/**
 * Código morse internacional: letras, números y algunos signos con su patrón de puntos (`.`) y rayas (`-`).
 * Lo usan el manipulador de las balizas (para transmitir) y el decodificador (para reconocer letras).
 */
export class MorseAlphabet {
  private static readonly CODES = [
    { letter: 'A', code: '.-' },
    { letter: 'B', code: '-...' },
    { letter: 'C', code: '-.-.' },
    { letter: 'D', code: '-..' },
    { letter: 'E', code: '.' },
    { letter: 'F', code: '..-.' },
    { letter: 'G', code: '--.' },
    { letter: 'H', code: '....' },
    { letter: 'I', code: '..' },
    { letter: 'J', code: '.---' },
    { letter: 'K', code: '-.-' },
    { letter: 'L', code: '.-..' },
    { letter: 'M', code: '--' },
    { letter: 'N', code: '-.' },
    { letter: 'O', code: '---' },
    { letter: 'P', code: '.--.' },
    { letter: 'Q', code: '--.-' },
    { letter: 'R', code: '.-.' },
    { letter: 'S', code: '...' },
    { letter: 'T', code: '-' },
    { letter: 'U', code: '..-' },
    { letter: 'V', code: '...-' },
    { letter: 'W', code: '.--' },
    { letter: 'X', code: '-..-' },
    { letter: 'Y', code: '-.--' },
    { letter: 'Z', code: '--..' },
    { letter: '0', code: '-----' },
    { letter: '1', code: '.----' },
    { letter: '2', code: '..---' },
    { letter: '3', code: '...--' },
    { letter: '4', code: '....-' },
    { letter: '5', code: '.....' },
    { letter: '6', code: '-....' },
    { letter: '7', code: '--...' },
    { letter: '8', code: '---..' },
    { letter: '9', code: '----.' },
    { letter: '/', code: '-..-.' },
    { letter: '?', code: '..--..' },
  ];
  private static readonly UNKNOWN = '?';

  private readonly byLetter = new Map(MorseAlphabet.CODES.map(({ letter, code }) => [letter, code]));
  private readonly byCode = new Map(MorseAlphabet.CODES.map(({ letter, code }) => [code, letter]));

  /**
   * Patrón morse de una letra.
   *
   * @param letter Letra (se toma en mayúscula).
   * @returns Puntos y rayas, o vacío si la letra no existe en el código.
   */
  public encode(letter: string): string {
    return this.byLetter.get(letter.toUpperCase()) ?? '';
  }

  /**
   * Letra de un patrón morse.
   *
   * @param code Puntos y rayas.
   * @returns Letra, o `?` si el patrón no existe (un error de recepción).
   */
  public decode(code: string): string {
    return this.byCode.get(code) ?? MorseAlphabet.UNKNOWN;
  }
}
