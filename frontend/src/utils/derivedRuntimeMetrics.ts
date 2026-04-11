import type { AdvancedModelMetrics, CropType, SensorData } from '../types';

type DeriveSourceSinkBalanceArgs = {
  crop: CropType;
  currentData: SensorData;
  metrics: AdvancedModelMetrics;
};

function coerceNumber(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

/**
 * Mirrors backend dashboard runtime snapshot heuristics so the UI can still show
 * a meaningful source/sink balance when model_runtime payload is unavailable.
 */
export function deriveSourceSinkBalance({
  crop,
  currentData,
  metrics,
}: DeriveSourceSinkBalanceArgs): number {
  const photosynthesis = Math.max(0, coerceNumber(currentData.photosynthesis) ?? 0);
  const sourceCapacity = Math.max(photosynthesis * 1.24, photosynthesis);

  const predictedWeeklyYield = coerceNumber(metrics.yield.predictedWeekly);
  const harvestableFruits = coerceNumber(metrics.yield.harvestableFruits);
  const activeTrusses = coerceNumber(metrics.growth.activeTrusses);
  const nodeCount = coerceNumber(metrics.growth.nodeCount);

  let fruitLoad: number | null = harvestableFruits;
  if (fruitLoad === null) {
    if (crop === 'Tomato' && activeTrusses !== null) {
      fruitLoad = activeTrusses * 4.0;
    } else if (crop === 'Cucumber' && nodeCount !== null) {
      fruitLoad = nodeCount * 0.55;
    } else if (predictedWeeklyYield !== null) {
      fruitLoad = Math.max(8.0, predictedWeeklyYield * (crop === 'Tomato' ? 1.4 : 1.9));
    }
  }

  if (fruitLoad === null) {
    fruitLoad = crop === 'Tomato' ? 10.0 : 12.0;
  }

  const sinkDemand = crop === 'Tomato'
    ? ((fruitLoad * 0.18) + ((activeTrusses ?? 0) * 0.32) + ((predictedWeeklyYield ?? 0) * 0.24))
    : ((fruitLoad * 0.22) + ((nodeCount ?? 0) * 0.12) + ((predictedWeeklyYield ?? 0) * 0.2));

  if (sourceCapacity === 0 && sinkDemand === 0) {
    return 0;
  }

  return (sourceCapacity - sinkDemand) / Math.max(1, Math.abs(sourceCapacity) + Math.abs(sinkDemand));
}
