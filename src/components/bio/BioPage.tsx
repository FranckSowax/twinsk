'use client';

// Vitrine « lien en bio » d'Oh My Gab : trafic WhatsApp et réseaux, donc mobile
// d'abord. En-tête collant, hero avec visuel de marque, filtre segmenté
// Tous / Confort / Pro à indicateur coulissant, grille de vignettes (vidéo 1:1
// du listing en boucle muette, sinon la cover), « Comment ça marche »,
// contacts, bouton WhatsApp flottant. Animations Framer Motion (déjà dans le
// projet) sur transform/opacity uniquement ; `prefers-reduced-motion` respecté.

import './bio.css';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion';
import { Package } from 'lucide-react';
import type { BioConfig, BioFilter } from '@/lib/bio-page';
import { bioSummary, waLink } from '@/lib/bio-page';
import type { BioOfferCard } from '@/lib/bio-page-data';
import { proxyImageUrl } from '@/lib/utils/imageProxy';

const EASE = [0.22, 1, 0.36, 1] as const;

const FILTERS: { key: BioFilter; label: string; emoji: string }[] = [
  { key: 'all', label: 'Tous', emoji: '✨' },
  { key: 'confort', label: 'Confort', emoji: '🏠' },
  { key: 'pro', label: 'Pro', emoji: '💼' },
];
const INDICATOR_BG: Record<BioFilter, string> = {
  all: 'var(--ink)',
  confort: 'linear-gradient(120deg, var(--blue), var(--blue-dark))',
  pro: 'linear-gradient(120deg, #F59E0B, #D97706)',
};
const INDICATOR_SHADOW: Record<BioFilter, string> = {
  all: '0 4px 14px rgba(11,27,43,.25)',
  confort: '0 4px 16px rgba(30,154,240,.4)',
  pro: '0 4px 16px rgba(245,158,11,.4)',
};

function WaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm0 18.13c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.26 8.26 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 4.54 0 8.24 3.7 8.24 8.24 0 4.55-3.7 8.24-8.24 8.24zm4.52-6.16c-.25-.13-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.13-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.13.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.29z" />
    </svg>
  );
}
function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className} aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className} aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

/** « 24107425560 » → « +241 07 42 55 60 ». */
function formatWaNumber(n: string): string {
  const d = n.replace(/\D/g, '');
  if (!d.startsWith('241')) return `+${d}`;
  return `+241 ${d.slice(3).replace(/(\d{2})(?=\d)/g, '$1 ')}`;
}

/** Vignette : vidéo carrée du listing en boucle muette (jouée seulement à l'écran), sinon la cover. */
function CardMedia({ card }: { card: BioOfferCard }) {
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const video = card.mobile_video_url && !videoFailed ? card.mobile_video_url : null;
  const poster = card.cover_image_url ? proxyImageUrl(card.cover_image_url) : undefined;
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    // React ne pose pas `muted` dans le HTML : on force la propriété, sinon
    // iOS/Chrome refusent l'autoplay. Lecture uniquement quand la vignette est
    // visible pour ménager batterie et données (jusqu'à 16 vidéos par page).
    v.muted = true;
    v.defaultMuted = true;
    const io = new IntersectionObserver(
      (entries) => {
        // Plusieurs entrées peuvent arriver d'un coup (hors-écran puis à l'écran) : seule la dernière compte.
        const last = entries[entries.length - 1];
        if (last.isIntersecting) v.play().catch(() => undefined);
        else v.pause();
      },
      { threshold: 0.25 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [video]);
  const media = 'h-full w-full object-cover transition-transform duration-[800ms] ease-(--ease) group-hover:scale-[1.07]';
  if (video) {
    return <video ref={videoRef} src={video} poster={poster} muted autoPlay loop playsInline preload="metadata" onError={() => setVideoFailed(true)} className={media} />;
  }
  if (poster) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={poster} alt="" loading="lazy" className={media} />;
  }
  return <div className="flex h-full w-full items-center justify-center bg-(--blue-soft) text-5xl">{card.tab === 'pro' ? '💼' : '🏠'}</div>;
}

