import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AdvancedModelMetrics, SensorData } from '../../types';

vi.mock('../ChatAssistant', () => ({
    default: ({ layoutMode }: { layoutMode?: string }) => (
        <div>{`ChatAssistant:${layoutMode ?? 'drawer'}`}</div>
    ),
}));

vi.mock('./AskKnowledgeBoard', () => ({
    default: ({ query }: { query: string }) => (
        <div>{`AskKnowledgeBoard:${query || 'empty'}`}</div>
    ),
}));

import AskSearchPage from './AskSearchPage';

const baseProps = {
    locale: 'en' as const,
    crop: 'Cucumber' as const,
    cropLabel: 'Cucumber',
    summary: {
        cropKey: 'cucumber',
        surfaces: [],
        advisorySurfaceNames: ['Nutrient', 'Protection'],
        pendingParsers: ['pdf'],
        pesticideReady: true,
        nutrientReady: true,
        nutrientCorrectionReady: false,
        nutrientCorrectionDraftMode: null,
        nutrientCorrectionLimitation: null,
    },
    currentData: {
        timestamp: Date.now(),
        temperature: 22.4,
        humidity: 67,
        co2: 540,
        light: 410,
        vpd: 1.12,
        stomatalConductance: 0.34,
        photosynthesis: 16.8,
        fieldAvailability: {
            temperature: true,
            humidity: true,
            co2: true,
            light: true,
            vpd: true,
            stomatalConductance: true,
        },
    } as unknown as SensorData,
    metrics: {
        energy: { consumption: 12.4, efficiency: 3.18 },
        growth: { lai: 3.2, developmentStage: 'vegetative' },
        yield: { predictedWeekly: 126.5 },
    } as unknown as AdvancedModelMetrics,
    onOpenSearch: vi.fn(),
};

describe('AskSearchPage', () => {
    it('renders the inline chat surface by default', () => {
        render(<AskSearchPage {...baseProps} />);

        expect(screen.getByText('ChatAssistant:inline')).toBeTruthy();
        expect(screen.queryByText(/AskKnowledgeBoard:/)).toBeNull();
    });

    it('renders the inline knowledge board and hydrates a seeded search query', async () => {
        render(
            <AskSearchPage
                {...baseProps}
                activePanel="assistant-search"
                searchRequest={{ query: 'powdery mildew rotation', nonce: 1 }}
            />,
        );

        expect(await screen.findByText('AskKnowledgeBoard:powdery mildew rotation')).toBeTruthy();
        expect(screen.queryByText('ChatAssistant:inline')).toBeNull();
    });

    it('maps legacy history panel to the search surface', () => {
        render(
            <AskSearchPage
                {...baseProps}
                activePanel="assistant-history"
            />,
        );

        expect(screen.getByText('AskKnowledgeBoard:empty')).toBeTruthy();
        expect(screen.queryByText('ChatAssistant:inline')).toBeNull();
    });
});
