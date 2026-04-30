import { describe, expect, it } from 'vitest';
import { getRequestErrorCopy } from './requestErrorCopy';

describe('getRequestErrorCopy', () => {
  it('localizes network failures for Korean screens', () => {
    expect(
      getRequestErrorCopy('Failed to fetch', 'ko', {
        resourceKo: '환경 제어 추천',
        resourceEn: 'the control recommendation',
      }),
    ).toBe('서비스 연결이 없어 환경 제어 추천 불러오지 못했습니다.');
  });

  it('localizes 5xx responses for English screens', () => {
    expect(
      getRequestErrorCopy('HTTP 502', 'en', {
        resourceKo: '온도 기준선',
        resourceEn: 'the strategy line',
      }),
    ).toBe('the strategy line is temporarily unavailable. Please try again shortly.');
  });

  it('localizes 404 and plain Not Found responses for Korean screens', () => {
    expect(
      getRequestErrorCopy('HTTP 404', 'ko', {
        resourceKo: '환경 제어 추천',
        resourceEn: 'the control recommendation',
      }),
    ).toBe('환경 제어 추천 값을 아직 준비하지 못했습니다.');

    expect(
      getRequestErrorCopy('Not Found', 'ko', {
        resourceKo: '환경 제어 추천',
        resourceEn: 'the control recommendation',
      }),
    ).toBe('환경 제어 추천 값을 아직 준비하지 못했습니다.');
  });

  it('preserves specific messages that are already readable', () => {
    expect(
      getRequestErrorCopy('온도 기준선 파일을 찾을 수 없습니다.', 'ko', {
        resourceKo: '온도 기준선',
        resourceEn: 'the strategy line',
      }),
    ).toBe('온도 기준선 파일을 찾을 수 없습니다.');
  });
});
