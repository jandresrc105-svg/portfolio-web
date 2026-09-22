import jsdocOnlyComments from './rules/jsdoc-only-comments.js';
import singleDeclaration from './rules/single-declaration.js';

/**
 * Plugin ESLint local con las reglas de arquitectura del portafolio.
 * @type {import('eslint').ESLint.Plugin}
 */
export default {
  meta: { name: 'eslint-plugin-portfolio', version: '1.0.0' },
  rules: {
    'single-declaration': singleDeclaration,
    'jsdoc-only-comments': jsdocOnlyComments,
  },
};
