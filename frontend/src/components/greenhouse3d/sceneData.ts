import type { AdvancedModelMetrics, CropType, SensorData, SensorFieldKey } from '../../types';
import { clamp, type Bounds, type SiteLocation, type Vec3 } from './sceneMath';

export type SceneLayer = 'growth' | 'sensors' | 'temperature' | 'humidity' | 'airflow';
export type SceneView = 'whole' | 'plant';
export interface BufferRange { byteOffset: number; length: number }
export interface ScenePart { start: number; count: number; center: Vec3; sourceId?: string }
export interface SceneBatch {
  target: 'facility' | 'tomatoDetail' | 'tomatoRows';
  group: string;
  sidedness: 'ONE_SIDED' | 'TWO_SIDED';
  vertices: BufferRange;
  indices: BufferRange;
  lines: BufferRange;
  parts: ScenePart[];
}
export interface SceneAsset {
  version: number;
  coordinateSystem: 'WorldENU';
  units: 'm';
  facilityBounds: Bounds;
  plantBounds: Bounds;
  plantOrigin: Vec3;
  site: SiteLocation;
  batches: SceneBatch[];
}
export interface LoadedScene { manifest: SceneAsset; binary: ArrayBuffer }
export interface SceneSnapshot {
  crop: CropType;
  data: SensorData;
  metrics: AdvancedModelMetrics;
  layer: SceneLayer;
  view: SceneView;
  showInset: boolean;
}

export async function loadScene(signal: AbortSignal): Promise<LoadedScene> {
  const base = `${import.meta.env.BASE_URL}greenhouse3d/`;
  const [metadataResponse, binaryResponse] = await Promise.all([
    fetch(`${base}knu-scene.json`, { signal }), fetch(`${base}knu-scene.bin`, { signal }),
  ]);
  if (!metadataResponse.ok || !binaryResponse.ok) throw new Error('온실 형상 파일을 불러오지 못했습니다.');
  const manifest = await metadataResponse.json() as SceneAsset;
  const binary = await binaryResponse.arrayBuffer();
  if (manifest.version !== 1 || manifest.coordinateSystem !== 'WorldENU' || manifest.units !== 'm'
    || !Array.isArray(manifest.batches) || !manifest.batches.length) throw new Error('온실 형상 파일을 읽을 수 없습니다.');
  for (const batch of manifest.batches) {
    for (const range of [batch.vertices, batch.indices, batch.lines]) {
      if (!Number.isInteger(range.byteOffset) || !Number.isInteger(range.length)
        || range.byteOffset < 0 || range.byteOffset % 4 !== 0 || range.length < 0
        || range.byteOffset + range.length * 4 > binary.byteLength) throw new Error('온실 형상 파일이 완전하지 않습니다.');
    }
  }
  return { manifest, binary };
}

export function snapshotUsable(data: SensorData) {
  return data.dataQuality?.status !== 'invalid'
    && !/(fail|invalid|unconverg|error|diverg|not[_ -]?converg)/i.test(data.simulationStatus ?? '');
}

export function available(data: SensorData, field: SensorFieldKey) {
  return Number.isFinite(data.timestamp) && data.timestamp > 0
    && snapshotUsable(data) && data.fieldAvailability?.[field] !== false && Number.isFinite(data[field]);
}

export function growthDisplay(metrics: AdvancedModelMetrics, crop: CropType, data?: SensorData) {
  const { lai, biomass, nodeCount } = metrics.growth;
  const cropMatches = metrics.cropType === crop && (!data || snapshotUsable(data) && Number.isFinite(data.timestamp) && data.timestamp > 0);
  const hasLai = cropMatches && Number.isFinite(lai) && lai >= 0;
  const hasBiomass = cropMatches && Number.isFinite(biomass) && biomass >= 0;
  const hasNodes = cropMatches && typeof nodeCount === 'number' && Number.isFinite(nodeCount) && nodeCount >= 0;
  const present = hasLai || hasBiomass || hasNodes;
  const visible = (hasLai && lai > 0) || (hasBiomass && biomass > 0) || (hasNodes && nodeCount > 0);
  // Display transfer only: bounded size/leaf spread, not reconstructed plant growth.
  const height = clamp(.65 + (hasLai ? Math.sqrt(clamp(lai / 3, 0, 2)) * .48 : 0)
    + (hasNodes ? clamp(nodeCount / 24, 0, 1.5) * .2 : 0)
    + (hasBiomass ? clamp(Math.log1p(biomass) / Math.log(501), 0, 1.5) * .1 : 0), .65, 1.7);
  const width = hasLai ? clamp(Math.sqrt(lai / 3), .4, 1.4) : .8;
  return { present, visible, scale: [width, width, height] as Vec3 };
}
