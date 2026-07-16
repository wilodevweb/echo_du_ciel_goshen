const CACHE_VERSION = "goshen-v2"; // Nouvelle version pour forcer la mise à jour
const APP_CACHE = `${CACHE_VERSION}-app`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const MAX_RUNTIME_ITEMS = 100;

// Les routes principales de l'application à précacher absolument
const PRECACHE_URLS = [
  "/",
  "/dashboard",
  "/enfants",
  "/enfants/nouveau",
  "/evenements",
  "/famille",
  "/fichiers",
  "/notifications",
  "/login",
  "/offline",
  "/manifest.webmanifest",
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/icon-192x192-maskable.png",
  "/icon-512x512-maskable.png",
  "/apple-touch-icon.png",
  "/logo eglise.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) => {
        console.log("[Service Worker] Précachage des ressources critiques...");
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => !cacheName.startsWith(CACHE_VERSION))
            .map((cacheName) => {
              console.log("[Service Worker] Nettoyage ancien cache :", cacheName);
              return caches.delete(cacheName);
            }),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ne gérer que les requêtes GET sur le même domaine
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Ignorer les requêtes d'API internes et auth (pour qu'elles aillent directement au réseau)
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Gérer la navigation html
  if (request.mode === "navigate") {
    event.respondWith(staleWhileRevalidateNavigate(request));
    return;
  }

  // Gérer les assets statiques et les fichiers Next.js
  const isPrecached = PRECACHE_URLS.includes(url.pathname);
  if (
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/static/") ||
    isStaticAsset(request) ||
    isPrecached
  ) {
    event.respondWith(cacheFirst(request));
  }
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }

  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || "Goshen", {
      body: data.body,
      icon: data.icon || "/icon-192x192.png",
      badge: "/icon-192x192.png",
      data: {
        url: data.url || "/",
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client && client.url.endsWith(targetUrl)) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }

      return undefined;
    }),
  );
});

/**
 * Stratégie Stale-While-Revalidate optimisée pour les pages de navigation :
 * Elle tente de récupérer la page depuis le réseau avec une limite de temps rapide (2s).
 * Si le réseau répond, elle met à jour le cache et renvoie la réponse.
 * Si le réseau met trop de temps ou échoue, elle renvoie immédiatement la version en cache.
 * Si aucune version en cache n'existe, elle renvoie la page /offline.
 */
async function staleWhileRevalidateNavigate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  
  // Créer une promesse de timeout réseau de 2.5 secondes
  const timeoutPromise = new Promise((resolve) => 
    setTimeout(() => resolve(null), 2500)
  );

  // Promesse réseau qui met à jour le cache
  const networkPromise = fetch(request)
    .then(async (response) => {
      if (response && response.status === 200) {
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  // Essayer de récupérer le réseau rapidement, sinon basculer sur le cache
  const networkResponse = await Promise.race([networkPromise, timeoutPromise]);
  
  if (networkResponse) {
    return networkResponse;
  }

  // Hors-ligne ou réseau lent : chercher dans tous les caches disponibles
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    // Si on a renvoyé du cache à cause du timeout, lancer quand même la mise à jour en tâche de fond
    event.waitUntil(networkPromise);
    return cachedResponse;
  }

  // Fallback ultime sur la page /offline précachée
  const offlineFallback = await caches.match("/offline");
  return offlineFallback || new Response("Connexion hors-ligne requise.", {
    status: 503,
    statusText: "Service Unavailable",
    headers: new Headers({ "Content-Type": "text/plain" }),
  });
}

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
      trimCache(RUNTIME_CACHE, MAX_RUNTIME_ITEMS);
    }
    return response;
  } catch (error) {
    // Échec réseau, aucune ressource disponible
    return new Response("Ressource non disponible hors-ligne.", {
      status: 404,
      statusText: "Not Found",
    });
  }
}

function isStaticAsset(request) {
  return ["image", "script", "style", "font", "worker"].includes(request.destination);
}


async function trimCache(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      const itemsToDelete = keys.slice(0, keys.length - maxItems);
      await Promise.all(itemsToDelete.map((key) => cache.delete(key)));
    }
  } catch {
    // Ignore les erreurs de cache silencieusement
  }
}
