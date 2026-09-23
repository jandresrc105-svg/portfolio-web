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
- **Diorama** (`src/features/diorama/`): `scene/objects/` (una clase por pieza del puesto), `scene/characters/` (`Figure`: personajes hechos a mano con formas redondeadas, articulaciones en grupos y cinemática inversa de dos huesos con `reach`/`aim`; `Juan` y `Chef` agregan ropa y animación), `scene/DioramaScene` (compone, define orden de encendido y hotspots), `camera/CameraDirector` (OrbitControls con amortiguación + viajes entre paradas), `intro/PowerOnSequence` (GSAP), `experience/DioramaExperience` (Facade que usa el componente).
- **Navegación (sin scroll de página, al estilo de jesse-zhou.com):** la escena ocupa toda la pantalla. `SectionNavigator` (`shared/core/navigation`) guarda la sección activa (parada 0 = vista general `inicio`) y avisa los cambios. Se navega con los marcadores, el riel (`SectionNavComponent`), ← → y Esc (volver); cada cambio hace que `CameraDirector` viaje a la parada con GSAP (arco para no atravesar el puesto) y que `SectionsComponent` muestre solo el panel activo (los demás quedan `inert`). La cámara usa `OrbitControls` con amortiguación: arrastrar gira (vuelta completa en la vista general, acotado en una sección), la rueda/pellizco acerca, y se queda donde se deja. Nada sigue al puntero.
- **Vitrina de tecnologías (máquina expendedora):** la sección con `"showcase": true` en `sections.json` (hoy `tecnologias`) se recorre de a un elemento (`ShowcaseComponent`, feature `sections`) y publica `showcaseSelected` en `AppEventBus`; el diorama resalta la lata (`VendingMachine.select`) sin mover la cámara, que usa un encuadre fijo (`VendingMachine.focusPoint` + `CameraRig.setFocus`). La lata `i` (4 estantes × 5, en orden de lectura desde arriba a la izquierda) es el elemento `i`; su diseño sale de `"can"` (id del catálogo `CanFlavors`). Las latas viven en `scene/cans/`: `VendingCans` (instancias + atributo que elige la celda del atlas), `CanLabelArt` (atlas en cuadrícula de 4 columnas + tapa) y un `CanEmblem` por dibujo (Strategy). Clic en una lata → `showcasePicked` → la vitrina la muestra. Con la vitrina en pantalla, ← → solo cambian de elemento: en los extremos se consumen (la flecha rebota) y no pasan de sección.
- **Taller de electrónica (secciones `proyectos`, `habilidades` y `laboratorio`):** local al estilo Akihabara a la izquierda de la cabina telefónica, sobre un ensanche de la isla (`Island.ANNEX`), de frente a la cámara de la vista general (`scene/workshop/`). `WorkshopLayout` fija su ubicación: las piezas se construyen en su espacio local (+z hacia la calle) y se colocan con `place`; el osciloscopio y la placa del PID reciben su `Placement` de `WorkshopLayout.placement` (van en el banco, bajo el estante de la fuente). `RepairShop` es el local, el letrero "電子部品" es un `NeonSign` y `Workbench` es el banco de los proyectos (`"bench": true`: cada elemento es una placa, su `"board"` es la serigrafía; `WorkbenchService` + `BenchInteraction`, eventos `bench*`). Los demás equipos interactivos implementan `WorkshopDevice` (pieza 3D + controles con `describe`/`press`/`grab`/`highlight`) y se registran en `WorkshopCatalog`; `WorkshopInteraction` (Composite) los reúne con el banco y responde en las tres paradas del taller (`DioramaScene.workshopStops`). Las perillas se arrastran con `DeviceInteraction.grab` (la cámara no gira mientras tanto). Cada equipo vive en `scene/workshop/<equipo>/` con su service (Observer) y, si suena, su clase en `audio/` (sintetizado con el `AudioEngine`).
- **Osciloscopio y PID (sección `habilidades`):** `PidLoopService` (`shared/control`, singleton en `SharedModule`) es la única fuente de verdad de las ganancias y de la referencia (amplitud y frecuencia de la onda cuadrada); lo usan el osciloscopio y la placa (feature `diorama`) y `PidTunerComponent` (feature `sections`, se muestra con `"tuner": true`). El estado del equipo (encendido, RUN/STOP, SINGLE, canales, escalas, posición, mediciones) vive en `ScopeService`, y `ScopeControlService` (Facade + Command) traduce cada tecla y perilla en su acción, su luz y su tooltip; con el equipo apagado solo responde POWER. Los controles se toman en `pointerdown` en fase de captura (antes que OrbitControls) y bloquean el giro de la cámara hasta soltar. El marcador de la sección abierta no se detecta con el puntero: su esfera tapaba el osciloscopio. La pantalla es `MeshBasicMaterial` sin vidrio encima y con `toneMapped: false`: con un vidrio transparente, el brillo especular la lavaba según el ángulo.
- **Teléfono de contacto (sección con `"phone": true`, hoy `contacto`):** `PhoneBooth` (cabina de vidrio con franja "公衆電話" y tubo fluorescente) contiene un `PayPhone` verde (`PhoneKeypad`, pantalla LCD y tarjeta de marcado rápido). `PayPhoneService` (máquina de estados: colgado → tono → llamando → conectado, o número sin asignar) es la única fuente de verdad; `PhoneInteraction` (Mediator) lleva sus avisos a la escena y a `PhoneSound` (timbre, DTMF y tonos de línea sintetizados). Los `links` de la sección son el marcado rápido (el primero es la tecla 1) y llegan por `contactChannels` en `AppEventBus`. Al conectar, `DioramaComponent` hace `window.open` dentro de los ~2 s de activación del clic; si el navegador lo bloquea, tocar la pantalla lo reabre. Solo responde con la sección abierta; los números del teclado físico también marcan. Al salir de la sección se cuelga.
- **Tablero del poste (sección con `"timeline": true`, hoy `experiencia`):** cada elemento es una etapa y su `"breaker"` es la etiqueta del breaker; `"certificates"` son los sellos de la puerta y `"since"` la fecha desde la que cuenta el medidor. `BreakerPanelService` (circuito en serie: la corriente llega hasta el primer breaker abajo) es la única fuente de verdad; `PanelInteraction` (Mediator) lo lleva a `scene/panel/BreakerPanel` y al sonido. El MAIN manda sobre la farola a través de `SwitchedLine`; al salir de la sección se cierra la puerta y el MAIN queda como se dejó (el poste puede quedar apagado). La vitrina de la sección usa los eventos `timeline*` (`ShowcaseComponent` recibe su `ShowcaseChannel`). El teléfono y el tablero son `DeviceInteraction` y solo responden con su sección abierta.
- **Iluminación:** `NeonEnvironment` se hornea una vez como mapa de entorno (`Stage.bakeEnvironment`). El asfalto y la roca casi no lo usan (`envMapIntensity` bajo): con más valor el suelo se tiñe de magenta.
- Los encuadres de `CameraDirector.SHOTS` siguen el **mismo orden** que las secciones de `public/data/sections.json` (con el hero primero), y los `sectionId` de `DioramaScene.HOTSPOTS` coinciden con sus `id`.
- Comunicación entre features: `AppEventBus` (`shared/core/events`) y `SectionNavigator` para la sección activa.
- **Clima** (`models/Weather`, fijado en `DioramaExperienceFactory.WEATHER`): lluvia, tormenta, fondo (cielo, ciudad, bokeh, rocas) y niebla se encienden por bandera. Hoy todo apagado (noche despejada, look limpio); el código sigue ahí para los climas futuros.
- **Audio** (`shared/audio/AudioEngine` + `features/diorama/audio/`): lluvia (`AmbientLoop`, bucle sin cortes) y música lofi (`Soundtrack`, transmitida) desde `public/audio/` (todo CC0, ver `public/audio/CREDITS.md`); zumbido del neón, relés, truenos y sonidos de UI sintetizados con Web Audio. El sonido está activo por defecto: se intenta reproducir de inmediato y, si el navegador lo bloquea, arranca con el primer clic/toque/tecla. La preferencia de silencio se recuerda en `localStorage`.
- **Capas de render** (`RenderLayer`): los charcos solo reflejan la capa `Reflected` (neones, faroles, guirnalda, máquina, farola; los marcadores no, porque el reflejo parecía un marcador duplicado). El reflector va sin MSAA. Reflejar la escena completa costaba ~10 ms por frame en GPUs integradas.
- **Look limpio:** bloom solo sobre lo que emite (umbral alto), tone mapping ACES, lluvia y bokeh tenues y grano mínimo. Un umbral de bloom bajo, AgX o mucha lluvia/bokeh dejan la imagen empañada.
- **Personajes:** se construyen en código como el resto del puesto (sin modelos glTF): cadera → torso → cabeza, brazos y piernas de dos segmentos que cuelgan hacia -y. `Figure` devuelve las articulaciones a reposo cada frame y la subclase las posa en `animate`. Medidas en metros y en el espacio del personaje (+z al frente, +x a su izquierda). Probados y descartados: modelos de Quaternius (se veían mal) y chibis de Kenney (cabeza enorme a la escala del puesto).
- **Rendimiento:** `AdaptiveResolution` decide por regularidad de frames (no por FPS promedio); durante la intro puede bajar y al terminar libera el techo. Nunca baja de `minResolutionScale` (1 = nativa en equipos potentes): por debajo la imagen se ve borrosa. Evitar MSAA, `shadowBlur` de canvas y texturas de canvas grandes que se actualicen cada frame.

### Shaders GLSL (obligatorio: evita pantallas negras en Windows/ANGLE)

- Nunca `smoothstep(a, b, x)` con `a >= b`: usar `1.0 - smoothstep(b, a, x)`.
- Nunca `pow(x, y)` con `x` posiblemente negativo: `pow(clamp(x, 0.0, 1.0), y)`.
- Nunca dividir por algo que pueda ser 0: `max(valor, epsilon)`.
- Un solo NaN en un buffer HDR se esparce por el bloom y deja **toda** la imagen negra.

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

Mensajes de commit: `tipo: verbo en infinitivo + descripción en español` (p. ej. `feat: agregar el diorama 3D`, `fix: corregir el encuadre de la cámara`). **Sin líneas `Co-Authored-By` ni ninguna atribución a Claude.**
