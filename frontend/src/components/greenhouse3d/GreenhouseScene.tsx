import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Box, Droplets, Expand, Leaf, MapPin, Minus, Moon, Plus, RotateCcw, Sprout, Sun, Thermometer, Wind, X } from 'lucide-react';
import type { AdvancedModelMetrics, CropType, SensorData } from '../../types';
import { Button } from '../ui/button';
import { GreenhouseRenderer, type SceneProjection } from './GreenhouseRenderer';
import { available, growthDisplay, loadScene, snapshotUsable, type SceneLayer, type SceneSnapshot, type SceneView } from './sceneData';
import type { SiteLocation } from './sceneMath';
import './greenhouse-scene.css';

export interface GreenhouseSceneProps {
  crop: CropType;
  currentData: SensorData;
  metrics: AdvancedModelMetrics;
  /** Parent owns the shared replay controls and selects a paired data/metrics snapshot. */
  history?: SensorData[];
  selectedTimestamp?: number | null;
  onTimestampChange?: (timestamp: number | null) => void;
}

const layers = [
  { id: 'growth', label: '생육', Icon: Leaf },
  { id: 'sensors', label: '센서', Icon: MapPin },
  { id: 'temperature', label: '온도', Icon: Thermometer },
  { id: 'humidity', label: '습도', Icon: Droplets },
  { id: 'airflow', label: '기류', Icon: Wind },
] as const;
const sensorNames = ['재배 구역', '군락 상부', '재배 구역 안쪽'];

