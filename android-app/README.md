# Echo du Ciel Goshen — application Android

Application Expo native des moniteurs et administrateurs Goshen. Elle couvre le pointage, les fiches enfants et archives, les familles, les événements/tâches, les notifications, les ressources médias et les outils d’administration. Le style reprend le fond gris clair, les cartes blanches et le vert du site. AsyncStorage conserve les données et met les modifications hors ligne en file; SecureStore protège le JWT.

## Adresse du serveur

Définir l’adresse publique HTTPS dans `EXPO_PUBLIC_SITE_URL` avant Expo (elle est lue par `app.config.ts`), puis lancer depuis ce dossier :

```bash
pnpm install --frozen-lockfile
EXPO_PUBLIC_SITE_URL=https://votre-domaine-goshen.tld npx expo start --android
```

Un fichier `.env` local peut contenir `EXPO_PUBLIC_SITE_URL=https://...`. Pour le développement sur téléphone, utiliser l’adresse LAN accessible du poste et définir explicitement `EXPO_PUBLIC_ALLOW_INSECURE_HTTP=true` si le serveur local utilise HTTP. La version de production refuse HTTP.

## APK de test et publication

```bash
pnpm exec expo prebuild --platform android
pnpm dlx eas-cli build --platform android --profile preview
pnpm dlx eas-cli build --platform android --profile production
```

Le profil preview produit une APK de test; production un AAB. Android Studio/SDK sont nécessaires aux compilations locales. Vérifier le domaine et le package `org.echoduciel.goshen` avant publication.

## Authentification et synchronisation

Le mobile appelle `/api/mobile/session` avec les identifiants du moniteur et conserve le JWT retourné dans SecureStore; il ne garde pas le mot de passe. `/api/sync` synchronise les présences, enfants, événements et tâches. Les routes mobiles d’administration et de téléversement valident le JWT et imposent le rôle administrateur. Les changements sont envoyés automatiquement au démarrage, au retour au premier plan, au retour du réseau et après une modification. La suppression définitive des comptes, événements et tâches n’est pas disponible dans l’application mobile.
