/**
 * List of critical project files that should be protected from accidental modification
 */
export const PROTECTED_FILES = [
  'code/tsconfig.json',
  'code/tsconfig.eslint.json',
  'code/.npmrc',
  'code/.prettierignore',
  'code/babel.config.js',
  'code/jest.config.js',
  'code/src/index.ts',
  'code/src/main.ts',
  'code/src/test-runner/test-runner.ts',
  'code/scripts/deploy.sh',
  'code/scripts/cleanup.sh',
  // Add project-specific protected files
  'snapin.config.mjs',
  'manifest.yaml',
] as const

export type ProtectedFile = typeof PROTECTED_FILES[number]
