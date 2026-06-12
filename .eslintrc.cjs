// DECISIÓN: ESLint 8 + eslintrc (no flat config) para mantener los scripts `eslint src --ext`
// existentes y evitar reescritura. typescript-eslint v7 = compatible con TS 5.4.
// Sin `parserOptions.project`: las reglas que nos importan (no-console, no-explicit-any)
// no requieren type-info → lint mucho más rápido y sin fricción de tsconfig.
/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  env: {
    es2022: true,
  },
  ignorePatterns: [
    'dist',
    'build',
    'node_modules',
    'coverage',
    '*.config.ts',
    '*.config.js',
    '*.config.cjs',
    '.eslintrc.cjs',
  ],
  rules: {
    // Reglas duras del proyecto (CLAUDE.md / README §8):
    'no-console': 'error',
    '@typescript-eslint/no-explicit-any': 'error',

    // Ruido relajado para que el lint sea verde y útil, no infinito:
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
    ],
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    'no-empty': ['warn', { allowEmptyCatch: true }],
  },
  overrides: [
    {
      files: ['apps/web/**/*.{ts,tsx}'],
      env: { browser: true },
      plugins: ['react-hooks'],
      extends: ['plugin:react-hooks/recommended'],
    },
    {
      files: ['apps/api/**/*.ts', 'packages/**/*.ts'],
      env: { node: true },
    },
  ],
};
