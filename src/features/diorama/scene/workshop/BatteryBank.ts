/**
 * Banco de baterías del taller, cargado por los paneles del techo durante el día. De noche (siempre, en el
 * diorama) los paneles no dan nada: con red la batería se recarga despacio desde la red y sin red se descarga
 * mientras el inversor alimenta el taller, hasta un piso de reserva.
 */
export class BatteryBank {
  private static readonly START = 86;
  private static readonly RESERVE = 20;
  private static readonly DRAIN = 0.25;
  private static readonly RECHARGE = 0.1;
  private static readonly FULL = 100;

  private charge = BatteryBank.START;
  private grid = true;

  /**
   * Carga en porcentaje entero, como la muestra el controlador.
   *
   * @returns Porcentaje de 0 a 100.
   */
  public get percent(): number {
    return Math.floor(this.charge);
  }

  /**
   * Si hay red eléctrica.
   *
   * @returns `true` con red.
   */
  public get onGrid(): boolean {
    return this.grid;
  }

  /**
   * Cambia la fuente: con red se recarga, sin red el inversor toma la batería.
   *
   * @param grid `true` si hay red.
   */
  public setGrid(grid: boolean): void {
    this.grid = grid;
  }

  /**
   * Avanza la carga o la descarga.
   *
   * @param delta Segundos desde el frame anterior.
   * @returns `true` si cambió el porcentaje mostrado.
   */
  public update(delta: number): boolean {
    const before = this.percent;
    const rate = this.grid ? BatteryBank.RECHARGE : -BatteryBank.DRAIN;
    this.charge = Math.min(Math.max(this.charge + rate * delta, BatteryBank.RESERVE), BatteryBank.FULL);
    return this.percent !== before;
  }
}
