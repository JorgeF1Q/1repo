# Configuración de API

La aplicación lee la URL base del backend desde `window.APP_CONFIG.apiBase`. Este valor se define en [`Js/config.js`](Js/config.js) y se reutiliza tanto en la web como en la app móvil.

## Configuración local (rutas relativas)

1. Edita `Js/config.js` y deja `apiBase` como cadena vacía (`''`).
2. Sirve el frontend y el backend bajo el mismo dominio (por ejemplo `http://localhost`).
3. Todas las peticiones usarán rutas relativas (`/api/...`).

## Producción en Railway

1. Despliega tu backend en Railway y obtén el dominio asignado, por ejemplo `https://joyeria-full-stack-production.up.railway.app`.
2. En `Js/config.js` establece:
   ```js
   apiBase: 'https://joyeria-full-stack-production.up.railway.app'
   ```
3. Sube este archivo junto con el frontend. La app móvil puede apuntar a la misma URL base para consumir el backend publicado en Railway.

## Servidor PHP propio

1. Coloca el backend en tu servidor, por ejemplo en `https://tu-dominio.com`.
2. Edita `Js/config.js` con:
   ```js
   apiBase: 'https://tu-dominio.com'
   ```
3. Usa esa misma URL base en la configuración de la app móvil para que consuma el mismo backend.

## ¿Solo usas tu API en PHP?

Si no necesitas ninguna integración adicional, basta con editar `Js/config.js` para que `apiBase` apunte a tu dominio (por ejemplo `https://tu-dominio.com`). No es necesario configurar Supabase ni ninguna otra dependencia externa.
