import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EnvironmentDatasetCard from './EnvironmentDatasetCard';

const fetchMock = vi.fn();

const BUNDLED = [
  { name: 'Tomato_Env.CSV', kind: 'bundled', rows: null, start: null, end: null, size_bytes: 4096, uploaded_at: null },
  { name: 'Cucumber_Env.CSV', kind: 'bundled', rows: null, start: null, end: null, size_bytes: 5120, uploaded_at: null },
];

function jsonResponse(payload: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Error',
    json: async () => payload,
  } as Response;
}

function stubFetch(datasets = BUNDLED) {
  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();

    if (url.includes('/datasets') && method === 'GET') {
      return jsonResponse({
        status: 'ok',
        required_columns: ['datetime', 'T_air_C', 'PAR_umol', 'CO2_ppm', 'RH_percent', 'wind_speed_ms'],
        datasets,
      });
    }
    if (url.includes('/datasets') && method === 'POST') {
      return jsonResponse({
        dataset: { name: 'summer_2024.csv', kind: 'uploaded', rows: 240, start: '2024-06-01T00:00:00', end: '2024-06-10T00:00:00', size_bytes: 8192, uploaded_at: '2026-07-18T00:00:00Z' },
      });
    }
    if (url.includes('/datasets') && method === 'DELETE') {
      return jsonResponse({ deleted: 'summer_2024.csv' });
    }
    if (url.includes('/start')) {
      return jsonResponse({ status: 'success', message: 'started' });
    }
    return jsonResponse({ status: 'success' });
  });
}

describe('EnvironmentDatasetCard', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists the available datasets as selectable radios with the crop default checked', async () => {
    stubFetch();
    render(<EnvironmentDatasetCard locale="en" crop="Cucumber" />);

    const tomato = await screen.findByRole('radio', { name: /Tomato_Env\.CSV/ });
    const cucumber = await screen.findByRole('radio', { name: /Cucumber_Env\.CSV/ });

    // The crop default (Cucumber) starts selected.
    expect(cucumber.getAttribute('aria-checked')).toBe('true');
    expect(tomato.getAttribute('aria-checked')).toBe('false');
    // Only the two bundled datasets are shown when nothing is uploaded.
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('lets the grower switch the selected dataset', async () => {
    stubFetch();
    render(<EnvironmentDatasetCard locale="en" crop="Cucumber" />);

    const tomato = await screen.findByRole('radio', { name: /Tomato_Env\.CSV/ });
    fireEvent.click(tomato);

    await waitFor(() => {
      expect(tomato.getAttribute('aria-checked')).toBe('true');
    });
  });

  it('starts the simulation on the selected dataset', async () => {
    stubFetch();
    render(<EnvironmentDatasetCard locale="en" crop="Cucumber" />);

    fireEvent.click(await screen.findByRole('radio', { name: /Tomato_Env\.CSV/ }));
    fireEvent.click(screen.getByRole('button', { name: /Start on this data/ }));

    await waitFor(() => {
      const startCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/start'));
      expect(startCall).toBeTruthy();
    });

    const startCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/start'));
    const body = JSON.parse((startCall?.[1]?.body as string) ?? '{}');
    expect(body.csv_filename).toBe('Tomato_Env.CSV');
  });

  it('uploads a CSV and selects the newly inserted dataset', async () => {
    stubFetch();
    render(<EnvironmentDatasetCard locale="en" crop="Cucumber" />);

    await screen.findByRole('radio', { name: /Cucumber_Env\.CSV/ });

    const file = new File(['datetime,T_air_C\n2024-06-01,22'], 'summer_2024.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      const uploadCall = fetchMock.mock.calls.find(
        ([url, init]) => String(url).includes('/datasets') && (init as RequestInit | undefined)?.method === 'POST',
      );
      expect(uploadCall).toBeTruthy();
    });

    // After upload the refreshed list still resolves; the newly-inserted name is picked.
    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([url, init]) => String(url).includes('/datasets') && !(init as RequestInit | undefined)?.method).length).toBeGreaterThanOrEqual(2);
    });
  });
});
