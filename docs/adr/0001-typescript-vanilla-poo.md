# ADR 0001: TypeScript vanilla con POO e inyección de dependencias

- **Estado:** aceptada
- **Fecha:** 2026-09-21

## Contexto

El portafolio debe demostrar dominio de arquitectura y patrones de diseño, y su núcleo será una escena 3D con Three.js, cuya API también es orientada a objetos.

## Decisión

- TypeScript sin framework de UI y Vite como bundler.
- Componentes como clases que heredan de `Component` (DOM + eventos), services con la lógica de negocio y una capa `api` limitada a fetch.
- Inyección de dependencias por constructor con un `Container` propio y un `FeatureModule` por feature.
- Reglas estrictas verificadas por ESLint, incluido un plugin local (`tools/eslint`).

## Consecuencias

- **A favor:** control total del render loop 3D sin la reconciliación de un framework; bundle mínimo; la arquitectura es en sí una muestra del trabajo.
- **En contra:** hay que implementar lo que un framework daría hecho (ciclo de vida, DI, posible router). Se mitiga manteniendo el núcleo pequeño y probado.
