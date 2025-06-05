import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { build } from './build'; // Assuming 'build' is the exported command object
import { getProjectInfo } from '@/src/utils/get-project-info';
import { createSnapInVersion, getSnapInContext } from '../utils/devrev-cli-wrapper';
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

// Cast the command to 'any' to access the action method for testing
const buildAction = build.action as any;

describe('build command', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Default Mocks
    vi.mocked(getProjectInfo).mockResolvedValue(null); // Default to no project info
    vi.mocked(createSnapInVersion).mockResolvedValue({ id: 'new-version-id', name: 'v1' });
    vi.mocked(getSnapInContext).mockResolvedValue({ snap_in_package_id: null, snap_in_id: null, snap_in_version_id: null }); // Default to no context
    vi.mocked(inquirer.prompt).mockResolvedValue({}); // Default to empty answers
  });

  it('should prompt for path if not provided and not archivePath', async () => {
    vi.mocked(inquirer.prompt).mockResolvedValueOnce({ pathOrArchive: './dist', type: 'Code Path' });
    await buildAction({} /* options */);
    expect(inquirer.prompt).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'pathOrArchive' }),
        expect.objectContaining({ name: 'type' }),
      ])
    );
    expect(createSnapInVersion).toHaveBeenCalledWith(
      './dist', // path derived from prompt
      expect.objectContaining({})
    );
  });

  it('should use projectInfo.manifestPath if available and no option is provided', async () => {
    vi.mocked(getProjectInfo).mockResolvedValue({
      name: 'Test Project',
      description: 'Desc',
      slug: 'test-slug',
      manifestPath: 'project/manifest.yaml',
      codePath: 'project/code',
      functionsPath: 'project/code/src/functions',
      isTsx: true,
      aliasPrefix: '@',
      serviceAccountName: '',
      externalSystemName: '',
      functions: [],
      keyring: undefined,
      tokenVerification: undefined
    });
    vi.mocked(inquirer.prompt).mockResolvedValueOnce({ pathOrArchive: './src', type: 'Code Path' }); // For path

    await buildAction({} /* options */);

    expect(logger.info).toHaveBeenCalledWith('Using manifest path from project information: project/manifest.yaml');
    // inquirer.prompt for manifestPath should NOT have been called for manifest
    expect(inquirer.prompt).not.toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ name: 'manifestPath' })])
    );
    expect(createSnapInVersion).toHaveBeenCalledWith(
      './src',
      expect.objectContaining({ manifestPath: 'project/manifest.yaml' })
    );
  });

  it('should use manifestPath from options even if projectInfo.manifestPath is available', async () => {
    vi.mocked(getProjectInfo).mockResolvedValue({
      name: 'Test Project',
      slug: 'test-slug',
      manifestPath: 'project/manifest.yaml',
      codePath: './', description: '', functionsPath: '', isTsx:false, aliasPrefix: null,
      serviceAccountName: '', externalSystemName: '', functions: [], keyring: undefined, tokenVerification: undefined
    });
     vi.mocked(inquirer.prompt).mockResolvedValueOnce({ pathOrArchive: './src', type: 'Code Path' }); // For path

    await buildAction({ manifestPath: 'options/manifest.yaml' });

    expect(logger.info).not.toHaveBeenCalledWith('Using manifest path from project information: project/manifest.yaml');
    expect(createSnapInVersion).toHaveBeenCalledWith(
      './src',
      expect.objectContaining({ manifestPath: 'options/manifest.yaml' })
    );
  });


  it('should skip packageId prompt if createPackage is true, no packageId option, and valid projectInfo.slug exists', async () => {
    vi.mocked(getProjectInfo).mockResolvedValue({
      name: 'Test Project',
      slug: 'valid-project-slug',
      manifestPath: 'manifest.yaml',
      codePath: './', description: '', functionsPath: '', isTsx:false, aliasPrefix: null,
      serviceAccountName: '', externalSystemName: '', functions: [], keyring: undefined, tokenVerification: undefined
    });
    vi.mocked(inquirer.prompt).mockResolvedValueOnce({ pathOrArchive: './src', type: 'Code Path' }); // For path

    await buildAction({ createPackage: true });

    expect(logger.info).toHaveBeenCalledWith("Option --create-package is set and no --package-id was provided.");
    expect(logger.info).toHaveBeenCalledWith("The slug 'valid-project-slug' from your manifest.yaml will be used by the DevRev CLI to identify or create the package.");
    // inquirer.prompt for packageId should NOT have been called
     expect(inquirer.prompt).not.toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ name: 'packageId' })])
    );
    expect(createSnapInVersion).toHaveBeenCalledWith(
        './src',
        expect.objectContaining({ createPackage: true })
    );
  });

  it('should prompt for packageId if createPackage is false, no packageId option, and no context packageId', async () => {
    vi.mocked(getProjectInfo).mockResolvedValue(null); // No project info
    vi.mocked(getSnapInContext).mockResolvedValue({ snap_in_package_id: null, snap_in_id: null, snap_in_version_id: null }); // No context
    vi.mocked(inquirer.prompt)
      .mockResolvedValueOnce({ pathOrArchive: './src', type: 'Code Path' }) // For path
      .mockResolvedValueOnce({ packageId: 'prompted-pkg-id' }) // For packageId
      .mockResolvedValueOnce({ manifestPath: 'prompted-manifest.yaml' }); // For manifest

    await buildAction({} /* options */);

    expect(inquirer.prompt).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ name: 'packageId' })])
    );
    expect(createSnapInVersion).toHaveBeenCalledWith(
      './src',
      expect.objectContaining({ packageId: 'prompted-pkg-id' })
    );
  });

  it('should use packageId from context if available and no option/slug logic applies', async () => {
    vi.mocked(getProjectInfo).mockResolvedValue(null);
    vi.mocked(getSnapInContext).mockResolvedValue({ snap_in_package_id: 'context-pkg-id', snap_in_id: '', snap_in_version_id: '' });
     vi.mocked(inquirer.prompt)
      .mockResolvedValueOnce({ pathOrArchive: './src', type: 'Code Path' }) // For path
      // No packageId prompt
      .mockResolvedValueOnce({ manifestPath: 'prompted-manifest.yaml' }); // For manifest


    await buildAction({} /* options */);

    expect(logger.info).toHaveBeenCalledWith('Using Snap-in package ID from current context: context-pkg-id');
    expect(inquirer.prompt).not.toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ name: 'packageId' })])
    );
    expect(createSnapInVersion).toHaveBeenCalledWith(
      './src',
      expect.objectContaining({ packageId: 'context-pkg-id' })
    );
  });


  it('should call createSnapInVersion with all relevant options', async () => {
    const options = {
      path: './dist',
      packageId: 'opt-pkg-id',
      manifestPath: 'opt-manifest.yaml',
      createPackage: true,
    };
    await buildAction(options);
    expect(createSnapInVersion).toHaveBeenCalledWith(
      './dist',
      expect.objectContaining({
        packageId: 'opt-pkg-id',
        manifestPath: 'opt-manifest.yaml',
        createPackage: true,
      })
    );
  });

  it('should use archivePath if provided', async () => {
    const options = {
      archivePath: './snap.zip',
      packageId: 'opt-pkg-id',
    };
    await buildAction(options);
    expect(createSnapInVersion).toHaveBeenCalledWith(
      '', // path is empty string when archivePath is used
      expect.objectContaining({
        archivePath: './snap.zip',
        packageId: 'opt-pkg-id',
      })
    );
  });

  it('should log error and exit if createSnapInVersion fails', async () => {
    vi.mocked(createSnapInVersion).mockRejectedValue(new Error('CLI tool failed'));
    const options = { path: './dist' };

    // Need to wrap action call to catch process.exit
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    await buildAction(options);

    expect(logger.error).toHaveBeenCalledWith('Failed to create Snap-in version.');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('CLI tool failed'));
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });

  it('should correctly pass testingUrl if it were an option in build (it is not currently)', async () => {
    // This test is more of a forward-looking check or for other commands.
    // Build command currently doesn't have testingUrl, but the wrapper supports it.
    const options = {
      path: './dist',
      // testingUrl: 'http://localhost:3000' // If this option was added to build
    };
    // If testingUrl was part of options, it would be:
    // expect(createSnapInVersion).toHaveBeenCalledWith('./dist', expect.objectContaining({ testingUrl: 'http://localhost:3000' }));
    // For now, just ensure it doesn't pass it if not an option:
    await buildAction(options);
    expect(createSnapInVersion).toHaveBeenCalledWith('./dist',expect.not.objectContaining({ testingUrl: expect.anything() }));
  });

});
