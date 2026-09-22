import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import portfolio from './tools/eslint/plugin.js';

const STYLE_IMPORTS = {
  group: ['*.scss', '*.sass', '*.css', '**/*.scss', '**/*.sass', '**/*.css'],
  message:
    'Los estilos solo se importan desde src/styles/main.scss (enlazado en index.html). Ningún .ts importa estilos.',
};

const DEEP_RELATIVE = {
  group: ['../../../*'],
  message:
    'Una ruta relativa de 3 niveles sale de la feature. Usa los alias @app o @shared (lo común entre features va en shared).',
};

const BOUNDARIES = [
  {
    group: ['@features/*'],
    message:
      'Solo app compone features. Una feature no importa otra ni shared depende de features; lo común va en @shared.',
  },
  { group: ['@app/*'], message: 'Ni features ni shared dependen de app.' },
];

const restrictImports = (...patterns) => ['error', { patterns: [STYLE_IMPORTS, DEEP_RELATIVE, ...patterns] }];

const layer = (files, patterns, extraRules = {}) => ({
  files,
  rules: { 'no-restricted-imports': restrictImports(...patterns), ...extraRules },
});

const NO_DOM = [
  'error',
  { name: 'document', message: 'La manipulación del DOM pertenece a los componentes.' },
  { name: 'window', message: 'La manipulación del DOM pertenece a los componentes.' },
];

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage', 'public'] },

  {
    files: ['**/*.js', 'vite.config.ts'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },

  {
    files: ['main.ts', 'src/**/*.ts'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      jsdoc.configs['flat/recommended-typescript-error'],
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { portfolio },
    rules: {
      'portfolio/single-declaration': 'error',
      'portfolio/jsdoc-only-comments': 'error',

      'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 20, skipBlankLines: true, skipComments: true, IIFEs: true }],
      complexity: ['error', 8],
      'max-depth': ['error', 3],
      'max-nested-callbacks': ['error', 3],
      '@typescript-eslint/max-params': ['error', { max: 5 }],
      'max-classes-per-file': ['error', 1],
      'max-statements-per-line': ['error', { max: 1 }],

      'no-restricted-imports': restrictImports(),
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-param-reassign': 'error',
      'no-nested-ternary': 'error',
      'no-else-return': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      'prefer-const': 'error',
      'object-shorthand': 'error',

      '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'explicit' }],
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/member-ordering': [
        'error',
        {
          default: [
            'signature',
            'static-field',
            'instance-field',
            'constructor',
            ['get', 'set'],
            'public-static-method',
            'public-instance-method',
            'protected-abstract-method',
            'protected-instance-method',
            'private-instance-method',
            'private-static-method',
          ],
        },
      ],
      '@typescript-eslint/no-empty-function': ['error', { allow: ['overrideMethods'] }],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
      '@typescript-eslint/no-magic-numbers': [
        'error',
        {
          ignore: [0, 1, -1, 2, 3, 0.5],
          ignoreEnums: true,
          ignoreReadonlyClassProperties: true,
          ignoreNumericLiteralTypes: true,
          ignoreTypeIndexes: true,
        },
      ],
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'interface', format: ['PascalCase'], custom: { regex: '^I[A-Z]', match: false } },
        { selector: 'enumMember', format: ['PascalCase'] },
        { selector: 'classProperty', modifiers: ['static', 'readonly'], format: ['UPPER_CASE', 'camelCase'] },
        { selector: 'memberLike', format: ['camelCase'], leadingUnderscore: 'forbid' },
        { selector: 'objectLiteralProperty', format: ['camelCase', 'PascalCase'] },
        { selector: 'objectLiteralProperty', modifiers: ['requiresQuotes'], format: null },
        { selector: 'typeProperty', filter: { regex: '^VITE_', match: true }, format: ['UPPER_CASE'] },
        { selector: 'variableLike', format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: 'variable', modifiers: ['destructured'], format: ['camelCase', 'UPPER_CASE'] },
      ],

      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: false,
          checkConstructors: true,
          require: { ClassDeclaration: true, MethodDefinition: true, FunctionDeclaration: true },
          contexts: [
            'TSInterfaceDeclaration',
            'TSTypeAliasDeclaration',
            'TSEnumDeclaration',
            'TSInterfaceBody > TSPropertySignature',
            'TSInterfaceBody > TSMethodSignature',
          ],
        },
      ],
      'jsdoc/require-description': [
        'error',
        {
          contexts: [
            'ClassDeclaration',
            'MethodDefinition',
            'TSInterfaceDeclaration',
            'TSTypeAliasDeclaration',
            'TSEnumDeclaration',
          ],
        },
      ],
      'jsdoc/require-param-description': 'error',
      'jsdoc/require-returns-description': 'error',
      'jsdoc/require-throws': 'error',
      'jsdoc/tag-lines': ['error', 'any', { startLines: 1 }],
    },
  },

  {
    files: ['main.ts'],
    rules: { 'portfolio/single-declaration': ['error', { entry: true, matchFilename: false }] },
  },

  layer(['src/shared/**/*.ts', 'src/features/**/*.ts'], BOUNDARIES),
  layer(
    ['src/**/components/**/*.ts'],
    [
      ...BOUNDARIES,
      { group: ['**/api/*'], message: 'Los componentes no llaman a la API: usan un service inyectado.' },
    ],
  ),
  layer(
    ['src/**/services/**/*.ts'],
    [...BOUNDARIES, { group: ['**/components/*'], message: 'Los services no conocen a los componentes.' }],
    { 'no-restricted-globals': NO_DOM },
  ),
  layer(
    ['src/**/api/**/*.ts'],
    [
      ...BOUNDARIES,
      {
        group: ['**/services/*', '**/components/*'],
        message: 'La capa api solo hace fetch; no conoce services ni componentes.',
      },
    ],
    { 'no-restricted-globals': NO_DOM },
  ),

  prettier,
);
