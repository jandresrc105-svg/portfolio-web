import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  Vector2,
} from 'three';
import type { SeededRandom } from '@shared/core/math/SeededRandom';
import { SceneObject } from '@shared/engine/SceneObject';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import type { Updatable } from '@shared/engine/Updatable';
import type { CanvasTextureFactory } from '../CanvasTextureFactory';
import type { MaterialLibrary } from '../MaterialLibrary';

/**
 * Bol de ramen humeante con palillos. El vapor son partículas que suben, se abren y se desvanecen.
 */
export class RamenBowl extends SceneObject implements Updatable {
  private static readonly POSITION = { x: 0.35, y: 1.09, z: 0.8 };
  private static readonly BOWL = { radius: 0.17, foot: 0.07, height: 0.12, segments: 12 };
  private static readonly BROTH = { radius: 0.155, y: 0.1, color: 0xc98a3c, emissive: 0x5a2f0c };
  private static readonly CHOPSTICK = { length: 0.36, size: 0.012, y: 0.14, spread: 0.03, tilt: 0.25 };
  private static readonly STEAM = {
    count: 36,
    height: 0.75,
    speed: 0.16,
    spread: 0.1,
    size: 0.22,
    opacity: 0.2,
  };

  private static readonly STEAM_ORIGIN = 0.4;

  private readonly steamOffsets: number[] = [];
  private steam: Points | null = null;

  /**
   * Crea el bol.
   *
   * @param materials Materiales compartidos.
   * @param textures Fábrica de texturas.
   * @param random Generador determinista.
   */
  public constructor(
    private readonly materials: MaterialLibrary,
    private readonly textures: CanvasTextureFactory,
    private readonly random: SeededRandom,
  ) {
    super();
  }

  /**
   * @inheritdoc
   */
  public update(_delta: number, elapsed: number): void {
    if (!this.steam) {
      return;
    }
    const position = this.steam.geometry.getAttribute('position');
    const color = this.steam.geometry.getAttribute('color');
    this.steamOffsets.forEach((offset, index) => {
      const life = (elapsed * RamenBowl.STEAM.speed + offset) % 1;
      const [x, y, z] = RamenBowl.steamPosition(offset, life, elapsed);
      position.setXYZ(index, x, y, z);
      const fade = Math.sin(life * Math.PI);
      color.setXYZ(index, fade, fade, fade);
    });
    position.needsUpdate = true;
    color.needsUpdate = true;
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    this.add(new Mesh(RamenBowl.bowlGeometry(), this.materials.ceramic));
    const { radius, y, color, emissive } = RamenBowl.BROTH;
    const broth = new Mesh(
      new CircleGeometry(radius, GeometryDetail.High),
      new MeshStandardMaterial({ color, emissive, roughness: 0.2 }),
    );
    broth.rotation.x = -Math.PI / 2;
    this.add(broth, { x: 0, y, z: 0 });
    this.buildChopsticks();
    this.steam = this.add(this.buildSteam(), { x: 0, y: RamenBowl.BROTH.y, z: 0 });
    this.root.position.copy(RamenBowl.POSITION);
  }

  /**
   * Par de palillos apoyados sobre el borde.
   */
  private buildChopsticks(): void {
    const { length, size, y, spread, tilt } = RamenBowl.CHOPSTICK;
    [-spread, spread].forEach((z) => {
      const stick = this.add(new Mesh(new BoxGeometry(length, size, size), this.materials.woodLight), {
        x: 0,
        y,
        z,
      });
      stick.rotation.y = tilt;
    });
  }

  /**
   * Partículas de vapor con desfase aleatorio.
   *
   * @returns Sistema de partículas.
   */
  private buildSteam(): Points {
    const { count } = RamenBowl.STEAM;
    for (let index = 0; index < count; index += 1) {
      this.steamOffsets.push(this.random.next());
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(count * 3), 3));
    const points = new Points(geometry, this.steamMaterial());
    points.frustumCulled = false;
    return points;
  }

  /**
   * Material aditivo de las partículas; el color por vértice controla el desvanecimiento.
   *
   * @returns Material de puntos.
   */
  private steamMaterial(): PointsMaterial {
    const { size, opacity } = RamenBowl.STEAM;
    return new PointsMaterial({
      size,
      map: this.own(this.textures.softDot()),
      vertexColors: true,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: AdditiveBlending,
    });
  }

  /**
   * Posición de una partícula de vapor: sube, se abre y oscila con el aire.
   *
   * @param offset Desfase propio de la partícula [0, 1).
   * @param life Vida de la partícula [0, 1).
   * @param elapsed Tiempo actual.
   * @returns Coordenadas xyz locales.
   */
  private static steamPosition(offset: number, life: number, elapsed: number): [number, number, number] {
    const { height, spread } = RamenBowl.STEAM;
    const angle = offset * Math.PI * 2;
    const drift = Math.sin(elapsed + angle) * spread * life;
    const origin = spread * RamenBowl.STEAM_ORIGIN;
    return [drift + Math.cos(angle) * origin, life * height, Math.sin(angle) * origin];
  }

  /**
   * Perfil del bol girado.
   *
   * @returns Geometría del bol.
   */
  private static bowlGeometry(): LatheGeometry {
    const { radius, foot, height, segments } = RamenBowl.BOWL;
    const profile: Vector2[] = [];
    for (let step = 0; step <= segments; step += 1) {
      const t = step / segments;
      profile.push(new Vector2(foot + (radius - foot) * Math.sin((t * Math.PI) / 2), t * height));
    }
    return new LatheGeometry(profile, segments * 3);
  }
}
