import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatAssistant from './ChatAssistant';
import { LocaleProvider } from '../i18n/LocaleProvider';
import type { AdvancedModelMetrics, SensorData } from '../types';

const currentData: SensorData = {
    timestamp: 1_775_430_000_000,
    temperature: 25.8,
    canopyTemp: 26.7,
    humidity: 78,
    co2: 610,
    light: 340,
    soilMoisture: 54,
    vpd: 1.02,
    transpiration: 0.19,
    stomatalConductance: 0.24,
    photosynthesis: 12.8,
    hFlux: 42,
    leFlux: 95,
    energyUsage: 4.1,
};

const metrics: AdvancedModelMetrics = {
    cropType: 'Cucumber',
    growth: {
        lai: 3.1,
        biomass: 2950,
        developmentStage: 'fruiting',
        growthRate: 6.8,
    },
    yield: {
        predictedWeekly: 11.4,
        confidence: 0.82,
        harvestableFruits: 18,
    },
    energy: {
        consumption: 4.1,
        costPrediction: 920,
        efficiency: 0.76,
    },
};

/** Minimal ReadableStream double delivering the given chunks in order. */
function streamOf(chunks: Uint8Array[]) {
    let index = 0;
    return {
        getReader: () => ({
            read: async () => (index < chunks.length
                ? { done: false, value: chunks[index++] }
                : { done: true, value: undefined }),
            releaseLock: () => undefined,
        }),
    };
}

