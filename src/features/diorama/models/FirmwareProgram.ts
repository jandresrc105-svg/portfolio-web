import type { FirmwareIo } from './FirmwareIo';

/**
 * Programa que se puede subir a la placa (patrón Strategy): su código fuente, que se muestra en el editor de
 * la laptop, y su comportamiento real, que corre en la placa simulada con `setup` y `loop` como en Arduino.
 */
export interface FirmwareProgram {
  /** Nombre en la lista de programas. */
  readonly name: string;
  /** Archivo del boceto. */
  readonly file: string;
  /** Tamaño del binario compilado, en bytes. */
  readonly bytes: number;
  /** Líneas del código fuente. */
  readonly source: readonly string[];
  /** Pausa de cada vuelta de `loop` en ms, con el potenciómetro al mínimo (`slow`) y al máximo (`fast`). */
  readonly delay: { readonly slow: number; readonly fast: number };

  /**
   * Prepara el programa después de un reinicio.
   *
   * @param io Hardware de la placa.
   */
  setup(io: FirmwareIo): void;

  /**
   * Una vuelta del lazo principal.
   *
   * @param io Hardware de la placa.
   */
  loop(io: FirmwareIo): void;
}
