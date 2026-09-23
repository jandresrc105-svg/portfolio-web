import type { ResistorBand } from '../models/ResistorBand';
import type { ResistorCode } from '../models/ResistorCode';

/**
 * Código de colores de 4 bandas (IEC 60062): primera cifra, segunda cifra, multiplicador y tolerancia. El
 * valor se lleva al más cercano de la serie E24 (tolerancia ±5 %, banda de oro), que es lo que se consigue
 * en una tienda de componentes.
 */
export class ResistorColorCode {
  private static readonly DIGITS: readonly ResistorBand[] = [
    { name: 'Negro', color: 0x141414, metallic: false },
    { name: 'Marrón', color: 0x6b3a1e, metallic: false },
    { name: 'Rojo', color: 0xc8201c, metallic: false },
    { name: 'Naranja', color: 0xe8661a, metallic: false },
    { name: 'Amarillo', color: 0xf2c81d, metallic: false },
    { name: 'Verde', color: 0x2f9e3c, metallic: false },
    { name: 'Azul', color: 0x2350c8, metallic: false },
    { name: 'Violeta', color: 0x7a36b8, metallic: false },
    { name: 'Gris', color: 0x80868c, metallic: false },
    { name: 'Blanco', color: 0xeeeeea, metallic: false },
  ];
  private static readonly GOLD: ResistorBand = { name: 'Oro', color: 0xd4a53a, metallic: true };
  private static readonly E24 = [
    { value: 1.0 },
    { value: 1.1 },
    { value: 1.2 },
    { value: 1.3 },
    { value: 1.5 },
    { value: 1.6 },
    { value: 1.8 },
    { value: 2.0 },
    { value: 2.2 },
    { value: 2.4 },
    { value: 2.7 },
    { value: 3.0 },
    { value: 3.3 },
    { value: 3.6 },
    { value: 3.9 },
    { value: 4.3 },
    { value: 4.7 },
    { value: 5.1 },
    { value: 5.6 },
    { value: 6.2 },
    { value: 6.8 },
    { value: 7.5 },
    { value: 8.2 },
    { value: 9.1 },
    { value: 10 },
  ];
  private static readonly BASE = 10;
  private static readonly EPSILON = 1e-9;
  private static readonly PRECISION = 10;

  /**
   * Código de colores de una resistencia.
   *
   * @param ohms Valor pedido, en ohmios.
   * @returns Bandas, valor normalizado y si coincide con el pedido.
   */
  public encode(ohms: number): ResistorCode {
    if (ohms <= 0) {
      return { bands: [this.digit(0)], ohms: 0, exact: true };
    }
    const standard = ResistorColorCode.nearest(ohms);
    const exponent = ResistorColorCode.exponent(standard);
    const significant = Math.round(standard / ResistorColorCode.BASE ** (exponent - 1));
    const first = Math.floor(significant / ResistorColorCode.BASE);
    const second = significant % ResistorColorCode.BASE;
    const multiplier = exponent - 1 < 0 ? ResistorColorCode.GOLD : this.digit(exponent - 1);
    return {
      bands: [this.digit(first), this.digit(second), multiplier, ResistorColorCode.GOLD],
      ohms: standard,
      exact: Math.abs(standard - ohms) < ResistorColorCode.EPSILON,
    };
  }

  /**
   * Banda de una cifra.
   *
   * @param value Cifra (0–9).
   * @returns Banda.
   */
  private digit(value: number): ResistorBand {
    return ResistorColorCode.DIGITS[value] ?? ResistorColorCode.GOLD;
  }

  /**
   * Valor de la serie E24 más cercano.
   *
   * @param ohms Valor pedido (mayor que 0).
   * @returns Valor normalizado.
   */
  private static nearest(ohms: number): number {
    const scale = ResistorColorCode.BASE ** ResistorColorCode.exponent(ohms);
    const mantissa = ohms / scale;
    const best = ResistorColorCode.E24.reduce((closest, item) =>
      Math.abs(item.value - mantissa) < Math.abs(closest.value - mantissa) ? item : closest,
    );
    const precision = ResistorColorCode.PRECISION;
    return Math.round(best.value * scale * precision) / precision;
  }

  /**
   * Potencia de diez de un valor (la década donde cae).
   *
   * @param value Valor mayor que 0.
   * @returns Exponente entero.
   */
  private static exponent(value: number): number {
    return Math.floor(Math.log10(value) + ResistorColorCode.EPSILON);
  }
}
