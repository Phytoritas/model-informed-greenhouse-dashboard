import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CropType } from '../types';
import { useLegacyRecommendations } from './useLegacyRecommendations';

const fetchMock = vi.fn();

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    json: async () => payload,
  } as Response;
}

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

describe('useLegacyRecommendations', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ignores late responses for a previous crop selection', async () => {
    const cucumber = deferredResponse();
    const tomato = deferredResponse();

    fetchMock.mockImplementation((url: string) => {
      if (url.includes('crop=cucumber')) {
        return cucumber.promise;
      }
      if (url.includes('crop=tomato')) {
        return tomato.promise;
      }

      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const { result, rerender } = renderHook(
      ({ crop }: { crop: CropType }) => useLegacyRecommendations(crop),
      { initialProps: { crop: 'Cucumber' as CropType } },
    );

    await act(async () => {
      rerender({ crop: 'Tomato' as CropType });
    });

    await act(async () => {
      tomato.resolve(jsonResponse({
        crops: {
          Tomato: {
            recommendations: [{ message: 'Tomato recommendation' }],
          },
        },
      }));
    });

    await waitFor(() => {
      expect(result.current.recommendations.map((item) => item.message)).toEqual(['Tomato recommendation']);
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      cucumber.resolve(jsonResponse({
        crops: {
          Cucumber: {
            recommendations: [{ message: 'Stale cucumber recommendation' }],
          },
        },
      }));
    });

    await waitFor(() => {
      expect(result.current.recommendations.map((item) => item.message)).toEqual(['Tomato recommendation']);
    });
  });
});
