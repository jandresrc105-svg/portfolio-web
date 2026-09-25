# Arquitectura

Frontend en **TypeScript vanilla orientado a objetos**, sin framework de UI. Vite hace de bundler y servidor de desarrollo.

## Flujo de arranque

```
index.html ──► <link> src/styles/main.scss        (único punto de entrada de estilos)
    │
    └──► <script> main.ts                        (raíz de composición)
              │  registra módulos en el Container
              │    SharedModule → HeroModule → … → AppModule
              ▼
          App.mount(#root)                        (src/app/App.ts)
              │  compone las features
              ▼
          HeroComponent, …                        (src/features/*)
```

- `index.html` solo contiene `<div id="root">`, el enlace a `main.scss` y el script `main.ts`.
- `main.ts` crea el `Container`, registra cada `FeatureModule` y monta `App`. Es el **único** lugar que ejecuta código fuera de una clase (`new Main().start()`).
- `App` es un `Component` que solo monta las features. No tiene lógica.

## Estructura de carpetas

```
portfolio-web/
├── index.html
├── main.ts                      raíz de composición
├── public/                      archivos estáticos servidos tal cual (datos mock, modelos .glb, HDRI)
│   └── data/profile.json
├── src/
│   ├── app/
│   │   ├── App.ts               contenedor principal
│   │   └── AppModule.ts         registra App
│   ├── features/
│   │   └── <feature>/
│   │       ├── <Feature>Module.ts   registra api, services y componentes de la feature
│   │       ├── components/          clases de UI: DOM + eventos
│   │       ├── services/            lógica de negocio (sin DOM)
│   │       ├── api/                 solo fetch al backend
│   │       └── models/              interfaces/tipos de datos
│   ├── shared/
│   │   ├── SharedModule.ts      registra dependencias compartidas
│   │   ├── api/                 HttpClient, HttpError
│   │   ├── config/              Environment
│   │   ├── core/
│   │   │   ├── component/       Component (clase base)
│   │   │   ├── di/              Container, FeatureModule, Provider, …
│   │   │   └── dom/             ElementBuilder
│   │   ├── components/          componentes reutilizados por varias features  (se crean
│   │   ├── services/            services reutilizados por varias features      cuando haga
│   │   └── models/              tipos compartidos                             falta)
│   ├── styles/                  Sass (ver convenciones)
│   └── types/                   declaraciones globales (.d.ts)
├── tools/eslint/                plugin ESLint local con reglas de arquitectura
├── docker/nginx.conf
├── Dockerfile · docker-compose.yml
└── docs/
```

## Capas y dependencias permitidas

```
components ──► services ──► api ──► shared/api/HttpClient ──► fetch
    │              │
    └──── models ◄─┘
```

| Capa         | Responsabilidad                              | Puede usar                               | No puede usar                              |
| ------------ | -------------------------------------------- | ---------------------------------------- | ------------------------------------------ |
| `components` | Crear DOM, escuchar eventos, pintar datos    | services (inyectados), models, `@shared` | `api`                                      |
| `services`   | Lógica de negocio, cálculos, orquestar api   | api (inyectada), models, `@shared`       | `document`, `window`, components           |
| `api`        | Solo peticiones HTTP y mapeo de la respuesta | `HttpClient`, models                     | `document`, `window`, services, components |
| `models`     | Interfaces y tipos                           | —                                        | —                                          |
| `shared`     | Lo que usan 2 o más features                 | `@shared`                                | `@features`, `@app`                        |
| `app`        | Componer features                            | `@features`, `@shared`                   | —                                          |

Una feature **nunca** importa otra feature. Si dos features necesitan lo mismo, se mueve a `shared`. Todas estas reglas las verifica ESLint (ver [convenciones](./conventions.md)).

## Inyección de dependencias

- Todas las dependencias se reciben **por constructor**. Ninguna clase hace `new` de sus dependencias ni conoce el `Container`.
- Cada feature expone un `<Feature>Module` que implementa `FeatureModule` y registra sus clases:

```ts
container
  .singleton(ProfileApi, (c) => new ProfileApi(c.resolve(HttpClient)))
  .singleton(ProfileService, (c) => new ProfileService(c.resolve(ProfileApi)))
  .transient(HeroComponent, (c) => new HeroComponent(c.resolve(ProfileService)));
```

- La llave es la propia clase (`ServiceKey<T>`), así que una clase **abstracta** puede registrarse con una implementación concreta (útil para cambiar el mock de `public/data` por el backend real sin tocar los services).
- `singleton`: una instancia compartida (api, services). `transient`: nueva instancia por resolución (componentes).

