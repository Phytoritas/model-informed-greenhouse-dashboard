export type RagAssistantPresetKey =
    | 'general'
    | 'environment'
    | 'physiology'
    | 'pesticide'
    | 'nutrient';

export interface RagAssistantOpenRequest {
    nonce: number;
    preset?: RagAssistantPresetKey;
    query?: string;
    autoRun?: boolean;
    source?: 'advisor' | 'assistant' | 'dashboard';
}
