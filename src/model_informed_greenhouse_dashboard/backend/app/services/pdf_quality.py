"""PDF text extraction with an expected-language quality gate.

Two failures the council found here:

1. The two 農業技術大系 volumes (2,353 pages) ingested as 0.0%-Hangul glyph soup because
   pypdf could not resolve their Adobe-Japan1 CID fonts, which have no ToUnicode CMap.
2. The ingest suppressed the very pypdf "Advanced encoding … not implemented yet" warning
   and the `pypdf._cmap` logger — the one diagnostic that would have revealed it — and the
   catalog marked documents ready by page count alone, so a fully-built garbage index got
   atomically promoted with nothing to stop it.

This module fixes both. `pdfminer.six` (MIT) resolves the CID mapping from an external
table where pypdf cannot, so it extracts more Korean from the Korean guides and recovers
readable Japanese from the compendia. And `assess_extraction` measures the expected-language
character share so a document that extracts as garbage fails the gate instead of shipping.

The gate does not by itself decide what happens to a failing document — the caller does
(quarantine, OCR fallback, or block the build). It just makes the corruption *visible and
measurable* rather than silent.

Reference: docs/research/20260717-advisor-answer-quality-architecture/
"""

from __future__ import annotations

import logging
import re
import warnings
from dataclasses import dataclass
from pathlib import Path


logger = logging.getLogger(__name__)

#: Below this Hangul share (of letters) a Korean-expected document is treated as
#: unreadable. The healthy Korean guides sit at 60-84%; the CID-soup compendia at 0%.
_MIN_HANGUL_SHARE_KO = 0.20
_MIN_JAPANESE_SHARE_JA = 0.20

#: Replacement / private-use / control characters above this share signal a decode
#: failure regardless of language.
_MAX_JUNK_SHARE = 0.02

_HANGUL = re.compile(r"[가-힣]")
_JAPANESE = re.compile(r"[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]")
_LETTER = re.compile(r"[^\W\d_]", re.UNICODE)
_JUNK = re.compile(r"[�-\x00-\x08\x0e-\x1f]")


@dataclass(frozen=True)
class ExtractionAssessment:
    """The measured quality of an extracted document."""

    chars: int
    letters: int
    hangul_share: float
    junk_share: float
    expected_language: str
    passes: bool
    reason: str
    japanese_share: float = 0.0

    def to_dict(self) -> dict:
        return {
            "chars": self.chars,
            "letters": self.letters,
            "hangul_share": round(self.hangul_share, 4),
            "japanese_share": round(self.japanese_share, 4),
            "junk_share": round(self.junk_share, 4),
            "expected_language": self.expected_language,
            "passes": self.passes,
            "reason": self.reason,
        }


def extract_pdf_page_text(layout, *, reading_order: str = "default") -> str:
    """Keep source text intact while ordering the compendia's two-column pages.

    The opt-in layout requires two repeated, separated starts of prose-width
    boxes. Ambiguous layouts retain pdfminer's order. Spanning text separates
    vertical bands; diagram labels and table cells are not reconstructed.
    """
    from pdfminer.layout import LTTextContainer

    boxes = [element for element in layout if isinstance(element, LTTextContainer)]
    if reading_order == "default":
        return "".join(box.get_text() for box in boxes)
    if reading_order != "two_column_bands_v1":
        raise ValueError(f"unsupported PDF reading order: {reading_order}")

    # Repeated starts distinguish body columns from centered titles and labels.
    candidates = sorted(
        (box for box in boxes if 0.25 * layout.width <= box.width <= 0.5 * layout.width),
        key=lambda box: box.x0,
    )
    clusters: list[list] = []
    for box in candidates:
        if not clusters or box.x0 - clusters[-1][0].x0 > 0.04 * layout.width:
            clusters.append([])
        clusters[-1].append(box)
    columns = sorted(sorted(clusters, key=len, reverse=True)[:2], key=lambda group: group[0].x0)
    if len(columns) != 2 or min(map(len, columns)) < 3:
        return "".join(box.get_text() for box in boxes)
    if sum(map(len, columns)) < 0.75 * len(candidates):
        return "".join(box.get_text() for box in boxes)
    left_end = max(box.x1 for box in columns[0])
    right_start = min(box.x0 for box in columns[1])
    if not 0.01 * layout.width <= right_start - left_end <= 0.15 * layout.width:
        return "".join(box.get_text() for box in boxes)
    gutter = (left_end + right_start) / 2

    # These volumes place running heads and supplement footers outside the body.
    heads = [box for box in boxes if box.y0 >= layout.y0 + 0.91 * layout.height]
    feet = [box for box in boxes if box.y1 <= layout.y0 + 0.07 * layout.height]
    body = [box for box in boxes if box not in heads and box not in feet]
    spanning = sorted(
        (box for box in body if box.x0 < gutter < box.x1),
        key=lambda box: (-box.y1, box.x0),
    )
    pending = [box for box in body if box not in spanning]
    column_key = lambda box: (box.x0 >= gutter, -box.y1, box.x0)
    ordered = sorted(heads, key=lambda box: (-box.y1, box.x0))
    for span in spanning:
        # Include same-height marginal text before advancing to the next band.
        above = [box for box in pending if (box.y0 + box.y1) / 2 >= (span.y0 + span.y1) / 2 - 0.5]
        ordered.extend(sorted(above, key=column_key))
        pending = [box for box in pending if box not in above]
        ordered.append(span)
    ordered.extend(sorted(pending, key=column_key))
    ordered.extend(sorted(feet, key=lambda box: (-box.y1, box.x0)))
    return "".join(box.get_text() for box in ordered)


