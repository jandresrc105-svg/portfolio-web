/**
 * Controles del equipo de luces y ambiente del taller: las palancas del tablero de interruptores, el dimmer
 * del techo y la bola de plasma de la calle (que también se prende con un clic sobre el vidrio).
 */
export enum ShopLightsControl {
  /** Palanca de las luminarias del techo. */
  Ceiling = 'ceiling',
  /** Palanca de la tira LED del banco. */
  Bench = 'bench',
  /** Palanca del letrero de neón OPEN. */
  Sign = 'sign',
  /** Palanca de la bola de plasma. */
  Plasma = 'plasma',
  /** Perilla del dimmer del techo (se arrastra). */
  Dimmer = 'dimmer',
  /** La bola de plasma misma, sobre el huacal de la calle. */
  Globe = 'globe',
}
