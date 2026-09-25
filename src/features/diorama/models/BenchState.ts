/**
 * Lo que la escena necesita para dibujar el banco del taller.
 */
export interface BenchState {
  /** Etiqueta serigrafiada de cada placa (un proyecto), en orden. */
  readonly boards: readonly string[];
  /** Placa que está en el banco de pruebas (índice desde 0). */
  readonly selected: number;
  /** Si la fuente de laboratorio está encendida (energiza la placa del banco y la protoboard). */
  readonly supply: boolean;
  /** Si la lámpara de lupa está encendida. */
  readonly lamp: boolean;
  /** Voltaje que entrega la fuente. */
  readonly volts: number;
  /** Corriente que consume la placa del banco. */
  readonly amps: number;
}
