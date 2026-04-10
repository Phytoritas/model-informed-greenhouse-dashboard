import { describe, expect, it } from 'vitest';
import { inferDefaultBackendOrigin } from './config';

type MemoryStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  dump: () => Record<string, string>;
};

function createMemoryStorage(initial: Record<string, string> = {}): MemoryStorage {
  const data = new Map(Object.entries(initial));

  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
    dump: () => Object.fromEntries(data.entries()),
  };
}

function createBrowserContext(
  url: string,
  storageSeed: Record<string, string> = {},
) {
  const parsed = new URL(url);
  const localStorage = createMemoryStorage(storageSeed);

  return {
    location: {
      hostname: parsed.hostname,
      origin: parsed.origin,
      port: parsed.port,
      protocol: parsed.protocol,
      search: parsed.search,
    },
    localStorage,
  };
}

describe('inferDefaultBackendOrigin', () => {
  it('drops stale standard local backend overrides and prefers port 8000', () => {
    const browser = createBrowserContext('http://127.0.0.1:4180/control', {
      'smartgrow.backendOrigin': 'http://127.0.0.1:8003',
      'smartgrow.backendOriginPinned': 'true',
    });

    expect(inferDefaultBackendOrigin(browser)).toBe('http://127.0.0.1:8000');
    expect(browser.localStorage.dump()).toEqual({});
  });

  it('uses a standard local backend query override for the current visit only', () => {
    const browser = createBrowserContext(
      'http://127.0.0.1:4180/control?backendOrigin=http://127.0.0.1:8003',
      {
        'smartgrow.backendOrigin': 'http://127.0.0.1:8000',
        'smartgrow.backendOriginPinned': 'true',
      },
    );

    expect(inferDefaultBackendOrigin(browser)).toBe('http://127.0.0.1:8003');
    expect(browser.localStorage.dump()).toEqual({});
  });

  it('keeps nonstandard pinned backend overrides', () => {
    const browser = createBrowserContext('http://127.0.0.1:4180/control', {
      'smartgrow.backendOrigin': 'https://greenhouse.example.com',
      'smartgrow.backendOriginPinned': 'true',
    });

    expect(inferDefaultBackendOrigin(browser)).toBe('https://greenhouse.example.com');
    expect(browser.localStorage.dump()).toEqual({
      'smartgrow.backendOrigin': 'https://greenhouse.example.com',
      'smartgrow.backendOriginPinned': 'true',
    });
  });
});
