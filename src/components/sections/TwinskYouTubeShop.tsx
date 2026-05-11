'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  ShoppingBag,
  X,
  Loader2,
  CheckCircle,
  ArrowRight,
  Youtube,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  ArrowLeft,
  MapPin,
  User,
  Mail,
  Phone,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import SectionHeader from './SectionHeader';

interface VideoProduct {
  id: string;
  name: string;
  priceUsd: number;
  image: string;
  productUrl: string;
  inStock: boolean;
  description: string;
}

interface YTVideo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  url: string;
  youtubeId: string | null;
  duration: string;
  views: string;
  products: VideoProduct[];
}

interface ApiVideo {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  video_type: 'youtube' | 'upload';
  video_url: string;
  youtube_id: string | null;
  duration: string;
  views: string;
  youtube_video_products?: Array<{
    id: string;
    name: string;
    price_usd: number;
    image_url: string;
    product_url: string;
    description: string;
    in_stock: boolean;
  }>;
}

const mapApiVideo = (v: ApiVideo): YTVideo => ({
  id: v.id,
  title: v.title || 'Sans titre',
  description: v.description || '',
  thumbnail: v.thumbnail_url || '',
  url:
    v.video_type === 'youtube' && v.youtube_id
      ? `https://www.youtube.com/watch?v=${v.youtube_id}`
      : v.video_url || '#',
  youtubeId: v.youtube_id,
  duration: v.duration || '',
  views: v.views || '',
  products: (v.youtube_video_products || [])
    .filter((p) => p.in_stock)
    .map((p) => ({
      id: p.id,
      name: p.name,
      priceUsd: Number(p.price_usd) || 0,
      image: p.image_url || '',
      productUrl: p.product_url || '',
      inStock: p.in_stock,
      description: p.description || '',
    })),
});

