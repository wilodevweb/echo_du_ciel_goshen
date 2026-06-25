import type { Metadata } from "next";
import "./globals.css";

export const viewport = {
  themeColor: "#00b22d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: {
    default: "Goshen - Ecole du Dimanche",
    template: "%s | Goshen",
  },
  description: "Application de pointage et gestion des présences",
  applicationName: "Goshen",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Goshen",
  },
  formatDetection: {
    telephone: true,
  },
  icons: {
    icon: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

import AuthProvider from "@/components/AuthProvider";
import { RegisterPWA } from "@/components/RegisterPWA";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <RegisterPWA />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