def extract_pdf_pages(path: Path, *, reading_order: str = "default") -> list[str]:
    """Per-page text via pdfminer.six, resolving CID fonts pypdf cannot.

    Returns one string per page, in order. Extraction warnings are surfaced (not
    suppressed): a document that warns is a document to look at.
    """
    from pdfminer.high_level import extract_pages
    from pdfminer.pdfparser import PDFSyntaxError

    # An empty or malformed file yields no pages rather than raising, so the caller
    # can distinguish "unreadable" (a quality result) from a hard crash. A real
    # 0-byte or truncated PDF then simply fails the gate on "no extractable letters".
    if not path.exists() or path.stat().st_size == 0:
        return []

    pages: list[str] = []
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("default")
            for layout in extract_pages(str(path)):
                pages.append(extract_pdf_page_text(layout, reading_order=reading_order))
    except (PDFSyntaxError, ValueError) as exc:
        logger.warning("pdfminer could not parse %s: %s", path.name, exc)
        return []
    return pages


def assess_extraction(text: str, *, expected_language: str = "ko") -> ExtractionAssessment:
    """Score extracted text against its expected language.

    `expected_language`:
      - "ko": Korean prose; requires a minimum Hangul share.
      - "ja": Japanese prose; requires a minimum kana/kanji share.
      - "any"/other: only the junk-character check applies (for structured or
        legitimately non-Korean documents).
    """
    chars = len(text)
    letters = len(_LETTER.findall(text))
    hangul = len(_HANGUL.findall(text))
    japanese = len(_JAPANESE.findall(text))
    junk = len(_JUNK.findall(text))
    hangul_share = (hangul / letters) if letters else 0.0
    japanese_share = (japanese / letters) if letters else 0.0
    junk_share = (junk / chars) if chars else 0.0

    if junk_share > _MAX_JUNK_SHARE:
        return ExtractionAssessment(
            chars, letters, hangul_share, junk_share, expected_language,
            passes=False,
            reason=f"junk-character share {junk_share:.3f} exceeds {_MAX_JUNK_SHARE}",
            japanese_share=japanese_share,
        )

    if letters == 0:
        return ExtractionAssessment(
            chars, letters, hangul_share, junk_share, expected_language,
            passes=False, reason="no extractable letters",
            japanese_share=japanese_share,
        )

    if expected_language == "ja" and japanese_share < _MIN_JAPANESE_SHARE_JA:
        return ExtractionAssessment(
            chars, letters, hangul_share, junk_share, expected_language,
            passes=False,
            reason=f"Japanese share {japanese_share:.3f} is below {_MIN_JAPANESE_SHARE_JA}",
            japanese_share=japanese_share,
        )

    if expected_language == "ko":
        if hangul_share < _MIN_HANGUL_SHARE_KO:
            return ExtractionAssessment(
                chars, letters, hangul_share, junk_share, expected_language,
                passes=False,
                reason=(
                    f"Hangul share {hangul_share:.3f} is below {_MIN_HANGUL_SHARE_KO} "
                    "for a Korean-expected document (likely a CID/encoding failure or a "
                    "non-Korean source)"
                ),
                japanese_share=japanese_share,
            )

    return ExtractionAssessment(
        chars, letters, hangul_share, junk_share, expected_language,
        passes=True, reason="ok",
        japanese_share=japanese_share,
    )


def assess_document(pages: list[str], *, expected_language: str = "ko") -> ExtractionAssessment:
    """Assess a whole document from its per-page text."""
    return assess_extraction("\n".join(pages), expected_language=expected_language)
