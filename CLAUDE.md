# CLAUDE.md

Portafolio personal 3D. Frontend en TypeScript vanilla con POO, Vite y Sass. El backend vendrá después.
Documentación completa en `docs/` ([arquitectura](docs/architecture.md), [convenciones](docs/conventions.md), [stack](docs/tech-stack.md), [despliegue](docs/deployment.md)).

## Comandos

- `npm run dev`: servidor de desarrollo.
- `npm run check`: typecheck + lint + formato. **Debe pasar antes de dar una tarea por terminada.**
- `npm run build`: build de producción.

## Arquitectura (resumen)

- `index.html` solo tiene `<div id="root">`, `<link>` a `src/styles/main.scss` y `<script>` a `main.ts`.
- `main.ts` es la raíz de composición: registra los `FeatureModule` en el `Container` y monta `App`.
- `src/app/App.ts` solo compone features.
- `src/features/<feature>/` contiene `components/` (DOM + eventos), `services/` (lógica de negocio), `api/` (solo fetch), `models/` (interfaces) y `<Feature>Module.ts` (registro DI).
- `src/shared/` guarda lo usado por 2 o más features, más el núcleo (`core/di`, `core/component`, `core/dom`).
- Flujo: component → service → api → `HttpClient`. Todo se inyecta por constructor y se registra en el `*Module` de la feature.
- **Capa 3D** (`src/shared/engine/`): `Stage` (renderer + escena + cámara), `PostProcessing`, `RenderLoop` (Observer de `Updatable`), `SceneObject` (base de objetos 3D: `build` / `dispose`), `PointerPicker`, `QualityDetector`, `AdaptiveResolution`, `GeometryDetail`.
- **Diorama** (`src/features/diorama/`): `scene/objects/` (una clase por pieza del puesto), `scene/DioramaScene` (compone, define orden de encendido y hotspots), `camera/CameraRig` (recorrido ligado al scroll), `intro/PowerOnSequence` (GSAP), `experience/DioramaExperience` (Facade que usa el componente).
- Los encuadres de `CameraRig.SHOTS` siguen el **mismo orden** que las secciones de `public/data/sections.json` (con el hero primero), y los `sectionId` de `DioramaScene.HOTSPOTS` coinciden con sus `id`.
- Comunicación entre features: `AppEventBus` (`shared/core/events`). Scroll: `SmoothScroll` (Lenis).

## Reglas obligatorias

1. **POO y patrones de diseño siempre que se pueda.** Nada de programación procedural suelta.
2. **1 archivo = 1 declaración** (clase, interfaz, tipo o enum). Sin variables ni funciones fuera de la clase: las constantes son `private static readonly`. El nombre del archivo es igual al de la clase. Sin barrels ni `export default`.
3. **Componentes:** heredan de `Component`; `render()` construye el DOM con `ElementBuilder` (nunca `innerHTML`); `bindEvents()` registra eventos con `this.listen()`; `onMount()` es opcional. No contienen lógica de negocio ni llaman a `api`.
4. **Services:** lógica de negocio, sin `document` ni `window`. Reciben la `api` inyectada.
5. **Api:** solo peticiones HTTP mediante `HttpClient`.
6. **Una feature no importa otra feature.** Lo común va a `shared`, y `shared` no importa de `features` ni de `app`.
7. **Funciones y métodos ≤ 20 líneas**, complejidad ≤ 8, anidamiento ≤ 3, ≤ 5 parámetros. **Archivos ≤ 500 líneas.**
8. **Solo JSDoc/TSDoc.** Documentar clases, constructores, métodos, interfaces y sus propiedades, tipos y enums. **Prohibidos los comentarios `//` y `/* */`.**
9. Tipos de retorno y modificadores de acceso explícitos; `import type` para tipos. **Sin números mágicos:** las medidas y colores van en `private static readonly` con objetos con nombre (`{ width, height, y }`); los arreglos de números se escriben como arreglos de objetos (`[{ x: 1.4 }]`); los segmentos de geometría usan `GeometryDetail`.
10. Imports con alias `@app`, `@features`, `@shared`; relativo solo dentro de la propia feature (máximo `../../`).
11. **Estilos:** solo Sass con nesting + BEM, importados desde `src/styles/main.scss`. **Ningún `.ts` importa `.scss`/`.css`.** Un parcial por feature en `src/styles/features/`, usando `@use`/`@forward` (nunca `@import`) y valores de `abstracts/_tokens.scss`.

Las reglas 2–3 y 5–11 las hace cumplir ESLint (`eslint.config.js` + plugin local en `tools/eslint/`). No se desactivan con comentarios.

## Cómo agregar una feature

1. Crear `src/features/<nombre>/` con `models/`, `api/`, `services/`, `components/` y `<Nombre>Module.ts`.
2. Registrar sus clases en el módulo (`singleton` para api/services, `transient` para componentes).
3. Agregar el módulo en `Main.modules()` (`main.ts`) e inyectar el componente en `App` desde `AppModule`.
4. Crear `src/styles/features/_<nombre>.scss` y hacerle `@forward` en `src/styles/features/_index.scss`.
5. Ejecutar `npm run check`.

## Git

Ramas: `DESARROLLO_JARC` → `DESARROLLO` → `CALIDAD` → `PRODUCTIVO`. Nunca trabajar directo en `PRODUCTIVO`.
Identidad local del repo: `jandresrc105@gmail.com` (la configuración global es la de la empresa; no modificarla).

Mensajes de commit: `tipo: descripción en español en primera persona` (p. ej. `feat: agregué el diorama 3D`, `fix: corregí el encuadre de la cámara`). **Sin líneas `Co-Authored-By` ni ninguna atribución a Claude.**
