# PolAr Vapes

De **Pol** y **Ar**nau. App web para llevar las compras, las ventas y el stock de la tienda: marcas, modelos, sabores y nicotina.

**Fase 1 (esta versión):** catálogo, compras, ventas (TPV) e inventario.

- **Catálogo:** marcas, sabores (con categoría), proveedores, productos (marca + modelo) y sus variantes (sabor + nicotina, con precio, stock mínimo y código de barras).
- **Compras:** registras lo que compras a un proveedor. Al guardar, el stock sube solo y se recalcula el coste medio, con los gastos de envío repartidos entre los productos.
- **Pedido sugerido** (Compras → Pedido sugerido): calcula cuánto pedir de cada sabor según lo que vendes y el stock que te queda. Eliges para cuántos días quieres tener stock, qué periodo de ventas se tiene en cuenta, si el proveedor vende en cajas (por ejemplo de 10) y, si quieres, filtras por marca o por el último proveedor al que compraste. Puedes cambiar las cantidades, copiar el pedido o mandarlo por WhatsApp (al móvil del proveedor, si lo tiene guardado), y cuando llegue, abrir la compra ya rellena. La fórmula: lo que venderías en esos días al ritmo actual + el stock mínimo − lo que ya tienes. Si un sabor entró en stock hace poco, el ritmo se calcula solo con los días que lleva a la venta.
- **Ventas:** pantalla de cobro pensada para el móvil. Buscas o escaneas el producto, eliges cómo te pagan (efectivo, tarjeta o Bizum) y la app te calcula el cambio. Antes de cobrar hay que marcar que el cliente es mayor de edad.
  - Sin buscar, salen primero los sabores que más vendes (últimos 30 días). Los botones de arriba filtran por modelo.
  - En efectivo, los botones «Justo», 20 €, 50 €… rellenan lo que te da el cliente.
  - **Lector de códigos:** uno USB o Bluetooth funciona siempre (escribe el código y pulsa Intro). La **cámara del móvil** también sirve con Chrome en Android, pero solo si la app va por **https** (con Vercel) o en el propio PC (localhost); desde el móvil por la WiFi de la tienda (http://192.168…) el navegador no deja usar la cámara. El mismo botón está en Nueva compra (cada lectura suma una unidad) y en el campo «Código de barras» de cada sabor, para darlos de alta leyéndolos.
- **Inventario:** stock por variante con filtros, avisos de reposición, valor del stock y el historial de movimientos de cada producto.
- **Ajustes:** para recuentos, roturas o regalos, siempre con su motivo.
- **Anular** una venta o una compra devuelve o retira las unidades del stock y deja el registro marcado. Es para tickets registrados por error.
- **Devoluciones parciales** (en el detalle de la venta → «Registrar devolución»): eliges qué unidades te devuelven, cómo devuelves el dinero (efectivo, tarjeta o Bizum) y si vuelven al stock o están defectuosas. Si el ticket tuvo descuento, se reparte en proporción. Lo defectuoso no vuelve a la venta y su coste cuenta como pérdida. En ventas, beneficio y sabores más vendidos, lo devuelto se resta de la venta original. Al devolver se elige qué socio pone el dinero. Una venta con devoluciones ya no se puede anular: si te devuelven el resto, es otra devolución.
- **Catálogo para clientes y reservas:** una parte pública, sin contraseña, donde los clientes ven modelos, sabores, fotos, precio y si hay («Disponible / Últimas unidades / Agotado», nunca cuántas). No es un canal de venta: el cliente elige, pone su nombre y reserva; recibe un código (R-XXXXXX) y un botón que le abre tu WhatsApp con el mensaje escrito. La venta se cierra por WhatsApp.
  - En **Reservas** confirmas, rechazas, cambias cantidades o la cancelas. Lo reservado queda apartado y el TPV no deja vendérselo a otro. «Vender» abre el TPV con la reserva cargada.
  - Si no la confirmas a tiempo (2 h por defecto) o no se cierra la venta (24 h desde que la confirmas), caduca sola y el stock vuelve a estar libre. Una caducada se puede reactivar si sigue habiendo unidades.
  - En **Ajustes** (desde Reservas): tu WhatsApp, el nombre que ven los clientes, un texto (horario…), los tiempos, el máximo de unidades por reserva y abrir o cerrar el catálogo.
  - Al entrar se pregunta si es mayor de edad, no sale en buscadores y hay límites contra reservas falsas (como mucho 3 en curso por conexión).
  - **Dos direcciones, una sola app:** cualquier dirección que empiece por `catalogo.` (por ejemplo `catalogo.tudominio.es`) solo enseña el catálogo; cualquier otra (`gestion.tudominio.es`, `localhost`, la IP del PC) es la gestión con contraseña. En este PC: http://catalogo.localhost:3000 y http://gestion.localhost:3000.
- **Cuentas:** cada persona entra con su nombre y su contraseña, y lo que hace queda a su nombre: quién cobró cada venta, quién registró y anuló compras y ventas. La primera vez que se entra no hay ninguna cuenta: se crea la primera con la contraseña de la app (`APP_PASSWORD`, la que enseña `arrancar.bat`) y desde **Socios → Cuentas y contraseñas** se crea la del otro socio. Ahí también se cambia la contraseña propia, se pone una nueva a quien la haya olvidado y se desactiva una cuenta (no puede entrar, pero sus ventas siguen a su nombre). Una cuenta puede ser de socio (entra en el reparto) o no (por ejemplo, una compartida de la tienda).
- **Socios (cuentas entre socios al 50 %):** no hay caja ni cuenta común: la app apunta qué socio tiene cada euro de la tienda (el bote) sin tener que contar el dinero. Al cobrar se elige quién se queda el dinero, sea en efectivo, por Bizum (a su móvil) o con tarjeta (a su cuenta), y en cada compra quién la paga. Las **aportaciones** son dinero que un socio pone de su bolsillo para comprar más stock (por ejemplo, 105 € cada uno): se apunta quién lo pone y quién lo guarda. La página **Socios** enseña el bote total y lo que tiene y ha aportado cada uno, quién paga a quién para quedar a la par si repartís ahora (contando lo aportado) o a quién le toca pagar la próxima compra, de dónde sale lo que tiene cada uno y lo que vende cada uno (ventas, tickets, beneficio). Ahí también se apuntan aportaciones, pagos entre socios, gastos, repartos de ganancias y el saldo de partida (por ejemplo, el dinero de ventas anteriores que alguien tiene guardado). Lo apuntado ahí se anula, no se borra. Si alguien se equivoca de persona, se corrige en el detalle de la venta o de la compra.
- **Entrada protegida:** 5 contraseñas fallidas seguidas desde la misma conexión bloquean la entrada 15 minutos. 30 fallos en total en 15 minutos bloquean la entrada desde dispositivos nuevos, pero no desde los que ya habían entrado antes (el móvil y el PC de la tienda siguen pudiendo entrar). Un nombre que no existe cuenta igual que una contraseña mal puesta.
- **Sesiones:** caducan a los 30 días. En **Ajustes → Sesiones**, «Cerrar sesión en todos los dispositivos» saca a todos (por ejemplo, si pierdes un móvil). Cambiar la contraseña de una cuenta o desactivarla cierra las sesiones de esa cuenta.
- **Inicio:** ventas y beneficio de hoy, de los últimos 7 días y de los últimos 30, quién paga a quién y lo que ha vendido hoy cada uno, lo que hay que reponer y los sabores más vendidos.
- **Ficha de producto:** foto, características, stock total, valor del stock y ventas de 30 días, más una tarjeta por sabor con su foto, precio, stock y ventas. Desde ahí puedes poner un mismo precio a todos los sabores a la vez.
- **Fotos:** se pueden subir desde el móvil o el PC, o importar pegando un enlace. Se guardan en la propia base de datos, así que funcionan igual en Docker y en Supabase.
- **Aspecto, tema e idioma:** marca propia, PolAr Vapes: un sello burdeos, hueso y oro viejo con el monograma P&A, títulos en Cormorant Garamond y texto en Public Sans (guía completa en [BRAND.md](BRAND.md)), con la estructura visual de FinqCat (navegación en cápsula y accesos rápidos a la izquierda). En el menú del círculo de arriba a la derecha eliges el tema (claro, oscuro o el del sistema) y el idioma (castellano o catalán); en el catálogo para clientes, en el botón del globo. Cada navegador recuerda su elección.

Tecnología: **Next.js 16** + **PostgreSQL** + **Drizzle ORM** + **Tailwind CSS**. Funciona igual con el Postgres de Docker y con el de **Supabase**, y se despliega en **Vercel** sin cambiar el código.

---

## 1. Arrancar en tu PC con Docker

Necesitas tener **Docker Desktop** instalado y abierto.

Haz doble clic en **`arrancar.bat`**. Espera a que Docker esté listo, construye y arranca la app y abre **http://localhost:3000**. La primera vez crea el archivo `.env` con una contraseña de la app nueva al azar y te la enseña (queda guardada en `.env`, en `APP_PASSWORD`): te la pedirá la app para crear la primera cuenta. También programa la copia de seguridad diaria (ver abajo). Si la app no llega a arrancar, te lo dice y deja los detalles en `app.log`. Para pararla, **`parar.bat`**.

Si creas el `.env` a mano copiando `.env.example`, cambia `APP_PASSWORD` y `AUTH_SECRET`. Si se quedan vacíos, con los valores de ejemplo o son demasiado cortos (la contraseña necesita al menos 8 caracteres y `AUTH_SECRET`, 32), `arrancar.bat` los cambia por unos nuevos y te enseña la contraseña.

Desde PowerShell, dentro de esta carpeta:

| Para…                         | Comando                                   |
| ----------------------------- | ----------------------------------------- |
| Arrancar (con el `.env` ya creado) | `docker compose up -d --build`       |
| Ver los logs                  | `docker compose logs -f app`              |
| Parar                         | `docker compose down`                     |
| Actualizar tras cambiar código | `docker compose up -d --build`           |
| Borrar TODO (también los datos) | `docker compose down -v`                |

Los datos se guardan en el volumen `datos_postgres` y no se pierden al parar ni al reiniciar.

### Copia de seguridad

Haz doble clic en **`copia.bat`**. Guarda un archivo `vapers-AAAA-MM-DD_HHMMSS.dump` en la carpeta `copias`, con todo: ventas, compras, stock, catálogo y fotos, y comprueba que se puede leer. Conserva los últimos 30 días y borra las copias más antiguas. El resultado de cada copia queda anotado en `copias\copias.log`.

Una tarea del Programador de tareas de Windows (**Gestion Vapers - copia diaria**) la hace sola todos los días a las 21:30, con la sesión de Windows iniciada (Docker Desktop la necesita). `arrancar.bat` la crea la primera vez; si mueves la carpeta de la app, ejecuta **`programar-copia.bat`** para rehacerla. Si el PC está apagado a esa hora, la copia se hace la próxima vez que lo enciendas.

- Si Docker aún está arrancando, espera hasta 5 minutos.
- Si la app está parada (con `parar.bat`), arranca solo la base de datos para hacer la copia y luego la vuelve a parar.
- Si algo falla, queda anotado en `copias\copias.log`.

> La carpeta `copias` está en este mismo disco: te protege de un borrado por error, pero no de que se estropee el PC. Para eso, guarda las copias en otra carpeta (un USB, o una carpeta de OneDrive o Google Drive que se sincronice):
>
> ```powershell
> .\copia.bat "E:\Copias vapers"
> ```

**Restaurar una copia.** Esto **sustituye todos los datos actuales** por los de la copia. Arrastra el archivo de la copia encima de **`restaurar.bat`**, o en PowerShell:

```powershell
.\restaurar.bat copias\vapers-2026-11-23_213000.dump
```

En un PC nuevo, ejecuta antes `arrancar.bat` (crea el `.env`, que no está en las copias ni en Git).

Te pide que escribas `SI` para seguir. Antes guarda los datos actuales en `copias\antes-de-restaurar` (si la base de datos está vacía, no guarda nada). Luego para la app, borra la base de datos, la crea de nuevo vacía, carga la copia y vuelve a arrancar la app. Si la copia es de una versión anterior, al arrancar la app se aplican las migraciones que falten. Si algo sale mal, te dice el nombre exacto de la copia de los datos de antes (también queda en `copias\copias.log`): restáurala con `restaurar.bat` para dejarlo como estaba.

### Catálogo inicial: Razz Bar 60K

La **primera vez** que arranca, con la base de datos vacía, la app carga la **Razz Bar 60K con sus 26 sabores** (20 mg, aviso de stock en 3 unidades y **sin precio**). Los datos están en `datos/catalogo-inicial.json`.

- Las fotos de los 26 sabores van incluidas en `datos/imagenes/razz-bar-60k/` (900×900, todas con el mismo estilo: fruta y nube de color detrás del vaper), así que no hace falta internet. La foto del producto (el cartel con los 26 sabores) se descarga de la web de Razz Bar; si no hay conexión, se usa la copia de `datos/imagenes/` y en la ficha del producto aparece el botón **«Descargar imágenes en alta»** para volver a intentarlo.
- Lo primero que tienes que hacer: entra en Catálogo → Razz Bar 60K y pon el precio con **«Aplicar a todos los sabores»**. Mientras un sabor no tenga precio, no se puede vender.
- Si subes tu propia foto de un sabor, la app no la sustituye por la de internet.

Con Supabase, este catálogo se carga a mano una vez con `npm run db:seed` (ver el apartado 4).

## 2. Desarrollar (ver los cambios al momento)

Con Node.js 20.12 o superior instalado y el archivo `.env` creado (ver el apartado 1; `db:migrate` y `db:seed` leen de ahí `DATABASE_URL`):

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
3. Ejecuta `npm run db:migrate`. Docker también aplica las migraciones pendientes cada vez que arranca la app; si alguna falla, la app no arranca y el error sale en `docker compose logs app`.

`npm run db:studio` abre un visor de la base de datos en el navegador.

### Textos y traducciones

Los textos se escriben en castellano dentro de `t("…")` (`await traductor()` en el servidor, `useT()` en componentes de cliente) y su traducción al catalán va en `lib/i18n/ca/*.json`, con el texto en castellano como clave. Las variables van entre llaves: `t("Faltan {importe}", { importe })`. `npm run i18n` avisa de los textos que faltan por traducir.

### Colores y tema

Los colores están en `app/globals.css` y cambian solos con el tema: las escalas `zinc`, `emerald`, `red`, `amber` y `marca` de Tailwind están redefinidas con la paleta de PolAr, así que no hace falta `dark:`. Para tarjetas y campos, `bg-superficie`.

## 3. Subir a GitHub

```powershell
git init
git add .
git commit -m "Fase 1: catálogo, compras, ventas e inventario"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/polar-vapes.git
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
   - `APP_PASSWORD`: una contraseña larga (como mínimo 8 caracteres); solo sirve para crear la primera cuenta
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
    socios/              cuentas entre socios, ventas por persona y cuentas y contraseñas
components/              piezas de interfaz (TPV, formulario de compra…)
lib/
  db/schema.ts           tablas (Drizzle)
  imagenes.ts            procesado de fotos (sharp → WebP 900 px)
  db/index.ts            conexión a Postgres
  queries.ts             consultas de lectura
  actions/               acciones del servidor (crear, editar, vender, comprar…)
  auth.ts, session.ts    sesiones de las cuentas (cookie firmada)
  claves.ts, usuarios.ts contraseñas (scrypt) y cuentas
  socios.ts              saldo de cada socio, movimientos de dinero y ventas por persona
  socios-calculo.ts      quién paga a quién para quedar a la par
  i18n/                  traducciones (ca/*.json) y traductor
  preferencias.ts        cookies de tema e idioma
proxy.ts                 protege todas las páginas
app/img/[id]/            sirve las fotos guardadas en la base de datos
drizzle/                 migraciones SQL (se suben a Git)
datos/                   catálogo inicial e imágenes de respaldo
scripts/migrate.mjs      aplica las migraciones
scripts/seed.mjs         carga el catálogo inicial
```

## Publicar el catálogo en internet (pendiente)

Ahora la app solo se ve desde este PC y la red de la tienda. Para que los clientes entren al catálogo hace falta un dominio (unos 10 €/año) y elegir dónde se aloja:

- **Túnel de Cloudflare desde este PC** (gratis): mismo Docker y mismas copias; el catálogo solo funciona con el PC encendido.
- **Servidor pequeño de alquiler** (desde unos 5 €/mes): el mismo Docker funcionando las 24 h.

En los dos casos se apuntan `catalogo.tudominio.es` y `gestion.tudominio.es` a la app, con https. Se puede añadir además un código por email para entrar en `gestion` (Cloudflare Access).

Con el túnel de Cloudflare, pon `CABECERA_IP=cf-connecting-ip` en el archivo `.env` y vuelve a arrancar la app: así toma la IP real de cada visitante de la cabecera que añade Cloudflare (la usa en los límites de reservas y de contraseñas fallidas).

## Siguientes fases

- **Fase 2:** informes por sabor, marca y periodo, rotación y stock muerto, exportar a Excel y gráficas.
- **Fase 3:** escáner con la cámara del móvil, clientes habituales, usuarios para empleados con permisos.
