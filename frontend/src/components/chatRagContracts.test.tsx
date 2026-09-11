import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatAssistant from './ChatAssistant';
import AskSearchPage from './phyto/AskSearchPage';
import { LocaleProvider } from '../i18n/LocaleProvider';
import type { AdvancedModelMetrics, CropType, SensorData } from '../types';

// Exercise the real components, request construction and recent-summary builder.
// Only the HTTP boundary and browser storage are replaced.
const currentData: SensorData = {
    timestamp: 1_775_430_000_000, temperature: 25.8, canopyTemp: 26.7,
    humidity: 78, co2: 610, light: 340, soilMoisture: 54, vpd: 1.02,
    transpiration: 0.19, stomatalConductance: 0.24, photosynthesis: 12.8,
    hFlux: 42, leFlux: 95, energyUsage: 4.1,
};
const metrics: AdvancedModelMetrics = {
    cropType: 'Cucumber',
    growth: { lai: 3.1, biomass: 2950, developmentStage: 'fruiting', growthRate: 6.8 },
    yield: { predictedWeekly: 11.4, confidence: 0.82, harvestableFruits: 18 },
    energy: { consumption: 4.1, costPrediction: 920, efficiency: 0.76 },
};
const question = 'How should I manage cucumber humidity?';
const reply = 'Check ventilation and consult the crop guide.';
const greeting = 'Hello. I can explain the current greenhouse state and turn it into immediate actions.';

function response(payload: object, ok = true) {
    return { ok, text: async () => JSON.stringify(payload) };
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => { resolve = done; });
    return { promise, resolve };
}

function chat(crop: CropType = 'Cucumber', data = currentData, history: SensorData[] = []) {
    return <LocaleProvider><ChatAssistant layoutMode="inline" crop={crop}
        currentData={data} metrics={{ ...metrics, cropType: crop }} history={history} /></LocaleProvider>;
}

function send(text: string) {
    fireEvent.change(screen.getByRole('textbox'), { target: { value: text } });
    fireEvent.click(screen.getByRole('button', { name: 'Send question' }));
}

