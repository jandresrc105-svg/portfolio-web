import type { MorseAlphabet } from './MorseAlphabet';

/**
 * Decodificador de morse por umbral y tiempos (lo que haría el firmware de un receptor): recibe cada muestra
 * ya comparada con el umbral (portadora presente o no), descarta los pulsos más cortos que una fracción del
 * punto (ruido), mide cuánto dura cada marca y cada silencio y los clasifica con la duración estimada del
 * punto, que se adapta a la velocidad de quien transmite: marca corta = punto, larga = raya; silencio de más
 * de 2 puntos = fin de letra, de más de 5 = espacio entre palabras.
 */
export class MorseDecoder {
  private static readonly DOT = { initial: 0.09, min: 0.04, max: 0.3, adapt: 0.2 };
  private static readonly GAPS = { split: 2, letter: 2, word: 5, dash: 3 };
  private static readonly GLITCH = 0.35;
  private static readonly LIMIT = 30;
  private static readonly MAX_SYMBOLS = 7;
  private static readonly DOT_MARK = '.';
  private static readonly DASH_MARK = '-';

  private dot = MorseDecoder.DOT.initial;
  private level = false;
  private held = 0;
  private pending = 0;
  private spaced = true;
  private symbols = '';
  private text = '';
  private last = '';

  /**
   * Crea el decodificador.
   *
   * @param alphabet Código morse.
   */
  public constructor(private readonly alphabet: MorseAlphabet) {}

  /**
   * Texto decodificado (las últimas letras).
   *
   * @returns Texto.
   */
  public get decoded(): string {
    return this.text;
  }

  /**
   * Puntos y rayas de la letra en curso.
   *
   * @returns Patrón parcial.
   */
  public get pattern(): string {
    return this.symbols;
  }

  /**
   * Última letra reconocida con su patrón (p. ej. `.- = A`).
   *
   * @returns Texto, o vacío.
   */
  public get lastSymbol(): string {
    return this.last;
  }

  /**
   * Procesa una muestra.
   *
   * @param keyed Si la señal supera el umbral.
   * @param delta Segundos desde la muestra anterior.
   * @returns Letra reconocida en esta muestra, o `null`.
   */
  public feed(keyed: boolean, delta: number): string | null {
    this.held += delta;
    if (keyed === this.level) {
      this.pending = 0;
    } else {
      this.pending += delta;
      if (this.pending >= this.dot * MorseDecoder.GLITCH) {
        this.flip();
        return null;
      }
    }
    return this.level ? null : this.gap();
  }

  /**
   * Descarta la letra en curso (la señal se perdió), sin borrar el texto.
   */
  public reset(): void {
    this.symbols = '';
    this.level = false;
    this.held = 0;
    this.pending = 0;
  }

  /**
   * Empieza de cero (otra emisora).
   */
  public clear(): void {
    this.reset();
    this.text = '';
    this.last = '';
    this.spaced = true;
    this.dot = MorseDecoder.DOT.initial;
  }

  /**
   * Cambia de marca a silencio o al revés y clasifica la marca que terminó.
   */
  private flip(): void {
    const duration = this.held - this.pending;
    if (this.level) {
      this.classify(duration);
    }
    this.level = !this.level;
    this.held = this.pending;
    this.pending = 0;
  }

  /**
   * Clasifica una marca como punto o raya y ajusta la duración estimada del punto.
   *
   * @param duration Duración de la marca en segundos.
   */
  private classify(duration: number): void {
    const { min, max, adapt } = MorseDecoder.DOT;
    const { split, dash } = MorseDecoder.GAPS;
    const short = duration < this.dot * split;
    this.symbols += short ? MorseDecoder.DOT_MARK : MorseDecoder.DASH_MARK;
    const sample = short ? duration : duration / dash;
    this.dot = Math.min(Math.max(this.dot + (sample - this.dot) * adapt, min), max);
  }

  /**
   * Revisa el silencio en curso: cierra la letra o agrega el espacio entre palabras.
   *
   * @returns Letra cerrada, o `null`.
   */
  private gap(): string | null {
    const { letter, word } = MorseDecoder.GAPS;
    if (this.symbols !== '' && this.held > this.dot * letter) {
      return this.close();
    }
    if (!this.spaced && this.held > this.dot * word) {
      this.spaced = true;
      this.append(' ');
    }
    return null;
  }

  /**
   * Cierra la letra en curso y la agrega al texto.
   *
   * @returns Letra reconocida.
   */
  private close(): string {
    const code = this.symbols;
    const letter = this.alphabet.decode(code.length > MorseDecoder.MAX_SYMBOLS ? '' : code);
    this.last = `${code} = ${letter}`;
    this.symbols = '';
    this.spaced = false;
    this.append(letter);
    return letter;
  }

  /**
   * Agrega texto y conserva solo las últimas letras.
   *
   * @param text Texto.
   */
  private append(text: string): void {
    this.text = `${this.text}${text}`.slice(-MorseDecoder.LIMIT);
  }
}
