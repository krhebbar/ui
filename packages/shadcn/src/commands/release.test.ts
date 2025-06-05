import { vi, describe, it, expect, beforeEach } from 'vitest';
import { release } from './release'; // Assuming 'release' is the exported command object
import { getProjectInfo } from '@/src/utils/get-project-info';
import {
  validateManifest,
  createSnapInVersion,
  updateSnapIn,
  draftSnapIn,
  activateSnapIn,
  getSnapInContext,
} from '../utils/devrev-cli-wrapper';
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

const releaseAction = release.action as any;

describe('release command (Smart Deploy Flow)', () => {
  const mockProjectInfo = {
    name: 'Test SnapIn',
    description: 'A test SnapIn',
    slug: 'test-snapin-slug',
    manifestPath: 'valid/manifest.yaml',
    codePath: './src',
    functionsPath: './src/functions',
    isTsx: true,
    aliasPrefix: '@',
    serviceAccountName: '', externalSystemName: '', functions: [], keyring: undefined, tokenVerification: undefined
  };

  const mockVersionInfo = { id: 'new-version-id', name: 'v1.0.0' };
  const mockContextWithSnapIn = { snap_in_id: 'existing-snapin-id', snap_in_package_id: 'pkg-123', snap_in_version_id: 'v0.0.1' };
  const mockContextWithoutSnapIn = { snap_in_id: null, snap_in_package_id: 'pkg-123', snap_in_version_id: null };
  const mockUpdatedSnapIn = { id: 'existing-snapin-id', url: 'http://updated.url' };
  const mockDraftedSnapIn = { id: 'new-snapin-id', url: 'http://drafted.url' };
  const mockActivationResult = { status: 'active' };

  let exitSpy: ReturnType<typeof vi.spyOn>;


  beforeEach(() => {
    vi.resetAllMocks();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);


    // Default successful mocks
    vi.mocked(getProjectInfo).mockResolvedValue(mockProjectInfo);
    vi.mocked(validateManifest).mockResolvedValue(undefined);
    vi.mocked(createSnapInVersion).mockResolvedValue(mockVersionInfo);
    vi.mocked(getSnapInContext).mockResolvedValue(mockContextWithSnapIn); // Default to context having a snap-in
    vi.mocked(updateSnapIn).mockResolvedValue(mockUpdatedSnapIn);
    vi.mocked(draftSnapIn).mockResolvedValue(mockDraftedSnapIn);
    vi.mocked(activateSnapIn).mockResolvedValue(mockActivationResult);
    vi.mocked(inquirer.prompt).mockResolvedValue({ activate: true }); // Default to user confirming activation
  });

  it('should run successful update path', async () => {
    await releaseAction({});

    expect(getProjectInfo).toHaveBeenCalled();
    expect(validateManifest).toHaveBeenCalledWith(mockProjectInfo.manifestPath);
    expect(createSnapInVersion).toHaveBeenCalledWith(mockProjectInfo.codePath,
        expect.objectContaining({ manifestPath: mockProjectInfo.manifestPath, createPackage: true, packageId: mockContextWithSnapIn.snap_in_package_id })
    );
    expect(getSnapInContext).toHaveBeenCalledTimes(2); // Once for create pkgId, once for update check
    expect(updateSnapIn).toHaveBeenCalledWith(mockContextWithSnapIn.snap_in_id, mockVersionInfo.id);
    expect(draftSnapIn).not.toHaveBeenCalled();
    expect(inquirer.prompt).toHaveBeenCalled();
    expect(activateSnapIn).toHaveBeenCalledWith(mockContextWithSnapIn.snap_in_id);
    expect(logger.info).toHaveBeenCalledWith("Smart Snap-in Release Process completed.");
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('should run successful draft path if no snap_in_id in context', async () => {
    vi.mocked(getSnapInContext)
      .mockResolvedValueOnce(mockContextWithoutSnapIn) // For createVersion (packageId might be there)
      .mockResolvedValueOnce(mockContextWithoutSnapIn); // For update check (no snap_in_id)

    await releaseAction({});

    expect(updateSnapIn).not.toHaveBeenCalled();
    expect(draftSnapIn).toHaveBeenCalledWith(mockVersionInfo.id);
    expect(activateSnapIn).toHaveBeenCalledWith(mockDraftedSnapIn.id);
    expect(logger.info).toHaveBeenCalledWith("No Snap-in ID found in current context. Will proceed to draft a new Snap-in.");
    expect(logger.info).toHaveBeenCalledWith("Smart Snap-in Release Process completed.");
  });

  it('should run successful draft path if updateSnapIn fails', async () => {
    // Setup getSnapInContext for createSnapInVersion (may or may not have packageId)
    vi.mocked(getSnapInContext).mockResolvedValueOnce({snap_in_package_id: 'pkg-for-create', snap_in_id: null, snap_in_version_id: null});
    // Setup getSnapInContext for the update attempt (must have snap_in_id to attempt update)
    vi.mocked(getSnapInContext).mockResolvedValueOnce(mockContextWithSnapIn);

    vi.mocked(updateSnapIn).mockRejectedValue(new Error('Update failed miserably'));


    await releaseAction({});

    expect(updateSnapIn).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to update existing Snap-in: Update failed miserably. Proceeding to draft a new Snap-in.'));
    expect(draftSnapIn).toHaveBeenCalledWith(mockVersionInfo.id);
    expect(activateSnapIn).toHaveBeenCalledWith(mockDraftedSnapIn.id);
  });

  it('should exit if projectInfo or manifestPath is missing', async () => {
    vi.mocked(getProjectInfo).mockResolvedValue(null);
    await releaseAction({});
    expect(logger.error).toHaveBeenCalledWith("Manifest file not found or project info could not be loaded. A manifest (e.g., manifest.yaml) is required in your project root for release.");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit if manifest validation fails', async () => {
    vi.mocked(validateManifest).mockRejectedValue(new Error('Validation XSD Error'));
    await releaseAction({});
    expect(logger.error).toHaveBeenCalledWith("Manifest validation failed.");
    expect(logger.error).toHaveBeenCalledWith("Validation XSD Error");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit if version creation fails', async () => {
    vi.mocked(createSnapInVersion).mockRejectedValue(new Error('Cannot create version'));
    await releaseAction({});
    expect(logger.error).toHaveBeenCalledWith("Failed to create Snap-in version.");
    expect(logger.error).toHaveBeenCalledWith("Cannot create version");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit if drafting fails (after update path failed/skipped)', async () => {
    vi.mocked(getSnapInContext) // first call for create version, second for update check
        .mockResolvedValueOnce(mockContextWithoutSnapIn)
        .mockResolvedValueOnce(mockContextWithoutSnapIn);
    vi.mocked(draftSnapIn).mockRejectedValue(new Error('Drafting process failed'));
    await releaseAction({});
    expect(logger.error).toHaveBeenCalledWith("Failed to draft Snap-in.");
    expect(logger.error).toHaveBeenCalledWith("Drafting process failed");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should skip activation if user declines', async () => {
    vi.mocked(inquirer.prompt).mockResolvedValue({ activate: false });
    await releaseAction({});
    expect(activateSnapIn).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith("Snap-in activation skipped by user.");
    expect(logger.info).toHaveBeenCalledWith("Smart Snap-in Release Process completed.");
  });

  it('should use codePath from projectInfo for createSnapInVersion', async () => {
    const specificProjectInfo = { ...mockProjectInfo, codePath: './custom/code/path' };
    vi.mocked(getProjectInfo).mockResolvedValue(specificProjectInfo);
    await releaseAction({});
    expect(createSnapInVersion).toHaveBeenCalledWith(specificProjectInfo.codePath, expect.anything());
  });

  it('should default to "./" for codePath if not in projectInfo (or undefined)', async () => {
    const infoWithoutCodePath = { ...mockProjectInfo, codePath: undefined as any };
    vi.mocked(getProjectInfo).mockResolvedValue(infoWithoutCodePath);
    await releaseAction({});
    expect(createSnapInVersion).toHaveBeenCalledWith("./", expect.anything());
  });

  it('should correctly use packageId from context for createSnapInVersion if available', async () => {
    vi.mocked(getSnapInContext)
        .mockResolvedValueOnce(mockContextWithSnapIn) // For createVersion, has packageId
        .mockResolvedValueOnce(mockContextWithSnapIn); // For update check
    await releaseAction({});
    expect(createSnapInVersion).toHaveBeenCalledWith(
        mockProjectInfo.codePath,
        expect.objectContaining({ packageId: mockContextWithSnapIn.snap_in_package_id })
    );
  });

  it('should inform if using slug from manifest when no packageId in context for createSnapInVersion', async () => {
    vi.mocked(getSnapInContext)
        .mockResolvedValueOnce(mockContextWithoutSnapIn) // For createVersion, no packageId
        .mockResolvedValueOnce(mockContextWithSnapIn); // For update check (doesn't matter for this assertion)
    await releaseAction({});
    expect(logger.info).toHaveBeenCalledWith(`No package ID in context. DevRev CLI will use slug '${mockProjectInfo.slug}' from manifest to find or create package.`);
    expect(createSnapInVersion).toHaveBeenCalledWith(
        mockProjectInfo.codePath,
        // Ensure packageId is NOT explicitly passed when relying on slug from manifest
        expect.not.objectContaining({ packageId: mockContextWithoutSnapIn.snap_in_package_id })
    );
  });
});
