import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, leerSesion, type SesionLeida } from "@/lib/auth";
import { versionSesionReciente } from "@/lib/ajustes";
import { estadoUsuarioReciente } from "@/lib/usuarios";
import { esHostCatalogo } from "@/lib/hosts";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Subdominio del catálogo: público, pero solo sus páginas (/tienda) y las fotos.
  // Cualquier otra ruta se busca dentro de /tienda, así que la gestión no existe desde aquí.
  if (esHostCatalogo(request.headers.get("host"))) {
    if (pathname.startsWith("/img/") || pathname === "/tienda" || pathname.startsWith("/tienda/")) {
      return NextResponse.next();
    }
    const url = request.nextUrl.clone();
    url.pathname = pathname === "/" ? "/tienda" : `/tienda${pathname}`;
    return NextResponse.rewrite(url);
  }

  // Gestión: todo con contraseña, salvo la entrada y la vista previa del catálogo
  if (pathname === "/login" || pathname === "/tienda" || pathname.startsWith("/tienda/")) {
    return NextResponse.next();
  }
  const sesion = await leerSesion(request.cookies.get(COOKIE)?.value);
  if (!sesion || !(await sesionAlDia(sesion))) {
    const res = NextResponse.redirect(urlMismoHost(request, "/login"));
    if (request.cookies.has(COOKIE)) res.cookies.delete(COOKIE);
    return res;
  }
  return NextResponse.next();
}

// Sesión cerrada en todos los dispositivos, cuenta desactivada o con la contraseña cambiada: se mira aquí,
// en cada petición, porque al navegar dentro de la app el layout no se vuelve a pintar. Si la base de datos
// no responde se deja pasar: las páginas y las acciones tampoco pueden leer nada y ya enseñan su error
// (y vuelven a comprobar la sesión).
async function sesionAlDia(s: SesionLeida) {
  try {
    const [version, usuario] = await Promise.all([
      versionSesionReciente(s.version),
      estadoUsuarioReciente(s.usuarioId, s.versionUsuario),
    ]);
    return s.version === version && !!usuario && usuario.activo && usuario.sesionVersion === s.versionUsuario;
  } catch {
    return true;
  }
}

// Redirige dentro de la misma dirección por la que se entró (gestion.tudominio.es, gestion.localhost…).
// request.url no siempre la trae (detrás de un túnel o en desarrollo apunta al servidor interno).
function urlMismoHost(request: NextRequest, ruta: string) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return host ? new URL(ruta, `${proto}://${host}`) : new URL(ruta, request.url);
}

export const config = {
  // Todo pasa por aquí salvo los archivos estáticos
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|icon-192.png|icon-512.png|apple-icon.png|sello.svg|manifest.webmanifest).*)"],
};
