// Comprueba las traducciones al catalán:  npm run i18n
//  - textos usados con t("…") o tx("…") que faltan en lib/i18n/ca/*.json
//  - traducciones cuyas variables {así} no coinciden con las del texto original
//  - textos que parecen visibles y no pasan por t() (aviso orientativo: revisar a mano)
// Sale con código 1 si falta alguna traducción o hay variables mal puestas.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const carpetas = ["app", "components", "lib"];

function archivos(dir) {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...archivos(p));
    else if (/\.(ts|tsx)$/.test(n)) out.push(p);
  }
  return out;
}

function desescapar(s, comilla) {
  return s.replace(/\\(.)/g, (_, c) => (c === "n" ? "\n" : c === "t" ? "\t" : c === comilla || c === "\\" ? c : `\\${c}`));
}

const dirCa = join(raiz, "lib", "i18n", "ca");
const ca = {};
for (const n of readdirSync(dirCa).filter((n) => n.endsWith(".json"))) {
  const datos = JSON.parse(readFileSync(join(dirCa, n), "utf8"));
  for (const [k, v] of Object.entries(datos)) {
    if (k in ca && ca[k] !== v) console.warn(`Aviso: «${k}» tiene dos traducciones distintas (${n}).`);
    ca[k] = v;
  }
}

const usados = new Map(); // texto → primer sitio
const sospechosos = [];
const reLlamada = /\b(?:t|tx)\(\s*(["'`])((?:\\.|(?!\1)[^\\])*?)\1\s*[,)]/g;
const reJsx = />\s*([¿¡A-ZÁÉÍÓÚÑa-záéíóúñ][^<>{}`]*?[A-Za-záéíóúñ.…!?:)])\s*</g;
// Línea que es solo texto (JSX en varias líneas)
const reProsa = /^\s*([¿¡A-ZÁÉÍÓÚÑ][^<>{}=;()|&`"]*[a-záéíóúñ.…!?:])\s*$/;
const reAtributo = /\b(placeholder|aria-label|title|alt|textoPendiente)="([^"]*[A-Za-záéíóúñ]{2}[^"]*)"/g;

for (const archivo of carpetas.flatMap((c) => archivos(join(raiz, c)))) {
  const rel = relative(raiz, archivo).replaceAll("\\", "/");
  if (rel.startsWith("lib/i18n/")) continue;
  const lineas = readFileSync(archivo, "utf8").split("\n");
  const texto = lineas.join("\n");
  for (const m of texto.matchAll(reLlamada)) {
    if (m[1] === "`" && m[2].includes("${")) continue;
    const s = desescapar(m[2], m[1]);
    const linea = texto.slice(0, m.index).split("\n").length;
    if (!usados.has(s)) usados.set(s, `${rel}:${linea}`);
  }
  if (!rel.endsWith(".tsx")) continue;
  lineas.forEach((l, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(l)) return;
    for (const m of l.matchAll(reJsx)) {
      if (/^(PolAr Vapes|Pol|Ar|Vapes|R-XXXXXX|A–Z|CA|ES|mg|ml|€|uds?\.?)$/.test(m[1].trim())) continue;
      if (/[=;]|=>|&&|\|\|/.test(m[1])) continue;
      sospechosos.push(`${rel}:${i + 1}  ${m[1].trim()}`);
    }
    const prosa = l.match(reProsa);
    if (prosa && /\s/.test(prosa[1].trim())) sospechosos.push(`${rel}:${i + 1}  ${prosa[1].trim()}`);
    for (const m of l.matchAll(reAtributo)) sospechosos.push(`${rel}:${i + 1}  ${m[1]}="${m[2]}"`);
  });
}

const variables = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
const faltan = [...usados].filter(([s]) => !(s in ca));
const malas = Object.entries(ca).filter(([k, v]) => variables(k) !== variables(v));
const sobran = Object.keys(ca).filter((k) => !usados.has(k));

if (faltan.length) {
  console.log(`\nFaltan ${faltan.length} traducciones:`);
  for (const [s, donde] of faltan) console.log(`  ${donde}  ${JSON.stringify(s)}`);
}
if (malas.length) {
  console.log(`\nVariables distintas entre original y traducción (${malas.length}):`);
  for (const [k, v] of malas) console.log(`  ${JSON.stringify(k)} → ${JSON.stringify(v)}`);
}
if (sospechosos.length) {
  console.log(`\nPosibles textos sin traducir (${sospechosos.length}, revisar a mano):`);
  for (const s of sospechosos) console.log(`  ${s}`);
}
if (sobran.length && process.argv.includes("--sobrantes")) {
  console.log(`\nTraducciones que ya no se usan (${sobran.length}):`);
  for (const s of sobran) console.log(`  ${JSON.stringify(s)}`);
}
console.log(`\n${usados.size} textos traducibles · ${Object.keys(ca).length} en el diccionario catalán · ${faltan.length} sin traducir`);
process.exit(faltan.length || malas.length ? 1 : 0);