const TwinskYouTubeShop = () => {
  const [videos, setVideos] = useState<YTVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<YTVideo | null>(null);

  useEffect(() => {
    fetch('/api/youtube-videos')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setVideos(data.map(mapApiVideo));
      })
      .finally(() => setLoading(false));
  }, []);

  if (!loading && videos.length === 0) return null;

  return (
    <section
      id="youtube-shop"
      className="relative px-3 sm:px-5 lg:px-6 py-16 lg:py-24 bg-white border-t border-forest/5 overflow-hidden"
    >
      <div
        aria-hidden
        className="absolute -top-40 -left-40 w-[640px] h-[640px] bg-red-600/10 rounded-full blur-3xl pointer-events-none"
      />
      <div
        aria-hidden
        className="absolute -bottom-40 -right-32 w-[520px] h-[520px] bg-red-600/[0.06] rounded-full blur-3xl pointer-events-none"
      />

      <div className="relative max-w-[1600px] mx-auto px-2 sm:px-4">
        <SectionHeader
          index="03"
          kicker="Twinsk Studio · YouTube"
          accent="red"
          title={
            <>
              <span className="block">Retrouvez</span>
              <span className="block">
                les <span className="text-red-600">produits</span>
              </span>
              <span className="block">de nos vidéos</span>
            </>
          }
          lead="Chaque vidéo de notre chaîne YouTube référence des produits réellement disponibles. Sélectionnez, commandez, recevez."
          meta={
            <a
              href="https://youtube.com/@twinsk"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-red-600 px-4 py-2.5 rounded-full text-sm font-semibold text-white hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
            >
              <Youtube className="w-4 h-4" fill="currentColor" />
              <span>youtube.com/@twinsk</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          }
        />

        {loading ? (
          <div className="mt-12 lg:mt-16 flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-red-600" />
          </div>
        ) : (
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
            }}
            className="mt-12 lg:mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {videos.map((video, i) => (
              <motion.button
                key={video.id}
                variants={{
                  hidden: { opacity: 0, y: 30 },
                  visible: { opacity: 1, y: 0 },
                }}
                whileHover={{ y: -6 }}
                transition={{ ease: [0.215, 0.61, 0.355, 1] }}
                onClick={() => setActive(video)}
                className="group relative bg-cream rounded-2xl overflow-hidden text-left border border-forest/10 hover:border-red-600/40 hover:shadow-2xl hover:shadow-red-600/10 transition-all"
              >
                <div className="relative aspect-video overflow-hidden bg-forest/5">
                  {video.thumbnail && (
                    <Image
                      src={video.thumbnail}
                      alt={video.title}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                      unoptimized
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-forest/70 via-forest/10 to-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-2xl">
                      <Play className="w-6 h-6 text-white fill-white ml-1" />
                    </div>
                  </div>
                  {video.duration && (
                    <span className="absolute bottom-2.5 right-2.5 bg-forest/90 text-cream kicker px-2 py-1 rounded tabular-nums">
                      {video.duration}
                    </span>
                  )}
                  <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 kicker text-white bg-red-600 px-2 py-1 rounded">
                    <Youtube className="w-3 h-3" fill="currentColor" />
                    EP {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <div className="p-4">
                  <h4 className="font-medium text-[15px] text-forest line-clamp-2 mb-3 leading-snug">
                    {video.title}
                  </h4>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-forest/50 tabular-nums">
                      {video.views ? `${video.views} vues` : ''}
                    </span>
                    <span className="inline-flex items-center gap-1 font-medium text-forest">
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span className="tabular-nums">{video.products.length}</span> produits
                    </span>
                  </div>
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {active && <ShopModal video={active} onClose={() => setActive(null)} />}
      </AnimatePresence>
    </section>
  );
};

// ────────────────────────────────────────────────
// E-commerce shop modal
// ────────────────────────────────────────────────

type Step = 'shop' | 'checkout' | 'done';
type Cart = Record<string, number>; // productId → qty

const ShopModal = ({ video, onClose }: { video: YTVideo; onClose: () => void }) => {
  const [cart, setCart] = useState<Cart>({});
  const [step, setStep] = useState<Step>('shop');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const addToCart = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const decrementCart = (id: string) =>
    setCart((c) => {
      const next = (c[id] || 0) - 1;
      if (next <= 0) {
        const copy = { ...c };
        delete copy[id];
        return copy;
      }
      return { ...c, [id]: next };
    });
  const removeFromCart = (id: string) =>
    setCart((c) => {
      const copy = { ...c };
      delete copy[id];
      return copy;
    });

  const cartItems = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, qty]) => {
          const product = video.products.find((p) => p.id === id);
          return product ? { product, qty } : null;
        })
        .filter(Boolean) as { product: VideoProduct; qty: number }[],
    [cart, video.products],
  );

  const total = useMemo(
    () => cartItems.reduce((acc, { product, qty }) => acc + product.priceUsd * qty, 0),
    [cartItems],
  );

  const itemsCount = useMemo(
    () => cartItems.reduce((acc, { qty }) => acc + qty, 0),
    [cartItems],
  );

  const canCheckout = cartItems.length > 0;
  const canSubmit =
    canCheckout &&
    name.trim().length > 0 &&
    (email.trim().length > 0 || whatsapp.trim().length > 0) &&
    address.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const itemsLine = cartItems
        .map(({ product, qty }) => `${product.name} × ${qty} ($${product.priceUsd * qty})`)
        .join(' · ');

      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'youtube_shop',
          fields: {
            Vidéo: video.title,
            Items: itemsLine,
            'Nb articles': itemsCount,
            'Total (USD)': total,
            Nom: name.trim(),
            Email: email.trim(),
            WhatsApp: whatsapp.trim(),
            'Adresse de livraison': address.trim(),
          },
        }),
      });
      setStep('done');
    } catch {
      setError('Erreur réseau. Réessayez ou contactez-nous directement.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center bg-forest-deep/85 backdrop-blur-md p-0 sm:p-4 overflow-y-auto"
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-6xl bg-white sm:rounded-3xl overflow-hidden shadow-2xl my-0 sm:my-6 flex flex-col h-screen sm:h-auto sm:min-h-[640px] sm:max-h-[95vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3 bg-white">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-md bg-red-600 flex items-center justify-center flex-shrink-0">
              <Youtube className="w-4 h-4 text-white" fill="currentColor" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                {step === 'shop' && 'Shop'}
                {step === 'checkout' && 'Validation du devis'}
                {step === 'done' && 'Confirmation'}
              </p>
              <h3 className="font-display text-sm uppercase tracking-tight text-slate-900 truncate">
                {video.title}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 flex-shrink-0"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {step === 'shop' && (
          <ShopStep
            video={video}
            cart={cart}
            cartItems={cartItems}
            total={total}
            itemsCount={itemsCount}
            onAdd={addToCart}
            onDec={decrementCart}
            onRemove={removeFromCart}
            onCheckout={() => setStep('checkout')}
          />
        )}

        {step === 'checkout' && (
          <CheckoutStep
            video={video}
            cartItems={cartItems}
            total={total}
            itemsCount={itemsCount}
            name={name}
            email={email}
            whatsapp={whatsapp}
            address={address}
            onName={setName}
            onEmail={setEmail}
            onWhatsapp={setWhatsapp}
            onAddress={setAddress}
            onBack={() => setStep('shop')}
            onSubmit={handleSubmit}
            canSubmit={canSubmit}
            submitting={submitting}
            error={error}
            onDec={decrementCart}
            onAdd={addToCart}
            onRemove={removeFromCart}
          />
        )}

        {step === 'done' && <DoneStep total={total} itemsCount={itemsCount} onClose={onClose} />}
      </motion.div>
    </motion.div>
  );
};

