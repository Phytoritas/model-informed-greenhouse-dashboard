import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { LocaleProvider } from '../../i18n/LocaleProvider';
import { LOCALE_STORAGE_KEY } from '../../i18n/locale';
import ConsultingTrendCard from './ConsultingTrendCard';
import { buildConsultingPoints } from './consultingTrendData';

describe('ConsultingTrendCard', () => {
  beforeEach(() => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'ko');
  });

  it('summarizes advisor action load and confidence in Korean', () => {
    render(
      <LocaleProvider>
        <ConsultingTrendCard
          actionsNow={['환기 조정']}
          actionsToday={['관수 타이밍']}
          actionsWeek={[]}
          confidence={0.82}
        />
      </LocaleProvider>,
    );

    expect(screen.getByText('컨설팅 액션 부하 · 신뢰도')).toBeTruthy();
    expect(screen.getByText('권고량: 2건')).toBeTruthy();
    expect(screen.getByText('신뢰도: 82%')).toBeTruthy();
    expect(screen.getByText('환기 조정')).toBeTruthy();
    expect(screen.getByRole('img', { name: /신뢰도 기준선: 82%/ })).toBeTruthy();
  });

  it('does not fabricate confidence trend points from a single confidence value', () => {
    expect(
      buildConsultingPoints({
        nowLabel: '즉시',
        todayLabel: '오늘',
        weekLabel: '이번 주',
        actionsNowCount: 1,
        actionsTodayCount: 2,
        actionsWeekCount: 3,
      }),
    ).toEqual([
      { horizon: '즉시', actionCount: 1, priorityScore: 3 },
      { horizon: '오늘', actionCount: 2, priorityScore: 4 },
      { horizon: '이번 주', actionCount: 3, priorityScore: 3 },
    ]);
  });
});
