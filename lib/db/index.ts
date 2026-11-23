import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function crear() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Falta la variable DATABASE_URL (mira .env.example)");
  }
  const client = postgres(url, {
    // prepare:false es obligatorio con el pooler de Supabase (modo transacción)
    prepare: false,
    max: process.env.VERCEL ? 1 : 10,
  });
  return drizzle(client, { schema });
}

type Db = ReturnType<typeof crear>;

// La conexión se crea la primera vez que se usa (así el build no necesita base de datos)
// y se reutiliza entre recargas en desarrollo.
const g = globalThis as unknown as { __db?: Db };

function obtener(): Db {
  if (!g.__db) g.__db = crear();
  return g.__db;
}

export const db = new Proxy({} as Db, {
  get(_, prop) {
    const real = obtener();
    const valor = Reflect.get(real, prop, real);
    return typeof valor === "function" ? valor.bind(real) : valor;
  },
});

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema };
