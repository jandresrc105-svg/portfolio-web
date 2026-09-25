/**
 * Control del osciloscopio que el visitante puede usar: teclas (encendido, ejecución, canales, menú) y
 * perillas (ganancias del PID, generador de la referencia y escalas de la pantalla).
 */
export type ScopeControlId =
  | 'power'
  | 'run'
  | 'single'
  | 'auto'
  | 'menu'
  | 'ch1'
  | 'ch2'
  | 'kp'
  | 'ki'
  | 'kd'
  | 'amplitude'
  | 'frequency'
  | 'scale'
  | 'position'
  | 'timebase';
