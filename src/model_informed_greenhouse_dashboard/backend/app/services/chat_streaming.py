"""Decode visible answer text and bridge synchronous generation to NDJSON."""
from __future__ import annotations

import asyncio
from contextlib import suppress
import json
import re
from threading import Event
from typing import Callable


def partial_answer(raw: str) -> str:
    """Decode only the leading JSON text string, holding incomplete escapes.

    The model writes text first. Other fields and incomplete JSON never reach UI.
    """
    match = re.match(r'^\s*(?:```json\s*)?\{\s*"text"\s*:\s*"', raw)
    if not match:
        return ""
    body = raw[match.end():]
    parts: list[str] = []
    index = 0
    escapes = {'"': '"', "\\": "\\", "/": "/", "n": "\n", "r": "\r", "t": "\t", "b": "\b", "f": "\f"}
    while index < len(body):
        char = body[index]
        if char == '"':
            break
        if char != "\\":
            parts.append(char)
            index += 1
            continue
        if index + 1 == len(body):
            break
        escape = body[index + 1]
        if escape in escapes:
            parts.append(escapes[escape])
            index += 2
        elif escape == "u":
            code = body[index + 2:index + 6]
            if len(code) < 4 or not re.fullmatch(r"[0-9a-fA-F]{4}", code):
                break
            value = int(code, 16)
            width = 6
            if 0xD800 <= value <= 0xDBFF:
                pair = body[index + 6:index + 12]
                if not re.fullmatch(r"\\u[dD][c-fC-F][0-9a-fA-F]{2}", pair):
                    break
                value = 0x10000 + ((value - 0xD800) << 10) + int(pair[2:], 16) - 0xDC00
                width = 12
            if 0xDC00 <= value <= 0xDFFF:
                break
            parts.append(chr(value))
            index += width
        else:
            break
    text = "".join(parts).lstrip()
    # Withhold a possible citation as soon as '[' arrives. Its optional link may
    # itself span many events, so a fixed character delay is insufficient.
    marker = r"\[\s*S\d+(?:\s*[,;]\s*S\d+)*\s*\]"
    text = re.sub(rf"[ \t]*{marker}(?:\(https?://[^\n)]*\))?", "", text)
    # Re-evaluate from the original string to avoid exposing a partial link.
    original = "".join(parts).lstrip()
    pending = re.search(rf"[ \t]*{marker}(?:\([^)]*)?$", original)
    if pending:
        text = re.sub(rf"[ \t]*{marker}(?:\(https?://[^\n)]*\))?", "", original[:pending.start()])
    open_bracket = text.rfind("[")
    if open_bracket >= 0 and re.fullmatch(r"\[\s*(?:S[\d\s,;S]*)?", text[open_bracket:]):
        text = text[:open_bracket].rstrip(" \t")
    return text.rstrip()


def stream_model_text(*, client, options: dict, on_text: Callable[[str], None]) -> str:
    raw = ""
    emitted = ""
    completed = False
    with client.responses.create(**options, stream=True) as stream:
        for event in stream:
            kind = getattr(event, "type", "")
            if kind == "response.output_text.delta":
                raw += event.delta
                visible = partial_answer(raw)
                if visible.startswith(emitted) and len(visible) > len(emitted):
                    on_text(visible[len(emitted):])
                    emitted = visible
            elif kind == "response.completed":
                completed = True
            elif kind in {"error", "response.failed", "response.incomplete"}:
                raise RuntimeError("Chat generation did not complete.")
    if not completed:
        raise RuntimeError("Chat stream ended before completion.")
    if not raw.strip():
        raise ValueError("AI response did not include text output.")
    return raw


async def chat_event_stream(build_response: Callable, *, kwargs: dict):
    """One worker/model call; cancellation closes its stream on the next delta."""
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()
    cancelled = Event()

    def emit(event: dict):
        if cancelled.is_set():
            raise RuntimeError("Chat request cancelled.")
        loop.call_soon_threadsafe(queue.put_nowait, event)

    async def run():
        try:
            response = await asyncio.to_thread(build_response, **kwargs, on_event=emit)
            await queue.put({"type": "done", "response": response})
        except Exception:
            if not cancelled.is_set():
                message = "답변을 완료하지 못했습니다. 다시 시도해 주세요." if kwargs.get("language", "ko").startswith("ko") else "The answer could not be completed. Please try again."
                await queue.put({"type": "error", "message": message})

    worker = asyncio.create_task(run())
    try:
        yield json.dumps({"type": "status", "phase": "retrieving"}) + "\n"
        while True:
            event = await queue.get()
            yield json.dumps(event, ensure_ascii=False, allow_nan=False) + "\n"
            if event["type"] in {"done", "error"}:
                break
    finally:
        cancelled.set()
        worker.cancel()
        with suppress(asyncio.CancelledError):
            await worker
