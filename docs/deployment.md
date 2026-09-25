# Despliegue

## ¿Hace falta Docker?

**Para el frontend, no es necesario.** El build (`dist/`) son archivos estáticos. Un hosting estático con CDN es gratis, sirve los modelos 3D más rápido desde el borde y trae HTTPS y previews por rama:

| Opción           | Ventaja                                                                   |
| ---------------- | ------------------------------------------------------------------------- |
| Cloudflare Pages | CDN global, ancho de banda ilimitado (clave para archivos `.glb` pesados) |
| Vercel / Netlify | Preview automático por cada push a una rama                               |
| GitHub Pages     | Todo dentro de GitHub                                                     |

**Docker tiene sentido cuando llegue el backend:** `docker-compose.yml` levantará `web` + `api` (+ base de datos) con un solo comando, y la misma imagen se despliega en un VPS, Railway, Fly.io o Render. Por eso el repositorio ya incluye:

- `Dockerfile`: multi-stage. Node 22 compila y nginx sirve `dist/`; la imagen final no lleva Node ni código fuente.
- `docker/nginx.conf`: fallback SPA, gzip, caché de 1 año para `/assets` (con hash) y MIME correcto para `.glb`.
- `.dockerignore` y `docker-compose.yml`.

## Comandos

```bash
# Local sin Docker
npm ci
npm run build
npm run preview

# Con Docker (requiere Docker Desktop encendido)
docker compose up --build        # http://localhost:8080
VITE_API_URL=https://api.ejemplo.com docker compose up --build
```

`VITE_API_URL` se inyecta **en tiempo de build** (Vite reemplaza `import.meta.env`), por eso es un `ARG` del Dockerfile y no una variable de runtime.

## Ramas y entornos

| Rama                          | Entorno              |
| ----------------------------- | -------------------- |
| `DESARROLLO` / `DESARROLLO_*` | Desarrollo (preview) |
| `CALIDAD`                     | Pruebas              |
| `PRODUCTIVO`                  | Producción           |

Flujo: `DESARROLLO_JARC` → PR a `DESARROLLO` → PR a `CALIDAD` → PR a `PRODUCTIVO`.
