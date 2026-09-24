'use client';

import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import {
  Check,
  Loader2,
  Plus,
  ShoppingBag,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  cartKey,
  clearStoredOrderId,
  isOrderOpen,
  linesToCart,
  readStoredOrderId,
  writeStoredOrderId,
  type CartLine,
} from '@/lib/offer-cart-session';
import SmartImage from '@/components/ui/SmartImage';
import ImageGallery from '@/components/ui/ImageGallery';
import MultiCurrencyPrice from '@/components/ui/MultiCurrencyPrice';
import { roundXafUp, formatXAF, formatCNY, formatUSD, formatEUR, formatInCurrency, convertFromCny, type CurrencyCode } from '@/lib/utils/formatCurrency';
import { shortenTitle, splitCategoryTitle } from '@/lib/utils/shortenTitle';
import { BatteryWarning, Info, LayoutGrid, List as ListIcon, Package, Ruler, Scale, Search, FileText } from 'lucide-react';
import { isAcompte, ACOMPTE_LABEL, ACOMPTE_BADGE } from '@/lib/acompte';
import { LOCAL_CURRENCY, isLocalCurrency } from '@/lib/local-currency';
import LazyVideo from '@/components/ui/LazyVideo';

// Normalisation pour la recherche : minuscules + sans accents (« telephone » trouve « Téléphone »).
function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

interface OfferVariant {
  id: string;
  name: string;
  image_url?: string | null;
  price: number | null;
  moq: number | null;
  weight: number | null;
  volume: number | null;
  dimensions: string | null;
  capacity: string | null;
  price_type?: string | null; // "acompte" (hérité du produit ou propre à la variante)
  price_note?: string | null;
}

interface OfferProduct {
  id: string;
  title: string;
  title_original: string | null;
  description: string | null;
  image_url: string;
  thumbnail_url: string;
  gallery: string[];
  detail_images: string[];
  videos: string[];
  price: number | null; // prix produit exact (null = porté par paliers/variantes)
  from_price: number; // prix d'affichage « à partir de » (0 si « sur devis »)
  on_quote?: boolean; // true → « Sur devis » (prix à 0)
  price_type?: string | null; // "acompte" → montant = acompte usine, pas un prix de vente
  price_note?: string | null; // note affichée sous le prix / en infobulle
  in_cover_video?: boolean; // « Vu dans la vidéo » → badge rose fluo
  price_tiers: { min_qty: number; price: number }[] | null;
  variants_total: number | null;
  moq: number | null;
  weight: number | null;
  volume: number | null;
  dimensions: string | null;
  dimensions_cm: { length?: number | null; width?: number | null; height?: number | null } | null;
  has_battery: boolean;
  info_manquante: string | null;
  seller: string | null;
  variants: OfferVariant[] | null;
}

interface OfferItem {
  id: string;
  image_url: string | null;
  description: string | null;
  phase_id?: string | null;
  products: OfferProduct[];
}

interface Props {
  offerId: string;
  offer: {
    id: string;
    title: string;
    theme: string | null;
    description: string | null;
    cover_image_url: string | null;
    cover_video_url?: string | null; // cover vidéo mp4 (prioritaire)
    mobile_video_url?: string | null; // vidéo carrée 1:1 en tête sur mobile
    note: string | null; // meta.note — chapô/contexte
    currency?: CurrencyCode; // devise affichée (défaut XAF)
    offer_type?: 'b2c' | 'b2b'; // B2B → vue liste par défaut
    best_sellers?: { enabled: boolean; product_ids: string[]; title?: string | null } | null; // galerie en tête
  };
  items: OfferItem[];
  phases?: { id: string; title: string }[]; // phases B2B (regroupent des catégories)
  // Marque blanche : lien affilié (/b/[id]). ref = affiliate_offers.id, transmis
  // à la création de commande pour attribuer la vente ; shopName remplace le
  // branding du header.
  affiliate?: { ref: string; shopName: string };
}

// Description de catégorie repliée à 2 lignes avec « Voir plus » (mobile surtout).
// Le bouton n'apparaît que si le texte déborde réellement du clamp.
function CategoryDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setClamped(el.scrollHeight > el.clientHeight + 1);
    check();
    // Re-mesure au redimensionnement (rotation mobile, resize desktop).
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text]);

  return (
    <div className="max-w-3xl">
      <p ref={ref} className={`mt-1 text-sm text-slate-500 ${expanded ? '' : 'line-clamp-2'}`}>
        {text}
      </p>
      {(clamped || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-0.5 text-xs font-semibold text-emerald-600 hover:underline"
        >
          {expanded ? 'Voir moins' : 'Voir plus'}
        </button>
      )}
    </div>
  );
}