describe('ChatAssistant', () => {
    const storageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');

    beforeEach(() => {
        const storage = {
            getItem: vi.fn(() => 'en'), setItem: vi.fn(), removeItem: vi.fn(),
            clear: vi.fn(), key: vi.fn(() => null), length: 0,
        };
        vi.stubGlobal('localStorage', storage);
        Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
        if (storageDescriptor) Object.defineProperty(window, 'localStorage', storageDescriptor);
    });

    it('renders the chat reply as natural conversation text', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => JSON.stringify({
                text: 'Raising CO2 by 100 ppm should lift photosynthesis a little here, since light is plentiful. Just watch VPD.',
                machine_payload: {
                    // model_runtime may still be present internally, but must never
                    // surface as a card in the conversation.
                    model_runtime: {
                        status: 'ready',
                        summary: 'Process-model scenario is ready.',
                        answer_focus: {
                            matched_user_request: true,
                            effects: { yield_delta_14d: 17.493218 },
                        },
                    },
                },
            }),
        });
        vi.stubGlobal('fetch', fetchMock);

        render(
            <LocaleProvider>
                <ChatAssistant
                    layoutMode="inline"
                    currentData={currentData}
                    metrics={metrics}
                    crop="Cucumber"
                />
            </LocaleProvider>,
        );

        fireEvent.change(
            screen.getByPlaceholderText('Example: What happens if I raise CO2 by 100 ppm now?'),
            { target: { value: 'What happens if I raise CO2 by 100 ppm now?' } },
        );
        fireEvent.click(screen.getByRole('button', { name: 'Send question' }));

        // A submitted question issues one chat request.
        await waitFor(() => {
            const chatCalls = fetchMock.mock.calls.filter(
                (call) => String(call[0]).endsWith('/advisor/chat'),
            );
            expect(chatCalls.length).toBe(1);
        });
        // The reply renders as plain conversational markdown.
        const reply = await screen.findByLabelText(/Raising CO2 by 100 ppm should lift photosynthesis/);
        expect(reply.querySelector('sub')?.textContent).toBe('2');
        // Internal model payloads do not become conversation cards.
        expect(screen.queryByText('Model-calculated effect')).toBeNull();
        expect(screen.queryByText(/14d \+17\.493/)).toBeNull();
        expect(screen.queryByText(/Levers/)).toBeNull();
        expect(screen.queryByText(/전체 답변 보기|Show full answer/)).toBeNull();
    });

    it('keeps a follow-up as conversation and sends a chosen option once with its question', async () => {
        const answer = 'Humidity is high for this stage, so venting earlier is the first lever.';
        const question = 'Are the leaves wet right now?';
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({
                    text: answer,
                    follow_up: { question, options: ['Yes, wet', 'No, dry'] },
                    // Retrieval provenance must stay invisible in the conversation.
                    grounded_status: 'no_matches',
                    sources: [{ title: 'Cucumber crop guide', source_locator: 'page:60', document_id: 7, chunk_id: 18 }],
                }),
            })
            .mockResolvedValue({
                ok: true,
                text: async () => JSON.stringify({ text: 'Then hold venting and recheck in an hour.', follow_up: null }),
            });
        vi.stubGlobal('fetch', fetchMock);

        render(
            <LocaleProvider>
                <ChatAssistant layoutMode="inline" currentData={currentData} metrics={metrics} crop="Cucumber" />
            </LocaleProvider>,
        );

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Humidity keeps climbing at night.' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send question' }));

        // The question renders after the answer; retrieval metadata never appears.
        expect(await screen.findByLabelText(question)).toBeTruthy();
        expect(screen.queryByText('Retrieved sources')).toBeNull();
        expect(screen.queryByText('Cucumber crop guide · page:60')).toBeNull();
        expect(screen.queryByText(/No directly matching reference/)).toBeNull();

        // Free text stays available alongside the quick replies.
        expect(screen.getByPlaceholderText('Example: What happens if I raise CO2 by 100 ppm now?')).toBeTruthy();

        const option = screen.getByRole('button', { name: 'Yes, wet' });
        fireEvent.click(option);
        // A second click while the first request is in flight must not queue another turn.
        fireEvent.click(option);
        fireEvent.click(screen.getByRole('button', { name: 'Send question' }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
        expect(fetchMock).toHaveBeenCalledTimes(2);

        // The short choice reply carries the asked question both as the tail of
        // the answer turn and as reply_to, so a bare noun-phrase option is not
        // read as a standalone statement.
        expect(JSON.parse(String(fetchMock.mock.calls[1][1].body)).messages).toEqual([
            { role: 'user', content: 'Humidity keeps climbing at night.' },
            { role: 'assistant', content: `${answer}\n\n${question}` },
            { role: 'user', content: 'Yes, wet', reply_to: question },
        ]);
        // The option becomes an ordinary user turn exactly once.
        expect(screen.getAllByText('Yes, wet')).toHaveLength(1);
        // Answered quick replies retire once a newer turn exists.
        expect(screen.queryByRole('button', { name: 'No, dry' })).toBeNull();
    });

    it('streams the answer into the conversation and lets the final payload decide the turn', async () => {
        // The answer arrives split mid-line and mid-UTF-8: '해' is cut between chunks.
        const answerBytes = new TextEncoder().encode(
            `{"type":"status","phase":"retrieving"}\n{"type":"delta","text":"Vent earlier. `,
        );
        const koreanBytes = new TextEncoder().encode('해');
        const tailBytes = new TextEncoder().encode(
            `"}\n{"type":"delta","text":" Then recheck."}\n{"type":"done","response":{"text":"Vent earlier. 해 Then recheck.","follow_up":{"question":"Are the leaves wet?","options":["Yes"]},"timings":{"total_ms":812}}}\n`,
        );
        const chunks = [
            answerBytes,
            koreanBytes.slice(0, 2),
            new Uint8Array([...koreanBytes.slice(2), ...tailBytes]),
        ];
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            headers: { get: () => 'application/x-ndjson' },
            body: streamOf(chunks),
        });
        vi.stubGlobal('fetch', fetchMock);

        render(
            <LocaleProvider>
                <ChatAssistant layoutMode="inline" currentData={currentData} metrics={metrics} crop="Cucumber" />
            </LocaleProvider>,
        );

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Humidity is climbing.' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send question' }));

        // Quick replies exist only once the final payload is applied, so this
        // is the signal that the turn settled rather than a moment before it.
        expect(await screen.findByRole('button', { name: 'Yes' })).toBeTruthy();
        // The live bubble retires; the split multi-byte character survives.
        expect(screen.queryByTestId('assistant-streaming-message')).toBeNull();
        expect(screen.getByLabelText('Vent earlier. 해 Then recheck.')).toBeTruthy();
        // The request opted into streaming on the same endpoint.
        const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
        expect(body.stream).toBe(true);
        expect(String(fetchMock.mock.calls[0][0]).endsWith('/advisor/chat')).toBe(true);
        // Backend timings stay internal.
        expect(screen.queryByText(/812/)).toBeNull();
    });

    it('surfaces a stream error without leaving partial text as an answer', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            headers: { get: () => 'application/x-ndjson' },
            body: streamOf([new TextEncoder().encode(
                `{"type":"delta","text":"Partial thought"}\n{"type":"error","message":"The model connection dropped."}\n`,
            )]),
        });
        vi.stubGlobal('fetch', fetchMock);

        render(
            <LocaleProvider>
                <ChatAssistant layoutMode="inline" currentData={currentData} metrics={metrics} crop="Cucumber" />
            </LocaleProvider>,
        );

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Why is VPD dropping?' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send question' }));

        const alert = await screen.findByRole('alert');
        expect(alert.textContent).toContain('The model connection dropped.');
        // An interrupted answer is not kept as if it were complete.
        expect(screen.queryByTestId('assistant-streaming-message')).toBeNull();
        expect(screen.queryByLabelText(/Partial thought/)).toBeNull();
        expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    });

    it('drops a stream whose crop changed mid-answer', async () => {
        // Boxed so the assignment inside the executor is not narrowed away.
        const gateControl: { release: () => void } = { release: () => undefined };
        const gate = new Promise<void>((resolve) => { gateControl.release = resolve; });
        const encoder = new TextEncoder();
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            headers: { get: () => 'application/x-ndjson' },
            body: {
                getReader: () => {
                    let step = 0;
                    return {
                        read: async () => {
                            step += 1;
                            if (step === 1) {
                                return { done: false, value: encoder.encode('{"type":"delta","text":"Cucumber advice"}\n') };
                            }
                            if (step === 2) {
                                await gate;
                                return {
                                    done: false,
                                    value: encoder.encode('{"type":"done","response":{"text":"Cucumber advice complete."}}\n'),
                                };
                            }
                            return { done: true, value: undefined };
                        },
                        releaseLock: () => undefined,
                    };
                },
            },
        });
        vi.stubGlobal('fetch', fetchMock);

        const { rerender } = render(
            <LocaleProvider>
                <ChatAssistant layoutMode="inline" currentData={currentData} metrics={metrics} crop="Cucumber" />
            </LocaleProvider>,
        );

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'What should I check?' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send question' }));
        expect(await screen.findByTestId('assistant-streaming-message')).toBeTruthy();

        // Switching crop abandons the conversation the answer belonged to.
        rerender(
            <LocaleProvider>
                <ChatAssistant layoutMode="inline" currentData={currentData} metrics={metrics} crop="Tomato" />
            </LocaleProvider>,
        );
        await act(async () => { gateControl.release(); await Promise.resolve(); });

        await waitFor(() => expect(screen.queryByTestId('assistant-streaming-message')).toBeNull());
        expect(screen.queryByLabelText(/Cucumber advice complete./)).toBeNull();
        expect(screen.queryByText('What should I check?')).toBeNull();
    });

    it('does not start a background scenario request before a question is submitted', async () => {
        vi.useFakeTimers();
        try {
            const fetchMock = vi.fn().mockResolvedValue({
                ok: true,
                text: async () => JSON.stringify({ status: 'primed' }),
            });
            vi.stubGlobal('fetch', fetchMock);

            render(
                <LocaleProvider>
                    <ChatAssistant
                        layoutMode="inline"
                        currentData={currentData}
                        metrics={metrics}
                        crop="Cucumber"
                    />
                </LocaleProvider>,
            );

            // Advance beyond the old debounce to catch accidental priming.
            await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
            expect(fetchMock).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });
});