describe('live chat and retrieval caller contracts', () => {
    const storageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');

    beforeEach(() => {
        // Node 25 and jsdom may expose different localStorage objects.
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

    it('sends only the user question initially and keeps returned source metadata internal', async () => {
        const fetchMock = vi.fn().mockResolvedValue(response({
            text: reply, status: 'ok', grounded_status: 'ready',
            sources: [{ title: 'Cucumber crop guide', source_locator: 'page:60', document_id: 7, chunk_id: 18 }],
        }));
        vi.stubGlobal('fetch', fetchMock);
        render(chat());
        expect(screen.getByText(greeting)).toBeTruthy();
        send(question);

        expect(await screen.findByText(reply)).toBeTruthy();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/advisor\/chat$/);
        expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toMatchObject({
            crop: 'cucumber', language: 'en', messages: [{ role: 'user', content: question }],
        });
        expect(screen.queryByText('Retrieved sources')).toBeNull();
        expect(screen.queryByText('Cucumber crop guide · page:60')).toBeNull();
        expect(screen.queryByText(/Page 1/)).toBeNull();
    });

    it.each(['rejected', 'http-error', 'degraded'] as const)(
        'keeps a %s response out of history and retries without duplicating the user turn', async (failureKind) => {
            const failureText = 'Reference service temporarily unavailable.';
            const fetchMock = vi.fn();
            if (failureKind === 'rejected') fetchMock.mockRejectedValueOnce(new Error(failureText));
            else fetchMock.mockResolvedValueOnce(response({ text: failureText,
                status: failureKind === 'degraded' ? 'degraded' : 'error' }, failureKind !== 'http-error'));
            fetchMock.mockResolvedValue(response({ text: reply, status: 'ok' }));
            vi.stubGlobal('fetch', fetchMock);
            render(chat());
            send(question);

            expect((await screen.findByRole('alert')).textContent).toContain(failureText);
            fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
            expect(await screen.findByText(reply)).toBeTruthy();
            expect(fetchMock).toHaveBeenCalledTimes(2);
            for (const call of fetchMock.mock.calls) {
                expect(JSON.parse(String(call[1].body)).messages).toEqual([{ role: 'user', content: question }]);
            }
            expect(screen.getAllByText(question)).toHaveLength(1);
            expect(screen.queryByRole('alert')).toBeNull();
            expect(screen.queryByText(failureText)).toBeNull();

            const followUp = 'Which observation should I record next?';
            send(followUp);
            await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
            expect(fetchMock).toHaveBeenCalledTimes(3);
            expect(JSON.parse(String(fetchMock.mock.calls[2][1].body)).messages).toEqual([
                { role: 'user', content: question },
                { role: 'assistant', content: reply },
                { role: 'user', content: followUp },
            ]);
        },
    );

    it('aborts an old crop request and ignores its late response during the new crop conversation', async () => {
        const oldRequest = deferred<ReturnType<typeof response>>();
        const newRequest = deferred<ReturnType<typeof response>>();
        const fetchMock = vi.fn().mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(newRequest.promise);
        vi.stubGlobal('fetch', fetchMock);
        const { rerender } = render(chat());
        send(question);
        const oldSignal = fetchMock.mock.calls[0][1].signal as AbortSignal;

        rerender(chat('Tomato'));
        expect(oldSignal.aborted).toBe(true);
        expect(screen.queryByText(question)).toBeNull();
        const tomatoQuestion = 'How should I manage tomato humidity?';
        send(tomatoQuestion);
        expect(JSON.parse(String(fetchMock.mock.calls[1][1].body))).toMatchObject({
            crop: 'tomato', messages: [{ role: 'user', content: tomatoQuestion }],
        });

        // Simulate a transport that resolves despite cancellation.
        await act(async () => { oldRequest.resolve(response({ text: 'Obsolete cucumber answer.' })); });
        expect(screen.queryByText('Obsolete cucumber answer.')).toBeNull();
        expect(screen.getByRole('status')).toBeTruthy();
        expect((screen.getByRole('button', { name: 'Send question' }) as HTMLButtonElement).disabled).toBe(true);

        await act(async () => { newRequest.resolve(response({ text: 'Current tomato answer.' })); });
        expect(await screen.findByText('Current tomato answer.')).toBeTruthy();
        expect(screen.queryByRole('status')).toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('preserves the live chat across chat/search/chat without resending a consumed nonce', async () => {
        const fetchMock = vi.fn().mockResolvedValue(response({ text: reply }));
        vi.stubGlobal('fetch', fetchMock);
        const page = (activePanel: 'assistant-chat' | 'assistant-search') => (
            <StrictMode><LocaleProvider><AskSearchPage locale="en" crop="Cucumber" cropLabel="Cucumber"
                summary={null} currentData={currentData} metrics={metrics} activePanel={activePanel}
                chatRequest={{ query: question, nonce: 41 }} onOpenSearch={vi.fn()} /></LocaleProvider></StrictMode>
        );
        const { rerender } = render(page('assistant-chat'));
        expect(await screen.findByText(reply)).toBeTruthy();
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Unsent follow-up' } });

        rerender(page('assistant-search'));
        expect(screen.queryByRole('button', { name: 'Send question' })).toBeNull();
        rerender(page('assistant-chat'));
        expect(await screen.findByText(reply)).toBeTruthy();
        expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Unsent follow-up');
        expect(screen.getAllByText(question)).toHaveLength(1);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it.each(['current snapshot', 'history'] as const)(
        'excludes unavailable photosynthesis=12.8 from the outgoing recentSummary using %s', async (source) => {
            const missing = { ...currentData, fieldAvailability: { photosynthesis: false, temperature: true } };
            const fetchMock = vi.fn().mockResolvedValue(response({ text: reply }));
            vi.stubGlobal('fetch', fetchMock);
            render(chat('Cucumber', missing, source === 'history' ? [
                { ...missing, timestamp: missing.timestamp - 60_000 }, missing,
            ] : []));
            send(question);
            expect(await screen.findByText(reply)).toBeTruthy();
            const dashboard = JSON.parse(String(fetchMock.mock.calls[0][1].body)).dashboard;
            expect(dashboard.data.photosynthesis).toBeNull();
            expect(dashboard.recentSummary.variables).not.toHaveProperty('photosynthesis');
            // Positive control: excluding a missing field must not drop valid observations.
            expect(dashboard.recentSummary.variables.temperature.mean).toBe(25.8);
            expect(dashboard.recentSummary.n).toBe(source === 'history' ? 2 : 1);
        },
    );
});
