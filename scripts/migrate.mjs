// Aplica las migraciones de ./drizzle a la base de datos.
// Uso: npm run db:migrate   (lee DATABASE_URL_MIGRATIONS o DATABASE_URL)
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { fileURLToPath } from "node:url";

const url = process.env.DATABASE_URL_MIGRATIONS || process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL");
  process.exit(1);
}

const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

// En Docker la base de datos puede tardar unos segundos en aceptar conexiones
for (let intento = 1; ; intento++) {
  try {
    await client`select 1`;
    break;
  } catch (e) {
    if (intento >= 30) throw e;
    console.log(`Esperando a la base de datos (${intento})…`);
    await new Promise((r) => setTimeout(r, 1000));
  }
}

await migrate(drizzle(client), { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
console.log("Migraciones aplicadas ✔");
await client.end();
