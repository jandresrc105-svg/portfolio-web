import path from 'node:path';

const ALLOWED = new Set([
  'ClassDeclaration',
  'TSInterfaceDeclaration',
  'TSTypeAliasDeclaration',
  'TSEnumDeclaration',
]);

/**
 * Obtiene la declaración real de una sentencia de nivel superior, desenvolviendo los `export`.
 * @param {import('estree').Node} statement Sentencia del cuerpo del programa.
 * @returns {import('estree').Node | null} Declaración o null si es un re-export.
 */
function unwrap(statement) {
  if (statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportDefaultDeclaration') {
    return statement.declaration ?? null;
  }
  return statement;
}

/**
 * Regla: cada archivo contiene exactamente una declaración (clase, interfaz, tipo o enum),
 * sin variables ni funciones sueltas, y el nombre del archivo coincide con el de la declaración.
 * El punto de entrada puede declarar su clase y ejecutar una única sentencia de arranque.
 * @type {import('eslint').Rule.RuleModule}
 */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Un archivo, una declaración; nada fuera de ella.' },
    schema: [
      {
        type: 'object',
        properties: {
          entry: { type: 'boolean' },
          matchFilename: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      forbidden:
        'Solo se permite una clase, interfaz, tipo o enum por archivo. Mueve "{{kind}}" dentro de la clase como miembro estático/privado o a su propio archivo.',
      multiple: 'El archivo tiene {{count}} declaraciones. Regla: 1 archivo = 1 declaración.',
      reexport: 'No se permiten barrels ni re-exports. Importa directamente desde el archivo de la clase.',
      filename: 'El archivo debe llamarse "{{name}}.ts" para coincidir con su declaración.',
      entryStatement:
        'El punto de entrada solo puede ejecutar una sentencia de arranque (p. ej. `new Main().start();`).',
    },
  },
  create(context) {
    const { entry = false, matchFilename = true } = context.options[0] ?? {};

    return {
      Program(program) {
        const declarations = [];
        let expressions = 0;

        for (const statement of program.body) {
          if (statement.type === 'ImportDeclaration') continue;
          if (entry && statement.type === 'ExpressionStatement') {
            expressions += 1;
            if (expressions > 1) context.report({ node: statement, messageId: 'entryStatement' });
            continue;
          }
          const declaration = unwrap(statement);
          if (!declaration) {
            context.report({ node: statement, messageId: 'reexport' });
            continue;
          }
          if (!ALLOWED.has(declaration.type)) {
            context.report({ node: statement, messageId: 'forbidden', data: { kind: declaration.type } });
            continue;
          }
          declarations.push(declaration);
        }

        if (declarations.length > 1) {
          for (const extra of declarations.slice(1)) {
            context.report({ node: extra, messageId: 'multiple', data: { count: declarations.length } });
          }
        }

        const [only] = declarations;
        if (matchFilename && only?.id?.name) {
          const base = path.basename(context.filename).replace(/\.(d\.)?ts$/, '');
          if (base !== only.id.name) {
            context.report({ node: only.id, messageId: 'filename', data: { name: only.id.name } });
          }
        }
      },
    };
  },
};
