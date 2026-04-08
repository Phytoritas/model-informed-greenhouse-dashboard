import { useCallback, useRef } from 'react';
import type { ProfilerOnRenderCallback } from 'react';

export function useDashboardPerfMetrics(id: string): ProfilerOnRenderCallback {
    const renderCountRef = useRef(0);

    return useCallback<ProfilerOnRenderCallback>((profilerId, phase, actualDuration) => {
        if (!import.meta.env.DEV) {
            return;
        }

        renderCountRef.current += 1;
        const roundedDuration = Math.round(actualDuration * 100) / 100;
        console.debug(
            `[perf:${id}] profiler=${profilerId} phase=${phase} renderCount=${renderCountRef.current} durationMs=${roundedDuration}`,
        );
    }, [id]);
}
