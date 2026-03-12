import { describe, it, expect, vi, beforeEach } from 'vitest';

// ====== Module mocks (hoisted by vitest) ======

vi.mock('node:fs/promises', async () => {
  const actual =
    await vi.importActual<typeof import('node:fs/promises')>(
      'node:fs/promises'
    );
  const mocked = {
    ...actual,
    readFile: vi.fn(),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({}),
    unlink: vi.fn().mockResolvedValue(undefined),
  };
  // startup.ts uses `import fs from 'node:fs/promises'` (default import).
  // Vitest resolves default imports to module.default, so expose both shapes.
  return { ...mocked, default: mocked };
});

vi.mock('../installationBackup', () => ({
  backupClijs: vi.fn().mockResolvedValue(undefined),
  backupNativeBinary: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../utils', async importOriginal => {
  const actual = await importOriginal<typeof import('../utils')>();
  return {
    ...actual,
    doesFileExist: vi.fn().mockResolvedValue(true),
  };
});

vi.mock('../systemPromptSync', () => ({
  syncSystemPrompts: vi
    .fn()
    .mockResolvedValue({ added: [], updated: [], removed: [] }),
  displaySyncResults: vi.fn(),
}));

// installationDetection is imported by startup.ts transitively; mock minimally
vi.mock('../installationDetection', () => ({
  findClaudeCodeInstallation: vi.fn(),
  getPendingCandidates: vi.fn().mockReturnValue(null),
}));

// nativeInstallationLoader used by installationDetection
vi.mock('../nativeInstallationLoader', () => ({
  extractClaudeJsFromNativeInstallation: vi.fn(),
  repackNativeInstallation: vi.fn(),
  resolveNixBinaryWrapper: vi.fn().mockResolvedValue(null),
}));

// systemPromptHashIndex used by config.ts internals
vi.mock('../systemPromptHashIndex', () => ({
  hasUnappliedSystemPromptChanges: vi.fn().mockResolvedValue(false),
}));

// node:fs (sync) used by getConfigDir / warnAboutMultipleConfigs
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    default: { ...actual, existsSync: vi.fn().mockReturnValue(true) },
    existsSync: vi.fn().mockReturnValue(true),
  };
});

// chalk: return strings as-is to avoid ANSI in error messages
vi.mock('chalk', () => {
  const id = (s: unknown) => s;
  const proxy: Record<string, unknown> = {};
  const make = () =>
    new Proxy(id, {
      get: (_t, p) => {
        if (!proxy[p as string]) proxy[p as string] = make();
        return proxy[p as string];
      },
    });
  return { default: make() };
});

// ====== Imports (after mocks) ======

import { exportSettings, importSettings } from '../config';
import { completeStartupCheck } from '../startup';
import type { TweakccConfig, ClaudeCodeInstallationInfo } from '../types';
import { DEFAULT_SETTINGS } from '../defaultSettings';
import fs from 'node:fs/promises';
import { doesFileExist } from '../utils';
import { backupNativeBinary } from '../installationBackup';

const mockedReadFile = vi.mocked(fs.readFile);
const mockedWriteFile = vi.mocked(fs.writeFile);
const mockedDoesFileExist = vi.mocked(doesFileExist);
const mockedBackupNativeBinary = vi.mocked(backupNativeBinary);

// ====== Helpers ======

const makeConfig = (overrides: Partial<TweakccConfig> = {}): TweakccConfig => ({
  ccVersion: '2.0.0',
  lastModified: '',
  changesApplied: true,
  settings: DEFAULT_SETTINGS,
  ccInstallationPath: null,
  ...overrides,
});

/** Make fs.readFile return a serialised TweakccConfig for the config-file path. */
const seedConfig = (cfg: TweakccConfig) => {
  mockedReadFile.mockResolvedValue(Buffer.from(JSON.stringify(cfg)) as never);
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  // Default: all backup files exist (prevents initial-backup branch)
  mockedDoesFileExist.mockResolvedValue(true);
  // Default config on disk
  seedConfig(makeConfig());
});

// ====== exportSettings ======

describe('exportSettings', () => {
  it('returns only the settings object, not ccVersion or other config fields', async () => {
    seedConfig(makeConfig({ ccVersion: '9.9.9', settings: DEFAULT_SETTINGS }));

    const result = await exportSettings();
    const parsed = JSON.parse(result) as Record<string, unknown>;

    expect(parsed).not.toHaveProperty('ccVersion');
    expect(parsed).not.toHaveProperty('changesApplied');
    expect(parsed).not.toHaveProperty('lastModified');
    expect(parsed).toHaveProperty('themes');
    expect(parsed).toHaveProperty('thinkingVerbs');
    expect(parsed).toHaveProperty('misc');
  });

  it('returns valid JSON', async () => {
    seedConfig(makeConfig());

    const result = await exportSettings();
    expect(() => JSON.parse(result)).not.toThrow();
  });
});

