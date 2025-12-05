const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const importPlugin = require('eslint-plugin-import');
const prettierPlugin = require('eslint-plugin-prettier');

const tsRecommended = tsPlugin.configs['recommended-type-checked']?.rules ?? {};
const tsStylistic = tsPlugin.configs['stylistic-type-checked']?.rules ?? {};

module.exports = [
  {
    ignores: ['dist', 'node_modules'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ['./tsconfig.json'],
        sourceType: 'module',
        ecmaVersion: 'latest',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      ...tsRecommended,
      ...tsStylistic,

      // Imports & style
      'import/order': [
        'warn',
        {
          groups: [['builtin', 'external'], ['internal'], ['parent', 'sibling', 'index']],
          'newlines-between': 'always',
        },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',

      // Safety
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',

      // Formatting
      'prettier/prettier': 'warn',
      'no-console': 'off',
    },
  },
];

