import DashboardCard from '../components/common/DashboardCard';
import type { AppLocale } from '../i18n/locale';
import SettingsPage from './settings-page';

interface SettingsRoutePageProps {
  locale: AppLocale;
  selectedCropLabel: string;
  assistantOpen: boolean;
  telemetrySummary: string;
  weatherConnected: boolean;
  marketConnected: boolean;
}

export default function SettingsRoutePage({
  locale,
  selectedCropLabel,
  assistantOpen,
  telemetrySummary,
  weatherConnected,
  marketConnected,
}: SettingsRoutePageProps) {
  return (
    <SettingsPage
      locale={locale}
      shellCard={(
        <DashboardCard
          eyebrow={locale === 'ko' ? '표시 기준' : 'Display'}
          title={locale === 'ko' ? '기본 화면 설정' : 'Shell defaults'}
          description={locale === 'ko' ? '언어, 작물, 보조 패널 진입 기준을 정리합니다.' : 'Review language, crop, and shell defaults.'}
        >
          <div className="grid gap-3 text-sm text-[color:var(--sg-text-muted)]">
            <div>{locale === 'ko' ? '현재 언어' : 'Current locale'}: {locale === 'ko' ? '한국어' : 'English'}</div>
            <div>{locale === 'ko' ? '현재 작물' : 'Current crop'}: {selectedCropLabel}</div>
            <div>{locale === 'ko' ? '보조 패널' : 'Assistant lane'}: {assistantOpen ? (locale === 'ko' ? '열림' : 'Open') : (locale === 'ko' ? '닫힘' : 'Closed')}</div>
          </div>
        </DashboardCard>
      )}
      laneCard={(
        <DashboardCard
          eyebrow={locale === 'ko' ? '연결 상태' : 'Runtime'}
          title={locale === 'ko' ? '현재 연결 확인' : 'Connection state'}
          description={locale === 'ko' ? '센서 신선도와 주요 연동 상태를 한곳에서 봅니다.' : 'Review telemetry freshness and key service connectivity.'}
        >
          <div className="grid gap-3 text-sm text-[color:var(--sg-text-muted)]">
            <div>{locale === 'ko' ? '센서 상태' : 'Telemetry'}: {telemetrySummary}</div>
            <div>{locale === 'ko' ? '기상 연동' : 'Weather'}: {weatherConnected ? (locale === 'ko' ? '연결됨' : 'Connected') : (locale === 'ko' ? '대기 중' : 'Pending')}</div>
            <div>{locale === 'ko' ? '시장 연동' : 'Market'}: {marketConnected ? (locale === 'ko' ? '연결됨' : 'Connected') : (locale === 'ko' ? '대기 중' : 'Pending')}</div>
          </div>
        </DashboardCard>
      )}
    />
  );
}