// ====== importSettings ======

describe('importSettings', () => {
  /** Capture the config that was written to disk by saveConfig. */
  const captureWrittenConfig = (): TweakccConfig => {
    const calls = mockedWriteFile.mock.calls;
    const lastCall = calls[calls.length - 1];
    return JSON.parse(lastCall[1] as string) as TweakccConfig;
  };

  it('accepts bare Settings JSON and writes settings + changesApplied=false', async () => {
    seedConfig(makeConfig({ changesApplied: true }));
    const bareSettings = JSON.stringify(DEFAULT_SETTINGS);

    await importSettings(bareSettings);

    expect(mockedWriteFile).toHaveBeenCalled();
    const written = captureWrittenConfig();
    expect(written.settings).toMatchObject({ themes: DEFAULT_SETTINGS.themes });
    expect(written.changesApplied).toBe(false);
  });

  it('accepts full TweakccConfig JSON and extracts .settings', async () => {
    seedConfig(makeConfig({ changesApplied: true }));
    const fullConfig = {
      ccVersion: '1.0.0',
      settings: DEFAULT_SETTINGS,
      changesApplied: true,
      lastModified: '',
    };

    await importSettings(JSON.stringify(fullConfig));

    expect(mockedWriteFile).toHaveBeenCalled();
    const written = captureWrittenConfig();
    expect(written.changesApplied).toBe(false);
    expect(written.settings).toMatchObject({ themes: DEFAULT_SETTINGS.themes });
  });

  it('strips a gist header line and parses the JSON that follows', async () => {
    seedConfig(makeConfig());
    const header = '"tweakcc config.json"';
    const body = JSON.stringify(DEFAULT_SETTINGS);

    await importSettings(`${header}\n${body}`);

    expect(mockedWriteFile).toHaveBeenCalled();
  });

  it('throws with "Failed to parse" on invalid JSON that starts with {', async () => {
    // Starts with '{' so the JSON-start finder succeeds, but JSON.parse fails.
    await expect(importSettings('{invalid json}')).rejects.toThrow(
      /Failed to parse/
    );
  });

  it('throws when no JSON object is found in input', async () => {
    await expect(importSettings('"just a string"')).rejects.toThrow(
      /No JSON object found/
    );
  });
});

// ====== contamination guard in completeStartupCheck ======

describe('contamination guard (completeStartupCheck)', () => {
  const mockCcInstInfo: ClaudeCodeInstallationInfo = {
    version: '2.0.0',
    nativeInstallationPath: '/path/to/claude',
    source: 'path',
  };

  // Config with stale ccVersion — triggers the version-mismatch branch
  const staleConfig = makeConfig({ ccVersion: '1.0.0' });

  beforeEach(() => {
    // Both backup files "exist" → hasBackedUp=false, hasBackedUpNativeBinary=false
    mockedDoesFileExist.mockResolvedValue(true);
    // Seed disk config so updateConfigFile (real) can read it
    seedConfig(staleConfig);
  });

  it('skips re-backup when live binary is already patched', async () => {
    // Route readFile by path: config file → JSON, native binary → patched content.
    mockedReadFile.mockImplementation((p: unknown) => {
      if (p === mockCcInstInfo.nativeInstallationPath) {
        return Promise.resolve(
          Buffer.from('binary data with tweakcc embedded')
        ) as never;
      }
      return Promise.resolve(Buffer.from(JSON.stringify(staleConfig))) as never;
    });

    const result = await completeStartupCheck(staleConfig, mockCcInstInfo);

    expect(result?.wasUpdated).toBe(false);
    expect(mockedBackupNativeBinary).not.toHaveBeenCalled();
  });

  it('proceeds with re-backup when live binary is clean', async () => {
    mockedReadFile.mockImplementation((p: unknown) => {
      if (p === mockCcInstInfo.nativeInstallationPath) {
        return Promise.resolve(
          Buffer.from('clean binary without the magic word')
        ) as never;
      }
      return Promise.resolve(Buffer.from(JSON.stringify(staleConfig))) as never;
    });

    const result = await completeStartupCheck(staleConfig, mockCcInstInfo);

    expect(result?.wasUpdated).toBe(true);
    expect(mockedBackupNativeBinary).toHaveBeenCalled();
  });

  it('returns wasUpdated=false when versions match (no contamination check needed)', async () => {
    const currentConfig = makeConfig({ ccVersion: '2.0.0' });
    seedConfig(currentConfig);

    const result = await completeStartupCheck(currentConfig, mockCcInstInfo);

    expect(result?.wasUpdated).toBe(false);
    // readFile is called for config.json but not for the native binary
    const nativeBinaryReadCalls = mockedReadFile.mock.calls.filter(
      ([p]) => p === '/path/to/claude'
    );
    expect(nativeBinaryReadCalls).toHaveLength(0);
  });
});