## Componentes

`Component<TElement>` (Template Method + Composite):

| Método         | Sección                                                             | Obligatorio                               |
| -------------- | ------------------------------------------------------------------- | ----------------------------------------- |
| `render()`     | DOM: construye y devuelve el elemento raíz con `ElementBuilder`     | Sí (abstracto)                            |
| `bindEvents()` | Eventos: registra listeners con `this.listen(...)`                  | Sí (abstracto; vacío si no tiene eventos) |
| `onMount()`    | Hook opcional tras insertarse en el DOM: cargar datos, montar hijos | No                                        |
| `unmount()`    | Libera listeners (AbortController), desmonta hijos y retira el DOM  | Heredado                                  |

Los listeners registrados con `listen` se eliminan solos al desmontar, así que no hay fugas de memoria. Los hijos se montan con `mountChild` para compartir el ciclo de vida del padre.

## Patrones de diseño usados

| Patrón                                       | Dónde                                                     |
| -------------------------------------------- | --------------------------------------------------------- |
| Inyección de dependencias / Composition Root | `Container`, `main.ts`, `*Module`                         |
| Template Method                              | `Component.mount()` → `render` / `bindEvents` / `onMount` |
| Composite                                    | `Component.mountChild` / `unmount` en cascada             |
| Builder                                      | `ElementBuilder`                                          |
| Module                                       | `FeatureModule` por feature                               |
| Repository (capa api)                        | `ProfileApi` aísla el origen de datos                     |

## Capa 3D

```
DioramaComponent (DOM + eventos)
      │ usa
      ▼
DioramaExperience (Facade) ──► Stage ──► PostProcessing (bloom, AgX, lente, grano)
      │                    ├─► RenderLoop ──► Updatable[] (CameraDirector, AdaptiveResolution, objetos animados)
      │                    ├─► PointerPicker<HotspotMarker>
      │                    └─► PowerOnSequence (GSAP)
      ▼
DioramaScene (Composite) ──► SceneObject[]  (Island, Stall, Lantern, NeonSign, Rain, Puddles, …)
      ├─ Character (Template Method) ──► Cook · Diner
      └─ MaterialLibrary (Flyweight) · CanvasTextureFactory (Factory) · NeonEnvironment · SeededRandom
```

