import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

// Cuentas de las personas que usan la gestión (ver usuarios en lib/db/schema.ts)

export type Usuario = { id: number; nombre: string; socio: boolean; activo: boolean; sesionVersion: number };
export type Persona = { id: number; nombre: string };

async function filas<T>(q: ReturnType<typeof sql>): Promise<T[]> {
  return (await db.execute(q)) as unknown as T[];
}

const COLUMNAS = sql`id, nombre, socio, activo, sesion_version as "sesionVersion"`;

export async function hayCuentas() {
  const [r] = await filas<{ hay: boolean }>(sql`select exists (select 1 from usuarios) as hay`);
  return r.hay;
}

export async function listarUsuarios() {
  return filas<Usuario & { creadoEn: Date }>(sql`select ${COLUMNAS}, creado_en as "creadoEn" from usuarios order by activo desc, lower(nombre)`);
}

// Socios activos: los que pueden tener dinero de la tienda y entran en el reparto
export async function listarSocios() {
  return filas<Persona>(sql`select id, nombre from usuarios where socio and activo order by id`);
}

// Cuenta y versión global de las sesiones en una sola consulta (para comprobar una sesión)
export async function usuarioYVersion(id: number) {
  const [r] = await filas<Usuario & { versionGlobal: string | null }>(sql`
    select ${COLUMNAS}, (select valor from ajustes where clave = 'sesion_version') as "versionGlobal"
    from usuarios where id = ${id}
  `);
  return r ?? null;
}

// Para el Proxy, que la mira en cada petición: se guarda unos segundos en memoria (como la versión global).
// Las versiones solo suben: si la cookie trae una más nueva que la guardada (acaba de cambiar la contraseña
// en esta sesión), lo guardado está viejo y se vuelve a leer.
const SEGUNDOS = 5;
const recientes = new Map<number, { valor: { activo: boolean; sesionVersion: number } | null; hasta: number }>();

export async function estadoUsuarioReciente(id: number, versionVista = 0) {
  const g = recientes.get(id);
  if (g && g.hasta > Date.now() && (!g.valor || versionVista <= g.valor.sesionVersion)) return g.valor;
  const [r] = await filas<{ activo: boolean; sesionVersion: number }>(
    sql`select activo, sesion_version as "sesionVersion" from usuarios where id = ${id}`,
  );
  const valor = r ?? null;
  if (recientes.size > 200) recientes.clear();
  recientes.set(id, { valor, hasta: Date.now() + SEGUNDOS * 1000 });
  return valor;
}
