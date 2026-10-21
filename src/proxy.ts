import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  // Protéger tout le site sauf la page de connexion, les routes d'auth next-auth, les fichiers statiques/uploads, sw.js, manifest et images
  matcher: [
    "/((?!api/auth|api/dev/status|api/mobile/session|api/mobile/resources|api/mobile/admin|api/mobile/upload|login|_next/static|_next/image|favicon.ico|uploads|sw.js|manifest.webmanifest|.*\\.png$).*)",
  ],
};
