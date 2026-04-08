import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import type { CropType, RtrAreaUnitMeta } from '../types';
import {
    DEFAULT_GREENHOUSE_AREA_M2,
    m2ToPyeong,
    pyeongToM2,
    roundArea,
} from '../utils/areaUnits';

const AREA_UNIT_STORAGE_KEY = 'smartgrow-dashboard-area-units-v1';

export interface CropAreaUnitState {
    canonicalAreaM2: number;
    actualAreaM2: number | null;
    actualAreaPyeong: number | null;
    source: 'default' | 'server' | 'local';
}

type AreaStateByCrop = Record<CropType, CropAreaUnitState>;

interface AreaUnitContextValue {
    areaByCrop: AreaStateByCrop;
    setActualAreaM2: (crop: CropType, value: number | null) => void;
    setActualAreaPyeong: (crop: CropType, value: number | null) => void;
    syncAreaMeta: (crop: CropType, areaMeta?: Partial<RtrAreaUnitMeta> | null) => void;
}

const DEFAULT_AREA_STATE: AreaStateByCrop = {
    Tomato: {
        canonicalAreaM2: DEFAULT_GREENHOUSE_AREA_M2,
        actualAreaM2: DEFAULT_GREENHOUSE_AREA_M2,
        actualAreaPyeong: roundArea(m2ToPyeong(DEFAULT_GREENHOUSE_AREA_M2), 2),
        source: 'default',
    },
    Cucumber: {
        canonicalAreaM2: DEFAULT_GREENHOUSE_AREA_M2,
        actualAreaM2: DEFAULT_GREENHOUSE_AREA_M2,
        actualAreaPyeong: roundArea(m2ToPyeong(DEFAULT_GREENHOUSE_AREA_M2), 2),
        source: 'default',
    },
};

const AreaUnitContext = createContext<AreaUnitContextValue | null>(null);

function isCropAreaUnitState(value: unknown): value is CropAreaUnitState {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Partial<CropAreaUnitState>;
    return typeof candidate.canonicalAreaM2 === 'number';
}

function resolveInitialAreaState(): AreaStateByCrop {
    if (typeof window === 'undefined') {
        return DEFAULT_AREA_STATE;
    }

    try {
        const raw = window.localStorage.getItem(AREA_UNIT_STORAGE_KEY);
        if (!raw) {
            return DEFAULT_AREA_STATE;
        }
        const parsed = JSON.parse(raw) as Partial<Record<CropType, CropAreaUnitState>>;
        return {
            Tomato: isCropAreaUnitState(parsed.Tomato) ? parsed.Tomato : DEFAULT_AREA_STATE.Tomato,
            Cucumber: isCropAreaUnitState(parsed.Cucumber) ? parsed.Cucumber : DEFAULT_AREA_STATE.Cucumber,
        };
    } catch {
        return DEFAULT_AREA_STATE;
    }
}

export const AreaUnitProvider = ({ children }: { children: ReactNode }) => {
    const [areaByCrop, setAreaByCrop] = useState<AreaStateByCrop>(resolveInitialAreaState);

    useEffect(() => {
        try {
            window.localStorage.setItem(AREA_UNIT_STORAGE_KEY, JSON.stringify(areaByCrop));
        } catch {
            // Ignore storage failures.
        }
    }, [areaByCrop]);

    const setActualAreaM2 = useCallback((crop: CropType, value: number | null) => {
        setAreaByCrop((prev) => {
            const nextActualAreaM2 = roundArea(value, 2);
            return {
                ...prev,
                [crop]: {
                    ...prev[crop],
                    actualAreaM2: nextActualAreaM2,
                    actualAreaPyeong: roundArea(m2ToPyeong(nextActualAreaM2), 2),
                    source: nextActualAreaM2 === null ? 'default' : 'local',
                },
            };
        });
    }, []);

    const setActualAreaPyeong = useCallback((crop: CropType, value: number | null) => {
        setAreaByCrop((prev) => {
            const nextActualAreaPyeong = roundArea(value, 2);
            return {
                ...prev,
                [crop]: {
                    ...prev[crop],
                    actualAreaPyeong: nextActualAreaPyeong,
                    actualAreaM2: roundArea(pyeongToM2(nextActualAreaPyeong), 2),
                    source: nextActualAreaPyeong === null ? 'default' : 'local',
                },
            };
        });
    }, []);

    const syncAreaMeta = useCallback((crop: CropType, areaMeta?: Partial<RtrAreaUnitMeta> | null) => {
        if (!areaMeta) {
            return;
        }

        setAreaByCrop((prev) => {
            const current = prev[crop];
            const nextCanonical = roundArea(areaMeta.greenhouse_area_m2, 2) ?? current.canonicalAreaM2;
            if (current.source === 'local') {
                return {
                    ...prev,
                    [crop]: {
                        ...current,
                        canonicalAreaM2: nextCanonical,
                    },
                };
            }

            const nextActualAreaM2 = roundArea(areaMeta.actual_area_m2, 2) ?? current.actualAreaM2;
            const nextActualAreaPyeong =
                roundArea(areaMeta.actual_area_pyeong, 2)
                ?? roundArea(m2ToPyeong(nextActualAreaM2), 2);

            return {
                ...prev,
                [crop]: {
                    canonicalAreaM2: nextCanonical,
                    actualAreaM2: nextActualAreaM2,
                    actualAreaPyeong: nextActualAreaPyeong,
                    source: 'server',
                },
            };
        });
    }, []);

    const value = useMemo(
        () => ({
            areaByCrop,
            setActualAreaM2,
            setActualAreaPyeong,
            syncAreaMeta,
        }),
        [areaByCrop, setActualAreaM2, setActualAreaPyeong, syncAreaMeta],
    );

    return <AreaUnitContext.Provider value={value}>{children}</AreaUnitContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export function useAreaUnit(): AreaUnitContextValue {
    const context = useContext(AreaUnitContext);
    if (!context) {
        throw new Error('useAreaUnit must be used within AreaUnitProvider.');
    }

    return context;
}
