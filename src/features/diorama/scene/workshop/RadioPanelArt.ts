import type { CanvasTexture } from 'three';
import type { RadioLabel } from '../../models/RadioLabel';
import { CanvasTextureFactory } from '../CanvasTextureFactory';

/**
 * Pintor de las texturas fijas de la estación de radio (se dibujan una vez): la escala iluminada del dial
 * (marcas cada 10 kHz, números cada 50 kHz y un punto en cada emisora conocida), los frentes serigrafiados
 * (panel del receptor y placa de RF con sus pistas de cobre) y la rejilla del parlante.
 */
export class RadioPanelArt {
  public static readonly SWEEP = { from: 3.926991, to: -0.785398 };
  public static readonly PIXELS_PER_METER = 1400;

  private static readonly DIAL = {
    size: 256,
    tick: { step: 10, major: 50, outer: 0.93, minor: 0.84, long: 0.77 },
    labels: 0.62,
    stations: 0.7,
    dot: 4,
    caption: { unit: 0.34, band: 0.5, brand: -0.32 },
    colors: {
      center: '#fff3d6',
      edge: '#dd9a4c',
      ink: '#2a1a0c',
      station: '#d8342a',
      rim: 'rgba(40, 22, 8, 0.8)',
    },
    fonts: { label: 17, caption: 15, brand: 13 },
    widths: { minor: 1.5, major: 3, rim: 4 },
  };
  private static readonly KHZ_PER_MHZ = 1000;
  private static readonly BRUSH = { lines: 60, alpha: 0.05, spread: 7 };
  private static readonly TRACE = { width: 3, alpha: 0.75 };
  private static readonly GRILLE = { size: 128, pitch: 9, hole: 2.6, margin: 6 };
  private static readonly GRILLE_COLORS = { base: '#16181b', hole: '#030304', rim: '#2a2d31' };
  private static readonly WEIGHT = 600;

  /**
   * Crea el pintor.
   *
   * @param textures Fábrica de texturas.
   */
  public constructor(private readonly textures: CanvasTextureFactory) {}

  /**
   * Escala del dial.
   *
   * @param band Banda en kHz.
   * @param band.from Borde inferior.
   * @param band.to Borde superior.
   * @param band.name Nombre de la banda.
   * @param stations Frecuencias de las emisoras (kHz), marcadas con un punto.
   * @returns Textura.
   */
  public dial(band: { from: number; to: number; name: string }, stations: readonly number[]): CanvasTexture {
    const { size } = RadioPanelArt.DIAL;
    return this.textures.paint(size, size, (context) => {
      RadioPanelArt.dialFace(context);
      RadioPanelArt.dialTicks(context, band);
      stations.forEach((frequency) => {
        RadioPanelArt.stationDot(context, (frequency - band.from) / (band.to - band.from));
      });
      RadioPanelArt.dialCaption(context, band.name);
    });
  }

  /**
   * Frente serigrafiado (panel del receptor o placa de circuito).
   *
   * @param size Medidas en metros.
   * @param size.width Ancho.
   * @param size.height Alto.
   * @param look Colores: fondo, tinta y cobre (sin cobre el fondo lleva un cepillado metálico).
   * @param look.background Fondo.
   * @param look.ink Tinta de los textos.
   * @param look.copper Color de las pistas, o `null`.
   * @param marks Textos y pistas (polilíneas), en metros desde el centro.
   * @param marks.labels Textos.
   * @param marks.traces Pistas.
   * @returns Textura.
   */
  public plate(
    size: { width: number; height: number },
    look: { background: string; ink: string; copper: string | null },
    marks: { labels: readonly RadioLabel[]; traces: readonly (readonly { x: number; y: number }[])[] },
  ): CanvasTexture {
    const scale = RadioPanelArt.PIXELS_PER_METER;
    const width = Math.round(size.width * scale);
    const height = Math.round(size.height * scale);
    return this.textures.paint(width, height, (context) => {
      context.fillStyle = look.background;
      context.fillRect(0, 0, width, height);
      if (look.copper === null) {
        RadioPanelArt.brush(context, width, height);
      } else {
        RadioPanelArt.traces(context, marks.traces, look.copper);
      }
      RadioPanelArt.labels(context, marks.labels, look.ink);
    });
  }

  /**
   * Rejilla perforada del parlante.
   *
   * @returns Textura.
   */
  public grille(): CanvasTexture {
    const { size, pitch, hole, margin } = RadioPanelArt.GRILLE;
    const { base, hole: dark, rim } = RadioPanelArt.GRILLE_COLORS;
    return this.textures.paint(size, size, (context) => {
      const center = size / 2;
      context.fillStyle = base;
      context.fillRect(0, 0, size, size);
      context.fillStyle = dark;
      RadioPanelArt.holes(context, { pitch, radius: hole, margin });
      context.strokeStyle = rim;
      context.lineWidth = margin / 2;
      context.beginPath();
      context.arc(center, center, center - margin / 2, 0, Math.PI * 2);
      context.stroke();
    });
  }

