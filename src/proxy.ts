import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  // Les routes protégées
  matcher: ["/", "/enfants/:path*", "/pointage/:path*", "/api/sync/:path*"],
};
