import { vi, describe, it, expect, beforeEach } from 'vitest';
import { getProjectInfo } from './get-project-info';
import fs from 'fs-extra';
import yaml from 'yaml';
import path from 'path';

// Mock fs-extra
vi.mock('fs-extra', async () => {
  const actualFsExtra = await vi.importActual<typeof fs>('fs-extra');
  return {
    ...actualFsExtra,
    readFile: vi.fn(),
    existsSync: vi.fn(), // Mock existsSync as it's used by getProjectInfo indirectly
  };
});

// Mock yaml
vi.mock('yaml', () => ({
  parse: vi.fn(),
}));

// Mock other utility functions called by getProjectInfo to isolate the test
vi.mock('./get-project-info', async (importOriginal) => {
    const originalModule = await importOriginal<typeof import('./get-project-info')>();
    return {
        ...originalModule,
        // We are testing getProjectInfo, so we don't mock it.
        // Instead, we mock its internal dependencies if they are complex or external.
        // For isTypeScriptProject and getTsConfigAliasPrefix, if they are simple and
        // don't have external deps themselves for the purpose of this test,
        // they might not need explicit mocking if we provide necessary file mocks.
        // However, getProjectInfo calls them, so it's safer to provide controlled mocks.
        isTypeScriptProject: vi.fn().mockResolvedValue(true), // Default mock
        getTsConfigAliasPrefix: vi.fn().mockResolvedValue('@'), // Default mock
    };
});


describe('getProjectInfo', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Default mock for fs.existsSync (called by getProjectInfo)
    // Make it return true for manifest.yaml and code path by default for successful cases
    (fs.existsSync as vi.Mock).mockImplementation((p: string) => {
        if (p.endsWith('manifest.yaml') || p.endsWith('code')) {
            return true;
        }
        return false;
    });
  });

  it('should correctly extract slug from manifest.imports[0].slug', async () => {
    const mockManifestContent = {
      name: 'Test Project',
      description: 'A test project',
      imports: [{ slug: 'expected-slug' }],
    };
    (fs.readFile as vi.Mock).mockResolvedValue('dummy yaml content');
    (yaml.parse as vi.Mock).mockReturnValue(mockManifestContent);

    const projectInfo = await getProjectInfo(process.cwd());

    expect(yaml.parse).toHaveBeenCalledWith('dummy yaml content');
    expect(projectInfo?.slug).toBe('expected-slug');
    expect(projectInfo?.name).toBe('Test Project');
  });

  it('should return "unknown-snapin-slug" if imports is missing', async () => {
    const mockManifestContent = {
      name: 'Test Project No Imports',
      description: 'A test project',
      // no imports key
    };
    (fs.readFile as vi.Mock).mockResolvedValue('dummy yaml content');
    (yaml.parse as vi.Mock).mockReturnValue(mockManifestContent);

    const projectInfo = await getProjectInfo(process.cwd());
    expect(projectInfo?.slug).toBe('unknown-snapin-slug');
  });

  it('should return "unknown-snapin-slug" if imports is an empty array', async () => {
    const mockManifestContent = {
      name: 'Test Project Empty Imports',
      description: 'A test project',
      imports: [],
    };
    (fs.readFile as vi.Mock).mockResolvedValue('dummy yaml content');
    (yaml.parse as vi.Mock).mockReturnValue(mockManifestContent);

    const projectInfo = await getProjectInfo(process.cwd());
    expect(projectInfo?.slug).toBe('unknown-snapin-slug');
  });

  it('should return "unknown-snapin-slug" if imports[0] has no slug property', async () => {
    const mockManifestContent = {
      name: 'Test Project Import No Slug',
      description: 'A test project',
      imports: [{ name: 'some-import' /* no slug here */ }],
    };
    (fs.readFile as vi.Mock).mockResolvedValue('dummy yaml content');
    (yaml.parse as vi.Mock).mockReturnValue(mockManifestContent);

    const projectInfo = await getProjectInfo(process.cwd());
    expect(projectInfo?.slug).toBe('unknown-snapin-slug');
  });

  it('should return null if manifest.yaml does not exist', async () => {
    (fs.existsSync as vi.Mock).mockImplementation((p: string) => {
        if (p.endsWith('manifest.yaml')) return false; // manifest does not exist
        if (p.endsWith('code')) return true;
        return false;
    });
    const projectInfo = await getProjectInfo(process.cwd());
    expect(projectInfo).toBeNull();
  });

  it('should return null if code path does not exist', async () => {
    (fs.existsSync as vi.Mock).mockImplementation((p: string) => {
        if (p.endsWith('manifest.yaml')) return true;
        if (p.endsWith('code')) return false; // code path does not exist
        return false;
    });
    const projectInfo = await getProjectInfo(process.cwd());
    expect(projectInfo).toBeNull();
  });

  it('should parse other manifest details correctly', async () => {
    const mockManifestContent = {
      name: 'Full Project',
      description: 'Full desc',
      service_account: { display_name: 'Test SA' },
      functions: [{ name: 'func1', description: 'desc1' }],
      keyring_types: [{ id: 'keyring1', kind: 'generic', external_system_name: 'sys1' }],
      imports: [{ slug: 'test-slug' }],
    };
    (fs.readFile as vi.Mock).mockResolvedValue('yaml content');
    (yaml.parse as vi.Mock).mockReturnValue(mockManifestContent);
    // Ensure internal mocks are set up if needed by the parts of getProjectInfo we are testing
    vi.mocked(fs.existsSync).mockReturnValue(true); // Assume all necessary paths exist

    const projectInfo = await getProjectInfo(process.cwd());

    expect(projectInfo?.name).toBe('Full Project');
    expect(projectInfo?.description).toBe('Full desc');
    expect(projectInfo?.slug).toBe('test-slug');
    expect(projectInfo?.serviceAccountName).toBe('Test SA');
    expect(projectInfo?.functions?.length).toBe(1);
    expect(projectInfo?.functions?.[0].name).toBe('func1');
    expect(projectInfo?.keyring?.id).toBe('keyring1');
    expect(projectInfo?.externalSystemName).toBe('sys1');
  });
});
