/**
 * Generador de buffers de ruido para sintetizar sonidos sin archivos de audio.
 */
export class NoiseBuffer {
  private static readonly BROWN_LEAK = 0.02;
  private static readonly BROWN_GAIN = 3.5;

  /**
   * Crea el generador para un contexto de audio.
   *
   * @param context Contexto de audio donde vivirán los buffers.
   */
  public constructor(private readonly context: BaseAudioContext) {}

  /**
   * Ruido blanco: energía igual en todas las frecuencias (siseo de lluvia, chasquidos).
   *
   * @param seconds Duración del buffer.
   * @returns Buffer mono.
   */
  public white(seconds: number): AudioBuffer {
    const buffer = this.empty(seconds);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * Ruido marrón: energía concentrada en graves (retumbo de truenos, cuerpo de la lluvia).
   *
   * @param seconds Duración del buffer.
   * @returns Buffer mono.
   */
  public brown(seconds: number): AudioBuffer {
    const buffer = this.empty(seconds);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let index = 0; index < data.length; index += 1) {
      last = (last + NoiseBuffer.BROWN_LEAK * (Math.random() * 2 - 1)) / (1 + NoiseBuffer.BROWN_LEAK);
      data[index] = last * NoiseBuffer.BROWN_GAIN;
    }
    return buffer;
  }

  /**
   * Crea un buffer mono vacío.
   *
   * @param seconds Duración.
   * @returns Buffer.
   */
  private empty(seconds: number): AudioBuffer {
    const { sampleRate } = this.context;
    return this.context.createBuffer(1, Math.floor(sampleRate * seconds), sampleRate);
  }
}
