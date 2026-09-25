/**
 * Motor de audio de la aplicación: contexto Web Audio, compresor y volumen maestro con fundidos.
 *
 * El sonido está activo por defecto. Los navegadores bloquean el audio hasta que el usuario interactúa,
 * así que {@link AudioEngine.start} intenta arrancar de inmediato y, si el contexto queda suspendido,
 * lo reanuda con el primer clic, toque o tecla. Recuerda si el visitante lo silenció (Observer para cambios).
 */
export class AudioEngine {
  private static readonly VOLUME = 0.9;
  private static readonly FADE_SECONDS = 1.2;
  private static readonly FADE_STEPS = 3;
  private static readonly COMPRESSOR = { threshold: -18, knee: 12, ratio: 3, attack: 0.02, release: 0.4 };
  private static readonly STORAGE_KEY = 'jr-portfolio-muted';
  private static readonly UNLOCK_EVENTS = ['pointerdown', 'keydown', 'touchend'] as const;

  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = AudioEngine.storedMuted();
  private readonly listeners = new Set<(muted: boolean) => void>();
  private readonly runningListeners = new Set<() => void>();

  /**
   * Indica si el sonido está silenciado por el visitante.
   *
   * @returns `true` si está silenciado.
   */
  public get isMuted(): boolean {
    return this.muted;
  }

  /**
   * Contexto de audio, disponible después de {@link AudioEngine.start}.
   *
   * @returns Contexto o `null`.
   */
  public get audioContext(): AudioContext | null {
    return this.context;
  }

  /**
   * Nodo al que se conectan todas las fuentes de sonido.
   *
   * @returns Nodo maestro o `null` si aún no hay contexto.
   */
  public get output(): AudioNode | null {
    return this.master;
  }

  /**
   * Crea el contexto e intenta reproducir de inmediato; si el navegador lo impide,
   * queda a la espera de la primera interacción del visitante.
   */
  public start(): void {
    if (this.context) {
      return;
    }
    this.context = new AudioContext();
    this.master = AudioEngine.createChain(this.context);
    this.context.addEventListener('statechange', this.onStateChange);
    document.addEventListener('visibilitychange', this.onVisibility);
    AudioEngine.UNLOCK_EVENTS.forEach((type) => {
      window.addEventListener(type, this.unlock, { passive: true });
    });
    this.unlock();
  }

  /**
   * Activa o silencia el sonido con un fundido y recuerda la elección.
   *
   * @param muted `true` para silenciar.
   */
  public setMuted(muted: boolean): void {
    this.muted = muted;
    AudioEngine.storeMuted(muted);
    this.unlock();
    this.applyVolume();
    this.listeners.forEach((listener) => {
      listener(muted);
    });
  }

  /**
   * Alterna entre silenciado y activo.
   */
  public toggle(): void {
    this.setMuted(!this.muted);
  }

  /**
   * Suscribe un manejador a los cambios de silencio.
   *
   * @param listener Recibe `true` si quedó silenciado.
   * @returns Función que cancela la suscripción.
   */
  public onChange(listener: (muted: boolean) => void): () => void {
    this.listeners.add(listener);
    return (): void => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Ejecuta un manejador cuando el audio realmente empieza a sonar (o de inmediato si ya suena).
   *
   * @param listener Manejador.
   * @returns Función que cancela la suscripción.
   */
  public onRunning(listener: () => void): () => void {
    this.runningListeners.add(listener);
    if (this.context?.state === 'running') {
      listener();
    }
    return (): void => {
      this.runningListeners.delete(listener);
    };
  }

  /**
   * Intenta reanudar el contexto (funciona si hay activación del usuario o el sitio tiene permiso de autoplay).
   */
  private readonly unlock = (): void => {
    if (this.context && this.context.state !== 'running') {
      void this.context.resume();
    }
  };

  /**
   * Al empezar a sonar: retira los listeners de desbloqueo, sube el volumen y avisa a los suscriptores.
   */
  private readonly onStateChange = (): void => {
    if (this.context?.state !== 'running') {
      return;
    }
    AudioEngine.UNLOCK_EVENTS.forEach((type) => {
      window.removeEventListener(type, this.unlock);
    });
    this.applyVolume();
    this.runningListeners.forEach((listener) => {
      listener();
    });
  };

  /**
   * Silencia mientras la pestaña está oculta y restaura al volver.
   */
  private readonly onVisibility = (): void => {
    this.applyVolume();
  };

  /**
   * Lleva el volumen maestro al valor que corresponde al estado actual, con una curva suave.
   */
  private applyVolume(): void {
    if (!this.context || !this.master) {
      return;
    }
    const target = this.muted || document.hidden ? 0 : AudioEngine.VOLUME;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(target, now, AudioEngine.FADE_SECONDS / AudioEngine.FADE_STEPS);
  }

  /**
   * Cadena maestra: ganancia → compresor → salida, para que ningún sonido sature.
   *
   * @param context Contexto de audio.
   * @returns Nodo de ganancia maestro.
   */
  private static createChain(context: AudioContext): GainNode {
    const compressor = new DynamicsCompressorNode(context, AudioEngine.COMPRESSOR);
    const master = new GainNode(context, { gain: 0 });
    master.connect(compressor).connect(context.destination);
    return master;
  }

  /**
   * Lee la preferencia guardada; si el almacenamiento no está disponible, el sonido queda activo.
   *
   * @returns `true` si el visitante silenció el sonido antes.
   */
  private static storedMuted(): boolean {
    try {
      return localStorage.getItem(AudioEngine.STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Guarda la preferencia de silencio, ignorando fallos del almacenamiento.
   *
   * @param muted Preferencia.
   */
  private static storeMuted(muted: boolean): void {
    try {
      localStorage.setItem(AudioEngine.STORAGE_KEY, String(muted));
    } catch {
      return;
    }
  }
}
