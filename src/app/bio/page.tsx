import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { readBioConfig, loadBioListings } from '@/lib/bio-page-data';
import BioPage from '@/components/bio/BioPage';
import { PUBLIC_ORIGIN_FALLBACK } from '@/lib/public-origin';

// Page « lien en bio » : vitrine mobile des listings publiés, comment ça
// marche, contacts. Données lues à chaque requête (réglages admin + listings).
export const dynamic = 'force-dynamic';

// Police propre à la vitrine Oh My Gab (le site Twinsk reste en Geist/Oswald).
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-jakarta', display: 'swap' });

export async function generateMetadata(): Promise<Metadata> {
  const cfg = await readBioConfig();
  const title = `${cfg.title} — Listings, commande et contact`;
  const image = cfg.logo_url || `${PUBLIC_ORIGIN_FALLBACK}/twinsk-logo.jpg`;
  return {
    title,
    description: cfg.tagline,
    robots: { index: true, follow: true },
    openGraph: { title, description: cfg.tagline, url: `${PUBLIC_ORIGIN_FALLBACK}/bio`, type: 'website', images: [{ url: image }] },
    twitter: { card: 'summary', title, description: cfg.tagline, images: [image] },
  };
}

export default async function BioRoute() {
  const cfg = await readBioConfig();
  const listings = await loadBioListings(cfg);
  return (
    <div className={jakarta.variable}>
      <BioPage config={cfg} listings={listings} />
    </div>
  );
}
