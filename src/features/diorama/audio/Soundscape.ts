import { Vector3, type Camera, type Vector3Like } from 'three';
import type { AudioEngine } from '@shared/audio/AudioEngine';
import type { Updatable } from '@shared/engine/Updatable';
import type { Powerable } from '../models/Powerable';
import type { SoundVoices } from '../models/SoundVoices';
import type { SoundtrackTrack } from '../models/SoundtrackTrack';
import { AmbientLoop } from './AmbientLoop';
import { InterfaceSound } from './InterfaceSound';
import { NeonHum } from './NeonHum';
import { Soundtrack } from './Soundtrack';
import { SwitchSound } from './SwitchSound';
import { ThunderSound } from './ThunderSound';

/**
 * Paisaje sonoro del diorama (patrón Facade): lluvia suave, lofi de fondo y efectos sintetizados.
 * La escena le habla siempre igual; mientras el navegador no permita sonar, las llamadas no hacen nada
 * y las voces se crean en cuanto el audio arranca.
 */
export class Soundscape implements Updatable {
  private static readonly RAIN = { src: '/audio/rain.mp3', volume: 1.5 };
  private static readonly MUSIC_VOLUME = 0.32;
  private static readonly PLAYLIST: readonly SoundtrackTrack[] = [
    { src: '/audio/cup-of-tea.mp3', gain: 0.7 },
    { src: '/audio/cat-caffe.mp3', gain: 1.15 },
    { src: '/audio/rainy-forest.mp3', gain: 0.72 },
  ];

  public readonly neon: Powerable;

  private voices: SoundVoices | null = null;
  private neonLevel = 0;
  private camera: Camera | null = null;
  private readonly neonPosition = new Vector3();
  private readonly unsubscribe: () => void;

  /**
   * Crea el paisaje sonoro.
   *
   * @param engine Motor de audio compartido.
   */
  public constructor(private readonly engine: AudioEngine) {
    this.neon = {
      setPower: (level: number): void => {
        this.neonLevel = level;
        this.voices?.hum.setPower(level);
      },
    };
    this.unsubscribe = engine.onRunning(() => {
      this.ensureStarted();
    });
  }

  /**
   * Define el oyente (la cámara) y la fuente del zumbido (el letrero).
   *
   * @param camera Cámara que hace de oyente.
   * @param neonPosition Posición del letrero de neón.
   */
  public follow(camera: Camera, neonPosition: Vector3Like): void {
    this.camera = camera;
    this.neonPosition.copy(neonPosition);
  }

  /**
   * @inheritdoc
   */
  public update(): void {
    if (this.voices && this.camera) {
      this.voices.hum.setDistance(this.camera.position.distanceTo(this.neonPosition));
    }
  }

  /**
   * Chasquido de encendido.
   */
  public click(): void {
    this.voices?.switches.play();
  }

  /**
   * Trueno.
   *
   * @param strength Intensidad [0, 1].
   * @param delay Segundos de retraso respecto al relámpago.
   */
  public thunder(strength: number, delay: number): void {
    this.voices?.thunder.play(strength, delay);
  }

  /**
   * Sonido al señalar un marcador.
   */
  public hover(): void {
    this.voices?.ui.hover();
  }

  /**
   * Sonido al seleccionar un marcador.
   */
  public select(): void {
    this.voices?.ui.select();
  }

  /**
   * Cancela la suscripción al motor de audio.
   */
  public dispose(): void {
    this.unsubscribe();
  }

  /**
   * Crea las voces la primera vez que el audio suena y arranca la lluvia y la música.
   */
  private ensureStarted(): void {
    const { audioContext: context, output } = this.engine;
    if (this.voices || !context || !output) {
      return;
    }
    this.voices = Soundscape.createVoices(context, output);
    this.voices.hum.setPower(this.neonLevel);
    this.voices.rain.start().catch((error: unknown) => {
      console.warn('No fue posible cargar la lluvia', error);
    });
    this.voices.music.start();
  }

  /**
   * Instancia todas las voces sobre el contexto de audio.
   *
   * @param context Contexto de audio.
   * @param output Nodo de salida.
   * @returns Voces del paisaje sonoro.
   */
  private static createVoices(context: AudioContext, output: AudioNode): SoundVoices {
    const { RAIN, PLAYLIST, MUSIC_VOLUME } = Soundscape;
    return {
      rain: new AmbientLoop(context, output, RAIN.src, RAIN.volume),
      music: new Soundtrack(context, output, PLAYLIST, MUSIC_VOLUME),
      hum: new NeonHum(context, output),
      switches: new SwitchSound(context, output),
      thunder: new ThunderSound(context, output),
      ui: new InterfaceSound(context, output),
    };
  }
}
