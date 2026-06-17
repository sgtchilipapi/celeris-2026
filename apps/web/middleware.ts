import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function toHost(origin: string | undefined, fallback: string) {
  return new URL(origin ?? fallback).host;
}

export function middleware(request: NextRequest) {
  const developerHost = toHost(process.env.NEXT_PUBLIC_DEVELOPER_APP_ORIGIN, "http://localhost:3101");
  const authOrigin = process.env.NEXT_PUBLIC_HOSTED_AUTH_ORIGIN ?? "http://localhost:3101";
  const host = request.headers.get("host");

  if (host !== developerHost) {
    return NextResponse.next();
  }

  const protectedPath = request.nextUrl.pathname === "/" || request.nextUrl.pathname === "/setup";
  const hasSession = Boolean(request.cookies.get("celeris_dashboard_session")?.value);

  if (!protectedPath || hasSession) {
    return NextResponse.next();
  }

  const signInUrl = new URL("/sign-in", authOrigin);
  signInUrl.searchParams.set(
    "redirectUri",
    new URL("/auth/callback", process.env.NEXT_PUBLIC_DEVELOPER_APP_ORIGIN ?? "http://localhost:3101").toString()
  );
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: ["/", "/setup"]
};
