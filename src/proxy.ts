import middleware from "next-auth/middleware";
import type { NextRequestWithAuth } from "next-auth/middleware";
import type { NextFetchEvent } from "next/server";

export default function proxy(req: NextRequestWithAuth, event: NextFetchEvent) {
  return middleware(req, event);
}

export const config = {
  // Les routes protégées
  matcher: ["/enfants/:path*", "/pointage/:path*", "/api/sync/:path*"],
};
