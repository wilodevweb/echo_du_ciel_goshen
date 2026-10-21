This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Run the isolated demo environment:

```bash
pnpm dev
```

`pnpm dev` starts the web app and its normal API routes against a local SQLite database at `.goshen-demo/goshen.db`. It overrides the database settings from `.env`, so it cannot connect to the real Turso database. The database and its fake records are kept locally and ignored by Git.

Demo accounts: `demo.admin` or `demo.monitor`, password `demo1234`.

To launch the demo web server and Expo Go together, with the mobile app pointed at the same local SQLite API, run:

```bash
pnpm dev:full
```

Keep the phone and computer on the same Wi-Fi. If the computer has several network adapters, set `GOSHEN_DEMO_HOST` to its Wi-Fi IPv4 address before running the command.

To use the existing real database configuration from `.env`, run:

```bash
pnpm dev:real
```

The `goshen-web` shell shortcut uses this real-database mode. Use `pnpm dev` for the isolated web demo or `pnpm dev:full` for the isolated web and mobile demo.

Administrator provisioning requires `ADMIN_JOSEPH_PASSWORD` and `ADMIN_SERGE_PASSWORD` in the ignored local `.env` file. Each must be at least 12 characters. `pnpm create-admins` creates missing accounts and leaves existing passwords unchanged; append `-- --reset-passwords` only when you intend to rotate both existing administrator passwords. The Prisma seed command refuses to run unless it points to the isolated demo database.

Web and mobile login block further attempts for 15 minutes after five failures for the same IP and login. This limiter is stored in process memory; multi-instance deployments need a shared limiter or gateway rule. A reverse proxy should overwrite `x-real-ip`/`x-forwarded-for` with the trusted client address.

Open [http://localhost:3000](http://localhost:3000) in your browser. The demo database is seeded only the first time; later launches preserve any changes made while developing.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


## Application Android

Le client mobile natif Expo se trouve dans `android-app/`. Il reprend le parcours web : pointage, gestion des fiches enfants, familles, événements/tâches, notifications, archives médias et outils d’administration selon le rôle. Les créations/modifications sont mises en file hors ligne et synchronisées automatiquement. Voir [`android-app/README.md`](android-app/README.md) pour la configuration du serveur, le lancement Android et la génération d’une APK/AAB.