export default function BioPage({ config, listings }: { config: BioConfig; listings: BioOfferCard[] }) {
  const summary = useMemo(() => bioSummary(listings), [listings]);
  const [filter, setFilter] = useState<BioFilter>('all');
  const shown = filter === 'all' ? listings : listings.filter((l) => l.tab === filter);
  const reduced = useReducedMotion();

  // Indicateur coulissant du filtre : mesuré sur le segment actif, remesuré au redimensionnement.
  const segRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = segRefs.current[filter];
      if (el) setIndicator({ x: el.offsetLeft, w: el.offsetWidth });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [filter]);
  const onFilterKey = (e: React.KeyboardEvent) => {
    const i = FILTERS.findIndex((f) => f.key === filter);
    if (e.key === 'ArrowRight') setFilter(FILTERS[(i + 1) % FILTERS.length].key);
    if (e.key === 'ArrowLeft') setFilter(FILTERS[(i + FILTERS.length - 1) % FILTERS.length].key);
  };

  const c = config.contacts;
  const wa = c.whatsapp_number ? waLink(c.whatsapp_number) : null;
  const contacts = [
    c.whatsapp_number && { href: waLink(c.whatsapp_number, 'Bonjour Oh My Gab, je souhaite des informations.'), label: 'WhatsApp', sub: formatWaNumber(c.whatsapp_number), emoji: '💬', bg: 'rgba(37,211,102,.14)' },
    c.whatsapp_group && { href: c.whatsapp_group, label: 'Groupe WhatsApp', sub: 'Le Salon Oh My — échanges', emoji: '👥', bg: 'rgba(37,211,102,.14)' },
    c.whatsapp_channel && { href: c.whatsapp_channel, label: 'Chaîne WhatsApp', sub: 'Nouveautés & promos', emoji: '📢', bg: 'rgba(37,211,102,.14)' },
    c.tiktok && { href: c.tiktok, label: 'TikTok', sub: 'Vidéos produits', emoji: '🎵', bg: 'var(--blue-soft)' },
    c.facebook && { href: c.facebook, label: 'Facebook', sub: 'Page Oh My Gab', emoji: '📘', bg: 'var(--blue-soft)' },
    c.instagram && { href: c.instagram, label: 'Instagram', sub: 'Stories & coulisses', emoji: '📸', bg: 'var(--blue-soft)' },
    c.youtube && { href: c.youtube, label: 'YouTube', sub: 'Guides et présentations', emoji: '▶️', bg: 'rgba(239,68,68,.12)' },
    c.email && { href: `mailto:${c.email}`, label: 'E-mail', sub: c.email, emoji: '✉️', bg: 'var(--blue-soft)' },
  ].filter(Boolean) as { href: string; label: string; sub: string; emoji: string; bg: string }[];

  const rise = (delay: number) => ({
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, ease: EASE, delay },
  });
  const reveal = (i: number) => ({
    initial: { opacity: 0, y: 18 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '0px 0px -30px 0px' },
    transition: { duration: 0.5, ease: EASE, delay: reduced ? 0 : Math.min(i, 6) * 0.08 },
  });
  const card = 'rounded-(--radius) border border-(--line) bg-(--card) shadow-(--shadow-sm)';

  return (
    <MotionConfig reducedMotion="user">
      <div className="bio-root min-h-screen">
        {/* En-tête collant */}
        <header className="sticky top-0 z-50 border-b border-(--line) bg-[rgba(247,246,243,.82)] backdrop-blur-[14px] backdrop-saturate-[160%]">
          <div className="mx-auto flex max-w-[1120px] items-center gap-3.5 px-5 py-3">
            <a href="#top" className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-[42px] w-[42px] flex-shrink-0 place-items-center overflow-hidden rounded-[13px] bg-(--ink) shadow-(--shadow-sm)">
                {config.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={config.logo_url} alt={config.title} className="h-[86%] w-[86%] object-contain" />
                ) : (
                  <span className="text-xl">🛒</span>
                )}
              </span>
              <span className="min-w-0">
                <span className="block whitespace-nowrap text-[17px] font-extrabold leading-[1.1] tracking-[-0.02em]">{config.title}</span>
                <span className="block truncate text-[11.5px] font-medium text-(--ink-60)">{config.tagline}</span>
              </span>
            </a>
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex flex-shrink-0 items-center gap-2 rounded-full bg-(--ink) px-4 py-2.5 text-[13.5px] font-bold text-white shadow-(--shadow-sm) transition-[transform,box-shadow,background-color] duration-250 ease-(--ease) hover:-translate-y-px hover:bg-(--blue) hover:shadow-[0_8px_20px_rgba(30,154,240,.35)] active:scale-[.96]"
              >
                <WaIcon className="h-4 w-4" />
                WhatsApp
              </a>
            )}
          </div>
        </header>

        <main id="top">
          {/* Hero */}
          <section className="mx-auto max-w-[1120px] px-5 pb-2 pt-11 text-center">
            <motion.span {...rise(0)} className={`inline-flex items-center gap-2 rounded-full px-3.5 py-[7px] text-[12.5px] font-semibold text-(--ink-60) ${card}`}>
              <span className="bio-dot h-[7px] w-[7px] rounded-full bg-(--green)" />
              Commandes ouvertes — réponse en &lt; 1 h sur WhatsApp
            </motion.span>
            <motion.h1 {...rise(0.08)} className="mx-auto mt-[18px] max-w-[680px] text-[clamp(30px,6vw,48px)] font-extrabold leading-[1.06] tracking-[-0.035em]">
              Votre projet et vos envies livrés à <span className="bio-grad">Libreville</span> !
            </motion.h1>
            <motion.p {...rise(0.16)} className="mx-auto mt-3.5 max-w-[520px] text-[clamp(14px,2.4vw,16.5px)] font-medium leading-[1.55] text-(--ink-60)">
              Choisissez un catalogue, ajoutez au panier, payez en FCFA par Airtel Money ou cash. On s’occupe du reste — suivi WhatsApp jusqu’à votre porte.
            </motion.p>
            {/* Visuel de marque (public/bio/top-bio-web.jpg, 1600 px, 82 Ko) à la place des indicateurs. */}
            <motion.img
              {...rise(0.24)}
              src="/bio/top-bio-web.jpg"
              alt="L’équipe Oh My Gab tient le logo OhMyGab!"
              width={1600}
              height={686}
              fetchPriority="high"
              className="mx-auto mt-6 w-full max-w-[720px] rounded-(--radius)"
            />
          </section>

          {/* Filtre segmenté, collé sous l'en-tête */}
          <div className="sticky top-(--header-h) z-40 mx-auto mt-[26px] max-w-[1120px] px-5 pb-1.5 max-[480px]:px-3">
            <motion.div
              {...rise(0.3)}
              role="tablist"
              aria-label="Filtrer les catalogues"
              onKeyDown={onFilterKey}
              className={`bio-filter relative mx-auto flex w-max max-w-full items-center gap-1.5 rounded-full p-1.5 ${card}`}
            >
              {indicator && (
                <motion.span
                  aria-hidden
                  initial={false}
                  animate={{ x: indicator.x, width: indicator.w }}
                  transition={{ duration: 0.45, ease: EASE }}
                  className="absolute left-0 top-1.5 z-[1] h-[calc(100%-12px)] rounded-full transition-[background,box-shadow] duration-[450ms] ease-(--ease)"
                  style={{ background: INDICATOR_BG[filter], boxShadow: INDICATOR_SHADOW[filter] }}
                />
              )}
              {FILTERS.map((f) => {
                const active = filter === f.key;
                return (
                  <button
                    key={f.key}
                    ref={(el) => {
                      segRefs.current[f.key] = el;
                    }}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    tabIndex={active ? 0 : -1}
                    onClick={() => setFilter(f.key)}
                    className={`bio-seg relative z-[2] flex items-center gap-[7px] whitespace-nowrap rounded-full px-[18px] py-2.5 text-[13.5px] font-bold transition-colors duration-300 ${
                      active ? 'text-white' : 'text-(--ink-60) hover:text-(--ink)'
                    }`}
                  >
                    <span className="text-[15px] max-[480px]:text-[13px]">{f.emoji}</span>
                    {f.label}
                    <span
                      className={`rounded-full border px-[7px] py-0.5 text-[10.5px] font-extrabold transition-colors duration-300 max-[480px]:px-1.5 max-[480px]:py-px ${
                        active ? 'border-transparent bg-white/20 text-white' : 'border-(--line) bg-(--bg) text-(--ink-40)'
                      }`}
                    >
                      {summary.counts[f.key]}
                    </span>
                  </button>
                );
              })}
            </motion.div>
          </div>

          {/* Grille de vignettes */}
          <section className="mx-auto mt-[18px] grid max-w-[1120px] grid-cols-2 gap-4 px-5 pb-2.5 min-[720px]:grid-cols-3 min-[720px]:gap-5 min-[1024px]:grid-cols-4" aria-live="polite">
            <AnimatePresence mode="popLayout">
              {shown.map((l, i) => {
                const badge = l.badge || (l.is_new ? 'Nouveau' : null);
                return (
                  <motion.a
                    key={l.id}
                    layout
                    href={`/offer/${l.id}?utm_source=bio&utm_medium=link&utm_campaign=${l.tab}`}
                    initial={{ opacity: 0, y: 22, scale: 0.97 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true, margin: '0px 0px -30px 0px' }}
                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.26, ease: EASE } }}
                    whileHover={{ y: -5 }}
                    transition={{ duration: 0.45, ease: EASE, delay: reduced ? 0 : Math.min(i, 6) * 0.07, layout: { duration: 0.4, ease: EASE } }}
                    className={`group relative block overflow-hidden transition-shadow duration-[400ms] ease-(--ease) hover:shadow-(--shadow-md) ${card}`}
                  >
                    {/* Vidéo 1:1 du listing (ou cover) */}
                    <div className="relative aspect-square overflow-hidden bg-[#e9e6e0]">
                      <CardMedia card={l} />
                      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgba(11,27,43,.35))]" />
                      {/* Badges : sur une carte étroite (2 colonnes mobile), « Nouveau » passe à la ligne au lieu de chevaucher. */}
                      <div className="absolute inset-x-2.5 top-2.5 z-[2] flex flex-wrap items-start justify-between gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-[5px] text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-white backdrop-blur-[6px] ${
                            l.tab === 'pro' ? 'bg-[rgba(245,158,11,.94)]' : 'bg-[rgba(30,154,240,.92)]'
                          }`}
                        >
                          {l.tab === 'pro' ? '💼 Pro' : '🏠 Confort'}
                        </span>
                        {badge && (
                          <span className="rounded-full bg-[rgba(11,27,43,.85)] px-2.5 py-[5px] text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-white backdrop-blur-[6px]">
                            {badge}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="px-3.5 pb-3.5 pt-[13px]">
                      <h2 className="line-clamp-2 min-h-[2.56em] text-[14.5px] font-extrabold leading-[1.28] tracking-[-0.015em]">{l.title}</h2>
                      <p className="mt-[7px] flex items-center gap-1.5 text-[11.5px] font-semibold text-(--ink-40)">
                        <Package className="h-[13px] w-[13px] flex-shrink-0" strokeWidth={2} />
                        {l.products > 0 ? `${l.products.toLocaleString('fr-FR')} produits` : 'Sélection'}
                        {l.categories > 0 ? ` · ${l.categories} catégorie${l.categories > 1 ? 's' : ''}` : ''}
                      </p>
                      <span className="mt-[11px] flex w-full items-center justify-center gap-[7px] rounded-[11px] bg-(--blue-soft) px-3 py-2.5 text-[12.5px] font-extrabold text-(--blue-dark) transition-colors duration-300 ease-(--ease) group-hover:bg-(--blue) group-hover:text-white">
                        Voir &amp; commander
                        <ArrowIcon className="h-3.5 w-3.5 transition-transform duration-300 ease-(--ease) group-hover:translate-x-[3px]" />
                      </span>
                    </div>
                  </motion.a>
                );
              })}
            </AnimatePresence>
            {shown.length === 0 && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full px-5 py-12 text-center text-sm font-semibold text-(--ink-40)">
                Aucun catalogue dans cette catégorie pour le moment — revenez vite !
              </motion.p>
            )}
          </section>

          {/* Comment ça marche */}
          <section className="mx-auto mt-14 max-w-[1120px] px-5" id="steps">
            <div className="mb-[18px] flex flex-wrap items-baseline gap-3">
              <span className="rounded-full bg-(--blue-soft) px-[11px] py-[5px] text-[11px] font-extrabold uppercase tracking-[0.1em] text-(--blue)">Simple &amp; rapide</span>
              <h2 className="text-[clamp(20px,3.4vw,26px)] font-extrabold tracking-[-0.025em]">Comment ça marche</h2>
            </div>
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
              {config.steps.map((s, i) => (
                <motion.div
                  key={i}
                  {...reveal(i)}
                  whileHover={{ y: -4 }}
                  className={`relative overflow-hidden px-4 py-[18px] transition-shadow duration-[350ms] ease-(--ease) hover:shadow-(--shadow-md) ${card}`}
                >
                  <span className="bio-step-num pointer-events-none absolute -top-3.5 right-0.5">{i + 1}</span>
                  <span className="mb-[11px] grid h-[38px] w-[38px] place-items-center rounded-xl bg-(--blue-soft) text-lg">{s.emoji}</span>
                  <b className="mb-[5px] block text-sm font-extrabold tracking-[-0.01em]">{s.title}</b>
                  <p className="text-[12.5px] font-medium leading-[1.5] text-(--ink-60)">{s.text}</p>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Contact */}
          <section className="mx-auto mt-14 max-w-[1120px] px-5" id="contact">
            <div className="mb-[18px] flex flex-wrap items-baseline gap-3">
              <span className="rounded-full bg-(--blue-soft) px-[11px] py-[5px] text-[11px] font-extrabold uppercase tracking-[0.1em] text-(--blue)">On est là</span>
              <h2 className="text-[clamp(20px,3.4vw,26px)] font-extrabold tracking-[-0.025em]">Nous contacter</h2>
            </div>
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
              {contacts.map((k, i) => (
                <motion.a
                  key={k.label}
                  {...reveal(i)}
                  whileHover={{ y: -4 }}
                  href={k.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group flex items-center gap-3 px-4 py-[15px] transition-[box-shadow,border-color] duration-[350ms] ease-(--ease) hover:border-[rgba(30,154,240,.35)] hover:shadow-(--shadow-md) ${card}`}
                >
                  <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl text-lg" style={{ background: k.bg }}>
                    {k.emoji}
                  </span>
                  <span className="min-w-0">
                    <b className="block text-[13.5px] font-extrabold tracking-[-0.01em]">{k.label}</b>
                    <span className="mt-0.5 block truncate text-[11.5px] font-semibold leading-[1.35] text-(--ink-40)">{k.sub}</span>
                  </span>
                  <ChevronIcon className="ml-auto h-4 w-4 flex-shrink-0 text-(--ink-40) transition-[transform,color] duration-300 ease-(--ease) group-hover:translate-x-[3px] group-hover:text-(--blue)" />
                </motion.a>
              ))}
            </div>
          </section>
        </main>

        <footer className="mx-auto mt-14 flex max-w-[1120px] flex-wrap justify-center gap-x-[18px] gap-y-2 border-t border-(--line) px-5 pb-[110px] pt-[26px] text-center text-xs font-semibold text-(--ink-40)">
          <span>Prix en FCFA</span>
          <span className="opacity-40">·</span>
          <span>Airtel Money ou cash</span>
          <span className="opacity-40">·</span>
          <span>Livraison à Libreville</span>
          <span className="opacity-40">·</span>
          <span>Propulsé par Twinsk</span>
        </footer>

        {/* Bouton WhatsApp flottant */}
        {wa && (
          <motion.a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Commander sur WhatsApp"
            initial={{ opacity: 0, y: 30, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, ease: EASE, delay: 1 }}
            whileHover={{ y: -3, scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            className="fixed bottom-[18px] right-[18px] z-[60] flex items-center gap-2.5 rounded-full bg-[#25D366] px-5 py-3.5 text-sm font-extrabold text-white shadow-[0_10px_28px_rgba(37,211,102,.45),0_2px_8px_rgba(11,27,43,.15)] transition-shadow duration-300 hover:shadow-[0_16px_36px_rgba(37,211,102,.55)] max-[480px]:p-[15px]"
          >
            <WaIcon className="h-5 w-5" />
            <span className="max-[480px]:hidden">Commander</span>
          </motion.a>
        )}
      </div>
    </MotionConfig>
  );
}
