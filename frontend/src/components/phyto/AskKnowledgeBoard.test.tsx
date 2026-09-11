import { StrictMode, useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AskKnowledgeBoard from './AskKnowledgeBoard';

describe('AskKnowledgeBoard', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('runs an inline knowledge search and renders the returned material', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                query_status: 'ok',
                query_mode: 'hybrid',
                returned_count: 1,
                resolved_scope: 'cucumber',
                results: [
                    {
                        // Retrieval scores are ranks, not calibrated probabilities.
                        score: 32,
                        source_locator: 'page:60',
                        text: 'Balance humidity control with powdery mildew rotation notes.',
                        topic_major: 'protection',
                        document: {
                            title: 'Powdery mildew notes',
                            filename: 'powdery.pdf',
                            relative_path: 'knowledge/powdery.pdf',
                            asset_family: 'pesticide_workbook',
                            source_type: 'pdf',
                            crop_scopes: ['cucumber'],
                        },
                    },
                ],
            }),
        });
        vi.stubGlobal('fetch', fetchMock);

        function Harness() {
            const [query, setQuery] = useState('');
            return (
                <AskKnowledgeBoard
                    locale="en"
                    crop="Cucumber"
                    cropLabel="Cucumber"
                    query={query}
                    onQueryChange={setQuery}
                    searchRequest={null}
                />
            );
        }

        render(<Harness />);

        fireEvent.change(
            screen.getByLabelText('Search Cucumber materials or type a question-shaped query'),
            { target: { value: 'powdery mildew rotation' } },
        );
        fireEvent.click(screen.getByRole('button', { name: 'Find materials' }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        expect(await screen.findByRole('button', { name: /Result 1/ })).toBeTruthy();
        expect(screen.getByRole('navigation', { name: 'Table of contents' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: /Page 1/ })).toBeNull();
        expect(screen.getAllByText('page:60').length).toBeGreaterThan(0);
        expect(screen.queryByText(/3200\s*%|32\s*%|Page 1/)).toBeNull();
        await screen.findAllByText('Powdery mildew notes');
        expect(screen.getAllByText('Powdery mildew notes').length).toBeGreaterThan(0);
        expect(screen.getByText(/Source location:/)).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Open full materials lane' })).toBeNull();

        fireEvent.change(
            screen.getByLabelText('Search Cucumber materials or type a question-shaped query'),
            { target: { value: 'cucumber cultivation method' } },
        );

        expect(screen.queryByText('Powdery mildew notes')).toBeNull();
        expect(screen.getByText('Enter a query and the related material will appear below in this page.')).toBeTruthy();
    });

    it.each([
        { query_status: 'database_missing' },
        { query_status: 'ok', database: { status: 'missing' } },
        { query_status: 'retrieval_unavailable' },
    ])('distinguishes unavailable retrieval from zero matches: %j', async (status) => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ ...status, returned_count: 0, results: [] }),
        }));
        render(<StrictMode><AskKnowledgeBoard locale="en" crop="Cucumber" cropLabel="Cucumber"
            query="powdery mildew" onQueryChange={vi.fn()}
            searchRequest={{ query: 'powdery mildew', nonce: 1 }} /></StrictMode>);

        expect(await screen.findByText('Reference search is unavailable. Please retry shortly.')).toBeTruthy();
        expect(screen.queryByText('No matching material was found. Try a more specific query.')).toBeNull();
    });

    it('leaves an autoRun=false seed idle until the user searches', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ query_status: 'ok', returned_count: 0, results: [] }),
        });
        vi.stubGlobal('fetch', fetchMock);
        render(<AskKnowledgeBoard locale="en" crop="Cucumber" cropLabel="Cucumber"
            query="powdery mildew" onQueryChange={vi.fn()}
            searchRequest={{ query: 'powdery mildew', nonce: 1, autoRun: false }} />);

        expect(fetchMock).not.toHaveBeenCalled();
        expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('powdery mildew');
        fireEvent.click(screen.getByRole('button', { name: 'Find materials' }));
        expect(await screen.findByText('No matching material was found. Try a more specific query.')).toBeTruthy();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toMatchObject({
            crop: 'cucumber', query: 'powdery mildew',
        });
    });

    it('clears the previous crop material without replaying an already handled search seed', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                query_status: 'ok', results: [{
                    score: 32, source_locator: 'page:60', text: 'Cucumber-specific rotation.',
                    document: { title: 'Cucumber guide', filename: 'cucumber.pdf',
                        relative_path: 'knowledge/cucumber.pdf', asset_family: 'manual',
                        source_type: 'pdf', crop_scopes: ['cucumber'] },
                }],
            }),
        });
        vi.stubGlobal('fetch', fetchMock);
        const props = { locale: 'en' as const, query: 'rotation', onQueryChange: vi.fn(),
            searchRequest: { query: 'rotation', nonce: 1 } };
        const { rerender } = render(<AskKnowledgeBoard {...props} crop="Cucumber" cropLabel="Cucumber" />);
        expect(await screen.findByText('Cucumber-specific rotation.')).toBeTruthy();

        rerender(<AskKnowledgeBoard {...props} crop="Tomato" cropLabel="Tomato" />);
        expect(screen.queryByText('Cucumber-specific rotation.')).toBeNull();
        expect(screen.queryByText('Cucumber guide')).toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
