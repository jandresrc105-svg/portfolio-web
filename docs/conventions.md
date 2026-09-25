# Convenciones de código

Todas las reglas marcadas con **ESLint** hacen fallar `npm run lint`. No se desactivan con comentarios (los comentarios `eslint-disable` también están prohibidos por la regla de solo-JSDoc).

## Archivos y declaraciones

| Regla                                                                                                                | Aplicación                            |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 1 archivo = 1 declaración (clase, interfaz, tipo o enum)                                                             | ESLint `portfolio/single-declaration` |
| Nada fuera de la clase: sin variables ni funciones sueltas. Las constantes son `private static readonly` de la clase | ESLint `portfolio/single-declaration` |
| El nombre del archivo es igual al de la declaración (`HeroComponent.ts` → `class HeroComponent`)                     | ESLint `portfolio/single-declaration` |
| Sin barrels ni re-exports (`export * from`, `index.ts`)                                                              | ESLint `portfolio/single-declaration` |
| Máximo 1 clase por archivo                                                                                           | ESLint `max-classes-per-file`         |
| Máximo 500 líneas por archivo (sin contar vacías ni JSDoc)                                                           | ESLint `max-lines`                    |
| Exportaciones con nombre, no `default`                                                                               | Convención                            |

Excepción única: `main.ts` puede ejecutar una sentencia de arranque (`new Main().start();`).

## Funciones y métodos

| Regla                                                                                        | Aplicación                                   |
| -------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Máximo 20 líneas por función/método (sin vacías ni comentarios)                              | ESLint `max-lines-per-function`              |
| Complejidad ciclomática máxima 8                                                             | ESLint `complexity`                          |
| Anidamiento máximo 3 niveles, callbacks anidados máximo 3                                    | ESLint `max-depth`, `max-nested-callbacks`   |
| Máximo 5 parámetros (si hay más, usar un objeto tipado)                                      | ESLint `@typescript-eslint/max-params`       |
| Tipo de retorno explícito y modificador de acceso explícito (`public`/`protected`/`private`) | ESLint                                       |
| Sin números mágicos: usar `private static readonly` o enums                                  | ESLint `@typescript-eslint/no-magic-numbers` |
| Siempre llaves en `if`/`for`, `===`, sin ternarios anidados                                  | ESLint                                       |

## Documentación y comentarios

- **Solo JSDoc/TSDoc** (`/** ... */`). Prohibidos `//` y `/* */` → ESLint `portfolio/jsdoc-only-comments`.
- Obligatorio en clases, constructores, métodos, interfaces, propiedades de interfaces, tipos y enums → ESLint `jsdoc/require-jsdoc`.
- Descripción obligatoria, `@param` y `@returns` con descripción, `@throws` si lanza errores.
- Métodos que sobrescriben la clase base pueden usar `@inheritdoc`.
- No se escriben tipos en JSDoc (`@param {string}`): TypeScript ya los tiene.

## Nombres

| Elemento                                | Formato                    | Ejemplo                                         |
| --------------------------------------- | -------------------------- | ----------------------------------------------- |
| Clases, interfaces, tipos, enums        | PascalCase                 | `ProfileService`                                |
| Interfaces                              | Sin prefijo `I`            | `Profile`, no `IProfile`                        |
| Métodos, propiedades, variables         | camelCase, sin `_` inicial | `experienceLabel`                               |
| Constantes de clase (`static readonly`) | UPPER_CASE                 | `MONTHS_PER_YEAR`                               |
| Miembros de enum                        | PascalCase                 | `Lifetime.Singleton`                            |
| Componentes / services / api            | Sufijo del rol             | `HeroComponent`, `ProfileService`, `ProfileApi` |

Orden de miembros en una clase: campos estáticos → campos → constructor → getters/setters → métodos públicos → abstractos protegidos → protegidos → privados → privados estáticos.

## Imports

- Alias: `@app/*`, `@features/*`, `@shared/*`. Relativo solo dentro de la misma feature (hasta `../../`, p. ej. desde `scene/objects/` hacia `models/`). `../../../` sale de la feature y está prohibido.
- `import type` para lo que solo se usa como tipo → ESLint `consistent-type-imports`.
- Límites entre capas (ver [arquitectura](./architecture.md#capas-y-dependencias-permitidas)) → ESLint `no-restricted-imports` y `no-restricted-globals`.

## Estilos (Sass)

- Un único punto de entrada: `src/styles/main.scss`, enlazado desde `index.html`. **Ningún `.ts` importa `.scss` ni `.css`** → ESLint `no-restricted-imports`.
- Módulos con `@use` / `@forward` (nunca `@import`). Cada carpeta tiene su `_index.scss`.
- Todo con **nesting** y BEM: `.hero { &__title { … } }`. Media queries con los mixins `from('md')` y `reduced-motion`, anidadas dentro del selector.
- Valores desde `abstracts/_tokens.scss`; nada de colores o espaciados sueltos.

```
styles/
├── main.scss         @use base, layout, features
├── abstracts/        tokens y mixins (no generan CSS)
├── base/             reset y estilos globales
├── layout/           estructura de la app
└── features/         un parcial por feature: _hero.scss
```

## Formato

Prettier (`.prettierrc.json`): comillas simples, punto y coma, 110 columnas. ESLint no discute formato (`eslint-config-prettier`).
