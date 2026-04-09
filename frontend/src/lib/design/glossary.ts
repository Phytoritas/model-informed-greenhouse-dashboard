export const phytoGlossary = {
    ko: {
        rtr: '빛 맞춤 온도',
        advisor: '재배 도움',
        assistant: '질문하기',
        knowledge: '자료 찾기',
        reviewState: '확인 상태',
        scenarioCompare: '조건별 비교',
        controlEffects: '조치 영향',
        setpoint: '목표값',
        resourceTracking: '자재·비용',
        alerts: '주의 알림',
    },
    en: {
        rtr: 'Light-linked temperature',
        advisor: 'Grower support',
        assistant: 'Ask',
        knowledge: 'Find materials',
        reviewState: 'Review state',
        scenarioCompare: 'Compare conditions',
        controlEffects: 'Control effects',
        setpoint: 'Target value',
        resourceTracking: 'Resources & cost',
        alerts: 'Alerts',
    },
} as const;

export type PhytoGlossaryLocale = keyof typeof phytoGlossary;
