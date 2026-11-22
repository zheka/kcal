import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'coverage', 'test-results', 'playwright-report'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  // The app and the lab (src/lab/, AI experiments at /kcal/lab/) stay apart.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lab/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['**/lab', '**/lab/**'], message: 'The app never uses the lab.' }] },
      ],
    },
  },
  {
    files: ['src/lab/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/state/**'],
              message: 'The lab never touches the app’s state, which writes the app’s data.',
            },
            {
              group: ['**/data/storage'],
              importNames: ['loadSaved', 'saveData', 'clearSaved'],
              message: 'The lab only reads the app’s data, never writes it.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['*.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  prettier,
);
