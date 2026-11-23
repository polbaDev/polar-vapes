import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, sesionValida } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const ok = await sesionValida(request.cookies.get(COOKIE)?.value);
  if (!ok) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Todo protegido salvo login y archivos estáticos
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"],
};
