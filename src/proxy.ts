import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  // Protéger tout le site sauf la page de connexion, les routes d'auth next-auth, les fichiers statiques/uploads, et les fichiers PWA (sw.js, manifest, icônes)
  matcher: [
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico|uploads|sw\\.js|manifest\\.webmanifest|.*\\.png$).*)",
  ],
};
