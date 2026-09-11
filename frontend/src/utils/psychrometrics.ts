import type { SensorData } from '../types';

export const STANDARD_PRESSURE_KPA = 101.325;

export interface PsychrometricState {
  temperatureC: number;
  relativeHumidityPercent: number;
  vaporPressureKPa: number;
  vpdKPa: number;
  humidityRatioGKg: number;
  enthalpyKJkg: number;
  dewPointC: number | null;
}

/** Over-water Tetens relation used by the crop runtime; greenhouse range only.
 * FAO-56, chapter 3, equations 11 and 17:
 * https://www.fao.org/4/x0490e/x0490e07.htm
 */
export function saturationVaporPressureKPa(temperatureC: number): number | null {
  if (!Number.isFinite(temperatureC) || temperatureC < 0 || temperatureC > 50) return null;
  return 0.6108 * Math.exp(17.27 * temperatureC / (temperatureC + 237.3));
}

/** Humidity ratio and enthalpy per kg DRY air, not per kg moist air.
 * Vaisala HMT330, Humidity Conversion Formulas (x in g/kg, T in °C):
 * https://docs.vaisala.com/r/M210912EN-J/en-US/GUID-8F8C9ECE-FFD9-4F6F-9F11-D94CF9122735
 * Total pressure defaults to a disclosed standard-atmosphere assumption.
 */
export function calculatePsychrometrics(
  temperatureC: number,
  relativeHumidityPercent: number,
  pressureKPa = STANDARD_PRESSURE_KPA,
): PsychrometricState | null {
  const saturation = saturationVaporPressureKPa(temperatureC);
  if (saturation === null || !Number.isFinite(relativeHumidityPercent)
    || relativeHumidityPercent < 0 || relativeHumidityPercent > 100
    || !Number.isFinite(pressureKPa) || pressureKPa <= 0) return null;
  const vaporPressureKPa = saturation * relativeHumidityPercent / 100;
  if (vaporPressureKPa >= pressureKPa) return null;
  const humidityRatioGKg = 621.99 * vaporPressureKPa / (pressureKPa - vaporPressureKPa);
  const alpha = vaporPressureKPa > 0 ? Math.log(vaporPressureKPa / 0.6108) : null;
  return {
    temperatureC,
    relativeHumidityPercent,
    vaporPressureKPa,
    vpdKPa: saturation - vaporPressureKPa,
    humidityRatioGKg,
    enthalpyKJkg: temperatureC * (1.01 + 0.00189 * humidityRatioGKg) + 2.5 * humidityRatioGKg,
    // At RH=0 there is no finite dew point. Below 0 this is a liquid-water
    // dew-point estimate, not an ice/frost-point calculation.
    dewPointC: alpha === null ? null : 237.3 * alpha / (17.27 - alpha),
  };
}

/** Select the actual last frame at/before replay time, including missing frames.
 * Never substitute an earlier valid observation for an invalid selected frame.
 */
export function selectPsychrometricFrame(history: SensorData[], timestamp: number | null): SensorData | null {
  const end = timestamp === null ? Infinity : timestamp;
  let selected: SensorData | null = null;
  for (const frame of history) {
    if (Number.isFinite(frame.timestamp) && frame.timestamp <= end
      && (!selected || frame.timestamp >= selected.timestamp)) selected = frame;
  }
  return selected;
}

export function psychrometricsFromFrame(frame: SensorData | null): PsychrometricState | null {
  if (!frame || frame.fieldAvailability?.temperature === false
    || frame.fieldAvailability?.humidity === false || frame.dataQuality?.status === 'invalid'
    || ['failed', 'unconverged', 'invalid_input', 'error'].some(
      (flag) => frame.simulationStatus?.toLowerCase().includes(flag),
    )) return null;
  return calculatePsychrometrics(frame.temperature, frame.humidity);
}
