import middleware from "next-auth/middleware";
import type { NextRequestWithAuth } from "next-auth/middleware";

export default function proxy(req: NextRequestWithAuth, event: any) {
  return middleware(req, event);
}

export const config = {
  // Les routes protégées
  matcher: ["/enfants/:path*", "/pointage/:path*", "/api/sync/:path*"],
};