// ────── Step 1: Shop ──────

interface ShopStepProps {
  video: YTVideo;
  cart: Cart;
  cartItems: { product: VideoProduct; qty: number }[];
  total: number;
  itemsCount: number;
  onAdd: (id: string) => void;
  onDec: (id: string) => void;
  onRemove: (id: string) => void;
  onCheckout: () => void;
}

const ShopStep = ({
  video,
  cart,
  cartItems,
  total,
  itemsCount,
  onAdd,
  onDec,
  onRemove,
  onCheckout,
}: ShopStepProps) => (
  <div className="grid grid-cols-1 lg:grid-cols-5 flex-1 min-h-0 overflow-hidden">
    {/* Left: video (aspect-video forces full thumbnail visibility) */}
    <div className="lg:col-span-3 bg-black relative aspect-video lg:aspect-auto lg:min-h-[560px] flex items-center justify-center">
      {video.youtubeId ? (
        <iframe
          src={`https://www.youtube.com/embed/${video.youtubeId}?rel=0&modestbranding=1`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      ) : video.url && video.url !== '#' ? (
        <video
          src={video.url}
          controls
          className="absolute inset-0 w-full h-full object-contain"
          poster={video.thumbnail}
        />
      ) : (
        <div className="text-white/60 text-sm">Vidéo non disponible</div>
      )}
    </div>

    {/* Right: products + cart */}
    <div className="lg:col-span-2 flex flex-col bg-cream border-t lg:border-t-0 lg:border-l border-slate-200 overflow-hidden">
      {/* Products list */}
      <div className="flex-1 overflow-y-auto p-5">
        <p className="kicker text-red-600 mb-1">Produits présentés</p>
        <h4 className="font-display text-lg uppercase tracking-tight text-slate-900 mb-3">
          Composez votre panier
        </h4>

        {video.products.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">
            Aucun produit référencé pour cette vidéo.
          </p>
        ) : (
          <ul className="space-y-2">
            {video.products.map((p) => {
              const qty = cart[p.id] || 0;
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-2"
                >
                  <div className="relative h-14 w-14 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                    {p.image ? (
                      <Image src={p.image} alt={p.name} fill className="object-cover" unoptimized />
                    ) : (
                      <ShoppingBag className="absolute inset-0 m-auto w-5 h-5 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 line-clamp-2 leading-snug">
                      {p.name}
                    </p>
                    <p className="text-xs font-semibold text-slate-900 tabular-nums mt-0.5">
                      ${p.priceUsd.toLocaleString('en-US')}
                    </p>
                  </div>
                  {qty === 0 ? (
                    <button
                      onClick={() => onAdd(p.id)}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 text-xs font-semibold"
                    >
                      <Plus className="w-3 h-3" />
                      Ajouter
                    </button>
                  ) : (
                    <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1 py-0.5">
                      <button
                        onClick={() => onDec(p.id)}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-slate-700 hover:bg-white"
                        aria-label="Diminuer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-semibold text-sm w-6 text-center tabular-nums">
                        {qty}
                      </span>
                      <button
                        onClick={() => onAdd(p.id)}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-slate-700 hover:bg-white"
                        aria-label="Augmenter"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Cart summary footer */}
      {cartItems.length > 0 && (
        <div className="border-t border-slate-200 bg-white p-4 space-y-3">
          <div className="max-h-32 overflow-y-auto pr-1 space-y-1.5">
            {cartItems.map(({ product, qty }) => (
              <div
                key={product.id}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="truncate text-slate-700">
                  <span className="font-medium">{product.name}</span>
                  <span className="text-slate-400"> × {qty}</span>
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-semibold text-slate-900 tabular-nums">
                    ${(product.priceUsd * qty).toLocaleString('en-US')}
                  </span>
                  <button
                    onClick={() => onRemove(product.id)}
                    className="text-slate-300 hover:text-red-600"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-baseline justify-between pt-2 border-t border-slate-100">
            <span className="text-xs uppercase tracking-wider text-slate-500">
              <ShoppingCart className="inline w-3 h-3 mr-1" />
              {itemsCount} article{itemsCount > 1 ? 's' : ''}
            </span>
            <span className="font-display text-2xl tabular-nums text-slate-900">
              ${total.toLocaleString('en-US')}
            </span>
          </div>
          <button
            onClick={onCheckout}
            className="w-full inline-flex items-center justify-between gap-2 rounded-full bg-gradient-to-r from-red-600 to-orange-500 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-red-500/25 hover:shadow-xl group"
          >
            <span>Procéder au devis</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      )}
    </div>
  </div>
);

// ────── Step 2: Checkout ──────

interface CheckoutStepProps {
  video: YTVideo;
  cartItems: { product: VideoProduct; qty: number }[];
  total: number;
  itemsCount: number;
  name: string;
  email: string;
  whatsapp: string;
  address: string;
  onName: (v: string) => void;
  onEmail: (v: string) => void;
  onWhatsapp: (v: string) => void;
  onAddress: (v: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  canSubmit: boolean;
  submitting: boolean;
  error: string;
  onAdd: (id: string) => void;
  onDec: (id: string) => void;
  onRemove: (id: string) => void;
}

const CheckoutStep = ({
  cartItems,
  total,
  itemsCount,
  name,
  email,
  whatsapp,
  address,
  onName,
  onEmail,
  onWhatsapp,
  onAddress,
  onBack,
  onSubmit,
  canSubmit,
  submitting,
  error,
  onAdd,
  onDec,
  onRemove,
}: CheckoutStepProps) => (
  <div className="grid grid-cols-1 lg:grid-cols-5 flex-1 min-h-0 overflow-hidden">
    {/* Left: contact form */}
    <div className="lg:col-span-3 overflow-y-auto p-5 sm:p-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 mb-4"
      >
        <ArrowLeft className="w-3 h-3" />
        Modifier le panier
      </button>

      <h3 className="font-display text-xl uppercase tracking-tight text-slate-900 mb-1">
        Vos coordonnées
      </h3>
      <p className="text-xs text-slate-500 mb-5">
        Un agent Twinsk revient vers vous sous 24 h avec le devis complet (port + douanes).
      </p>

      <div className="space-y-3">
        <Field icon={User} label="Nom *">
          <input
            type="text"
            value={name}
            onChange={(e) => onName(e.target.value)}
            placeholder="Nom complet ou société"
            className="bg-transparent text-sm font-medium w-full focus:outline-none placeholder:text-slate-400"
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field icon={Mail} label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => onEmail(e.target.value)}
              placeholder="vous@exemple.com"
              className="bg-transparent text-sm font-medium w-full focus:outline-none placeholder:text-slate-400"
            />
          </Field>
          <Field icon={Phone} label="WhatsApp">
            <input
              type="tel"
              value={whatsapp}
              onChange={(e) => onWhatsapp(e.target.value)}
              placeholder="+241 06 00 00 00"
              className="bg-transparent text-sm font-medium w-full focus:outline-none placeholder:text-slate-400"
            />
          </Field>
        </div>
        <p className="text-[10px] text-slate-400 -mt-1">
          Renseignez au moins l&apos;un des deux : email ou WhatsApp.
        </p>
        <Field icon={MapPin} label="Adresse de livraison *">
          <textarea
            value={address}
            onChange={(e) => onAddress(e.target.value)}
            rows={2}
            placeholder="Rue, ville, pays — destination finale"
            className="bg-transparent text-sm font-medium w-full focus:outline-none placeholder:text-slate-400 resize-none"
          />
        </Field>
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>

    {/* Right: cart summary */}
    <div className="lg:col-span-2 flex flex-col bg-slate-50 border-t lg:border-t-0 lg:border-l border-slate-200 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-5">
        <p className="kicker text-red-600 mb-1">Votre panier</p>
        <h4 className="font-display text-lg uppercase tracking-tight text-slate-900 mb-3">
          Récapitulatif
        </h4>

        <ul className="space-y-2">
          {cartItems.map(({ product, qty }) => (
            <li
              key={product.id}
              className="flex items-center gap-3 rounded-xl bg-white p-2 border border-slate-200"
            >
              <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                {product.image && (
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-900 line-clamp-2 leading-snug">
                  {product.name}
                </p>
                <p className="text-[11px] text-slate-500 tabular-nums">
                  ${product.priceUsd.toLocaleString('en-US')} × {qty}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="font-semibold text-xs text-slate-900 tabular-nums">
                  ${(product.priceUsd * qty).toLocaleString('en-US')}
                </span>
                <div className="inline-flex items-center gap-0.5 rounded-full bg-slate-100">
                  <button
                    onClick={() => onDec(product.id)}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-slate-600 hover:bg-white"
                  >
                    <Minus className="w-2.5 h-2.5" />
                  </button>
                  <button
                    onClick={() => onAdd(product.id)}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-slate-600 hover:bg-white"
                  >
                    <Plus className="w-2.5 h-2.5" />
                  </button>
                  <button
                    onClick={() => onRemove(product.id)}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-slate-200 bg-white p-4 space-y-3">
        <div className="space-y-1 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Sous-total</span>
            <span className="tabular-nums">${total.toLocaleString('en-US')}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Port + douanes</span>
            <span className="italic">Devis sur demande</span>
          </div>
        </div>
        <div className="flex items-baseline justify-between border-t border-slate-200 pt-2">
          <span className="text-xs uppercase tracking-wider text-slate-500">
            {itemsCount} article{itemsCount > 1 ? 's' : ''}
          </span>
          <span className="font-display text-2xl tabular-nums text-slate-900">
            ${total.toLocaleString('en-US')}
          </span>
        </div>
        <button
          onClick={onSubmit}
          disabled={!canSubmit || submitting}
          className="w-full inline-flex items-center justify-between gap-2 rounded-full bg-gradient-to-r from-red-600 to-orange-500 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-red-500/25 hover:shadow-xl disabled:opacity-50 group"
        >
          <span>
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Envoi…
              </>
            ) : (
              'Demander le devis'
            )}
          </span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </button>
        <p className="text-[10px] text-slate-400 text-center">
          Un agent Twinsk vous répond sous 48 h.
        </p>
      </div>
    </div>
  </div>
);

// ────── Step 3: Done ──────

const DoneStep = ({
  total,
  itemsCount,
  onClose,
}: {
  total: number;
  itemsCount: number;
  onClose: () => void;
}) => (
  <div className="flex flex-1 items-center justify-center p-10 sm:p-16">
    <div className="text-center max-w-md">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 14 }}
        className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500"
      >
        <CheckCircle className="h-8 w-8 text-white" />
      </motion.div>
      <h3 className="font-display text-3xl uppercase tracking-tight text-slate-900 mb-3">
        Devis envoyé !
      </h3>
      <p className="text-sm text-slate-600 mb-5 leading-relaxed">
        Votre demande de {itemsCount} article{itemsCount > 1 ? 's' : ''} ($
        {total.toLocaleString('en-US')}) est arrivée chez un agent Twinsk. Vous recevrez le devis
        complet (port + douanes + délai) sous 48 h.
      </p>
      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 mb-5 text-left">
        <p className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
          Prochaines étapes
        </p>
        <ol className="space-y-1.5 text-xs text-slate-700">
          <li>1. Réception et confirmation par un agent</li>
          <li>2. Devis détaillé envoyé par email/WhatsApp</li>
          <li>3. Acompte + mise en route</li>
          <li>4. Livraison à votre adresse</li>
        </ol>
      </div>
      <button
        onClick={onClose}
        className="inline-flex items-center gap-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 text-sm font-semibold"
      >
        Fermer
      </button>
    </div>
  </div>
);

// ────── Helpers ──────

const Field = ({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) => (
  <div className="bg-slate-50 rounded-xl flex items-start gap-3 px-4 py-3 border border-slate-200 focus-within:border-red-400 transition-colors">
    <div className="w-9 h-9 rounded-lg bg-white text-red-600 border border-red-100 flex items-center justify-center flex-shrink-0">
      <Icon className="w-4 h-4" />
    </div>
    <div className="flex-1 min-w-0">
      <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
        {label}
      </label>
      {children}
    </div>
  </div>
);

export default TwinskYouTubeShop;