| Clase                                  | Responsabilidad                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SceneObject`                          | Base de cada pieza 3D: `build()` crea su geometría en `root`; `dispose()` libera GPU. Equivalente 3D de `Component`.                                                                                                                                                                                                                                                                         |
| `Updatable` / `Powerable`              | Contratos para animarse por frame y para encenderse en la intro.                                                                                                                                                                                                                                                                                                                             |
| `DioramaScene`                         | Crea las piezas, decide qué se anima, el orden de encendido y los puntos interactivos.                                                                                                                                                                                                                                                                                                       |
| `CameraDirector`                       | OrbitControls con amortiguación (girar, acercar, se queda donde se deja) y viajes animados con GSAP entre paradas; límites por parada.                                                                                                                                                                                                                                                       |
| `SectionNavigator`                     | (`shared`) Sección activa del recorrido sin scroll de página; la escena, el riel y los paneles se suscriben a sus cambios.                                                                                                                                                                                                                                                                   |
| `ShowcaseComponent`                    | (feature `sections`) Vitrina de a un elemento (hoy, tecnologías) con flechas, puntos y teclas ← →; publica `showcaseSelected` para que el diorama resalte la lata.                                                                                                                                                                                                                           |
| `SideBlinds`                           | Persianas de bambú en los costados abiertos del puesto: tapan la pared del fondo vista de lado.                                                                                                                                                                                                                                                                                              |
| `SectionNavComponent`                  | Riel de puntos con el nombre de cada sección; salta a cualquiera y responde a las flechas ← →.                                                                                                                                                                                                                                                                                               |
| `NeonEnvironment`                      | Escena de franjas emisivas que `Stage.bakeEnvironment` hornea una vez (PMREM) como mapa de entorno: reflejos de color sin luces extra.                                                                                                                                                                                                                                                       |
| `Puddles`                              | Charcos con shader propio: borde orgánico suave, ondas de gotas, fresnel y reflejo planar deformado (capa `Reflected`).                                                                                                                                                                                                                                                                      |
| `RainSplashes` / `RoofDrips` / `Steam` | Salpicaduras, goteras y vapor animados completamente en GPU (un draw call cada uno).                                                                                                                                                                                                                                                                                                         |
| `Figure`                               | Personaje hecho a mano con formas redondeadas y articulaciones en grupos (cadera, torso, cabeza, brazos y piernas de dos segmentos), con cinemática inversa de dos huesos. `Chef` revuelve la olla y saluda; `Juan` come ramen y mira el osciloscopio.                                                                                                                                       |
| `PidLoopService`                       | (`shared/control`) Lazo PID que se sintoniza en vivo: ganancias y referencia (amplitud y frecuencia). `PidSimulator` simula una planta de tercer orden con saturación y anti-windup, y el servicio avisa cada cambio (Observer) al osciloscopio, sus perillas, el motor y el panel.                                                                                                          |
| `Oscilloscope`                         | Osciloscopio digital funcional: panel serigrafiado (`OscilloscopePanel` + `PanelArtPainter`), pantalla LCD (`OscilloscopeDisplay`: apagada, arranque y trazas según escalas y canales; sin vidrio ni tone mapping), teclas retroiluminadas (`ScopeKey`) y perillas (`ScopeKnob`). El estado vive en `ScopeService` y `ScopeControlService` traduce cada control en su acción, luz y tooltip. |
| `CircuitBoard`                         | Placa del controlador (`CircuitBoardLayout` + `CircuitBoardArt` + `ElectronicParts`), motor de la planta (`ServoMotor`, su aguja sigue y(t)) y sonda (`ScopeProbe`) desde CH1 hasta TP1.                                                                                                                                                                                                     |
| `PidTunerComponent`                    | (feature `sections`) Deslizadores Kp, Ki, Kd, amplitud y frecuencia, y mediciones del escalón en la sección con `"tuner": true` (hoy `habilidades`).                                                                                                                                                                                                                                         |
| `ContactShadows`                       | Sombras de contacto falsas bajo cada objeto que toca el suelo (una textura radial, un draw call, sin mapas de sombra).                                                                                                                                                                                                                                                                       |
| `PowerOnSequence`                      | Línea de tiempo de la intro: vuelo de cámara + encendidos (fade o arranque de neón).                                                                                                                                                                                                                                                                                                         |
| `AdaptiveResolution`                   | Mide FPS reales: baja la resolución si cae de 48 FPS dos muestras seguidas y la sube (hasta supersampling ×1.5) si sobra rendimiento.                                                                                                                                                                                                                                                        |
| `QualityDetector`                      | Perfil alto/bajo: reflejos, SMAA, gotas de lluvia, edificios, resolución de texturas y `pixelRatio`.                                                                                                                                                                                                                                                                                         |
| `SkyDome` / `CitySkyline`              | Cielo con nubes procedurales y ciudad instanciada con ventanas calculadas en el shader (capa `Background`).                                                                                                                                                                                                                                                                                  |
| `Storm`                                | Relámpagos que iluminan cielo, ciudad y escena, y avisan para que suene el trueno con retraso.                                                                                                                                                                                                                                                                                               |

Los marcadores (`HotspotMarker`) no se reflejan en los charcos: son interfaz, no parte del mundo, y un reflejo se leía como un segundo marcador.

Todo es procedural (sin modelos descargados) y determinista (`SeededRandom`). Para reemplazar una pieza por un `.glb`, se crea otro `SceneObject` que lo cargue en `build()` y se cambia en `DioramaScene`.

## Audio

```
AudioEngine (shared, singleton) ── contexto Web Audio · compresor · volumen maestro · silencio
      ▲ onChange
Soundscape (Facade, Updatable) ──► RainSound · NeonHum · SwitchSound · ThunderSound · InterfaceSound
      ▲
DioramaExperience ── NeonSign.mirror(neon) · Storm.onStrike(thunder) · AudibleSwitch (Decorator) en cada Strike
```

- Todo el sonido se sintetiza (ruido filtrado y osciladores): no hay archivos de audio.
- El navegador exige un gesto del usuario para crear el contexto; la pantalla de arranque lo resuelve con "Entrar con sonido / en silencio" y `SoundToggleComponent` permite cambiarlo después.
- El zumbido del neón sigue el brillo real del tubo (baja en cada parpadeo) y la distancia de la cámara al letrero.
- Al ocultar la pestaña el audio se silencia solo.

## Pendiente de definir

Ver la sección "Qué falta" en [stack tecnológico](./tech-stack.md#qué-falta-en-la-arquitectura).
