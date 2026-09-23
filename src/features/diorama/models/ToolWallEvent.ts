import type { ToolId } from './ToolId';

/**
 * Aviso de la pared de herramientas: una herramienta sale de su gancho, vuelve a él o se inspecciona.
 */
export type ToolWallEvent =
  | { readonly type: 'take'; readonly tool: ToolId }
  | { readonly type: 'hang'; readonly tool: ToolId }
  | { readonly type: 'inspect' };
