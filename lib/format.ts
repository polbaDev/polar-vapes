const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const num = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });

export function euros(v: number | string | null | undefined) {
  return eur.format(Number(v ?? 0));
}

export function numero(v: number | string | null | undefined) {
  return num.format(Number(v ?? 0));
}

export function fechaHora(d: Date | string, tz = process.env.APP_TZ || "Europe/Madrid") {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: tz,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

export function fecha(d: Date | string) {
  // Las fechas tipo "date" llegan como "YYYY-MM-DD"
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  }
  return new Intl.DateTimeFormat("es-ES", { timeZone: process.env.APP_TZ || "Europe/Madrid" }).format(new Date(d));
}

export function hoyISO(tz = process.env.APP_TZ || "Europe/Madrid") {
  // YYYY-MM-DD en la zona horaria de la tienda
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

// «hoy a las 18:30», «mañana a las 10:00» o «el 25/11 a las 10:00»
export function cuando(d: Date | string, tz = process.env.APP_TZ || "Europe/Madrid") {
  const fecha = new Date(d);
  const hora = new Intl.DateTimeFormat("es-ES", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(fecha);
  const dia = diaISO(fecha, tz);
  const hoy = diaISO(new Date(), tz);
  const manana = diaISO(new Date(Date.now() + 86400000), tz);
  if (dia === hoy) return `hoy a las ${hora}`;
  if (dia === manana) return `mañana a las ${hora}`;
  const dm = new Intl.DateTimeFormat("es-ES", { timeZone: tz, day: "2-digit", month: "2-digit" }).format(fecha);
  return `el ${dm} a las ${hora}`;
}

export function diaISO(d: Date | string, tz = process.env.APP_TZ || "Europe/Madrid") {
  // YYYY-MM-DD de un instante, en la zona horaria de la tienda
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(d));
}

export function redondear(v: number, dec = 2) {
  const f = 10 ** dec;
  return Math.round((v + Number.EPSILON) * f) / f;
}

export function nombreVariante(v: {
  marca: string;
  modelo: string;
  sabor: string;
  nicotinaMg: number;
}) {
  return `${v.marca} ${v.modelo} · ${v.sabor} · ${v.nicotinaMg} mg`;
}
