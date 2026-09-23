import {
  PointLight,
  SpotLight,
  type Camera,
  type Light,
  type Object3D,
  type Scene,
  type WebGLRenderer,
} from 'three';

/**
 * Luces por zona: cada luz puntual o foco con alcance limitado pertenece a una zona de la escena (la calle, el
 * taller) y solo se enciende en el shader mientras su zona está en cámara. Cada luz encendida la calcula cada
 * píxel iluminado, aunque esté lejos, así que apagar las de la zona que no se ve ahorra trabajo de la GPU sin
 * cambiar la imagen. Cambiar cuántas luces hay obliga a three.js a usar otra variante de cada shader: por eso
 * las combinaciones son pocas y se compilan todas al cargar ({@link LightZones.precompile}), sin tirones.
 * Las luces sin límite de alcance (distancia 0) no se tocan.
 */
export class LightZones {
  private readonly zones = new Map<string, Light[]>();

  /**
   * Prepara las zonas.
   *
   * @param renderer Renderer que compila los shaders.
   * @param scene Escena.
   * @param camera Cámara con la que se compila.
   */
  public constructor(
    private readonly renderer: WebGLRenderer,
    private readonly scene: Scene,
    private readonly camera: Camera,
  ) {}

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
  }

  /**
   * Enciende solo las zonas indicadas.
   *
   * @param visible Zonas en cámara.
   */
  public show(visible: readonly string[]): void {
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
   * @param combinations Combinaciones de zonas visibles.
   * @returns Promesa que se resuelve al terminar.
   */
  public async precompile(combinations: readonly (readonly string[])[]): Promise<void> {
    for (const combination of combinations) {
      this.show(combination);
      await this.renderer.compileAsync(this.scene, this.camera);
    }
    this.show([...this.zones.keys()]);
  }
}
