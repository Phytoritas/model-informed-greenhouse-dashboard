import type { CropType } from '../types';

export const UNIT_LABELS = {
    temperature: '°C',
    humidity: '%',
    carbonDioxide: 'ppm',
    photonFlux: 'µmol m⁻² s⁻¹',
    radiativeFlux: 'W m⁻²',
    vpd: 'kPa',
    stomatalConductance: 'mol H₂O m⁻² s⁻¹',
    transpirationRate: 'mm H₂O h⁻¹',
    transpirationDepth: 'mm H₂O',
    biomassGrowthRate: 'g m⁻² d⁻¹',
    biomassDensity: 'g m⁻²',
    leafAreaIndex: 'm² m⁻²',
    weeklyYield: 'kg',
    energyDemand: 'kW',
    energyUse: 'kWh',
} as const;

export const DASHBOARD_SENSOR_COPY = {
    temperature: { title: 'Air Temperature', unit: UNIT_LABELS.temperature },
    humidity: { title: 'Relative Humidity', unit: UNIT_LABELS.humidity },
    carbonDioxide: { title: 'CO₂ Concentration', unit: UNIT_LABELS.carbonDioxide },
    light: { title: 'Photosynthetic Photon Flux Density', unit: UNIT_LABELS.photonFlux },
    vpd: { title: 'Vapor Pressure Deficit', unit: UNIT_LABELS.vpd },
    stomatalConductance: { title: 'Stomatal Conductance', unit: UNIT_LABELS.stomatalConductance },
} as const;

export const IDEAL_RANGES: Record<CropType, Record<'temperature' | 'humidity' | 'light' | 'vpd', string>> = {
    Tomato: {
        temperature: '18-26 °C',
        humidity: '60-80 %',
        light: '> 600 µmol m⁻² s⁻¹',
        vpd: '0.5-1.2 kPa',
    },
    Cucumber: {
        temperature: '20-28 °C',
        humidity: '70-90 %',
        light: '> 600 µmol m⁻² s⁻¹',
        vpd: '0.5-1.2 kPa',
    },
};

export const getCropModelLabel = (crop: CropType): string =>
    crop === 'Tomato' ? 'Tomato digital twin' : 'Cucumber digital twin';

export const getCropStatusLabel = (crop: CropType): string =>
    crop === 'Tomato' ? 'Active trusses' : 'Node count';

export const getForecastTitle = (crop: CropType): string =>
    `7-day harvest and water forecast: ${crop}`;
