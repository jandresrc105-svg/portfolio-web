/**
 * Regla: prohíbe comentarios de línea y de bloque. Solo se permiten bloques JSDoc/TSDoc (`/** ... *\/`).
 * La documentación va en JSDoc; el código debe explicarse por sí mismo.
 * @type {import('eslint').Rule.RuleModule}
 */
export default {
  meta: {
    type: 'suggestion',
    docs: { description: 'Solo se permiten comentarios JSDoc/TSDoc.' },
    schema: [],
    messages: {
      noComment:
        'No se permiten comentarios. Documenta con JSDoc (/** ... */) o renombra para que el código se explique solo.',
    },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          const isJsDoc = comment.type === 'Block' && comment.value.startsWith('*');
          if (comment.type === 'Shebang' || isJsDoc) continue;
          context.report({ loc: comment.loc, messageId: 'noComment' });
        }
      },
    };
  },
};
