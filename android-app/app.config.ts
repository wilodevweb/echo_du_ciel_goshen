const config = {
  name: 'Echo du Ciel Goshen',
  slug: 'echo-du-ciel-goshen',
  version: '1.0.0',
  orientation: 'portrait',
  icon: '../public/icon-512x512.png',
  splash: { image: '../public/icon-512x512.png', resizeMode: 'contain', backgroundColor: '#ffffff' },
  plugins: ['expo-secure-store'],
  android: {
    package: 'org.echoduciel.goshen',
    adaptiveIcon: { foregroundImage: '../public/icon-512x512-maskable.png', backgroundColor: '#ffffff' },
    permissions: [],
  },
  extra: {
    siteUrl: process.env.EXPO_PUBLIC_SITE_URL ?? '',
    allowInsecureHttp: process.env.EXPO_PUBLIC_ALLOW_INSECURE_HTTP === 'true',
  },
};

export default config;
