import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ReactMarkdown from 'react-markdown';
import ScientificText, { scientificChildren } from './ScientificText';

describe('scientific labels and units', () => {
  it('renders dimensional exponents and chemical subscripts as semantic elements', () => {
    const { container } = render(<ScientificText text="mol H₂O m⁻² s⁻¹ · CO2 · W m^{-2}" />);
    expect(Array.from(container.querySelectorAll('sub'), (el) => el.textContent)).toEqual(['2', '2']);
    expect(Array.from(container.querySelectorAll('sup'), (el) => el.textContent)).toEqual(['−2', '−1', '−2']);
    expect(container.firstElementChild?.getAttribute('aria-label')).toBe('mol H₂O m⁻² s⁻¹ · CO2 · W m^{-2}');
  });

  it('preserves numbers, dates, source identifiers and unrecognized expressions', () => {
    const text = 'source_123 CO2_response H_2 2026-09-08 x^2 0.00 1e-3';
    const { container } = render(<ScientificText text={text} />);
    expect(container.textContent).toBe(text);
    expect(container.querySelector('sub,sup')).toBeNull();
  });

  it('formats nested prose without rewriting code or losing links', () => {
    const { container } = render(<div>{scientificChildren(<p>CO₂ <strong>m^-2</strong> <a href="#source_12">source_12</a> <code>H₂O m^-2</code></p>)}</div>);
    expect(container.querySelector('strong sup')?.textContent).toBe('−2');
    expect(container.querySelector('code')?.textContent).toBe('H₂O m^-2');
    expect(container.querySelector('code sub,code sup')).toBeNull();
    expect(container.querySelector('a')?.getAttribute('href')).toBe('#source_12');
  });

  it('preserves inline code through the actual Markdown custom-component shape', () => {
    const { container } = render(<ReactMarkdown components={{
      p: ({ children }) => <p>{scientificChildren(children)}</p>,
      code: ({ children }) => <code className="example-code">{children}</code>,
    }}>{'CO2 has a subscript; `H₂O m^-2` remains literal code.'}</ReactMarkdown>);
    expect(container.querySelector('p sub')?.textContent).toBe('2');
    expect(container.querySelector('code')?.textContent).toBe('H₂O m^-2');
    expect(container.querySelector('code sub,code sup')).toBeNull();
  });
});
