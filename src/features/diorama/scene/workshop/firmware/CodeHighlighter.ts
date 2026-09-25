import type { CodeToken } from './CodeToken';

/**
 * Resaltado de sintaxis de C++ (Arduino) con la paleta One Dark: divide cada línea en comentarios, textos,
 * directivas, números, palabras clave, tipos, funciones y constantes.
 */
export class CodeHighlighter {
  public static readonly COLORS = {
    plain: '#abb2bf',
    comment: '#7f848e',
    string: '#98c379',
    directive: '#e06c75',
    number: '#d19a66',
    keyword: '#c678dd',
    type: '#e5c07b',
    call: '#61afef',
    constant: '#56b6c2',
  };

  private static readonly PATTERN =
    /(\/\/.*$)|("(?:[^"\\]|\\.)*"|<[\w.]+>)|(#\w+)|(\b0x[0-9A-Fa-f]+\b|\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|(\s+|.)/g;
  private static readonly KEYWORDS = new Set([
    'if',
    'else',
    'for',
    'while',
    'return',
    'const',
    'true',
    'false',
    'sizeof',
  ]);
  private static readonly TYPES = new Set(['void', 'int', 'bool', 'byte', 'Servo', 'Punto', 'Cola']);
  private static readonly GROUPS = ['comment', 'string', 'directive', 'number'] as const;

  /**
   * Divide una línea en trozos coloreados.
   *
   * @param line Línea de código.
   * @returns Trozos.
   */
  public tokens(line: string): CodeToken[] {
    return [...line.matchAll(CodeHighlighter.PATTERN)].map((match) => ({
      text: match[0],
      color: CodeHighlighter.colorOf(match, line),
    }));
  }

  /**
   * Color de un trozo según el grupo de la expresión que lo reconoció.
   *
   * @param match Coincidencia.
   * @param line Línea completa (para saber qué sigue a un identificador).
   * @returns Color CSS.
   */
  private static colorOf(match: RegExpMatchArray, line: string): string {
    const group = CodeHighlighter.GROUPS.findIndex((_, index) => match[index + 1] !== undefined);
    const name = CodeHighlighter.GROUPS[group];
    if (name) {
      return CodeHighlighter.COLORS[name];
    }
    const word = match[CodeHighlighter.GROUPS.length + 1];
    return word === undefined
      ? CodeHighlighter.COLORS.plain
      : CodeHighlighter.wordColor(word, line, match.index ?? 0);
  }

  /**
   * Color de un identificador: palabra clave, tipo, función llamada, constante en mayúsculas o nombre común.
   *
   * @param word Identificador.
   * @param line Línea completa.
   * @param at Posición del identificador en la línea.
   * @returns Color CSS.
   */
  private static wordColor(word: string, line: string, at: number): string {
    const { COLORS } = CodeHighlighter;
    if (CodeHighlighter.KEYWORDS.has(word)) {
      return COLORS.keyword;
    }
    if (CodeHighlighter.TYPES.has(word)) {
      return COLORS.type;
    }
    if (
      line
        .slice(at + word.length)
        .trimStart()
        .startsWith('(')
    ) {
      return COLORS.call;
    }
    return word === word.toUpperCase() ? COLORS.constant : COLORS.plain;
  }
}
