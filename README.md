# Gestión Vapers

App web para llevar las compras, las ventas y el stock de la tienda: marcas, modelos, sabores y nicotina.

**Fase 1 (esta versión):** catálogo, compras, ventas (TPV) e inventario.

- **Catálogo:** marcas, sabores (con categoría), proveedores, productos (marca + modelo) y sus variantes (sabor + nicotina, con precio, stock mínimo y código de barras).
- **Compras:** registras lo que compras a un proveedor. Al guardar, el stock sube solo y se recalcula el coste medio, con los gastos de envío repartidos entre los productos.
- **Ventas:** pantalla de cobro pensada para el móvil. Buscas o escaneas el producto, eliges cómo te pagan (efectivo, tarjeta o Bizum) y la app te calcula el cambio. Antes de cobrar hay que marcar que el cliente es mayor de edad.
- **Inventario:** stock por variante con filtros, avisos de reposición, valor del stock y el historial de movimientos de cada producto.
- **Ajustes:** para recuentos, roturas o regalos, siempre con su motivo.
- **Anular** una venta o una compra devuelve o retira las unidades del stock y deja el registro marcado.
- **Inicio:** ventas y beneficio de hoy, de los últimos 7 días y de los últimos 30, lo que hay que reponer y los sabores más vendidos.
- **Ficha de producto:** foto, características, stock total, valor del stock y ventas de 30 días, más una tarjeta por sabor con su foto, precio, stock y ventas. Desde ahí puedes poner un mismo precio a todos los sabores a la vez.
- **Fotos:** se pueden subir desde el móvil o el PC, o importar pegando un enlace. Se guardan en la propia base de datos, así que funcionan igual en Docker y en Supabase.

Tecnología: **Next.js 16** + **PostgreSQL** + **Drizzle ORM** + **Tailwind CSS**. Funciona igual con el Postgres de Docker y con el de **Supabase**, y se despliega en **Vercel** sin cambiar el código.

---

## 1. Arrancar en tu PC con Docker

Necesitas tener **Docker Desktop** abierto.

En PowerShell, dentro de esta carpeta:

```powershell
# Solo la primera vez, si no tienes .env (ya viene uno creado):
copy .env.example .env

docker compose up -d --build
```

Abre **http://localhost:3000** y entra con la contraseña que pone `APP_PASSWORD` en el archivo `.env`.

| Para…                         | Comando                                   |
| ----------------------------- | ----------------------------------------- |
| Ver los logs                  | `docker compose logs -f app`              |
| Parar                         | `docker compose down`                     |
| Actualizar tras cambiar código | `docker compose up -d --build`           |
| Borrar TODO (también los datos) | `docker compose down -v`                |

Los datos se guardan en el volumen `datos_postgres` y no se pierden al parar ni al reiniciar.

### Copia de seguridad

Haz doble clic en **`copia.bat`** (con la app arrancada). Guarda un archivo `vapers-AAAA-MM-DD_HHMM.dump` en la carpeta `copias`, con todo: ventas, compras, stock, catálogo y fotos. Conserva los últimos 30 días y borra las copias más antiguas. El resultado de cada copia queda anotado en `copias\copias.log`.

Una tarea del Programador de tareas de Windows (**Gestion Vapers - copia diaria**) la hace sola todos los días a las 21:30. Si el PC está apagado a esa hora, la copia se hace la próxima vez que lo enciendas. Si Docker no está arrancado, la copia falla y queda anotado en `copias\copias.log`.

> La carpeta `copias` está en este mismo disco: te protege de un borrado por error, pero no de que se estropee el PC. Para eso, guarda las copias en otra carpeta (un USB, o una carpeta de OneDrive o Google Drive que se sincronice):
>
> ```powershell
> .\copia.bat "E:\Copias vapers"
> ```

**Restaurar una copia.** Esto **sustituye todos los datos actuales** por los de la copia:

```powershell
docker compose cp copias\vapers-2026-11-23_2130.dump db:/tmp/copia.dump
docker compose exec db pg_restore -U vapers -d vapers --clean --if-exists --no-owner /tmp/copia.dump
docker compose restart app
```

### Catálogo inicial: Razz Bar 60K

La **primera vez** que arranca, con la base de datos vacía, la app carga la **Razz Bar 60K con sus 16 sabores** (20 mg, aviso de stock en 3 unidades y **sin precio**). Los datos están en `datos/catalogo-inicial.json`.

- Las fotos de cada sabor se descargan de internet en ese momento (800×800). Si no hay conexión, usa los recortes del cartel que hay en `datos/imagenes/` y en la ficha del producto aparece el botón **«Descargar imágenes en alta»** para volver a intentarlo.
- Lo primero que tienes que hacer: entra en Catálogo → Razz Bar 60K y pon el precio con **«Aplicar a todos los sabores»**. Mientras un sabor no tenga precio, no se puede vender.
- Si subes tu propia foto de un sabor, la app no la sustituye por la de internet.

