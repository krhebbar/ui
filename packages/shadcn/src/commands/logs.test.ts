import { vi, describe, it, expect, beforeEach } from 'vitest';
import { logs } from './logs'; // Assuming 'logs' is the exported command object
import { getProjectInfo } from '@/src/utils/get-project-info';
import { getSnapInLogs } from '../utils/devrev-cli-wrapper';
import { logger } from '@/src/utils/logger';

// Mock utilities and external dependencies
vi.mock('@/src/utils/get-project-info');
vi.mock('../utils/devrev-cli-wrapper');
vi.mock('@/src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock console.log as the command uses it directly for outputting logs
const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});


const logsAction = logs.action as any;

describe('logs command', () => {
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

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getProjectInfo).mockResolvedValue(mockProjectInfo); // Default to having project info
    vi.mocked(getSnapInLogs).mockResolvedValue([]); // Default to no logs
    consoleLogSpy.mockClear(); // Clear spy calls before each test
  });

  it('should call getProjectInfo for consistency', async () => {
    await logsAction({});
    expect(getProjectInfo).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(`Project Name (context): ${mockProjectInfo.name}`);
  });

  it('should call getSnapInLogs with default options if none are provided', async () => {
    await logsAction({});
    // Default limit is 100, others are undefined. The wrapper will pass these along.
    expect(getSnapInLogs).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
  });

  it('should call getSnapInLogs with provided options', async () => {
    const options = {
      after: '1h',
      before: '10m',
      filters: '{"level":"error"}',
      limit: 50,
    };
    await logsAction(options);
    expect(getSnapInLogs).toHaveBeenCalledWith({
      after: '1h',
      before: '10m',
      filters: '{"level":"error"}',
      limit: 50,
    });
  });

  it('should log "No logs found" if getSnapInLogs returns empty array or null', async () => {
    vi.mocked(getSnapInLogs).mockResolvedValue([]);
    await logsAction({});
    expect(logger.info).toHaveBeenCalledWith("No logs found for the given criteria.");

    vi.mocked(getSnapInLogs).mockResolvedValue(null as any); // Simulate null response
    await logsAction({});
    expect(logger.info).toHaveBeenCalledWith("No logs found for the given criteria.");
  });

  it('should output logs if retrieved', async () => {
    const mockLogEntries = [
      { timestamp: '2023-01-01T00:00:00Z', message: 'Log 1' },
      "Plain string log",
    ];
    vi.mocked(getSnapInLogs).mockResolvedValue(mockLogEntries);
    await logsAction({});
    expect(logger.info).toHaveBeenCalledWith("Logs retrieved successfully:");
    // Check console.log calls
    expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(mockLogEntries[0], null, 2));
    expect(consoleLogSpy).toHaveBeenCalledWith(mockLogEntries[1]);
  });

  it('should handle DevRev CLI error from getSnapInLogs', async () => {
    const cliError = new Error('DevRev CLI command failed: Some CLI issue');
    vi.mocked(getSnapInLogs).mockRejectedValue(cliError);
    await logsAction({});
    expect(logger.error).toHaveBeenCalledWith("Failed to fetch Snap-in logs.");
    expect(logger.error).toHaveBeenCalledWith("It seems 'devrev' CLI is not installed or not found in your PATH.");
  });

  it('should handle snap_in_package_id not found error from getSnapInLogs', async () => {
    const contextError = new Error('snap_in_package_id not found in context');
    vi.mocked(getSnapInLogs).mockRejectedValue(contextError);
    await logsAction({});
    expect(logger.error).toHaveBeenCalledWith("Failed to fetch Snap-in logs.");
    expect(logger.error).toHaveBeenCalledWith("Snap-in package ID not found in the current DevRev context.");
  });

  it('should handle other unexpected errors from getSnapInLogs', async () => {
    const unexpectedError = new Error('Some unexpected network issue');
    vi.mocked(getSnapInLogs).mockRejectedValue(unexpectedError);
    await logsAction({});
    expect(logger.error).toHaveBeenCalledWith("Failed to fetch Snap-in logs.");
    expect(logger.error).toHaveBeenCalledWith(`An unexpected error occurred: ${unexpectedError.message}`);
  });

});
