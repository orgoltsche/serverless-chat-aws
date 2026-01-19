import pluginVue from 'eslint-plugin-vue';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import vueParser from 'vue-eslint-parser';

const tsRecommendedScoped = tseslint.configs['flat/recommended'].map((config, index) => {
  const scoped = {
    ...config,
    plugins: {
      ...(config.plugins || {}),
      '@typescript-eslint': tseslint,
    },
  };

  if (index === 0) {
    scoped.files = ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'];
  } else if (!scoped.files) {
    delete scoped.files;
  }

  return scoped;
});

export default [
  ...pluginVue.configs['flat/recommended'],
  ...tsRecommendedScoped,
  {
    files: ['src/**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsparser,
        ecmaVersion: 2022,
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
    },
  },
  {
    files: ['src/**/*.ts', 'src/**/*.vue'],
    rules: {
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: ['dist/', 'node_modules/', 'coverage/'],
  },
];
