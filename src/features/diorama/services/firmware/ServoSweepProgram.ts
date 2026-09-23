import type { FirmwareIo } from '../../models/FirmwareIo';
import type { FirmwareProgram } from '../../models/FirmwareProgram';

/**
 * "Servo sweep": el servo barre de 0° a 180° y vuelve, de a 5°. La matriz muestra el ángulo como una barra y
 * el monitor serie el ancho del pulso PWM que lo fija (0,5 ms a 2,4 ms cada 20 ms).
 */
export class ServoSweepProgram implements FirmwareProgram {
  private static readonly STEP = 5;
  private static readonly RANGE = 180;
  private static readonly REPORT = 45;
  private static readonly COLUMNS = 8;
  private static readonly FULL = 0xff;
  private static readonly PULSE = { min: 0.5, span: 1.9 };
  private static readonly TONE = { hz: 1568, milliseconds: 25 };

  public readonly name = 'Servo sweep';
  public readonly file = 'servo_sweep.ino';
  public readonly bytes = 279402;
  public readonly delay = { slow: 90, fast: 12 };
  public readonly source = [
    '#include "lab.h"  // lc (MAX7219), POT, BUZZER',
    '#include <ESP32Servo.h>',
    '',
    'Servo servo;',
    'int angulo = 0, paso = 5;',
    '',
    'void setup() {',
    '  Serial.begin(115200);',
    '  servo.attach(13, 500, 2400);   // pulso 0,5–2,4 ms',
    '}',
    '',
    'void loop() {',
    '  servo.write(angulo);',
    '  int barra = map(angulo, 0, 180, 0, 8);',
    '  for (int c = 0; c < 8; c++)',
    '    lc.setColumn(0, c, c < barra ? 0xFF : 0x00);',
    '  if (angulo % 45 == 0)',
    '    Serial.printf("servo %d°  pulso %.2f ms\\n",',
    '                  angulo, 0.5 + angulo * 1.9 / 180);',
    '  angulo += paso;',
    '  if (angulo <= 0 || angulo >= 180) {',
    '    paso = -paso;',
    '    tone(BUZZER, 1568, 25);',
    '  }',
    '  delay(map(analogRead(POT), 0, 4095, 90, 12));',
    '}',
  ];

  private angle = 0;
  private step = ServoSweepProgram.STEP;

  /**
   * @inheritdoc
   */
  public setup(): void {
    this.angle = 0;
    this.step = ServoSweepProgram.STEP;
  }

  /**
   * @inheritdoc
   */
  public loop(io: FirmwareIo): void {
    const { RANGE, COLUMNS, FULL } = ServoSweepProgram;
    io.servo(this.angle);
    const bar = Math.trunc((this.angle * COLUMNS) / RANGE);
    for (let column = 0; column < COLUMNS; column++) {
      io.setColumn(column, column < bar ? FULL : 0);
    }
    if (this.angle % ServoSweepProgram.REPORT === 0) {
      const pulse = ServoSweepProgram.PULSE.min + (this.angle * ServoSweepProgram.PULSE.span) / RANGE;
      io.print(`servo ${String(this.angle)}°  pulso ${pulse.toFixed(2)} ms`);
    }
    this.angle += this.step;
    if (this.angle <= 0 || this.angle >= RANGE) {
      this.step = -this.step;
      io.tone(ServoSweepProgram.TONE.hz, ServoSweepProgram.TONE.milliseconds);
    }
  }
}
