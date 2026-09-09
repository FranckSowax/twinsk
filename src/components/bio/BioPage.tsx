'use client';

// Vitrine « lien en bio » : mobile d'abord (colonne ≤ 28 rem centrée), onglets
// Confort / Pro, cartes listing → page listing (panier + commande), carrousel
// « Comment ça marche » (défilement horizontal avec accroche), contacts.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Facebook, Instagram, Mail, MessageCircle, Radio, Users, Youtube } from 'lucide-react';
import type { BioConfig, BioTab } from '@/lib/bio-page';
import { waLink } from '@/lib/bio-page';
import type { BioOfferCard } from '@/lib/bio-page-data';
import { proxyImageUrl } from '@/lib/utils/imageProxy';

const TABS: { key: BioTab; label: string; hint: string; emoji: string }[] = [
  { key: 'confort', label: 'Confort', hint: 'Maison & famille', emoji: '🏠' },
  { key: 'pro', label: 'Pro', hint: 'Business clé en main', emoji: '💼' },
];

/** Vignette d'un listing : vidéo carrée en boucle (muette) si disponible, sinon la cover. */
function CardMedia({ card }: { card: BioOfferCard }) {
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const video = card.mobile_video_url && !videoFailed ? card.mobile_video_url : null;
  const poster = card.cover_image_url ? proxyImageUrl(card.cover_image_url) : undefined;
  // React ne pose pas l'attribut `muted` dans le HTML rendu : on force la
  // propriété puis on relance la lecture, sinon iOS/Chrome bloquent l'autoplay.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    v.play().catch(() => undefined);
  }, [video]);
  if (video) {
    return (
      <video
        ref={videoRef}
        src={video}
        poster={poster}
        muted
        autoPlay
        loop
        playsInline
        preload="metadata"
        onError={() => setVideoFailed(true)}
        className="h-full w-full object-cover"
      />
    );
  }
  if (poster) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={poster} alt={card.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />;
  }
  return <div className="flex h-full w-full items-center justify-center text-5xl">{card.tab === 'pro' ? '💼' : '🏠'}</div>;
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.5 3c.4 2.2 1.8 3.7 4 3.9v3.1c-1.5 0-2.9-.5-4-1.3v6.1a5.9 5.9 0 1 1-5.9-5.9c.3 0 .7 0 1 .1v3.2a2.8 2.8 0 1 0 1.9 2.6V3h3z" />
    </svg>
  );
}

