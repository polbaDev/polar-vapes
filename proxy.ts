import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, sesionValida } from "@/lib/auth";
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
  const ok = await sesionValida(request.cookies.get(COOKIE)?.value);
  if (!ok) return NextResponse.redirect(urlMismoHost(request, "/login"));
  return NextResponse.next();
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
