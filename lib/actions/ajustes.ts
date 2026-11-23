"use server";

import { revalidatePath } from "next/cache";
import { guardarAjustesEnDb, telefonoWhatsApp, HORAS_CERRAR, MINUTOS_CONFIRMAR } from "@/lib/ajustes";
import { exigirSesion } from "@/lib/session";
import { type Resultado, texto, entero, mensajeError } from "./tipos";

export async function guardarAjustes(_: Resultado, fd: FormData): Promise<Resultado> {
  await exigirSesion();
  try {
    const nombreTienda = texto(fd, "nombre_tienda");
    const whatsapp = texto(fd, "whatsapp");
    const info = texto(fd, "info");
    const minutosConfirmar = entero(fd, "minutos_confirmar");
    const horasCerrar = entero(fd, "horas_cerrar");
    const maxUnidades = entero(fd, "max_unidades");
    if (!nombreTienda) throw new Error("Escribe el nombre que verán los clientes.");
    if (nombreTienda.length > 60) throw new Error("El nombre es demasiado largo.");
    if (whatsapp && !telefonoWhatsApp(whatsapp)) throw new Error("Ese número de WhatsApp no parece válido. Escríbelo con el prefijo si no es de España (+351…).");
    if (info.length > 500) throw new Error("El texto para los clientes es demasiado largo (máx. 500 letras).");
    if (!minutosConfirmar || !MINUTOS_CONFIRMAR.includes(minutosConfirmar)) throw new Error("Elige el tiempo para confirmar.");
    if (!horasCerrar || !HORAS_CERRAR.includes(horasCerrar)) throw new Error("Elige cuánto dura apartada una reserva confirmada.");
    if (!maxUnidades || Number.isNaN(maxUnidades) || maxUnidades < 1 || maxUnidades > 50) throw new Error("Máximo de unidades: entre 1 y 50.");
    await guardarAjustesEnDb({
      nombreTienda,
      whatsapp,
      info,
      minutosConfirmar,
      horasCerrar,
      maxUnidades,
      catalogoAbierto: fd.get("catalogo_abierto") === "on",
    });
  } catch (e) {
    return { error: mensajeError(e) };
  }
  revalidatePath("/", "layout");
  return { ok: "Ajustes guardados." };
}
