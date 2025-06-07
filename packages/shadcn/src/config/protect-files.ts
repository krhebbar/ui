/**
 * List of critical project files that should be protected from accidental modification
 */
export const PROTECTED_FILES = [
  'tsconfig.json',
  'tsconfig.eslint.json',
  '.npmrc',
  '.prettierignore',
  'babel.config.js',
  'jest.config.js',
  'src/index.ts',
  'src/main.ts',
  'src/test-runner/test-runner.ts',
  'scripts/deploy.sh',
  'scripts/cleanup.sh',
  // Add project-specific protected files
  'snapin.config.mjs',
  'manifest.yaml',
  'package.json',
  '.gitignore',
] as const

export type ProtectedFile = typeof PROTECTED_FILES[number]
