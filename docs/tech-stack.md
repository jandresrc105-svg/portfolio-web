# Stack tecnológico

## Base (instalado)

| Herramienta                                         | Uso                                  |
| --------------------------------------------------- | ------------------------------------ |
| TypeScript 6 (strict)                               | Lenguaje                             |
| Vite 8                                              | Dev server y bundler                 |
| Sass                                                | Estilos con nesting y módulos `@use` |
| ESLint 10 + typescript-eslint + eslint-plugin-jsdoc | Calidad y reglas de arquitectura     |
| Prettier                                            | Formato                              |
| Docker + nginx                                      | Imagen de producción opcional        |

## Capa 3D (propuesta, sin instalar aún)

| Herramienta                 | Por qué                                                                                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Three.js**                | Estándar de WebGL/WebGPU en la web. Su API es de clases (`Scene`, `Mesh`, `Material`), así que encaja con la arquitectura POO. React Three Fiber queda descartado porque exige React. |
| **GSAP + ScrollTrigger**    | Timelines ligados al scroll (armar el cubo, recorrer el diorama). Gratis para uso comercial desde 2025, plugins incluidos.                                                            |
| **Lenis**                   | Scroll suave que se sincroniza con ScrollTrigger.                                                                                                                                     |
| **postprocessing** (pmndrs) | Bloom para neón y linternas, viñeta y ruido de película. Mejor rendimiento que el `EffectComposer` de Three.                                                                          |
| **lil-gui** + **stats-gl**  | Ajustar luces/cámara y medir FPS en desarrollo (solo en modo dev).                                                                                                                    |
| **@gltf-transform/cli**     | Comprimir modelos descargados (Draco/Meshopt, texturas KTX2/WebP). Un modelo de Sketchfab de 40 MB puede quedar en 3–5 MB.                                                            |
| Rapier (opcional)           | Física, por ejemplo para escombros flotando como en la imagen de referencia.                                                                                                          |

### Fuentes de assets (sin modelar)

