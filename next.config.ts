import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // pdf-parse (lecture des devis PDF, projets) charge pdf.js à l'exécution par un
  // import() à chemin calculé : hors bundle, et pdfjs-dist copié d'office dans la
  // sortie standalone (le traçage ne peut pas le voir ; sans lui, « Cannot find
  // module …/pdfjs-dist/legacy/build/pdf.mjs » en production).
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],
  outputFileTracingIncludes: {
    '/api/projects/**': ['./node_modules/pdfjs-dist/package.json', './node_modules/pdfjs-dist/legacy/build/**'],
  },
  // Pays figé au build (code navigateur compris). Exposé par /api/health pour
  // vérifier qu'il correspond au pays lu à l'exécution par le serveur.
  env: { BUILD_COUNTRY: process.env.NEXT_PUBLIC_COUNTRY || 'GA' },
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'img.freepik.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'img.alicdn.com',
      },
      {
        protocol: 'https',
        hostname: 'gw.alicdn.com',
      },
      {
        protocol: 'https',
        hostname: 'cbu01.alicdn.com',
      },
    ],
  },
};

export default nextConfig;
