import { Children, cloneElement, isValidElement, type ReactNode } from 'react';

const SUPER = '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ';
const SUB = '₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎';
const SUPER_BASE = '0123456789+−=()ni';
const SUB_BASE = '0123456789+−=()';

// Only known chemical formulas and unit exponents receive ASCII shorthand
// handling. Dates, citations, source IDs and arbitrary underscored text stay literal.
const SCIENTIFIC_TOKEN = /[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ]+|[₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎]+|\b(?:CO2|H2O)\b|\b(?:CO_(?:\{2\}|2)|H_(?:\{2\}|2)O)(?!\w)|\b(?:m|cm|mm|s|h|d|kg|g|mol|mmol|µmol|μmol|K|Pa|kPa|W|kW)\^(?:\{[+−-]?\d+\}|[+−-]?\d+)/g;

function baseline(text: string, alphabet: string, replacement: string) {
  return Array.from(text, (char) => replacement[alphabet.indexOf(char)] ?? char).join('');
}

function scientificParts(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let offset = 0;
  for (const match of text.matchAll(SCIENTIFIC_TOKEN)) {
    const index = match.index!;
    if (index > offset) parts.push(text.slice(offset, index));
    const token = match[0];
    if (SUPER.includes(token[0])) {
      parts.push(<sup key={index}>{baseline(token, SUPER, SUPER_BASE)}</sup>);
    } else if (SUB.includes(token[0])) {
      parts.push(<sub key={index}>{baseline(token, SUB, SUB_BASE)}</sub>);
    } else if (token.startsWith('CO') || token.startsWith('H')) {
      const carbon = token.startsWith('CO');
      parts.push(<span key={index}>{carbon ? 'CO' : 'H'}<sub>2</sub>{carbon ? '' : 'O'}</span>);
    } else {
      const [base, exponent] = token.split('^');
      parts.push(<span key={index}>{base}<sup>{exponent.replace(/[{}]/g, '').replace('-', '−')}</sup></span>);
    }
    offset = index + token.length;
  }
  if (offset < text.length) parts.push(text.slice(offset));
  return parts;
}

/** Semantic superscripts/subscripts with a stable baseline in labels and units. */
export default function ScientificText({ text, className = '' }: { text: string; className?: string }) {
  return <span className={`scientific-text ${className}`.trim()} aria-label={text}>{scientificParts(text)}</span>;
}

/** Preserve Markdown structure and code while formatting scientific prose. */
export function scientificChildren(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === 'string') return <ScientificText text={child} />;
    if (!isValidElement<{ children?: ReactNode; node?: { tagName?: string } }>(child)
      || child.type === 'code' || child.type === 'pre'
      // ReactMarkdown supplies custom components with the original HAST node;
      // their React type is a function, so a raw tag-name check is insufficient.
      || child.props.node?.tagName === 'code' || child.props.node?.tagName === 'pre') return child;
    return cloneElement(child, {}, scientificChildren(child.props.children));
  });
}
