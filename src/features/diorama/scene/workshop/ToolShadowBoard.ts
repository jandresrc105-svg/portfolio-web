import { Mesh, MeshStandardMaterial, PlaneGeometry, type CanvasTexture } from 'three';
import type { ToolOutline } from '../../models/ToolOutline';
import type { CanvasTextureFactory } from '../CanvasTextureFactory';

/**
 * Tablero de siluetas ("shadow board") de la pared de herramientas: la forma de cada herramienta pintada
 * detrás de su gancho, oscura y con el borde ámbar (el trazo va debajo del relleno para que solo quede el
 * contorno exterior), para que se vea al instante cuál falta. Es un solo plano
 * con una textura dibujada una vez.
 */
export class ToolShadowBoard {
  private static readonly PIXELS_PER_METER = 440;
  private static readonly PAINT = { fill: '#151a21', stroke: '#e8a93c', line: 0.0044 };
  private static readonly FINISH = {
    roughness: 0.8,
    metalness: 0,
    envMapIntensity: 0.1,
    transparent: true,
    depthWrite: false,
  };

  /**
   * Crea el tablero.
   *
   * @param textures Fábrica de texturas.
   */
  public constructor(private readonly textures: CanvasTextureFactory) {}

  /**
   * Pinta las siluetas sobre un plano del tamaño de la zona.
   *
   * @param zone Zona de la pared (centro y medidas, en metros).
   * @param zone.x Centro horizontal.
   * @param zone.y Centro vertical.
   * @param zone.width Ancho.
   * @param zone.height Alto.
   * @param tools Silueta y posición de cada herramienta.
   * @returns Plano (hay que fijarle la profundidad) y su textura (para liberarla).
   */
  public build(
    zone: { x: number; y: number; width: number; height: number },
    tools: readonly { x: number; y: number; outline: readonly ToolOutline[] }[],
  ): { mesh: Mesh; texture: CanvasTexture } {
    const scale = ToolShadowBoard.PIXELS_PER_METER;
    const texture = this.textures.paint(zone.width * scale, zone.height * scale, (context) => {
      context.scale(scale, -scale);
      context.translate(zone.width / 2 - zone.x, -zone.height / 2 - zone.y);
      tools.forEach((tool) => {
        ToolShadowBoard.paint(context, tool);
      });
    });
    const material = new MeshStandardMaterial({ ...ToolShadowBoard.FINISH, map: texture });
    const mesh = new Mesh(new PlaneGeometry(zone.width, zone.height), material);
    mesh.position.set(zone.x, zone.y, 0);
    return { mesh, texture };
  }

  /**
   * Pinta la silueta de una herramienta.
   *
   * @param context Contexto (en metros, y hacia arriba).
   * @param tool Posición y formas.
   * @param tool.x Horizontal del origen de la herramienta.
   * @param tool.y Altura del origen.
   * @param tool.outline Formas de la silueta.
   */
  private static paint(
    context: CanvasRenderingContext2D,
    tool: { x: number; y: number; outline: readonly ToolOutline[] },
  ): void {
    const { fill, stroke, line } = ToolShadowBoard.PAINT;
    context.beginPath();
    tool.outline.forEach((shape) => {
      ToolShadowBoard.trace(context, tool.x + shape.x, tool.y + shape.y, shape);
    });
    context.strokeStyle = stroke;
    context.lineWidth = line;
    context.stroke();
    context.fillStyle = fill;
    context.fill('nonzero');
  }

  /**
   * Agrega al trazo un rectángulo redondeado girado.
   *
   * @param context Contexto.
   * @param x Centro horizontal.
   * @param y Centro vertical.
   * @param shape Medidas, giro y redondeo.
   */
  private static trace(context: CanvasRenderingContext2D, x: number, y: number, shape: ToolOutline): void {
    const { width, height, angle = 0, round = 0 } = shape;
    const radius = Math.min(width, height) * round;
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.roundRect(-width / 2, -height / 2, width, height, radius);
    context.restore();
  }
}
