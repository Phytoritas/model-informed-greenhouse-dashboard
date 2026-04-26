import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../i18n/LocaleProvider';
import { LOCALE_STORAGE_KEY } from '../../i18n/locale';
import ModelRuntimeBridge from './ModelRuntimeBridge';

const fetchMock = vi.fn();

function jsonResponse(payload: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 400,
    statusText: ok ? 'OK' : 'Bad Request',
    json: async () => payload,
  };
}

function renderBridge() {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en');

  return render(
    <LocaleProvider>
      <ModelRuntimeBridge crop="Tomato" onOpenAssistant={() => undefined} />
    </LocaleProvider>,
  );
}

describe('ModelRuntimeBridge', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('calls the model snapshot backend endpoint from the overview UI', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      status: 'success',
      snapshot_id: 'snap_123',
      crop: 'tomato',
      surfaces: [],
    }));

    renderBridge();

    fireEvent.click(screen.getByRole('button', { name: 'Capture snapshot' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/models/snapshot');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      crop: 'tomato',
      source: 'overview_runtime_bridge',
    });
    expect(await screen.findByText(/Snapshot persisted: snap_123/)).toBeTruthy();
    expect(screen.getByText('Current snapshot: snap_123')).toBeTruthy();
  });

  it('surfaces backend runtime errors without navigating to legacy pages', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      detail: 'Model runtime is inactive. Call /api/start first.',
    }, false));

    renderBridge();

    fireEvent.click(screen.getByRole('button', { name: 'Run scenario' }));

    expect(await screen.findByText('Model runtime is inactive. Call /api/start first.')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Control Solutions' })).toBeNull();
  });
});
