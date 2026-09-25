import type { FirmwareIo } from '../../models/FirmwareIo';
import type { FirmwareProgram } from '../../models/FirmwareProgram';

/**
 * "Blink": el "hola mundo" de los microcontroladores. Prende y apaga el LED de la placa y dibuja un corazón
 * en la matriz fila por fila.
 */
export class BlinkProgram implements FirmwareProgram {
  private static readonly HEART = [
    { bits: 0x00 },
    { bits: 0x66 },
    { bits: 0xff },
    { bits: 0xff },
    { bits: 0x7e },
    { bits: 0x3c },
    { bits: 0x18 },
    { bits: 0x00 },
  ];

  public readonly name = 'Blink';
  public readonly file = 'blink.ino';
  public readonly bytes = 271845;
  public readonly delay = { slow: 900, fast: 120 };
  public readonly source = [
    '#include "lab.h"  // lc (MAX7219), POT, BUZZER',
    '',
    'const byte CORAZON[8] = {',
    '  0x00, 0x66, 0xFF, 0xFF, 0x7E, 0x3C, 0x18, 0x00',
    '};',
    'bool encendido = false;',
    '',
    'void setup() {',
    '  Serial.begin(115200);',
    '  pinMode(LED_BUILTIN, OUTPUT);',
    '}',
    '',
    'void loop() {',
    '  encendido = !encendido;',
    '  digitalWrite(LED_BUILTIN, encendido);',
    '  for (int f = 0; f < 8; f++)',
    '    lc.setRow(0, f, encendido ? CORAZON[f] : 0);',
    '  Serial.println(encendido ? "LED ON" : "LED OFF");',
    '  delay(map(analogRead(POT), 0, 4095, 900, 120));',
    '}',
  ];

  private lit = false;

  /**
   * @inheritdoc
   */
  public setup(io: FirmwareIo): void {
    this.lit = false;
    io.builtin(false);
  }

  /**
   * @inheritdoc
   */
  public loop(io: FirmwareIo): void {
    this.lit = !this.lit;
    io.builtin(this.lit);
    BlinkProgram.HEART.forEach(({ bits }, row) => {
      io.setRow(row, this.lit ? bits : 0);
    });
    io.print(this.lit ? 'LED ON' : 'LED OFF');
  }
}