export default function BioPage({ config, listings }: { config: BioConfig; listings: BioOfferCard[] }) {
  const counts = useMemo(() => ({ confort: listings.filter((l) => l.tab === 'confort').length, pro: listings.filter((l) => l.tab === 'pro').length }), [listings]);
  const [tab, setTab] = useState<BioTab>(() => (counts.confort === 0 && counts.pro > 0 ? 'pro' : 'confort'));
  const shown = listings.filter((l) => l.tab === tab);

  // Carrousel « Comment ça marche » : position courante pour les points + flèches.
  const railRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const onScroll = () => {
      const w = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth + 12 : el.clientWidth;
      setStep(Math.round(el.scrollLeft / Math.max(1, w)));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);
  const scrollTo = (i: number) => {
    const el = railRef.current;
    if (!el || !el.firstElementChild) return;
    const w = (el.firstElementChild as HTMLElement).offsetWidth + 12;
    el.scrollTo({ left: Math.max(0, Math.min(config.steps.length - 1, i)) * w, behavior: 'smooth' });
  };

  const c = config.contacts;
  const contacts = [
    c.whatsapp_number && { href: waLink(c.whatsapp_number, 'Bonjour Oh My Gab, je souhaite des informations.'), label: 'Écrire sur WhatsApp', sub: `+${c.whatsapp_number}`, icon: <MessageCircle className="h-5 w-5" />, cls: 'bg-[#25D366] text-white' },
    c.whatsapp_group && { href: c.whatsapp_group, label: 'Groupe WhatsApp', sub: 'Le Salon Oh My : questions et échanges', icon: <Users className="h-5 w-5" />, cls: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' },
    c.whatsapp_channel && { href: c.whatsapp_channel, label: 'Chaîne WhatsApp', sub: 'Nouveautés et promos chaque heure', icon: <Radio className="h-5 w-5" />, cls: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' },
    c.tiktok && { href: c.tiktok, label: 'TikTok', sub: 'Vidéos produits', icon: <TikTokIcon className="h-5 w-5" />, cls: 'bg-slate-900 text-white' },
    c.facebook && { href: c.facebook, label: 'Facebook', sub: 'Page Oh My Gab', icon: <Facebook className="h-5 w-5" />, cls: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' },
    c.instagram && { href: c.instagram, label: 'Instagram', sub: 'Stories et coulisses', icon: <Instagram className="h-5 w-5" />, cls: 'bg-pink-50 text-pink-700 ring-1 ring-pink-200' },
    c.youtube && { href: c.youtube, label: 'YouTube', sub: 'Guides et présentations', icon: <Youtube className="h-5 w-5" />, cls: 'bg-red-50 text-red-700 ring-1 ring-red-200' },
    c.email && { href: `mailto:${c.email}`, label: 'E-mail', sub: c.email, icon: <Mail className="h-5 w-5" />, cls: 'bg-slate-100 text-slate-800 ring-1 ring-slate-200' },
  ].filter(Boolean) as { href: string; label: string; sub: string; icon: React.ReactNode; cls: string }[];

  return (
    <div className="min-h-screen bg-[radial-gradient(120%_60%_at_50%_-10%,#dbeafe_0%,#f8fafc_55%)] text-slate-900">
      <main className="mx-auto w-full max-w-md px-4 pb-12 pt-6 sm:max-w-lg">
        {/* En-tête */}
        <header className="text-center">
          {config.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.logo_url} alt={config.title} className="mx-auto h-32 w-32 rounded-[2rem] object-cover shadow-xl shadow-blue-500/15 sm:h-36 sm:w-36" />
          ) : (
            <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-[2rem] bg-gradient-to-br from-sky-400 to-blue-600 text-6xl shadow-xl shadow-blue-500/20 sm:h-36 sm:w-36">🛒</div>
          )}
          <h1 className="mt-4 font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">{config.title}</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-600">{config.tagline}</p>
        </header>

        {/* Onglets */}
        <div className="mt-6 grid grid-cols-2 gap-1 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`rounded-xl px-3 py-2.5 text-left transition ${active ? 'bg-[#0047FF] text-white shadow-md shadow-[#0047FF]/30' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <span className="block text-sm font-bold">{t.emoji} {t.label} <span className={`ml-1 rounded-full px-1.5 text-[10px] font-semibold ${active ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{counts[t.key]}</span></span>
                <span className={`block text-[11px] ${active ? 'text-white/70' : 'text-slate-400'}`}>{t.hint}</span>
              </button>
            );
          })}
        </div>

        {/* Listings */}
        <section className="mt-4 space-y-4" aria-live="polite">
          {shown.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-6 text-center text-sm text-slate-500">Aucun listing dans cet onglet pour le moment.</p>
          )}
          {shown.map((l) => (
            <a
              key={l.id}
              href={`/offer/${l.id}?utm_source=bio&utm_medium=link&utm_campaign=${l.tab}`}
              className="group block overflow-hidden rounded-3xl bg-white shadow-md shadow-slate-900/5 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className={`relative w-full bg-slate-100 ${l.mobile_video_url ? 'aspect-square' : 'aspect-[16/9]'}`}>
                <CardMedia card={l} />
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-slate-900/70 to-transparent" />
                <div className="absolute left-3 top-3 flex gap-2">
                  {l.theme && <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-800 backdrop-blur">{l.theme}</span>}
                  {l.badge && <span className="rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white">{l.badge}</span>}
                </div>
                <h2 className="absolute bottom-3 left-3 right-3 font-display text-xl font-bold uppercase leading-tight text-white drop-shadow sm:text-2xl">{l.title}</h2>
              </div>
              <div className="space-y-2.5 px-4 pb-4 pt-3">
                <span className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-md shadow-emerald-500/30 transition group-hover:bg-emerald-600">
                  Voir & commander <ArrowRight className="h-4 w-4" />
                </span>
                {l.description && (
                  <p className="line-clamp-2 text-sm leading-relaxed text-slate-600">{l.description}</p>
                )}
                <p className="text-xs font-medium text-slate-500">
                  {l.products > 0 ? `${l.products} produits` : 'Sélection'}{l.categories > 0 ? ` · ${l.categories} catégories` : ''}
                </p>
              </div>
            </a>
          ))}
        </section>

        {/* Comment ça marche */}
        <section className="mt-10">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-2xl font-bold uppercase tracking-tight">Comment ça marche</h2>
            <div className="hidden gap-1 sm:flex">
              <button type="button" onClick={() => scrollTo(step - 1)} aria-label="Précédent" className="rounded-full bg-white p-1.5 text-slate-600 shadow ring-1 ring-slate-200"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" onClick={() => scrollTo(step + 1)} aria-label="Suivant" className="rounded-full bg-white p-1.5 text-slate-600 shadow ring-1 ring-slate-200"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
          <div ref={railRef} className="-mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {config.steps.map((s, i) => (
              <article key={i} className="w-[78%] flex-shrink-0 snap-center rounded-3xl bg-white p-5 shadow-md shadow-slate-900/5 ring-1 ring-slate-200 sm:w-[60%]">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-2xl">{s.emoji}</span>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-sky-600">Étape {i + 1}</span>
                </div>
                <h3 className="mt-3 text-base font-bold text-slate-900">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{s.text}</p>
              </article>
            ))}
          </div>
          <div className="mt-2 flex justify-center gap-1.5">
            {config.steps.map((_, i) => (
              <button key={i} type="button" onClick={() => scrollTo(i)} aria-label={`Étape ${i + 1}`} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-slate-900' : 'w-1.5 bg-slate-300'}`} />
            ))}
          </div>
        </section>

        {/* Contact */}
        <section className="mt-10">
          <h2 className="font-display text-2xl font-bold uppercase tracking-tight">Nous contacter</h2>
          <div className="mt-3 space-y-2">
            {contacts.map((k) => (
              <a key={k.label} href={k.href} target="_blank" rel="noreferrer" className={`flex items-center gap-3 rounded-2xl px-4 py-3 shadow-sm transition hover:-translate-y-0.5 ${k.cls}`}>
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/30">{k.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{k.label}</span>
                  <span className="block truncate text-xs opacity-80">{k.sub}</span>
                </span>
                <ArrowRight className="h-4 w-4 flex-shrink-0 opacity-70" />
              </a>
            ))}
          </div>
        </section>

        <footer className="mt-10 text-center text-[11px] text-slate-400">
          Prix en FCFA · Airtel Money ou cash · Livraison à Libreville · Propulsé par Twinsk
        </footer>
      </main>
    </div>
  );
}
