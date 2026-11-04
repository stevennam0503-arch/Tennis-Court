import reactPlugin from 'eslint-plugin-react';
import globals from 'globals';

export default [
  {
    files: ['src/**/*.{js,jsx,mjs}'],
    plugins: {
      react: reactPlugin,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
    rules: {
      'no-undef': 'error',
      'react/jsx-no-undef': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='fetch'][arguments.0.value=/^\\/api/]",
          message: "Không dùng fetch('/api...') trực tiếp vì thiếu CSRF token. Dùng api('/...') từ services/api.js."
        },
        {
          selector: "CallExpression[callee.name='fetch'][arguments.0.quasis.0.value.raw=/^\\/api/]",
          message: "Không dùng fetch(`/api...`) trực tiếp vì thiếu CSRF token. Dùng api(`/...`) từ services/api.js."
        }
      ],
    },
  },
  {
    files: ['src/services/api.js'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
];
