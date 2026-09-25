import type { CharacterPlacement } from './CharacterPlacement';

/**
 * Ubicación, postura base y colores de un personaje hecho a mano.
 */
export interface FigureOptions {
  /** Posición del suelo bajo el personaje y orientación. */
  readonly placement: CharacterPlacement;
  /** Alto de la cadera sobre el suelo (de pie o sentado), en metros. */
  readonly hips: number;
  /** Ancho del torso relativo al estándar (1 = normal, más = corpulento). */
  readonly girth: number;
  /** Colores de piel, cabello y ropa. */
  readonly palette: {
    /** Piel (cara, cuello, manos). */
    readonly skin: number;
    /** Cabello y cejas. */
    readonly hair: number;
    /** Camiseta o chaqueta (torso). */
    readonly top: number;
    /** Manga (brazo). */
    readonly sleeve: number;
    /** Antebrazo: la piel si la manga es corta o está recogida. */
    readonly forearm: number;
    /** Pantalón. */
    readonly pants: number;
    /** Zapatos. */
    readonly shoes: number;
  };
}
