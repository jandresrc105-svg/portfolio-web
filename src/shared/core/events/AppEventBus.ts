import type { AppEvents } from './AppEvents';
import { EventBus } from './EventBus';

/**
 * Bus de eventos global de la aplicación, registrado como singleton en el contenedor.
 */
export class AppEventBus extends EventBus<AppEvents> {}
