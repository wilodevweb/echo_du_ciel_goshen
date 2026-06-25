import { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'École du Dimanche - Gestion',
    short_name: 'Gestion Enfants',
    description: 'Application de gestion des enfants et présences pour l\'école du dimanche',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#00b22d',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
