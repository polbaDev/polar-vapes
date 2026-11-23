import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_MIGRATIONS || process.env.DATABASE_URL || "postgres://vapers:vapers@localhost:5432/vapers",
  },
});
