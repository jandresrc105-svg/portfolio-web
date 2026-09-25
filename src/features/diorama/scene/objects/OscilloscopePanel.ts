import type { PanelArt } from '../../models/PanelArt';
import type { PanelKey } from '../../models/PanelKey';
import type { PanelKnob } from '../../models/PanelKnob';

/**
 * Diseño del panel frontal del osciloscopio digital: marca arriba, pantalla a la izquierda con sus teclas de
 * menú y, debajo, el encendido y el generador de la referencia (GEN r(t): amplitud y frecuencia); a la
 * derecha los grupos de control (adquisición, sintonía PID, canales, escalas y entradas BNC). Las piezas 3D
 * y la serigrafía salen de las mismas medidas (metros desde el centro del panel).
 */
export class OscilloscopePanel {
  private static readonly FACE = { width: 0.386, height: 0.186 };
  private static readonly SCREEN = { x: -0.08, y: 0.012, width: 0.206, height: 0.129, frame: 0.006 };
  private static readonly RUBBER = 0x3b3f47;
  private static readonly SOFTKEYS = [{ y: 0.062 }, { y: 0.036 }, { y: 0.01 }, { y: -0.016 }, { y: -0.042 }];
  private static readonly SOFTKEY = { x: 0.04, width: 0.012, height: 0.009 };
  private static readonly RUN_ROW = { y: 0.075, width: 0.022, height: 0.01, label: 0.0645 };
  private static readonly RUN_KEYS = [
    { x: 0.074, label: 'MENU', color: 0x9fd8ff, glow: 0.9, control: 'menu' },
    { x: 0.103, label: 'AUTO', color: OscilloscopePanel.RUBBER, glow: 0, control: 'auto' },
    { x: 0.132, label: 'SINGLE', color: 0xffa23a, glow: 1.4, control: 'single' },
    { x: 0.165, label: 'RUN/STOP', color: 0x39e07a, glow: 1.6, control: 'run' },
  ] as const;
  private static readonly PID = {
    x: 0.123,
    y: 0.035,
    width: 0.126,
    height: 0.042,
    knob: 0.011,
    label: 0.0185,
  };
  private static readonly PID_KNOBS = [
    { x: 0.083, control: 'kp', label: 'Kp' },
    { x: 0.123, control: 'ki', label: 'Ki' },
    { x: 0.163, control: 'kd', label: 'Kd' },
  ] as const;
  private static readonly CHANNEL_ROW = { y: -0.004, width: 0.018, height: 0.009 };
  private static readonly CHANNELS = [
    { x: 0.074, color: 0xffe14a, css: '#ffe14a', glow: 1.3, control: 'ch1' },
    { x: 0.098, color: 0x3fd8ff, css: '#3fd8ff', glow: 1.3, control: 'ch2' },
    { x: 0.122, color: 0x8a3a64, css: '#ff4fb0', glow: 0 },
    { x: 0.146, color: 0x2e4a7a, css: '#4f8dff', glow: 0 },
  ] as const;
  private static readonly TRIGGER_KNOB = { x: 0.175, y: -0.004, radius: 0.0072 };
  private static readonly SCALE_ROW = { y: -0.033, radius: 0.0085, label: -0.0465 };
  private static readonly SCALE_KNOBS = [
    { x: 0.083, label: 'SCALE', control: 'scale' },
    { x: 0.123, label: 'POSITION', control: 'position' },
    { x: 0.163, label: 'TIME/DIV', control: 'timebase' },
  ] as const;
  private static readonly BNC = { y: -0.075, label: -0.0615, ring: 0.0082 };
  private static readonly POWER = {
    x: -0.178,
    y: -0.0755,
    size: 0.011,
    color: 0x39e07a,
    glow: 1.2,
    label: -0.0865,
  };
  private static readonly USB = { x: -0.158, y: -0.0755 };
  private static readonly GEN = {
    x: -0.092,
    y: -0.0755,
    width: 0.1,
    height: 0.03,
    title: -0.138,
    knob: 0.0078,
    knobY: -0.0725,
    label: -0.0865,
  };
  private static readonly GEN_KNOBS = [
    { x: -0.103, control: 'amplitude', label: 'AMPL' },
    { x: -0.066, control: 'frequency', label: 'FREQ' },
  ] as const;
  private static readonly BRAND = { x: -0.189, y: 0.0877, model: -0.128 };
  private static readonly RATING = { x: 0.004, y: -0.0755 };
  private static readonly TEXT = { tiny: 0.0032, small: 0.0036, label: 0.0042, key: 0.0055, brand: 0.0055 };
  private static readonly INK = { label: '#c9ccd2', dim: '#8a9099', accent: '#3fd8ff' };
  private static readonly WEIGHT = { regular: 500, bold: 700 };

