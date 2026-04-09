import { useState } from 'react';
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
                        score: 0.91,
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
        const onOpenSearch = vi.fn();

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
                    onOpenSearch={onOpenSearch}
                />
            );
        }

        render(<Harness />);

        fireEvent.change(
            screen.getByLabelText('Search Cucumber materials or type a question-shaped query'),
            { target: { value: 'powdery mildew rotation' } },
        );
        fireEvent.click(screen.getByRole('button', { name: 'Search in this page' }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        expect(await screen.findByText('Powdery mildew notes')).toBeTruthy();
        expect(screen.getByText(/Source location:/)).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Open full materials lane' }));
        expect(onOpenSearch).toHaveBeenCalledTimes(1);
    });
});
