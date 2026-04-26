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
        expect(screen.getByRole('navigation', { name: 'Table of contents' })).toBeTruthy();
        expect(screen.getByRole('button', { name: /Page 1/ })).toBeTruthy();
        await screen.findAllByText('Powdery mildew notes');
        expect(screen.getAllByText('Powdery mildew notes').length).toBeGreaterThan(0);
        expect(screen.getByText(/Source location:/)).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Open full materials lane' })).toBeNull();
    });
});