  /**
   * Medidas del panel.
   *
   * @returns Ancho y alto en metros.
   */
  public get face(): { width: number; height: number } {
    return OscilloscopePanel.FACE;
  }

  /**
   * Pantalla y su marco.
   *
   * @returns Centro, medidas del área visible y ancho del marco.
   */
  public get screen(): { x: number; y: number; width: number; height: number; frame: number } {
    return OscilloscopePanel.SCREEN;
  }

  /**
   * Puerto USB del frente.
   *
   * @returns Centro del puerto.
   */
  public get usb(): { x: number; y: number } {
    return OscilloscopePanel.USB;
  }

  /**
   * Teclas de goma: menú, adquisición, canales y encendido.
   *
   * @returns Teclas.
   */
  public keys(): PanelKey[] {
    const { SOFTKEYS, SOFTKEY, RUBBER, POWER } = OscilloscopePanel;
    const { x, y, size, color, glow } = POWER;
    return [
      ...SOFTKEYS.map((key) => ({ ...SOFTKEY, y: key.y, color: RUBBER, glow: 0 })),
      ...OscilloscopePanel.rowKeys(OscilloscopePanel.RUN_KEYS, OscilloscopePanel.RUN_ROW),
      ...OscilloscopePanel.rowKeys(OscilloscopePanel.CHANNELS, OscilloscopePanel.CHANNEL_ROW),
      { x, y, width: size, height: size, color, glow, control: 'power' },
    ];
  }

  /**
   * Perillas: PID, generador, escalas de pantalla y la de disparo.
   *
   * @returns Perillas.
   */
  public knobs(): PanelKnob[] {
    const { PID, PID_KNOBS, SCALE_ROW, SCALE_KNOBS, GEN, GEN_KNOBS, TRIGGER_KNOB } = OscilloscopePanel;
    return [
      ...PID_KNOBS.map(({ x, control }) => ({ x, y: PID.y, radius: PID.knob, control })),
      ...SCALE_KNOBS.map(({ x, control }) => ({ x, y: SCALE_ROW.y, radius: SCALE_ROW.radius, control })),
      ...GEN_KNOBS.map(({ x, control }) => ({ x, y: GEN.knobY, radius: GEN.knob, control })),
      TRIGGER_KNOB,
    ];
  }

  /**
   * Entradas BNC de los cuatro canales.
   *
   * @returns Centros de los conectores (el primero es CH1).
   */
  public connectors(): { x: number; y: number }[] {
    return OscilloscopePanel.CHANNELS.map(({ x }) => ({ x, y: OscilloscopePanel.BNC.y }));
  }

  /**
   * Serigrafía completa del panel.
   *
   * @returns Textos, anillos y marcos.
   */
  public art(): PanelArt {
    const { PID, GEN, INK, CHANNELS, BNC } = OscilloscopePanel;
    return {
      labels: [...this.keyLabels(), ...this.knobLabels(), ...this.channelLabels(), ...this.stripLabels()],
      rings: CHANNELS.map(({ x, css }) => ({ x, y: BNC.y, radius: BNC.ring, color: css })),
      frames: [
        { x: PID.x, y: PID.y, width: PID.width, height: PID.height, color: INK.accent },
        { x: GEN.x, y: GEN.y, width: GEN.width, height: GEN.height, color: INK.accent },
      ],
    };
  }

  /**
   * Nombres bajo las teclas de adquisición.
   *
   * @returns Textos.
   */
  private keyLabels(): PanelArt['labels'] {
    const { RUN_KEYS, RUN_ROW, TEXT } = OscilloscopePanel;
    return RUN_KEYS.map(({ x, label }) => OscilloscopePanel.label(label, x, RUN_ROW.label, TEXT.small));
  }