  /**
   * Fondo del dial: luz cálida que sale del centro.
   *
   * @param context Contexto.
   */
  private static dialFace(context: CanvasRenderingContext2D): void {
    const { size, colors, widths } = RadioPanelArt.DIAL;
    const center = size / 2;
    const gradient = context.createRadialGradient(center, center, 0, center, center, center);
    gradient.addColorStop(0, colors.center);
    gradient.addColorStop(1, colors.edge);
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    context.strokeStyle = colors.rim;
    context.lineWidth = widths.rim;
    context.beginPath();
    context.arc(center, center, center - widths.rim / 2, 0, Math.PI * 2);
    context.stroke();
  }

  /**
   * Marcas de la escala y sus números en MHz.
   *
   * @param context Contexto.
   * @param band Banda en kHz.
   * @param band.from Borde inferior.
   * @param band.to Borde superior.
   */
  private static dialTicks(context: CanvasRenderingContext2D, band: { from: number; to: number }): void {
    const { size, tick, labels, colors, fonts, widths } = RadioPanelArt.DIAL;
    const radius = size / 2;
    context.strokeStyle = colors.ink;
    context.fillStyle = colors.ink;
    context.font = `${String(RadioPanelArt.WEIGHT)} ${String(fonts.label)}px ${CanvasTextureFactory.SANS_FONT}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (let khz = band.from; khz <= band.to; khz += tick.step) {
      const angle = RadioPanelArt.angle((khz - band.from) / (band.to - band.from));
      const major = (khz - band.from) % tick.major === 0;
      context.lineWidth = major ? widths.major : widths.minor;
      RadioPanelArt.ray(context, angle, { from: major ? tick.long : tick.minor, to: tick.outer });
      if (major) {
        const text = (khz / RadioPanelArt.KHZ_PER_MHZ).toFixed(2);
        const at = RadioPanelArt.polar(angle, radius * labels);
        context.fillText(text, at.x, at.y);
      }
    }
  }

  /**
   * Punto rojo donde hay una emisora.
   *
   * @param context Contexto.
   * @param fraction Posición en la banda (0 a 1).
   */
  private static stationDot(context: CanvasRenderingContext2D, fraction: number): void {
    const { size, stations, dot, colors } = RadioPanelArt.DIAL;
    const at = RadioPanelArt.polar(RadioPanelArt.angle(fraction), (size / 2) * stations);
    context.fillStyle = colors.station;
    context.beginPath();
    context.arc(at.x, at.y, dot, 0, Math.PI * 2);
    context.fill();
  }

  /**
   * Leyendas del centro: unidad, banda y marca.
   *
   * @param context Contexto.
   * @param band Nombre de la banda.
   */
  private static dialCaption(context: CanvasRenderingContext2D, band: string): void {
    const { size, caption, colors, fonts } = RadioPanelArt.DIAL;
    const center = size / 2;
    const font = `${String(RadioPanelArt.WEIGHT)} ${String(fonts.caption)}px ${CanvasTextureFactory.SANS_FONT}`;
    context.fillStyle = colors.ink;
    context.font = font;
    context.fillText('MHz', center, center + center * caption.unit);
    context.fillText(`BANDA ${band}`, center, center + center * caption.band);
    context.font = `${String(RadioPanelArt.WEIGHT)} ${String(fonts.brand)}px ${CanvasTextureFactory.MONO_FONT}`;
    context.fillText('JR-40', center, center + center * caption.brand);
  }

  /**
   * Cepillado metálico del frente: líneas horizontales tenues.
   *
   * @param context Contexto.
   * @param width Ancho en píxeles.
   * @param height Alto en píxeles.
   */
  private static brush(context: CanvasRenderingContext2D, width: number, height: number): void {
    const { lines, alpha, spread } = RadioPanelArt.BRUSH;
    for (let index = 0; index < lines; index++) {
      const shade = ((index * spread) % lines) / lines;
      context.fillStyle = `rgba(255, 255, 255, ${String(alpha * shade)})`;
      context.fillRect(0, (index / lines) * height, width, 1);
    }
  }

  /**
   * Pistas de cobre de la placa.
   *
   * @param context Contexto.
   * @param traces Polilíneas en metros.
   * @param color Color del cobre.
   */
  private static traces(
    context: CanvasRenderingContext2D,
    traces: readonly (readonly { x: number; y: number }[])[],
    color: string,
  ): void {
    const { width, alpha } = RadioPanelArt.TRACE;
    context.strokeStyle = color;
    context.globalAlpha = alpha;
    context.lineWidth = width;
    context.lineJoin = 'round';
    traces.forEach((points) => {
      context.beginPath();
      points.forEach((point) => {
        const at = RadioPanelArt.pixel(context, point);
        context.lineTo(at.x, at.y);
      });
      context.stroke();
    });
    context.globalAlpha = 1;
  }

  /**
   * Textos serigrafiados.
   *
   * @param context Contexto.
   * @param labels Textos en metros desde el centro.
   * @param ink Color.
   */
  private static labels(context: CanvasRenderingContext2D, labels: readonly RadioLabel[], ink: string): void {
    context.fillStyle = ink;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    labels.forEach((label) => {
      context.font = `${String(RadioPanelArt.WEIGHT)} ${String(label.size)}px ${CanvasTextureFactory.SANS_FONT}`;
      const at = RadioPanelArt.pixel(context, label);
      context.fillText(label.text, at.x, at.y);
    });
  }

  /**
   * Agujeros de la rejilla en tresbolillo.
   *
   * @param context Contexto.
   * @param grid Separación, radio de cada agujero y margen.
   * @param grid.pitch Separación.
   * @param grid.radius Radio del agujero.
   * @param grid.margin Margen hasta el borde.
   */
  private static holes(
    context: CanvasRenderingContext2D,
    grid: { pitch: number; radius: number; margin: number },
  ): void {
    const { pitch, radius, margin } = grid;
    const size = RadioPanelArt.GRILLE.size;
    for (let y = margin; y < size - margin; y += pitch) {
      const shift = (Math.round(y / pitch) % 2) * (pitch / 2);
      for (let x = margin + shift; x < size - margin; x += pitch) {
        RadioPanelArt.hole(context, { x, y, radius, limit: size / 2 - margin });
      }
    }
  }

  /**
   * Un agujero de la rejilla, si cae dentro del círculo.
   *
   * @param context Contexto.
   * @param hole Centro, radio y radio límite de la rejilla.
   * @param hole.x Horizontal.
   * @param hole.y Vertical.
   * @param hole.radius Radio del agujero.
   * @param hole.limit Radio de la rejilla.
   */
  private static hole(
    context: CanvasRenderingContext2D,
    hole: { x: number; y: number; radius: number; limit: number },
  ): void {
    const center = RadioPanelArt.GRILLE.size / 2;
    if (Math.hypot(hole.x - center, hole.y - center) > hole.limit) {
      return;
    }
    context.beginPath();
    context.arc(hole.x, hole.y, hole.radius, 0, Math.PI * 2);
    context.fill();
  }

  /**
   * Trazo radial del dial.
   *
   * @param context Contexto.
   * @param angle Ángulo (radianes, antihorario desde +x).
   * @param span Radios relativos donde empieza y termina.
   * @param span.from Radio interior.
   * @param span.to Radio exterior.
   */
  private static ray(
    context: CanvasRenderingContext2D,
    angle: number,
    span: { from: number; to: number },
  ): void {
    const radius = RadioPanelArt.DIAL.size / 2;
    const start = RadioPanelArt.polar(angle, radius * span.from);
    const end = RadioPanelArt.polar(angle, radius * span.to);
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  }

  /**
   * Ángulo de la aguja para una posición en la banda.
   *
   * @param fraction Posición (0 a 1).
   * @returns Ángulo en radianes.
   */
  private static angle(fraction: number): number {
    const { from, to } = RadioPanelArt.SWEEP;
    return from + (to - from) * fraction;
  }

  /**
   * Punto del canvas del dial a un ángulo y radio del centro (y del canvas hacia abajo).
   *
   * @param angle Ángulo.
   * @param radius Radio en píxeles.
   * @returns Punto.
   */
  private static polar(angle: number, radius: number): { x: number; y: number } {
    const center = RadioPanelArt.DIAL.size / 2;
    return { x: center + Math.cos(angle) * radius, y: center - Math.sin(angle) * radius };
  }

  /**
   * Convierte un punto en metros desde el centro a píxeles del canvas.
   *
   * @param context Contexto (da el tamaño del canvas).
   * @param point Punto en metros (+y arriba).
   * @param point.x Horizontal.
   * @param point.y Vertical.
   * @returns Punto en píxeles lógicos.
   */
  private static pixel(
    context: CanvasRenderingContext2D,
    point: { x: number; y: number },
  ): { x: number; y: number } {
    const scale = RadioPanelArt.PIXELS_PER_METER;
    const transform = context.getTransform();
    const width = context.canvas.width / transform.a;
    const height = context.canvas.height / transform.d;
    return { x: width / 2 + point.x * scale, y: height / 2 - point.y * scale };
  }
}
