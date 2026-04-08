import { describe, expect, it } from 'vitest';
import {
    DEFAULT_GREENHOUSE_AREA_M2,
    PYEONG_TO_M2,
    m2ToPyeong,
    parseAreaInput,
    pyeongToM2,
    roundArea,
} from './areaUnits';

describe('areaUnits', () => {
    it('converts between pyeong and square meters with deterministic rounding support', () => {
        expect(PYEONG_TO_M2).toBeCloseTo(3.305785, 6);
        expect(pyeongToM2(850)).toBeCloseTo(2809.91725, 5);
        expect(roundArea(pyeongToM2(850), 2)).toBe(2809.92);
        expect(roundArea(m2ToPyeong(2809.92), 2)).toBe(850);
        expect(roundArea(DEFAULT_GREENHOUSE_AREA_M2, 1)).toBe(3305.8);
    });

    it('treats empty, zero, and invalid values as absent area input', () => {
        expect(parseAreaInput('')).toBeNull();
        expect(parseAreaInput('   ')).toBeNull();
        expect(parseAreaInput('0')).toBeNull();
        expect(parseAreaInput('-5')).toBeNull();
        expect(parseAreaInput('abc')).toBeNull();
        expect(parseAreaInput('900')).toBe(900);
        expect(parseAreaInput('2975.21')).toBe(2975.21);
        expect(pyeongToM2(null)).toBeNull();
        expect(m2ToPyeong(undefined)).toBeNull();
        expect(roundArea(null)).toBeNull();
    });
});
