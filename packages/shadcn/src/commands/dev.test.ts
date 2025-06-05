import { vi, describe, it, expect, beforeEach } from 'vitest';
import { dev } from './dev'; // Assuming 'dev' is the exported command object
import { getProjectInfo } from '@/src/utils/get-project-info';
import { createSnapInVersion, draftSnapIn, activateSnapIn, getSnapInContext } from '../utils/devrev-cli-wrapper';
import inquirer from 'inquirer';
import { logger } from '@/src/utils/logger';

// Mock utilities and external dependencies
vi.mock('@/src/utils/get-project-info');
vi.mock('../utils/devrev-cli-wrapper');
vi.mock('inquirer');
vi.mock('@/src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const devAction = dev.action as any;

describe('dev command', () => {
  const fullProjectInfo = {
      name: 'Test Project',
      description: 'Desc',
      slug: 'test-slug',
      manifestPath: 'project/manifest.yaml',
      codePath: 'project/code',
      functionsPath: 'project/code/src/functions',
      isTsx: true,
      aliasPrefix: '@',
      serviceAccountName: '', externalSystemName: '', functions: [], keyring: undefined, tokenVerification: undefined
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getProjectInfo).mockResolvedValue(null);
    vi.mocked(createSnapInVersion).mockResolvedValue({ id: 'new-version-id', name: 'v_dev_1' });
    vi.mocked(draftSnapIn).mockResolvedValue({ id: 'draft-snapin-id', url: 'http://draft.url' });
    vi.mocked(activateSnapIn).mockResolvedValue('Activation successful');
    vi.mocked(getSnapInContext).mockResolvedValue({ snap_in_package_id: null, snap_in_id: null, snap_in_version_id: null });
    vi.mocked(inquirer.prompt).mockResolvedValue({}); // Default to empty answers
  });

  it('should prompt for path and url if not provided', async () => {
    vi.mocked(inquirer.prompt)
      .mockResolvedValueOnce({ path: './dev-src' }) // For path
      .mockResolvedValueOnce({ url: 'http://localhost:1234' }); // For url
    await devAction({});
    expect(inquirer.prompt).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ name: 'path' })]));
    expect(inquirer.prompt).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ name: 'url' })]));
    expect(createSnapInVersion).toHaveBeenCalledWith('./dev-src', expect.objectContaining({ testingUrl: 'http://localhost:1234' }));
  });

  it('should use projectInfo.manifestPath if available and no option is provided', async () => {
    vi.mocked(getProjectInfo).mockResolvedValue(fullProjectInfo);
    vi.mocked(inquirer.prompt) // path, url
      .mockResolvedValueOnce({ path: './dev-src' })
      .mockResolvedValueOnce({ url: 'http://localhost:1234' });

    await devAction({});
    expect(logger.info).toHaveBeenCalledWith(`Using manifest path from project information: ${fullProjectInfo.manifestPath}`);
    expect(inquirer.prompt).not.toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ name: 'manifestPath' })]));
    expect(createSnapInVersion).toHaveBeenCalledWith(
        './dev-src',
        expect.objectContaining({ manifestPath: fullProjectInfo.manifestPath, testingUrl: 'http://localhost:1234' })
    );
  });

  it('should skip packageId prompt if createPackage is true, no packageId option, and valid projectInfo.slug exists', async () => {
    vi.mocked(getProjectInfo).mockResolvedValue(fullProjectInfo);
     vi.mocked(inquirer.prompt) // path, url
      .mockResolvedValueOnce({ path: './dev-src' })
      .mockResolvedValueOnce({ url: 'http://localhost:1234' });

    await devAction({ createPackage: true });

    expect(logger.info).toHaveBeenCalledWith("Option --create-package is set and no --package-id was provided.");
    expect(logger.info).toHaveBeenCalledWith(`The slug '${fullProjectInfo.slug}' from your manifest.yaml will be used by the DevRev CLI to identify or create the package.`);
    expect(inquirer.prompt).not.toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ name: 'packageId' })]));
    expect(createSnapInVersion).toHaveBeenCalledWith(
        './dev-src',
        expect.objectContaining({ createPackage: true, testingUrl: 'http://localhost:1234' })
    );
  });

  it('should prompt for packageId if needed (no context, no createPackage with slug)', async () => {
    vi.mocked(getProjectInfo).mockResolvedValue(null); // No project info
    vi.mocked(getSnapInContext).mockResolvedValue({ snap_in_package_id: null, snap_in_id: null, snap_in_version_id: null }); // No context
    vi.mocked(inquirer.prompt)
      .mockResolvedValueOnce({ path: './dev-src' }) // For path
      .mockResolvedValueOnce({ url: 'http://localhost:1234' }) // For url
      .mockResolvedValueOnce({ packageId: 'prompted-pkg-id' }) // For packageId
      .mockResolvedValueOnce({ manifestPath: '' }); // For manifest (optional)

    await devAction({});
    expect(inquirer.prompt).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ name: 'packageId' })]));
    expect(createSnapInVersion).toHaveBeenCalledWith(
        './dev-src',
        expect.objectContaining({ packageId: 'prompted-pkg-id', testingUrl: 'http://localhost:1234' })
    );
  });

  it('should successfully execute the full dev flow (create, draft, activate)', async () => {
    vi.mocked(inquirer.prompt)
      .mockResolvedValueOnce({ path: './dev-src' }) // path
      .mockResolvedValueOnce({ url: 'http://localhost:5678' }) // url
      .mockResolvedValueOnce({ activate: true }); // activate confirmation

    await devAction({});

    expect(createSnapInVersion).toHaveBeenCalledWith('./dev-src', expect.objectContaining({ testingUrl: 'http://localhost:5678' }));
    expect(draftSnapIn).toHaveBeenCalledWith('new-version-id');
    expect(activateSnapIn).toHaveBeenCalledWith('draft-snapin-id');
    expect(logger.info).toHaveBeenCalledWith('Snap-in test version created successfully:');
    expect(logger.info).toHaveBeenCalledWith('Snap-in drafted successfully:');
    expect(logger.info).toHaveBeenCalledWith("Local development setup complete. Your Snap-in should be routing to your local server via the provided URL.");
  });

  it('should skip activation if user declines', async () => {
    vi.mocked(inquirer.prompt)
      .mockResolvedValueOnce({ path: './dev-src' }) // path
      .mockResolvedValueOnce({ url: 'http://localhost:5678' }) // url
      .mockResolvedValueOnce({ activate: false }); // decline activation

    await devAction({});
    expect(activateSnapIn).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('Snap-in activation skipped by user.');
  });

  it('should handle error during createSnapInVersion', async () => {
    vi.mocked(createSnapInVersion).mockRejectedValue(new Error('Version creation failed'));
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    vi.mocked(inquirer.prompt)
      .mockResolvedValueOnce({ path: './dev-src' })
      .mockResolvedValueOnce({ url: 'http://localhost:1234' });

    await devAction({});
    expect(logger.error).toHaveBeenCalledWith('Failed during Snap-in development workflow.');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Version creation failed'));
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it('should handle error during draftSnapIn', async () => {
    vi.mocked(draftSnapIn).mockRejectedValue(new Error('Drafting failed'));
     const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    vi.mocked(inquirer.prompt)
      .mockResolvedValueOnce({ path: './dev-src' })
      .mockResolvedValueOnce({ url: 'http://localhost:1234' });

    await devAction({});
    expect(logger.error).toHaveBeenCalledWith('Failed during Snap-in development workflow.');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Drafting failed'));
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it('should handle error if newVersionInfo.id is missing', async () => {
    vi.mocked(createSnapInVersion).mockResolvedValue({} as any); // No ID
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    vi.mocked(inquirer.prompt)
      .mockResolvedValueOnce({ path: './dev-src' })
      .mockResolvedValueOnce({ url: 'http://localhost:1234' });

    await devAction({});
    expect(logger.error).toHaveBeenCalledWith('Failed to get Snap-in Version ID from creation response.');
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

   it('should handle error if draftInfo.id is missing', async () => {
    vi.mocked(draftSnapIn).mockResolvedValue({ url: 'http://some.url' } as any); // No ID
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    vi.mocked(inquirer.prompt)
      .mockResolvedValueOnce({ path: './dev-src' })
      .mockResolvedValueOnce({ url: 'http://localhost:1234' });

    await devAction({});
    expect(logger.error).toHaveBeenCalledWith('Failed to get Snap-in ID from draft response.');
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

});
