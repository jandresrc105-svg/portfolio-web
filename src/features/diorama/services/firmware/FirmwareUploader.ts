import { FirmwarePhase } from '../../models/FirmwarePhase';
import type { FirmwareProgram } from '../../models/FirmwareProgram';
import type { FirmwareUpload } from '../../models/FirmwareUpload';

/**
 * Cronología de una subida de firmware como la del IDE de Arduino con esptool: compila, se conecta al chip
 * (lo pone en modo de arranque con DTR/RTS), escribe la flash por el puerto serie y reinicia. Devuelve cómo
 * va la subida en cada instante, sin estado propio.
 */
export class FirmwareUploader {
  private static readonly TIMES = { compile: 1.3, connect: 2, write: 4.3, done: 4.8 };
  private static readonly FLASH = { partition: 1310720, address: '0x00010000' };
  private static readonly PERCENT = 100;
  private static readonly LOCALE = 'es';

  /**
   * Cómo va la subida.
   *
   * @param elapsed Segundos desde que empezó.
   * @param program Programa que se sube.
   * @returns Etapa, avance, texto y líneas de la consola.
   */
  public at(elapsed: number, program: FirmwareProgram): FirmwareUpload {
    const { compile, done } = FirmwareUploader.TIMES;
    const written = FirmwareUploader.written(elapsed);
    return {
      phase: elapsed < compile ? FirmwarePhase.Compiling : FirmwarePhase.Flashing,
      progress: Math.min(elapsed / done, 1),
      label: FirmwareUploader.label(elapsed, written),
      lines: FirmwareUploader.lines(elapsed, written, program),
      done: elapsed >= done,
    };
  }

  /**
   * Porcentaje de la flash ya escrito.
   *
   * @param elapsed Segundos desde que empezó.
   * @returns Porcentaje entero.
   */
  private static written(elapsed: number): number {
    const { connect, write } = FirmwareUploader.TIMES;
    const share = Math.min(Math.max((elapsed - connect) / (write - connect), 0), 1);
    return Math.round(share * FirmwareUploader.PERCENT);
  }

  /**
   * Texto corto de la barra de estado.
   *
   * @param elapsed Segundos desde que empezó.
   * @param written Porcentaje escrito.
   * @returns Texto.
   */
  private static label(elapsed: number, written: number): string {
    const { compile, connect, write } = FirmwareUploader.TIMES;
    if (elapsed < compile) {
      return 'Compilando…';
    }
    if (elapsed < connect) {
      return 'Conectando con la ESP32…';
    }
    return elapsed < write ? `Subiendo ${String(written)} %` : 'Hecho · reiniciando';
  }

  /**
   * Salida del compilador y de esptool hasta este momento.
   *
   * @param elapsed Segundos desde que empezó.
   * @param written Porcentaje escrito.
   * @param program Programa que se sube.
   * @returns Líneas.
   */
  private static lines(elapsed: number, written: number, program: FirmwareProgram): string[] {
    const { compile, connect, write } = FirmwareUploader.TIMES;
    const { partition, address } = FirmwareUploader.FLASH;
    const lines = [`Compilando ${program.file} para ESP32 Dev Module…`];
    if (elapsed >= compile) {
      const share = Math.round((program.bytes * FirmwareUploader.PERCENT) / partition);
      const bytes = program.bytes.toLocaleString(FirmwareUploader.LOCALE);
      lines.push(`El boceto usa ${bytes} bytes (${String(share)} %) de la flash.`);
      lines.push('esptool.py v4.6 · Conectando….');
    }
    if (elapsed >= connect) {
      lines.push('Chip ESP32-D0WD-V3 (rev 3) · cristal 40 MHz · 921600 baud');
      lines.push(`Escribiendo en ${address}… (${String(written)} %)`);
    }
    if (elapsed >= write) {
      lines.push('Hash verificado. Hecho: reinicio por el pin RTS…');
    }
    return lines;
  }
}
