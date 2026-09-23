import type { MorseAlphabet } from './MorseAlphabet';

/**
 * Manipulador automático de una baliza CW: convierte un mensaje en la secuencia de marcas (llave bajada) con
 * los tiempos del código morse (punto = 1 unidad, raya = 3, separación entre símbolos = 1, entre letras = 3,
 * entre palabras = 7) y lo repite en bucle con una pausa. Es determinista: depende solo del reloj.
 */
export class MorseKeyer {
  private static readonly UNITS = { dot: 1, dash: 3, symbol: 1, letter: 3, word: 7, repeat: 24 };
  private static readonly DASH = '-';

  private readonly marks: { start: number; end: number }[] = [];
  private readonly length: number;

  /**
   * Crea el manipulador.
   *
   * @param message Mensaje a transmitir.
   * @param unit Duración de un punto en segundos.
   * @param alphabet Código morse.
   * @param phase Desfase en segundos (para que las balizas no transmitan al unísono).
   */
  public constructor(
    message: string,
    private readonly unit: number,
    alphabet: MorseAlphabet,
    private readonly phase: number,
  ) {
    this.length = this.compose(message, alphabet);
  }

  /**
   * Indica si la llave está bajada (la portadora en el aire) en un instante.
   *
   * @param time Segundos del reloj de la simulación.
   * @returns `true` si transmite.
   */
  public keyed(time: number): boolean {
    const units = Math.max(time + this.phase, 0) / this.unit;
    const position = units % this.length;
    return this.marks.some(({ start, end }) => position >= start && position < end);
  }

  /**
   * Arma la secuencia de marcas del mensaje.
   *
   * @param message Mensaje.
   * @param alphabet Código morse.
   * @returns Largo total del ciclo en unidades (con la pausa final).
   */
  private compose(message: string, alphabet: MorseAlphabet): number {
    const { letter, word, repeat } = MorseKeyer.UNITS;
    let cursor = 0;
    message.split(' ').forEach((text, index) => {
      if (index > 0) {
        cursor += word - letter;
      }
      Array.from(text).forEach((character) => {
        cursor = this.letter(alphabet.encode(character), cursor) + letter;
      });
    });
    return Math.max(cursor - letter + repeat, 1);
  }

  /**
   * Agrega las marcas de una letra.
   *
   * @param code Puntos y rayas.
   * @param start Unidad donde empieza.
   * @returns Unidad donde termina su última marca.
   */
  private letter(code: string, start: number): number {
    const { dot, dash, symbol } = MorseKeyer.UNITS;
    let cursor = start;
    Array.from(code).forEach((mark, index) => {
      if (index > 0) {
        cursor += symbol;
      }
      const units = mark === MorseKeyer.DASH ? dash : dot;
      this.marks.push({ start: cursor, end: cursor + units });
      cursor += units;
    });
    return cursor;
  }
}
