import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

describe('ChatAssistant', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
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

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        // The reply renders as plain conversational markdown.
        expect(await screen.findByText(/Raising CO2 by 100 ppm should lift photosynthesis/)).toBeTruthy();
        // No structured model-effect cards, runtime strip, or source citations.
        expect(screen.queryByText('Model-calculated effect')).toBeNull();
        expect(screen.queryByText(/14d \+17\.493/)).toBeNull();
        expect(screen.queryByText(/Levers/)).toBeNull();
        expect(screen.queryByText(/전체 답변 보기|Show full answer/)).toBeNull();
    });
});