| Fuente                               | Qué ofrece                                                     | Licencia                                      |
| ------------------------------------ | -------------------------------------------------------------- | --------------------------------------------- |
| [Sketchfab](https://sketchfab.com)   | Dioramas y escenas completas en glTF                           | Revisar cada modelo (CC-BY exige dar crédito) |
| [Poly Pizza](https://poly.pizza)     | Modelos low-poly                                               | CC0 / CC-BY                                   |
| [Kenney](https://kenney.nl/assets)   | Kits: ciudad, fábrica, bandas transportadoras, props           | CC0                                           |
| [Quaternius](https://quaternius.com) | Kits low-poly, robots, sci-fi                                  | CC0                                           |
| [Poly Haven](https://polyhaven.com)  | HDRI, texturas PBR, modelos                                    | CC0                                           |
| Meshy / Tripo / Hyper3D Rodin        | Modelos generados con IA desde texto o imagen, exportan `.glb` | Según el plan (revisar uso comercial)         |
| Blockade Labs Skybox AI              | Fondos 360° generados con IA                                   | Según el plan                                 |

## Conceptos evaluados

| Concepto                                   | Assets necesarios                    | Esfuerzo   | Rendimiento en móvil            | Relación con tu perfil               |
| ------------------------------------------ | ------------------------------------ | ---------- | ------------------------------- | ------------------------------------ |
| A. Cubo de Rubik que se arma con el scroll | Ninguno (27 cubos procedurales)      | Bajo–medio | Excelente                       | Algoritmos y resolución de problemas |
| B. Diorama de ramen nocturno con lluvia    | Modelo descargado + lluvia en shader | Alto       | Delicado (luces, lluvia, bloom) | Estética, poca relación técnica      |
| C. PCB-ciudad                              | Ninguno (procedural)                 | Medio      | Muy bueno                       | Muy alta: electrónica                |
| D. Línea de producción automatizada        | Kits CC0 de Kenney/Quaternius        | Medio–alto | Bueno                           | Muy alta: automatización             |
| E. HMI / SCADA con lazo PID interactivo    | Ninguno (UI + shader CRT)            | Medio      | Excelente                       | Muy alta: control                    |

- **A. Rubik:** cada cara es una sección (sobre mí, experiencia, proyectos, habilidades, estudios, contacto). El scroll ejecuta una solución real paso a paso y al terminar queda armado. El texto va en HTML sincronizado con el cubo, no sobre las caras.
- **B. Ramen:** la cámara orbita según el scroll y cada objeto es un punto interactivo (el menú muestra proyectos, la cortina _noren_ muestra "sobre mí", la linterna muestra contacto). Ojo: debe ser _inspirado en_ Ichiraku, no una copia, porque Naruto tiene derechos de autor.
- **C. PCB-ciudad:** la placa vista como una ciudad de noche. Los chips y condensadores son "edificios" (una sección cada uno) y las pistas se encienden con pulsos que viajan hacia la siguiente sección al hacer scroll.
- **D. Línea de producción:** una banda transportadora lleva una caja por estaciones (sensor, brazo robótico, PLC). Cada estación "procesa" una sección del portafolio y el scroll mueve la banda.
- **E. HMI/SCADA:** la navegación es un panel industrial con pilotos, pulsadores y un osciloscopio CRT. Incluye un lazo PID en vivo: el visitante ajusta Kp, Ki y Kd y ve la respuesta del sistema. Así demuestras control, no solo lo mencionas.

### Recomendación

**Diorama nocturno híbrido (B + C/E):** un puesto de ramen callejero, flotando y fragmentado como en la referencia, que en realidad es **el taller de un ingeniero**. Tendría un letrero de neón que parpadea con un pulso PWM, un osciloscopio sobre la barra, cables y una placa expuesta. Mantiene la estética que te gusta y cuenta tu historia.

- Los puntos interactivos son objetos. El osciloscopio abre la demo PID (E), un panel de breakers lleva a contacto y el menú lleva a proyectos.
- Si el alcance crece demasiado, el **cubo de Rubik** es la opción segura: cero assets y excelente rendimiento. Puede ser el MVP mientras se consigue el diorama.

La arquitectura de la capa 3D es la misma para cualquiera de los conceptos, así que puede construirse antes de elegir.

## Qué falta en la arquitectura

| Tema                            | Propuesta                                                                                                                                                                                                                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Capa 3D**                     | `shared/engine/`: `Renderer`, `SceneManager`, `RenderLoop` (Observer: los objetos se suscriben al tick), `AssetLoader` (caché/Flyweight de glTF y texturas), `SceneObject` (clase base análoga a `Component` con `build` / `update` / `dispose`) y `Raycaster` para los puntos interactivos. |
| **Comunicación entre features** | `EventBus` tipado (Observer/Mediator) en `shared/core`, por ejemplo para publicar el progreso del scroll y que lo consuman la escena y el HTML.                                                                                                                                              |
| **Estado**                      | Un `Store` observable pequeño si hace falta (sección activa, idioma, calidad gráfica).                                                                                                                                                                                                       |
| **Accesibilidad y SEO**         | Contenido HTML real siempre presente. Si no hay WebGL o con `prefers-reduced-motion`, se muestra una versión 2D. Los reclutadores y Google leen el HTML, no el canvas.                                                                                                                       |
| **Rendimiento**                 | Detectar la GPU y bajar la calidad en móvil (sin bloom, menos partículas, `pixelRatio` ≤ 1.5). Carga diferida de modelos con pantalla de carga.                                                                                                                                              |
| **i18n**                        | Español / inglés con un `I18nService` y archivos JSON.                                                                                                                                                                                                                                       |
| **Tests**                       | Vitest + happy-dom. Los services son puros, así que son fáciles de probar.                                                                                                                                                                                                                   |
| **Git hooks**                   | husky + lint-staged para ejecutar `npm run check` antes de cada commit.                                                                                                                                                                                                                      |
| **CI**                          | GitHub Actions: `check` + `build` en cada PR hacia `DESARROLLO` / `CALIDAD` / `PRODUCTIVO`.                                                                                                                                                                                                  |
| **Stylelint**                   | `stylelint-config-standard-scss` con profundidad máxima de nesting 3 y BEM.                                                                                                                                                                                                                  |
| **Hosting**                     | Ver [despliegue](./deployment.md).                                                                                                                                                                                                                                                           |