  /**
   * Nombres de las perillas: Kp, Ki y Kd destacadas dentro del marco "PID TUNING", y las de escala.
   *
   * @returns Textos.
   */
  private knobLabels(): PanelArt['labels'] {
    const { PID, PID_KNOBS, SCALE_ROW, SCALE_KNOBS, TEXT, INK, WEIGHT } = OscilloscopePanel;
    const titleX = PID.x - PID.width / 2 + TEXT.label;
    const titleY = PID.y + PID.height / 2 - TEXT.label;
    const title = OscilloscopePanel.label('PID TUNING', titleX, titleY, TEXT.small);
    return [
      { ...title, color: INK.accent, weight: WEIGHT.bold, align: 'left' },
      ...PID_KNOBS.map(({ x, label }) => ({
        ...OscilloscopePanel.label(label, x, PID.y - PID.label, TEXT.key),
        weight: WEIGHT.bold,
      })),
      ...SCALE_KNOBS.map(({ x, label }) => OscilloscopePanel.label(label, x, SCALE_ROW.label, TEXT.small)),
    ];
  }

  /**
   * Nombres de los canales sobre las entradas BNC, en su color.
   *
   * @returns Textos.
   */
  private channelLabels(): PanelArt['labels'] {
    const { CHANNELS, BNC, TEXT } = OscilloscopePanel;
    return CHANNELS.map(({ x, css }, index) => ({
      ...OscilloscopePanel.label(`CH${String(index + 1)}`, x, BNC.label, TEXT.small),
      color: css,
    }));
  }

  /**
   * Textos de las franjas superior e inferior: marca, encendido, generador y categoría de medición.
   *
   * @returns Textos.
   */
  private stripLabels(): PanelArt['labels'] {
    const { BRAND, POWER, GEN, GEN_KNOBS, RATING, TEXT, INK, WEIGHT } = OscilloscopePanel;
    const model = 'DSO1104  ·  100 MHz  ·  1 GSa/s  ·  GEN r(t)';
    const accent = { color: INK.accent, weight: WEIGHT.bold, align: 'left' as const };
    return [
      {
        ...OscilloscopePanel.label('JR INSTRUMENTS', BRAND.x, BRAND.y, TEXT.brand),
        weight: WEIGHT.bold,
        align: 'left',
      },
      { ...OscilloscopePanel.label(model, BRAND.model, BRAND.y, TEXT.tiny), color: INK.dim, align: 'left' },
      OscilloscopePanel.label('POWER', POWER.x, POWER.label, TEXT.tiny),
      { ...OscilloscopePanel.label('GEN r(t)', GEN.title, GEN.y, TEXT.small), ...accent },
      ...GEN_KNOBS.map(({ x, label }) => OscilloscopePanel.label(label, x, GEN.label, TEXT.tiny)),
      { ...OscilloscopePanel.label('CAT I · 300 Vpk', RATING.x, RATING.y, TEXT.tiny), color: INK.dim },
    ];
  }

  /**
   * Teclas de una fila.
   *
   * @param keys Posición, color, luz y control de cada tecla.
   * @param row Altura y medidas comunes de la fila.
   * @param row.y Centro vertical.
   * @param row.width Ancho de cada tecla.
   * @param row.height Alto de cada tecla.
   * @returns Teclas.
   */
  private static rowKeys(
    keys: readonly { x: number; color: number; glow: number; control?: PanelKey['control'] }[],
    row: { y: number; width: number; height: number },
  ): PanelKey[] {
    return keys.map(({ x, color, glow, control }) => ({
      x,
      y: row.y,
      width: row.width,
      height: row.height,
      color,
      glow,
      ...(control ? { control } : {}),
    }));
  }

  /**
   * Texto centrado con la tinta normal del panel.
   *
   * @param text Texto.
   * @param x Centro horizontal.
   * @param y Línea media.
   * @param size Alto de la letra.
   * @returns Texto de la serigrafía.
   */
  private static label(text: string, x: number, y: number, size: number): PanelArt['labels'][number] {
    const { INK, WEIGHT } = OscilloscopePanel;
    return { text, x, y, size, color: INK.label, weight: WEIGHT.regular, align: 'center' };
  }
}
