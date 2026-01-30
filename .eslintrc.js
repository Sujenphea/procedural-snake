module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  plugins: ['@typescript-eslint'],
  env: {
    browser: true,
    es2020: true,
  },
  rules: {
    // Allow unused vars with underscore prefix
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

    // Warn on explicit any usage
    '@typescript-eslint/no-explicit-any': 'warn',

    // Allow console.warn and console.error
    'no-console': ['warn', { allow: ['warn', 'error'] }],

    // Allow non-null assertions when necessary
    '@typescript-eslint/no-non-null-assertion': 'off',
  },
}