Con Supabase, este catálogo se carga a mano una vez con `npm run db:seed` (ver el apartado 4).

## 2. Desarrollar (ver los cambios al momento)

Con Node.js 20.9 o superior instalado:

```powershell
docker compose up -d db      # solo la base de datos (puerto 5433)
npm install
npm run db:migrate           # crea o actualiza las tablas
npm run db:seed              # catálogo inicial (solo si no hay productos)
npm run dev                  # http://localhost:3000
```

### Cambiar la base de datos

1. Edita `lib/db/schema.ts`.
2. Ejecuta `npm run db:generate`. Se crea un archivo SQL nuevo en `drizzle/`; súbelo a Git.
3. Ejecuta `npm run db:migrate`. Docker también aplica las migraciones pendientes cada vez que arranca la app.

`npm run db:studio` abre un visor de la base de datos en el navegador.

## 3. Subir a GitHub

```powershell
git init
git add .
git commit -m "Fase 1: catálogo, compras, ventas e inventario"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/gestion-vapers.git
git push -u origin main
```

El archivo `.env` (con tu contraseña) **no se sube**: está en `.gitignore`.

## 4. Publicar con Supabase y Vercel

1. **Supabase:** crea un proyecto (región de la UE, por ejemplo Frankfurt o Irlanda). En **Connect** copia dos cadenas de conexión:
   - **Transaction pooler** (puerto 6543): la usa la app.
   - **Session pooler** (puerto 5432): la usan las migraciones.
2. **Crea las tablas en Supabase** desde tu PC:
   ```powershell
   $env:DATABASE_URL_MIGRATIONS="postgresql://postgres.xxxx:CONTRASEÑA@aws-0-eu-...pooler.supabase.com:5432/postgres"
   npm run db:migrate
   npm run db:seed      # carga la Razz Bar 60K con sus fotos
   ```
3. **Vercel:** *Add New → Project*, importa el repositorio de GitHub y añade estas variables de entorno:
   - `DATABASE_URL`: la cadena del **Transaction pooler** (6543)
   - `APP_PASSWORD`: una contraseña larga
   - `AUTH_SECRET`: una cadena aleatoria. Genérala con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `APP_TZ`: `Europe/Madrid`
4. Pulsa **Deploy**. Cada `git push` a `main` vuelve a publicar la app.

> Cuando cambies el esquema, ejecuta `npm run db:migrate` contra Supabase **antes** de hacer push.
>
> Para pasar los datos que ya tengas en Docker a Supabase: haz `pg_dump --data-only` de la base de Docker y cárgalo con `psql` en Supabase cuando ya existan las tablas.

En el móvil, abre la web y elige "Añadir a pantalla de inicio". Se abrirá como una app.

---

## Cómo calcula el stock y el coste

- **El stock no se escribe a mano.** Es la suma de la tabla `movimientos_stock`: las compras suman, las ventas restan, y los ajustes y las anulaciones suman o restan. Así siempre sabes por qué hay las unidades que hay (Inventario → producto → Movimientos).
- **El coste medio es ponderado.** Si tienes 10 unidades a 3 € y compras 10 a 3,40 €, el coste pasa a 3,20 €. Los gastos de envío se reparten en proporción al importe de cada línea.
- **Cada línea de venta guarda el coste de ese momento.** Así el beneficio de una venta antigua no cambia aunque luego compres más caro.
- **No se puede vender más de lo que hay en stock.** Si te pasa, es que falta registrar una compra o hacer un ajuste.

## Estructura

```
app/
  login/                 pantalla de entrada
  (app)/                 todo lo que va detrás del login
    page.tsx             inicio
    ventas/              cobro (nueva), listado y detalle
    compras/             nueva compra, listado y detalle
    inventario/          stock, movimientos y ajustes
    catalogo/            productos, variantes, sabores, marcas y proveedores
components/              piezas de interfaz (TPV, formulario de compra…)
lib/
  db/schema.ts           tablas (Drizzle)
  imagenes.ts            procesado de fotos (sharp → WebP 900 px)
  db/index.ts            conexión a Postgres
  queries.ts             consultas de lectura
  actions/               acciones del servidor (crear, editar, vender, comprar…)
  auth.ts, session.ts    acceso con contraseña
proxy.ts                 protege todas las páginas
app/img/[id]/            sirve las fotos guardadas en la base de datos
drizzle/                 migraciones SQL (se suben a Git)
datos/                   catálogo inicial e imágenes de respaldo
scripts/migrate.mjs      aplica las migraciones
scripts/seed.mjs         carga el catálogo inicial
```

## Siguientes fases

- **Fase 2:** informes por sabor, marca y periodo, rotación y stock muerto, exportar a Excel y gráficas.
- **Fase 3:** escáner con la cámara del móvil, clientes habituales, usuarios para empleados con permisos y cierre de caja diario.