export default function GreenhouseScene({ crop, currentData, metrics }: GreenhouseSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<GreenhouseRenderer | null>(null);
  const [layer, setLayer] = useState<SceneLayer>('airflow');
  const [view, setView] = useState<SceneView>('whole');
  const [showInset, setShowInset] = useState(true);
  const [selectedSensor, setSelectedSensor] = useState<number | null>(1);
  const [projection, setProjection] = useState<SceneProjection | null>(null);
  const [site, setSite] = useState<SiteLocation | null>(null);
  const [renderStatus, setRenderStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const helpId = useId();
  const snapshot = useMemo<SceneSnapshot>(() => ({ crop, data: currentData, metrics, layer, view, showInset }),
    [crop, currentData, metrics, layer, view, showInset]);
  const snapshotRef = useRef(snapshot);

  useEffect(() => {
    snapshotRef.current = snapshot;
    rendererRef.current?.update(snapshot);
  }, [snapshot]);

  useEffect(() => {
    const abort = new AbortController();
    let active = true;
    let renderer: GreenhouseRenderer | null = null;
    void loadScene(abort.signal).then(loaded => {
      if (!active || !canvasRef.current) return;
      setSite(loaded.manifest.site);
      renderer = new GreenhouseRenderer(canvasRef.current, loaded, snapshotRef.current, {
        onProjection: next => {
          if (active) { setProjection(next); setRenderStatus('ready'); }
        },
        onError: message => {
          if (active) { setError(message); setRenderStatus('error'); }
        },
      });
      rendererRef.current = renderer;
    }).catch(reason => {
      if (!active || abort.signal.aborted) return;
      setError(reason instanceof Error ? reason.message : '3D 장면을 불러오지 못했습니다.');
      setRenderStatus('error');
    });
    return () => {
      active = false; abort.abort(); renderer?.dispose();
      if (rendererRef.current === renderer) rendererRef.current = null;
    };
  }, [attempt]);

  const cropLabel = crop === 'Cucumber' ? '오이' : '토마토';
  const growth = growthDisplay(metrics, crop, currentData);
  const temperatureReady = available(currentData, 'temperature');
  const humidityReady = available(currentData, 'humidity');
  const temperatureText = temperatureReady ? `${currentData.temperature.toFixed(1)} °C` : '입력 대기';
  const humidityText = humidityReady ? `${currentData.humidity.toFixed(0)} %` : '입력 대기';
  const layerReady = layer === 'temperature' ? temperatureReady : layer === 'humidity' ? humidityReady
    : layer === 'airflow' ? temperatureReady && humidityReady : true;
  const usable = snapshotUsable(currentData);
  const layerIsField = ['temperature', 'humidity', 'airflow'].includes(layer);
  const sun = projection?.sun;
  const plantExplanation = crop === 'Cucumber' ? '오이 형상 예시' : 'VTC 원본 구조';
  const growthExplanation = !usable ? '모델 계산 상태 확인 필요' : !growth.present ? '생육 입력 대기'
    : !growth.visible ? '생육 입력 0 · 작물 표시 대기' : '모델 생육에 따른 크기 예시';

  return (
    <section className="knu-scene" aria-label="경북대 온실 3D 시각화" data-render-status={renderStatus} data-crop={crop}>
      <div className="knu-scene-toolbar">
        <div className="knu-scene-heading">
          <strong><Box size={17} aria-hidden="true" />경북대 온실</strong>
          <span>{site ? `${site.latitude.toFixed(5)}° N · ${site.longitude.toFixed(5)}° E` : '온실 형상 불러오는 중'}</span>
        </div>
        <div className="knu-scene-layers" role="group" aria-label="3D 표시 항목">
          {layers.map(({ id, label, Icon }) => (
            <button key={id} type="button" aria-pressed={layer === id && view === 'whole'}
              disabled={renderStatus !== 'ready'} onClick={() => { setLayer(id); setView('whole'); }}>
              <Icon size={14} aria-hidden="true" /><span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="knu-scene-viewport">
        <canvas ref={canvasRef} tabIndex={0} aria-label="경북대 온실 3D 장면" aria-describedby={helpId} />

        {renderStatus === 'loading' && <div className="knu-scene-notice" role="status"><Box size={24} /><strong>경북대 온실을 불러오고 있습니다</strong></div>}
        {renderStatus === 'error' && <div className="knu-scene-notice" role="alert">
          <Box size={24} /><strong>3D 온실을 표시할 수 없습니다</strong><p>{error}</p>
          <Button size="sm" variant="secondary" onClick={() => {
            setRenderStatus('loading'); setError(null); setProjection(null); setAttempt(value => value + 1);
          }}>다시 불러오기</Button>
        </div>}

        {renderStatus === 'ready' && <>
          <div className="knu-scene-sun">
            {sun?.aboveHorizon ? <Sun size={24} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
            <span>{sun ? `태양 고도 ${sun.elevation.toFixed(1)}°` : '태양 시각 입력 대기'}
              <small>{sun ? `${sun.aboveHorizon ? '위치·시각으로 계산' : '지평선 아래'} · KST` : '시뮬레이션 시각 기준'}</small></span>
          </div>

          {view === 'whole' && layer !== 'growth' && projection?.sensors.map((point, index) => point.visible && (
            <div className="knu-scene-sensor" key={index} style={{ left: point.x, top: point.y }}>
              <button type="button" className="knu-scene-pin" aria-label={`예시 센서 ${index + 1}, ${sensorNames[index]}`}
                aria-expanded={selectedSensor === index} onClick={() => setSelectedSensor(selectedSensor === index ? null : index)}>
                <MapPin size={13} aria-hidden="true" />S{index + 1}
              </button>
              {selectedSensor === index && <div className="knu-scene-sensor-card">
                <strong>{sensorNames[index]}</strong>
                <span>{temperatureText}<i>·</i>{humidityText}</span>
                <small>환경 입력 · 위치는 예시</small>
              </div>}
            </div>
          ))}

          {view === 'whole' && projection?.plant.visible && growth.visible && <button type="button" className="knu-scene-plant-pin"
            style={{ left: projection.plant.x, top: projection.plant.y }} aria-label={`${cropLabel} 원본 위치의 작물 확대`}
            onClick={() => setView('plant')}><Sprout size={15} aria-hidden="true" /></button>}

          {view === 'whole' && showInset && projection?.insetVisible && <div className="knu-scene-inset-frame">
            <div className="knu-scene-inset-heading"><strong>선택 작물 · {cropLabel}</strong>
              <button type="button" aria-label="작물 미리보기 닫기" onClick={() => setShowInset(false)}><X size={12} /></button>
            </div>
            <span className="knu-scene-inset-source">{plantExplanation}</span>
            <button type="button" className="knu-scene-inset-open" onClick={() => setView('plant')}><Expand size={12} />작물 확대</button>
          </div>}

          {(view === 'plant' || !growth.visible || !usable) && <div className="knu-scene-plant-description">
            <strong>{view === 'plant' ? `${cropLabel} · ${plantExplanation}` : '생육 표시'}</strong>
            <span>{growthExplanation}</span>
          </div>}

          <div className="knu-scene-legend" aria-label="3D 표시 설명">
            {view === 'whole' && layerIsField ? <>
              <strong>{layer === 'temperature' ? '기온' : layer === 'humidity' ? '습도' : '기류'} <span>예시 분포</span></strong>
              {!layerReady ? <p>{usable ? '환경 입력을 기다리고 있습니다' : '모델 계산 상태를 확인해 주세요'}</p>
                : layer === 'airflow' ? <><div className="knu-scene-flow-key">→ <span>흐름 방향 예시</span> →</div><small>온도·습도 입력에 따른 시각화</small></>
                  : <><div className={`knu-scene-ramp ${layer === 'humidity' ? 'knu-scene-ramp-humidity' : ''}`} />
                    <div className="knu-scene-range"><span>{layer === 'temperature' ? '18 °C' : '40 %'}</span><span>{layer === 'temperature' ? '34 °C' : '95 %'}</span></div>
                    <small>환경 입력 {layer === 'temperature' ? temperatureText : humidityText}</small></>}
            </> : <><strong>{view === 'plant' || layer === 'growth' ? plantExplanation : '센서 위치 예시'}</strong>
              <small>{view === 'plant' || layer === 'growth' ? growthExplanation : '같은 시점의 환경 입력을 표시합니다'}</small></>}
          </div>

          <div className="knu-scene-camera">
            <button type="button" onClick={() => { if (view === 'plant') setView('whole'); else { setView('plant'); setShowInset(true); } }}>
              {view === 'plant' ? <Box size={14} /> : <Sprout size={14} />}<span>{view === 'plant' ? '온실 전체' : '작물 확대'}</span>
            </button>
            <button type="button" aria-label="3D 확대" onClick={() => rendererRef.current?.zoom(.85)}><Plus size={15} /></button>
            <button type="button" aria-label="3D 축소" onClick={() => rendererRef.current?.zoom(1.18)}><Minus size={15} /></button>
            <button type="button" aria-label="3D 시점 초기화" onClick={() => rendererRef.current?.reset()}><RotateCcw size={14} /></button>
          </div>

          <div className="knu-scene-compass" title="원본 ENU 모형 방위 · 설치 방위 실측값 아님">
            <span>N</span><svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
              <circle cx="14" cy="14" r="12" fill="none" stroke="currentColor" opacity=".3" />
              <g transform={`rotate(${projection?.northAngle ?? 0} 14 14)`}><path d="M14 3 L19 21 L14 17 L9 21 Z" fill="currentColor" /></g>
            </svg><small>모형 방위</small>
          </div>
        </>}
      </div>

      <div className="knu-scene-caption">
        <span>원본 온실 구조 · 재식·크기·센서 위치는 예시</span>
        <span id={helpId}>드래그 회전 · 휠/핀치 확대 · R 초기화</span>
      </div>
    </section>
  );
}
