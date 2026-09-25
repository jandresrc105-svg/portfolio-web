# Documentación del proyecto

| Documento                            | Contenido                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| [Arquitectura](./architecture.md)    | Capas, flujo de arranque, inyección de dependencias y estructura de carpetas    |
| [Convenciones](./conventions.md)     | Reglas de código, nombres, JSDoc, estilos y reglas ESLint que las hacen cumplir |
| [Stack tecnológico](./tech-stack.md) | Tecnologías elegidas, conceptos 3D evaluados y fuentes de assets                |
| [Despliegue](./deployment.md)        | Build, Docker y opciones de hosting                                             |
| [Decisiones (ADR)](./adr/)           | Registro de decisiones de arquitectura                                          |

## Comandos

```bash
npm run dev          # servidor de desarrollo (http://localhost:5173)
npm run build        # typecheck + build de producción en dist/
npm run preview      # sirve dist/ localmente
npm run check        # typecheck + lint + formato (usar antes de cada commit)
npm run lint:fix     # corrige lo que ESLint pueda corregir solo
npm run format       # aplica Prettier
```
