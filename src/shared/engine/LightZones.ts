import { PointLight, SpotLight, type Light, type Object3D } from 'three';

/**
 * Luces por zona: cada luz puntual o foco con alcance limitado pertenece a una zona de la escena (la calle, el
 * taller) y solo se enciende en el shader mientras su zona está en cámara. Cada luz encendida la calcula cada
 * píxel iluminado, aunque esté lejos, así que apagar las de la zona que no se ve ahorra trabajo de la GPU sin
 * cambiar la imagen. Cambiar cuántas luces hay obliga a three.js a usar otra variante de cada shader: por eso
 * las combinaciones son pocas y se compilan todas al cargar ({@link LightZones.precompile}); lo que se crea
 * después (los lotes que se rearman) se prepara igual con {@link LightZones.prepare}, sin tirones.
 * Las luces sin límite de alcance (distancia 0) no se tocan.
 */
export class LightZones {
  private readonly zones = new Map<string, Light[]>();
  private combinations: readonly (readonly string[])[] = [];
  private visible: readonly string[] = [];

  /**
   * Prepara las zonas.
   *
   * @param compile Compila los shaders de una raíz con las luces actuales, para el destino real del render.
   */
  public constructor(private readonly compile: (root?: Object3D) => Promise<void>) {}

  /**
   * Asigna a una zona las luces con alcance limitado que cuelgan de unas raíces.
   *
   * @param zone Nombre de la zona.
   * @param roots Raíces de las piezas de la zona.
   */
  public assign(zone: string, roots: readonly Object3D[]): void {
    const lights = this.zones.get(zone) ?? [];
    roots.forEach((root) => {
      root.traverse((object) => {
        if ((object instanceof PointLight || object instanceof SpotLight) && object.distance > 0) {
          lights.push(object);
        }
      });
    });
    this.zones.set(zone, lights);
    this.visible = [...this.zones.keys()];
  }

  /**
   * Enciende solo las zonas indicadas.
   *
   * @param visible Zonas en cámara.
   */
  public show(visible: readonly string[]): void {
    this.visible = visible;
    this.zones.forEach((lights, zone) => {
      const on = visible.includes(zone);
      lights.forEach((light) => {
        light.visible = on;
      });
    });
  }

  /**
   * Compila las variantes de shader de cada combinación de zonas que se va a usar y deja todo encendido.
   *
   * @param combinations Combinaciones de zonas visibles (además de todas encendidas).
   * @param extras Objetos fuera de la escena que también se compilan (p. ej. variantes que se usarán después).
   * @returns Promesa que se resuelve al terminar.
   */
  public async precompile(
    combinations: readonly (readonly string[])[],
    extras: readonly Object3D[] = [],
  ): Promise<void> {
    this.combinations = combinations;
    for (const combination of [...combinations, [...this.zones.keys()]]) {
      this.show(combination);
      await Promise.all([this.compile(), ...extras.map((extra) => this.compile(extra))]);
    }
  }

  /**
   * Prepara objetos creados después de la carga en todas las combinaciones de zonas, y deja las zonas como
   * estaban. Si ya hay programas con la misma clave (lo normal: otro material igual los usa), no se compila
   * nada: solo quedan asignados y no se enlazan al verse por primera vez.
   *
   * @param roots Objetos nuevos.
   */
  public prepare(roots: readonly Object3D[]): void {
    const current = this.visible;
    [...this.combinations, [...this.zones.keys()]].forEach((combination) => {
      this.show(combination);
      roots.forEach((root) => {
        void this.compile(root);
      });
    });
    this.show(current);
  }
}