export default function OfferPublicView({ offerId, offer, items, phases, affiliate }: Props) {
  const router = useRouter();
  // Devise affichée au client (défaut FCFA). Les autres devises restent en conversion (≈).
  const currency: CurrencyCode = offer.currency || LOCAL_CURRENCY;
  const fmtPrice = (cny: number) => formatInCurrency(cny, currency);
  // Acompte : montant présenté comme « Acompte usine » (jamais comme prix de vente).
  const isAcompteLine = (p: OfferProduct, variant?: OfferVariant | null) =>
    isAcompte(p.price_type) || isAcompte(variant?.price_type);
  const cardPriceLabel = (p: { price: number | null; from_price: number; on_quote?: boolean; price_type?: string | null }) => {
    if (isAcompte(p.price_type)) {
      const amt = p.price != null ? p.price : p.from_price;
      return amt > 0 ? `${ACOMPTE_LABEL} · ${fmtPrice(amt)}` : 'Sur devis';
    }
    return p.on_quote || p.from_price <= 0
      ? 'Sur devis'
      : `À partir de ${fmtPrice(p.price != null ? p.price : p.from_price)}`;
  };
  // Formate une valeur DÉJÀ dans la devise choisie (pour les totaux sommés).
  const fmtPrimaryValue = (v: number) =>
    currency === 'CNY' ? formatCNY(v) : currency === 'USD' ? formatUSD(v) : currency === 'EUR' ? formatEUR(v) : formatXAF(v);
  // Le panier est la commande ouverte (voir offer-cart-session) : `cart` en est
  // le miroir local, pour les pastilles des cartes et le compteur de la barre.
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [orderId, setOrderId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  // Animation d'ajout : pastille qui vole du bouton vers l'icône panier, puis rebond de l'icône.
  const [cartFly, setCartFly] = useState<{ from: { x: number; y: number }; to: { x: number; y: number }; image: string | null } | null>(null);
  const cartIconRef = useRef<HTMLButtonElement>(null);
  const cartBump = useAnimationControls();
  // Ombre de la barre supérieure une fois la page défilée.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const [activeProduct, setActiveProduct] = useState<OfferProduct | null>(null);
  const [selectedVariantForActive, setSelectedVariantForActive] = useState<
    string | null
  >(null);
  // B2B : vue « liste » par défaut ; B2C : vue « grille ».
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(offer.offer_type === 'b2b' ? 'list' : 'grid');
  // Sur smartphone, on force la vue « grille » (galerie horizontale par catégorie).
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches) {
      setViewMode('grid');
    }
  }, []);
  // Lightbox variante : image en grand + nom + détails + description produit.
  const [variantLightbox, setVariantLightbox] = useState<{
    image: string;
    name: string;
    description: string | null;
    price: number | null;
    moq: number | null;
    capacity: string | null;
    weight: number | null;
    volume: number | null;
    dimensions: string | null;
  } | null>(null);
  // Recherche dynamique : filtre les produits (titre, description, catégorie)
  // à la frappe, côté client — les catégories vides sont masquées.
  const [searchQuery, setSearchQuery] = useState('');
  const totalProducts = useMemo(
    () => items.reduce((s, it) => s + it.products.length, 0),
    [items],
  );
  // Best sellers : produits choisis par l'admin (ordre conservé), affichés en
  // tête quand la galerie est activée et qu'aucune recherche n'est en cours.
  const bestSellers = useMemo(() => {
    const bs = offer.best_sellers;
    if (!bs?.enabled || !bs.product_ids?.length) return [] as OfferProduct[];
    const byId = new Map<string, OfferProduct>();
    for (const it of items) for (const p of it.products) byId.set(p.id, p);
    return bs.product_ids.map((id) => byId.get(id)).filter((p): p is OfferProduct => !!p);
  }, [offer.best_sellers, items]);

  // Sommaire B2B : phases présentes dans le listing, avec leurs catégories
  // (titres courts) — alimente la barre de phases collante et les puces d'ancrage.
  const phaseNav = useMemo(() => {
    if (!phases?.length) return [] as { id: string; title: string; categories: { id: string; title: string; count: number }[] }[];
    return phases
      .map((ph) => ({
        id: ph.id,
        title: ph.title,
        categories: items
          .filter((it) => it.phase_id === ph.id)
          .map((it) => ({ id: it.id, title: splitCategoryTitle(it.description).short || 'Produits', count: it.products.length })),
      }))
      .filter((ph) => ph.categories.length > 0);
  }, [phases, items]);
  const [activePhase, setActivePhase] = useState<string | null>(null);
  useEffect(() => {
    if (!phaseNav.length || typeof IntersectionObserver === 'undefined') return;
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-phase-anchor]'));
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActivePhase(visible[0].target.getAttribute('data-phase-anchor'));
      },
      { rootMargin: '-35% 0px -55% 0px', threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [phaseNav, searchQuery]);
  // La pastille de la phase active reste visible dans la barre (16 phases sur
  // un listing pizzeria : sans ça, la phase courante sort de l'écran).
  const phaseBarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bar = phaseBarRef.current;
    if (!bar || !activePhase) return;
    const btn = bar.querySelector<HTMLElement>(`[data-phase-btn="${activePhase}"]`);
    if (!btn) return;
    const left = btn.offsetLeft - bar.clientWidth / 2 + btn.offsetWidth / 2;
    bar.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [activePhase]);
  const jumpTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const filteredItems = useMemo(() => {
    const q = normalizeSearch(searchQuery.trim());
    if (!q) return items;
    const terms = q.split(/\s+/).filter(Boolean);
    return items
      .map((item) => {
        const catText = normalizeSearch(item.description || '');
        // La catégorie matche → on garde tous ses produits.
        if (terms.every((t) => catText.includes(t))) return item;
        const products = item.products.filter((p) => {
          const hay = normalizeSearch(
            `${p.title} ${p.title_original || ''} ${p.description || ''}`,
          );
          return terms.every((t) => hay.includes(t));
        });
        return { ...item, products };
      })
      .filter((item) => item.products.length > 0);
  }, [items, searchQuery]);
  const filteredCount = useMemo(
    () => filteredItems.reduce((s, it) => s + it.products.length, 0),
    [filteredItems],
  );

  const cartLines = Object.values(cart).filter((l) => l.quantity > 0);
  const allProducts: OfferProduct[] = useMemo(
    () => items.flatMap((i) => i.products),
    [items],
  );

  const total = useMemo(() => {
    let cny = 0;
    let count = 0;
    let primary = 0; // somme des sous-totaux de ligne arrondis (devise) → total == somme des lignes
    let acompteCount = 0; // articles « acompte / sur devis » présents dans le panier
    for (const line of cartLines) {
      const p = allProducts.find((pp) => pp.id === line.productId);
      if (!p) continue;
      const variant = line.variantId
        ? p.variants?.find((v) => v.id === line.variantId)
        : null;
      count += line.quantity;
      // Ligne « acompte » (devis) : jamais de calcul prix × quantité ni de total.
      if (isAcompteLine(p, variant)) {
        acompteCount += line.quantity;
        continue;
      }
      // Prix unitaire : variante chiffrée, sinon prix produit, sinon « à partir de »
      const unit = variant && variant.price != null ? variant.price : p.price ?? p.from_price;
      const lineCny = unit * line.quantity;
      cny += lineCny;
      const v = convertFromCny(lineCny, currency);
      primary += isLocalCurrency(currency) ? roundXafUp(v) : Math.round(v * 100) / 100;
    }
    // allAcompte : le panier ne contient que des demandes de devis (aucun prix).
    return { cny, count, primary, acompteCount, allAcompte: count > 0 && acompteCount === count };
  }, [cartLines, allProducts, currency]);

  const inCart = (productId: string, variantId: string | null) => {
    return !!cart[cartKey(productId, variantId)];
  };

  // Au retour sur le listing : la commande mémorisée redevient le panier si
  // elle est encore ouverte (ni payée, ni en vérification) ; sinon on l'oublie.
  useEffect(() => {
    const stored = readStoredOrderId(offerId);
    if (!stored) return;
    let cancelled = false;
    fetch(`/api/offer-public/${offerId}/order/${stored}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.order && isOrderOpen(data.order)) {
          setOrderId(stored);
          setCart(linesToCart(data.lines || []));
        } else {
          clearStoredOrderId(offerId);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [offerId]);

  const orderPageUrl = (id: string) => `/offer/${offerId}/order/${id}`;
  const goToCart = () => {
    if (orderId) router.push(orderPageUrl(orderId));
    else setToast({ kind: 'ok', text: 'Votre panier est vide : ajoutez un produit.' });
  };
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  // Lien profond : ?p=<id produit> ouvre directement la fiche (modale, variantes,
  // panier). On tient l'URL à jour à l'ouverture/fermeture pour qu'un partage
  // depuis le navigateur pointe aussi sur le produit — sans navigation Next.
  const setProductInUrl = (productId: string | null) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (productId) url.searchParams.set('p', productId);
    else url.searchParams.delete('p');
    window.history.replaceState(window.history.state, '', url.toString());
  };

  const openProduct = (p: OfferProduct) => {
    setActiveProduct(p);
    // Default-select the first variant if any in cart, else null
    const existing = Object.values(cart).find((l) => l.productId === p.id);
    setSelectedVariantForActive(existing?.variantId ?? null);
    setProductInUrl(p.id);
  };

  const closeProduct = () => {
    setActiveProduct(null);
    setProductInUrl(null);
  };

  // À l'arrivée avec ?p=…, on ouvre la fiche une seule fois (pas de réouverture
  // après fermeture, même si l'URL est relue).
  const searchParams = useSearchParams();
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (deepLinkHandled.current) return;
    const wanted = searchParams.get('p');
    if (!wanted) return;
    deepLinkHandled.current = true;
    const found = items.flatMap((it) => it.products).find((pr) => pr.id === wanted);
    if (found) openProduct(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, items]);

  // Ajout au panier = la commande est créée (ou complétée) tout de suite, et le
  // client arrive sur l'écran produit + transport. Pas d'étape intermédiaire.
  const addToCart = async (p: OfferProduct, fromEl?: HTMLElement | null) => {
    if (adding) return;
    const variantId = selectedVariantForActive;
    if (p.variants && p.variants.length > 0 && !variantId) return;
    const pick = { product_id: p.id, variant_id: variantId, quantity: 1 };

    // Animation : la vignette vole du bouton vers l'icône panier, qui rebondit à l'arrivée.
    const from = fromEl?.getBoundingClientRect();
    const to = cartIconRef.current?.getBoundingClientRect();
    if (from && to) {
      setCartFly({
        from: { x: from.left + from.width / 2, y: from.top + from.height / 2 },
        to: { x: to.left + to.width / 2, y: to.top + to.height / 2 },
        image: variantOfActive(p, variantId)?.image_url || p.thumbnail_url || p.image_url || null,
      });
      setTimeout(() => {
        cartBump.start({ scale: [1, 1.35, 0.9, 1.12, 1], rotate: [0, -14, 10, -5, 0], transition: { duration: 0.55 } });
        setCartFly(null);
      }, 520);
    }
    // Miroir local immédiat (compteur, pastilles).
    setCart((prev) => {
      const key = cartKey(p.id, variantId);
      return { ...prev, [key]: { productId: p.id, variantId, quantity: (prev[key]?.quantity || 0) + 1 } };
    });
    closeProduct();
    setAdding(true);

    try {
      let id = orderId;
      // Commande ouverte → on y ajoute la ligne (même produit + variante : quantité cumulée).
      if (id) {
        const r = await fetch(`/api/offer-public/${offerId}/order/${id}/lines`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pick),
        });
        if (!r.ok) {
          // Commande payée entre-temps, ou disparue : on repart sur une nouvelle.
          if (r.status === 409 || r.status === 404) {
            clearStoredOrderId(offerId);
            setOrderId(null);
            id = null;
          } else {
            const d = await r.json().catch(() => ({}));
            throw new Error(d?.error || 'Ajout impossible');
          }
        }
      }
      if (!id) {
        const r = await fetch(`/api/offer-public/${offerId}/order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ affiliate_ref: affiliate?.ref, picks: [pick] }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d?.order_id) throw new Error(d?.error || 'Enregistrement impossible');
        id = d.order_id as string;
        writeStoredOrderId(offerId, id);
        setOrderId(id);
      }
      router.push(orderPageUrl(id));
    } catch (e) {
      setAdding(false);
      setToast({ kind: 'error', text: e instanceof Error ? e.message : 'Erreur réseau, réessayez.' });
    }
  };

  const variantOfActive = (p: OfferProduct | null, variantId: string | null) => {
    if (!p?.variants || !variantId) return null;
    return p.variants.find((v) => v.id === variantId) || null;
  };

  const cartCount = total.count;

  return (
    <>
      {/* Barre supérieure : une seule, collée en haut, pleine largeur — marque,
          recherche et panier, puis les phases B2B en seconde ligne. Les cartes
          flottantes séparées (recherche, phases) donnaient un rendu décousu au défilement. */}
      <header
        className={`sticky top-0 z-40 border-b bg-white/95 backdrop-blur-md transition-shadow ${
          scrolled ? 'border-slate-200 shadow-md shadow-slate-900/5' : 'border-transparent'
        }`}
      >
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex h-14 items-center gap-2 sm:gap-3">
            {/* Marque */}
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex min-w-0 flex-shrink items-center gap-2"
              title="Haut de page"
            >
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-green-500 text-white">
                <Sparkles className="h-4 w-4" />
              </span>
              <span className={`truncate text-sm font-bold text-slate-900 ${totalProducts >= 5 ? 'hidden md:inline' : ''}`}>
                {affiliate?.shopName || offer.theme || offer.title}
              </span>
            </button>

            {/* Recherche (dès 5 produits) */}
            {totalProducts >= 5 && (
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un produit…"
                  aria-label="Rechercher un produit"
                  className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-9 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200 [&::-webkit-search-cancel-button]:hidden"
                />
                {searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Effacer la recherche"
                    className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
            {totalProducts < 5 && <div className="flex-1" />}

            {/* Bascule liste / grille (desktop) */}
            <div className="hidden flex-shrink-0 items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5 sm:flex">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                title="Vue liste"
                className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
                  viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <ListIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                title="Vue grille"
                className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
                  viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>

            {/* Panier : icône fixe, compteur, rebond à l'ajout */}
            <motion.button
              ref={cartIconRef}
              type="button"
              onClick={goToCart}
              animate={cartBump}
              whileTap={{ scale: 0.92 }}
              aria-label={cartCount > 0 ? `Panier : ${cartCount} article${cartCount > 1 ? 's' : ''}` : 'Panier vide'}
              className={`relative flex h-10 flex-shrink-0 items-center gap-2 rounded-full pl-3 pr-3 text-sm font-semibold transition-colors ${
                cartCount > 0
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {adding ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShoppingBag className="h-5 w-5" />}
              {cartCount > 0 && !total.allAcompte && (
                <span className="hidden tabular-nums sm:inline">{fmtPrimaryValue(total.primary)}</span>
              )}
              <AnimatePresence>
                {cartCount > 0 && (
                  <motion.span
                    key={cartCount}
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.4, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                    className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[11px] font-bold text-white ring-2 ring-white"
                  >
                    {cartCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>

          {/* Phases B2B : puces défilantes, phase courante en sombre */}
          {phaseNav.length > 0 && !searchQuery.trim() && (
            <nav aria-label="Phases du listing" className="-mx-4 sm:-mx-6">
              <div
                ref={phaseBarRef}
                className="flex snap-x gap-2 overflow-x-auto px-4 pb-2.5 pt-0.5 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden"
              >
                {phaseNav.map((ph, i) => {
                  const active = activePhase === ph.id;
                  return (
                    <button
                      key={ph.id}
                      type="button"
                      data-phase-btn={ph.id}
                      onClick={() => jumpTo(`phase-${ph.id}`)}
                      className={`flex flex-shrink-0 snap-start items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${
                        active ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <span className={`flex h-4.5 w-4.5 items-center justify-center rounded-full text-[10px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-slate-900 text-white'}`}>{i + 1}</span>
                      <span className="max-w-[12rem] truncate">{ph.title}</span>
                    </button>
                  );
                })}
              </div>
            </nav>
          )}
          {searchQuery.trim() && (
            <p className="pb-2 text-xs font-medium text-slate-500">
              {filteredCount} produit{filteredCount > 1 ? 's' : ''} trouvé{filteredCount > 1 ? 's' : ''}
            </p>
          )}
        </div>
      </header>

    <div className="mx-auto max-w-5xl px-4 pt-5 pb-16 sm:px-6 sm:pt-8">
      {/* Vidéo carrée 1:1 en tête — MOBILE uniquement (autoplay + boucle) */}
      {offer.mobile_video_url && (
        <div className="mb-6 overflow-hidden rounded-3xl bg-black sm:hidden">
          <LazyVideo
            src={offer.mobile_video_url}
            className="aspect-square w-full object-cover"
            poster={offer.cover_image_url || undefined}
          />
        </div>
      )}

      {/* En-tête : badge thème, H1 = titre du listing, sous-titre = thème (inversé le 5 sept.) */}
      <div className="mb-4">
        {offer.theme && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
            <Tag className="h-3 w-3" />
            {offer.theme}
          </span>
        )}
        <h1 className="mt-3 font-display text-3xl font-bold uppercase tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
          {offer.title}
        </h1>
        {offer.theme && (
          <p className="mt-1 text-base font-medium text-slate-600 dark:text-slate-300 sm:text-lg">
            {offer.theme}
          </p>
        )}
        {offer.description && (
          <p className="mt-3 max-w-2xl text-sm text-slate-500 dark:text-slate-400 sm:text-base">
            {offer.description}
          </p>
        )}
      </div>

      {/* Cover : vidéo (mp4) prioritaire, sinon image, sinon dégradé.
          Masquée sur mobile si une vidéo 1:1 est présente (elle la remplace). */}
      <div className={`relative mb-8 overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 ${offer.mobile_video_url ? 'hidden sm:block' : ''}`}>
        {offer.cover_video_url ? (
          <LazyVideo
            src={offer.cover_video_url}
            className="h-64 w-full bg-black object-cover sm:h-80"
            controls
            poster={offer.cover_image_url || undefined}
          />
        ) : offer.cover_image_url ? (
          <SmartImage
            src={offer.cover_image_url}
            alt={offer.theme || offer.title}
            className="h-64 w-full object-cover sm:h-80"
          />
        ) : (
          <div className="relative h-56 w-full bg-gradient-to-br from-emerald-600 via-emerald-500 to-green-500 sm:h-72">
            <div
              aria-hidden
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 30% 30%, white 1px, transparent 0), radial-gradient(circle at 70% 60%, white 1px, transparent 0)',
                backgroundSize: '40px 40px, 60px 60px',
              }}
            />
          </div>
        )}
      </div>

      {/* Best sellers : galerie horizontale en tête, cartes à cadre rouge animé */}
      {bestSellers.length > 0 && !searchQuery.trim() && (
        <section className="mb-10">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-red-600/30">
              🔥 Best sellers
            </span>
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-slate-900 sm:text-2xl">
              {offer.best_sellers?.title || 'Nos meilleures ventes'}
            </h2>
          </div>
          <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
            {bestSellers.map((p, i) => {
              const lineCount = Object.values(cart).filter((l) => l.productId === p.id).length;
              return (
                <motion.button
                  type="button"
                  key={p.id}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => openProduct(p)}
                  className="best-seller-card group relative flex w-[68%] flex-shrink-0 snap-start flex-col overflow-hidden text-left sm:w-56 lg:w-60"
                >
                  <div className="relative aspect-square w-full overflow-hidden rounded-t-[0.8rem] bg-slate-100">
                    <SmartImage
                      src={p.image_url}
                      fallbackSrc={p.thumbnail_url}
                      alt={p.title}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                    <span className="absolute left-2 top-2 inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-red-600 px-2 text-xs font-black text-white shadow-lg">
                      #{i + 1}
                    </span>
                    {lineCount > 0 && (
                      <span className="absolute right-2 top-2 inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-emerald-500 px-2 text-xs font-bold text-white shadow-lg">
                        {lineCount}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-3">
                    <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold text-slate-900" title={p.title}>
                      {shortenTitle(p.title, 5)}
                    </p>
                    <div className="mt-2 flex items-baseline justify-between">
                      <p className={`text-base font-bold ${isAcompte(p.price_type) ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {cardPriceLabel(p)}
                      </p>
                      {p.moq != null && <p className="text-[10px] text-slate-500">MOQ {p.moq}</p>}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>
      )}

      {/* Aucun résultat de recherche */}
      {searchQuery.trim() && filteredCount === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white py-14 text-center">
          <Search className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-700">
            Aucun produit ne correspond à « {searchQuery.trim()} »
          </p>
          <p className="mt-1 text-sm text-slate-400">Essayez un autre mot-clé, ou parcourez tout le catalogue.</p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="mt-4 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600"
          >
            Voir tous les produits
          </button>
        </div>
      )}

      {/* Categories (regroupées par phase pour les offres B2B) */}
      <div className="space-y-10">
        {(() => {
          const hasPhases = !!phases && phases.length > 0;
          const rank = new Map((phases || []).map((p, i) => [p.id, i]));
          const ordered = hasPhases
            ? [...filteredItems].sort((a, b) => (rank.get(a.phase_id ?? '') ?? 9999) - (rank.get(b.phase_id ?? '') ?? 9999))
            : filteredItems;
          return ordered.map((item, idx) => {
            const showPhase =
              hasPhases && (idx === 0 || ordered[idx - 1].phase_id !== item.phase_id);
            const phaseTitle = item.phase_id
              ? phases?.find((p) => p.id === item.phase_id)?.title
              : null;
            const { short: catShort, rest: catRest } = splitCategoryTitle(item.description);
            return (
          <div key={item.id} className="space-y-4">
            {showPhase && phaseTitle && (
              <div id={`phase-${item.phase_id}`} data-phase-anchor={item.phase_id ?? ''} className="scroll-mt-36 rounded-2xl bg-slate-900 px-5 py-4 text-white">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-white/60">
                  Phase {(phaseNav.findIndex((ph) => ph.id === item.phase_id) + 1) || ''}
                </p>
                <p className="font-display text-xl font-bold uppercase tracking-wide">{phaseTitle}</p>
                {(() => {
                  const cats = phaseNav.find((ph) => ph.id === item.phase_id)?.categories || [];
                  return cats.length > 1 ? (
                    <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {cats.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => jumpTo(`cat-${c.id}`)}
                          className="flex-shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/20 hover:bg-white/20"
                        >
                          {c.title.slice(0, 40)} <span className="text-white/50">· {c.count}</span>
                        </button>
                      ))}
                    </div>
                  ) : null;
                })()}
              </div>
            )}
          <section id={`cat-${item.id}`} className="scroll-mt-36">
            <div className="mb-4">
              <h2 className="font-display text-xl font-bold text-slate-900">
                {catShort || 'Produits'}
              </h2>
              {catRest && <CategoryDescription text={catRest} />}
              <p className="mt-1 text-xs text-slate-400">
                {item.products.length} produit(s) disponible(s)
              </p>
            </div>
            {viewMode === 'grid' ? (
              // Mobile : galerie qui défile horizontalement (snap) · Desktop : grille.
              <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
                {item.products.map((p) => {
                  const lineCount = Object.values(cart).filter((l) => l.productId === p.id).length;
                  const hasVariants = !!p.variants && p.variants.length > 0;
                  return (
                    <motion.button
                      type="button"
                      key={p.id}
                      layout
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => openProduct(p)}
                      className={`group relative flex w-[68%] flex-shrink-0 snap-start flex-col overflow-hidden rounded-2xl border-2 bg-white text-left transition-all hover:border-emerald-400 sm:w-auto sm:flex-shrink ${
                        lineCount > 0 ? 'border-emerald-500 shadow-lg shadow-emerald-500/10' : 'border-slate-200'
                      }`}
                    >
                      <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
                        <SmartImage
                          src={p.image_url}
                          fallbackSrc={p.thumbnail_url}
                          alt={p.title}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                        {p.has_battery && (
                          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg">
                            <BatteryWarning className="h-2.5 w-2.5" />
                            Batterie
                          </span>
                        )}
                        {lineCount > 0 && (
                          <span className="absolute right-2 top-2 inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-emerald-500 px-2 text-xs font-bold text-white shadow-lg">
                            {lineCount}
                          </span>
                        )}
                        {p.in_cover_video && (
                          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-[#ff1493] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-lg shadow-[#ff1493]/50">
                            ▶ Vu dans la vidéo
                          </span>
                        )}
                        {isAcompte(p.price_type) && (
                          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-lg shadow-amber-500/40">
                            {ACOMPTE_BADGE}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col p-3">
                        <p
                          className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold text-slate-900"
                          title={p.title}
                        >
                          {shortenTitle(p.title, 5)}
                        </p>
                        {hasVariants && (
                          <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            {p.variants!.length} variantes
                          </span>
                        )}
                        <div className="mt-2 flex items-baseline justify-between">
                          <p className={`text-base font-bold ${isAcompte(p.price_type) ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {cardPriceLabel(p)}
                          </p>
                          {p.moq != null && (
                            <p className="text-[10px] text-slate-500">MOQ {p.moq}</p>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <ul className="divide-y divide-slate-100">
                  {item.products.map((p) => {
                    const lineCount = Object.values(cart).filter((l) => l.productId === p.id).length;
                    const hasVariants = !!p.variants && p.variants.length > 0;
                    return (
                      <li key={p.id}>
                        <motion.button
                          type="button"
                          layout
                          whileTap={{ scale: 0.995 }}
                          onClick={() => openProduct(p)}
                          className={`flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-emerald-50 ${
                            lineCount > 0 ? 'bg-emerald-50/40' : 'bg-white'
                          }`}
                        >
                          <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100">
                            <SmartImage
                              src={p.image_url}
                              fallbackSrc={p.thumbnail_url}
                              alt={p.title}
                              className="h-full w-full object-cover"
                            />
                            {lineCount > 0 && (
                              <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white shadow">
                                {lineCount}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p
                                className="line-clamp-1 text-sm font-semibold text-slate-900"
                                title={p.title}
                              >
                                {shortenTitle(p.title)}
                              </p>
                              {p.has_battery && (
                                <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-orange-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-orange-700">
                                  <BatteryWarning className="h-2.5 w-2.5" />
                                  Batterie
                                </span>
                              )}
                              {p.in_cover_video && (
                                <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-[#ff1493] px-1.5 py-0.5 text-[9px] font-black uppercase text-white shadow-sm shadow-[#ff1493]/50">
                                  ▶ Vu dans la vidéo
                                </span>
                              )}
                              {isAcompte(p.price_type) && (
                                <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-black uppercase text-white shadow-sm">
                                  {ACOMPTE_BADGE}
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                              {hasVariants && (
                                <span className="font-semibold text-slate-700">{p.variants!.length} variantes</span>
                              )}
                              {p.moq != null && <span>MOQ {p.moq}</span>}
                              {p.weight != null && <span>{p.weight} kg</span>}
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <p className={`text-sm font-bold ${isAcompte(p.price_type) ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {cardPriceLabel(p)}
                            </p>
                            <p className="mt-0.5 text-[10px] text-emerald-600/70">
                              Voir détails →
                            </p>
                          </div>
                        </motion.button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
          </div>
            );
          });
        })()}
      </div>

      {/* Product modal */}
      <AnimatePresence>
        {activeProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeProduct}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/70 p-0 backdrop-blur-sm sm:p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="min-h-full w-full overflow-clip rounded-none bg-white shadow-2xl sm:my-8 sm:min-h-0 sm:max-w-xl sm:rounded-3xl"
            >
              <div className="relative">
                {(() => {
                  const baseGallery = activeProduct.gallery.length
                    ? activeProduct.gallery
                    : [activeProduct.image_url];
                  const variantImg = variantOfActive(activeProduct, selectedVariantForActive)?.image_url || null;
                  const images = variantImg
                    ? [variantImg, ...baseGallery.filter((u) => u !== variantImg)]
                    : baseGallery;
                  return (
                    <ImageGallery
                      key={variantImg || 'base'}
                      images={images}
                      videos={activeProduct.videos}
                      alt={activeProduct.title}
                    />
                  );
                })()}
                <button
                  type="button"
                  onClick={closeProduct}
                  className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-lg backdrop-blur"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-5 p-5">
                <div>
                  {activeProduct.in_cover_video && (
                    <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-[#ff1493] px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-white shadow-lg shadow-[#ff1493]/50">
                      ▶ Vu dans la vidéo
                    </span>
                  )}
                  <h2 className="font-display text-lg font-bold text-slate-900 sm:text-xl">
                    {activeProduct.title}
                  </h2>
                  {activeProduct.title_original && (
                    <p className="mt-1 text-xs italic text-slate-400">{activeProduct.title_original}</p>
                  )}
                </div>

                {(() => {
                  const sel = variantOfActive(activeProduct, selectedVariantForActive);
                  const variantPrice = sel?.price;
                  // Prix exact (produit ou variante sélectionnée), sinon « à partir de »
                  const exact = variantPrice ?? activeProduct.price;
                  const acompte = isAcompteLine(activeProduct, sel);
                  const note = sel?.price_note || activeProduct.price_note || null;
                  // Acompte : montant présenté comme « Acompte usine », jamais comme prix de vente.
                  if (acompte) {
                    const amt = exact ?? activeProduct.from_price;
                    return (
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-white">
                            {ACOMPTE_BADGE}
                          </span>
                          <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">{ACOMPTE_LABEL}</span>
                        </div>
                        {amt != null && amt > 0 ? (
                          <MultiCurrencyPrice amountCny={amt} variant="large" primary={currency} only />
                        ) : (
                          <span className="font-display text-2xl font-bold text-amber-600">Sur devis</span>
                        )}
                        <p className="text-xs text-slate-500">
                          Montant d’acompte usine — pas le prix de vente final.
                          {note ? ` ${note}` : ''}
                        </p>
                      </div>
                    );
                  }
                  // « Sur devis » : produit à 0 sans variante chiffrée sélectionnée.
                  if ((activeProduct.on_quote || activeProduct.from_price <= 0) && exact == null) {
                    return <span className="font-display text-2xl font-bold text-emerald-600">Sur devis</span>;
                  }
                  if (exact != null) {
                    return <MultiCurrencyPrice amountCny={exact} variant="large" primary={currency} only />;
                  }
                  return (
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                        À partir de
                      </span>
                      <MultiCurrencyPrice amountCny={activeProduct.from_price} variant="large" primary={currency} only />
                    </div>
                  );
                })()}

                {/* Variants */}
                {activeProduct.variants && activeProduct.variants.length > 0 && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
                      Choisissez une variante
                    </p>
                    {activeProduct.variants_total != null &&
                      activeProduct.variants_total > activeProduct.variants.length && (
                        <p className="mb-3 text-xs text-slate-500">
                          {activeProduct.variants_total} variantes disponibles — échantillon représentatif affiché
                        </p>
                      )}
                    <div className="space-y-2">
                      {activeProduct.variants.map((v) => {
                        const active = v.id === selectedVariantForActive;
                        return (
                          <button
                            key={v.id || v.name}
                            type="button"
                            onClick={() =>
                              setSelectedVariantForActive(active ? null : v.id)
                            }
                            className={`block w-full rounded-xl border-2 p-3 text-left text-sm transition-all ${
                              active
                                ? 'border-emerald-500 bg-emerald-100 ring-2 ring-emerald-200'
                                : 'border-emerald-200/60 bg-white hover:border-emerald-400 hover:bg-emerald-50'
                            }`}
                          >
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 font-semibold text-slate-900">
                                {v.image_url ? (
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setVariantLightbox({
                                        image: v.image_url as string,
                                        name: v.name,
                                        description: activeProduct.description,
                                        price: v.price ?? null,
                                        moq: v.moq ?? null,
                                        capacity: v.capacity ?? null,
                                        weight: v.weight ?? null,
                                        volume: v.volume ?? null,
                                        dimensions: v.dimensions ?? null,
                                      });
                                    }}
                                    className="group relative h-10 w-10 flex-shrink-0 cursor-zoom-in overflow-hidden rounded-md ring-1 ring-emerald-200"
                                    title="Voir l'image"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={v.image_url} alt={v.name} className="h-full w-full object-cover" />
                                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/25">
                                      <Search className="h-3.5 w-3.5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                                    </span>
                                  </span>
                                ) : null}
                                {active && <Check className="h-4 w-4 text-emerald-600" />}
                                <span>{v.name}</span>
                              </div>
                              {v.price != null && (
                                <div className="flex flex-col items-end gap-0.5">
                                  {isAcompteLine(activeProduct, v) && (
                                    <span className="inline-flex items-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
                                      {ACOMPTE_BADGE}
                                    </span>
                                  )}
                                  <MultiCurrencyPrice amountCny={v.price} variant="stacked" primary={currency} only />
                                </div>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                              {v.moq != null && <span>MOQ : {v.moq}</span>}
                              {v.capacity && <span>Capacité : {v.capacity}</span>}
                              {v.weight != null && <span>Poids : {v.weight} kg</span>}
                              {v.volume != null && <span>Vol : {v.volume} m³</span>}
                              {v.dimensions && <span>Dim : {v.dimensions}</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Paliers de prix par quantité (v3.1) — sans objet pour un acompte */}
                {!isAcompte(activeProduct.price_type) && activeProduct.price_tiers && activeProduct.price_tiers.length > 0 && (
                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <p className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Prix par quantité
                    </p>
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-100">
                        {activeProduct.price_tiers.map((t) => (
                          <tr key={t.min_qty}>
                            <td className="px-4 py-2 text-slate-600">≥ {t.min_qty} pcs</td>
                            <td className="px-4 py-2 text-right font-semibold text-emerald-600">
                              {fmtPrice(t.price)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeProduct.has_battery && (
                  <div className="flex items-start gap-2 rounded-xl border-2 border-orange-300 bg-orange-50 px-3 py-2.5 text-sm text-orange-800">
                    <BatteryWarning className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <div>
                      <p className="font-bold">Produit avec batterie</p>
                      <p className="text-xs text-orange-700">
                        Contraintes de transport aérien (tarif majoré) et documents
                        douaniers spécifiques.
                      </p>
                    </div>
                  </div>
                )}

                {activeProduct.description && (
                  <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                    {activeProduct.description}
                  </div>
                )}

                {/* Détails techniques (v3.1) — galerie secondaire, distincte de la principale */}
                {activeProduct.detail_images.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Détails techniques
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {activeProduct.detail_images.map((src) => (
                        <a
                          key={src}
                          href={src}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                        >
                          <SmartImage
                            src={src}
                            fallbackSrc={src}
                            alt="Détail technique"
                            className="h-24 w-full object-cover transition-transform hover:scale-105"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Logistique */}
                {(activeProduct.weight != null ||
                  activeProduct.volume != null ||
                  activeProduct.dimensions ||
                  activeProduct.dimensions_cm) && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <Package className="h-3.5 w-3.5" />
                      Logistique
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {activeProduct.weight != null && (
                        <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                          <Scale className="h-4 w-4 text-slate-400" />
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                              Poids
                            </p>
                            <p className="font-medium text-slate-900">
                              {activeProduct.weight} kg
                            </p>
                          </div>
                        </div>
                      )}
                      {activeProduct.volume != null && (
                        <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                          <Package className="h-4 w-4 text-slate-400" />
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                              CBM
                            </p>
                            <p className="font-medium text-slate-900">
                              {activeProduct.volume.toFixed(4)} m³
                            </p>
                          </div>
                        </div>
                      )}
                      {(activeProduct.dimensions || activeProduct.dimensions_cm) && (
                        <div className="col-span-2 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                          <Ruler className="h-4 w-4 text-slate-400" />
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                              Dimensions
                            </p>
                            <p className="font-medium text-slate-900">
                              {activeProduct.dimensions ||
                                (activeProduct.dimensions_cm
                                  ? `${activeProduct.dimensions_cm.length ?? '?'}×${activeProduct.dimensions_cm.width ?? '?'}×${activeProduct.dimensions_cm.height ?? '?'} cm`
                                  : '—')}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeProduct.info_manquante && (
                  <p className="flex items-start gap-1.5 text-xs italic text-slate-500">
                    <Info className="mt-0.5 h-3 w-3 flex-shrink-0" />
                    À confirmer : {activeProduct.info_manquante}
                  </p>
                )}

                {(() => {
                  const sel = variantOfActive(activeProduct, selectedVariantForActive);
                  const needsVariant =
                    !!activeProduct.variants &&
                    activeProduct.variants.length > 0 &&
                    !selectedVariantForActive;
                  const existing = inCart(activeProduct.id, selectedVariantForActive);
                  // Acompte : le CTA d'achat devient « Demander un devis » (le produit
                  // rejoint quand même le panier → coordonnées récoltées au checkout).
                  const acompte = isAcompteLine(activeProduct, sel);
                  const unit = sel?.price ?? activeProduct.price ?? (activeProduct.from_price > 0 ? activeProduct.from_price : null);
                  return (
                    // Collé en bas de la fiche : toujours à portée, même avec dix variantes.
                    <div className="sticky bottom-0 -mx-5 -mb-5 border-t border-slate-100 bg-white/95 px-5 py-3 backdrop-blur-md">
                      <div className="flex items-center gap-3">
                        {!needsVariant && (sel || unit != null) && (
                          <div className="hidden min-w-0 sm:block">
                            {sel && <p className="truncate text-xs font-semibold text-emerald-700">{sel.name}</p>}
                            {unit != null && !acompte && (
                              <p className="text-sm font-bold tabular-nums text-slate-900">{fmtPrice(unit)}</p>
                            )}
                          </div>
                        )}
                        <motion.button
                          type="button"
                          onClick={(e) => addToCart(activeProduct, e.currentTarget)}
                          disabled={needsVariant || adding}
                          whileHover={!needsVariant ? { scale: 1.02 } : undefined}
                          whileTap={!needsVariant ? { scale: 0.98 } : undefined}
                          className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-base font-semibold transition-colors ${
                            needsVariant
                              ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                              : acompte
                                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25 hover:bg-amber-600'
                                : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600'
                          }`}
                        >
                          {adding ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : needsVariant ? (
                            <>Choisissez une variante ci-dessus</>
                          ) : acompte ? (
                            <>
                              <FileText className="h-5 w-5" />
                              Demander un devis
                            </>
                          ) : existing ? (
                            <>
                              <Plus className="h-5 w-5" />
                              Ajouter encore +1
                            </>
                          ) : (
                            <>
                              <ShoppingBag className="h-5 w-5" />
                              Ajouter au panier
                            </>
                          )}
                        </motion.button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vignette qui vole vers l'icône panier à l'ajout */}
      <AnimatePresence>
        {cartFly && (
          <motion.div
            key="fly"
            initial={{ left: cartFly.from.x, top: cartFly.from.y, scale: 1, opacity: 1 }}
            animate={{ left: cartFly.to.x, top: cartFly.to.y, scale: 0.25, opacity: 0.9 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            className="pointer-events-none fixed z-[70] -ml-7 -mt-7 h-14 w-14 overflow-hidden rounded-full bg-emerald-500 shadow-xl ring-2 ring-white"
            aria-hidden
          >
            {cartFly.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cartFly.image} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-white"><ShoppingBag className="h-6 w-6" /></span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message bref sous la barre (panier vide, erreur réseau) */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            role="status"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`fixed inset-x-4 top-16 z-[65] mx-auto max-w-md rounded-xl px-4 py-2.5 text-center text-sm font-medium shadow-lg ${
              toast.kind === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'
            }`}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox variante : image + description (au-dessus du modal produit) */}
      <AnimatePresence>
        {variantLightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setVariantLightbox(null)}
            className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-900/80 p-0 backdrop-blur-sm sm:p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              onClick={(e) => e.stopPropagation()}
              className="min-h-full w-full overflow-hidden bg-white shadow-2xl sm:my-8 sm:min-h-0 sm:max-w-lg sm:rounded-3xl"
            >
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={variantLightbox.image}
                  alt={variantLightbox.name}
                  className="max-h-[60vh] w-full bg-slate-50 object-contain"
                />
                <button
                  type="button"
                  onClick={() => setVariantLightbox(null)}
                  className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-lg font-bold text-slate-900">{variantLightbox.name}</h3>
                  {variantLightbox.price != null && (
                    <MultiCurrencyPrice amountCny={variantLightbox.price} variant="stacked" primary={currency} only />
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                  {variantLightbox.moq != null && <span>MOQ : {variantLightbox.moq}</span>}
                  {variantLightbox.capacity && <span>Capacité : {variantLightbox.capacity}</span>}
                  {variantLightbox.weight != null && <span>Poids : {variantLightbox.weight} kg</span>}
                  {variantLightbox.volume != null && <span>Vol : {variantLightbox.volume} m³</span>}
                  {variantLightbox.dimensions && <span>Dim : {variantLightbox.dimensions}</span>}
                </div>
                {variantLightbox.description && (
                  <p className="whitespace-pre-line border-t border-slate-100 pt-3 text-sm leading-relaxed text-slate-600">
                    {variantLightbox.description}
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </>
  );
}
