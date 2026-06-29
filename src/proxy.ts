import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  // Protéger tout le site sauf la page de connexion, les routes d'auth next-auth, et les fichiers statiques/uploads
  matcher: [
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico|uploads).*)",
  ],
};
