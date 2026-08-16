/**
 * ESLint configuration.
 *
 * Type-aware linting is enabled deliberately: `no-floating-promises` is the rule
 * that catches the "fire and forget an async call, then wonder why state is
 * stuck" class of bug, and it needs type information. `config/tsconfig.test.json`
 * is used as the project because it is the only one that covers every source
 * directory plus the tests.
 */

const js = require('@eslint/js');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    ignores: ['dist/**', 'dist-tests/**', 'release/**', 'node_modules/**'],
  },

  // Plain JS: build and tooling scripts, and this file.
  {
    files: ['scripts/**/*.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'writable',
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
      },
    },
    ...js.configs.recommended,
  },

  // TypeScript sources and tests.
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        project: ['./config/tsconfig.test.json'],
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // The rule this configuration exists for. Node's test runner returns a
      // promise from every `test()` call and handles it itself, so those are
      // declared safe rather than silenced with `void` at 150 call sites.
      '@typescript-eslint/no-floating-promises': [
        'error',
        {
          allowForKnownSafeCalls: [
            { from: 'package', package: 'node:test', name: ['after', 'before', 'describe', 'it', 'suite', 'test'] },
          ],
        },
      ],

      // Unused code should be deleted, but an argument kept for signature
      // symmetry may be prefixed with an underscore.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // The configuration wizard is a large `any`-typed form controller. Tightening
  // its types is tracked separately; until then the rule would only produce
  // noise that hides real findings. The triple-slash reference is deliberate:
  // the wizard is loaded by a <script> tag with no module loader, so an `import`
  // would emit a `require` the browser cannot resolve.
  {
    files: ['src/renderer/config/scripts/configApp.ts'],
    rules: {
      '@typescript-eslint/triple-slash-reference': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },

  // Ambient declarations mirror an IPC surface that is untyped by construction
  // (values cross a process boundary as JSON). Typing them properly is tracked
  // by the "align config types with runtime" item.
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // GSAP's Timeline and Tween are thenables, so every `if (!timeline)` null
  // guard trips no-misused-promises. The guards are correct; the rule cannot
  // tell a thenable animation object from a promise.
  {
    files: ['src/renderer/scripts/avatarAnimator.ts'],
    rules: {
      '@typescript-eslint/no-misused-promises': 'off',
    },
  },

  // Test doubles are untyped by nature: a stub stands in for an Electron or DOM
  // object without implementing its type. Correctness of the tests is enforced
  // by the tests themselves.
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    },
  }
);
