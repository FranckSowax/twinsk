'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Play, ShoppingBag, X, Loader2, CheckCircle, ArrowRight, Youtube } from 'lucide-react';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import SectionHeader from './SectionHeader';

interface VideoProduct {
  id: string;
  name: string;
  priceCny: number;
  image: string;
  productUrl: string;
  inStock: boolean;
}

interface YTVideo {
  id: string;
  title: string;
  thumbnail: string;
  url: string;
  duration: string;
  views: string;
  products: VideoProduct[];
}

interface ApiVideo {
  id: string;
  title: string;
  thumbnail_url: string;
  video_type: 'youtube' | 'upload';
  video_url: string;
  youtube_id: string | null;
  duration: string;
  views: string;
  youtube_video_products?: Array<{
    id: string;
    name: string;
    price_cny: number;
    image_url: string;
    product_url: string;
    in_stock: boolean;
  }>;
}

const mapApiVideo = (v: ApiVideo): YTVideo => ({
  id: v.id,
  title: v.title || 'Sans titre',
  thumbnail: v.thumbnail_url || '',
  url:
    v.video_type === 'youtube' && v.youtube_id
      ? `https://www.youtube.com/watch?v=${v.youtube_id}`
      : v.video_url || '#',
  duration: v.duration || '',
  views: v.views || '',
  products: (v.youtube_video_products || [])
    .filter((p) => p.in_stock)
    .map((p) => ({
      id: p.id,
      name: p.name,
      priceCny: Number(p.price_cny) || 0,
      image: p.image_url || '',
      productUrl: p.product_url || '',
      inStock: p.in_stock,
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
        if (Array.isArray(data)) {
          setVideos(data.map(mapApiVideo));
        }
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
              <span className="block">les <span className="text-red-600">produits</span></span>
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
        {active && <ProductsModal video={active} onClose={() => setActive(null)} />}
      </AnimatePresence>
    </section>
  );
};

const ProductsModal = ({ video, onClose }: { video: YTVideo; onClose: () => void }) => {
  const [selected, setSelected] = useState<VideoProduct | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleOrder = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'youtube_shop',
          fields: {
            Vidéo: video.title,
            Produit: selected.name,
            'Prix unitaire (CNY)': selected.priceCny,
            Quantité: quantity,
            Contact: contact,
          },
        }),
      });
      setSubmitted(true);
    } catch {
      // ignore
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-forest-deep/80 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl bg-cream rounded-3xl overflow-hidden shadow-2xl"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white flex items-center justify-center text-forest hover:bg-forest hover:text-cream transition-colors"
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative aspect-video bg-forest">
          {video.thumbnail && (
            <Image
              src={video.thumbnail}
              alt={video.title}
              fill
              className="object-cover opacity-90"
              unoptimized
            />
          )}
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 flex items-center justify-center group"
          >
            <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
              <Play className="w-7 h-7 text-white fill-white ml-1" />
            </div>
          </a>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <p className="kicker text-red-600 mb-1">Produits présentés</p>
          <h3 className="font-display text-2xl uppercase tracking-tight text-forest mb-4">
            {video.title}
          </h3>

          {video.products.length === 0 ? (
            <p className="text-sm text-forest/50 py-6 text-center">
              Aucun produit référencé pour cette vidéo.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              {video.products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className={`group rounded-2xl border-2 overflow-hidden text-left transition-all ${
                    selected?.id === p.id
                      ? 'border-forest bg-lime/30'
                      : 'border-forest/10 bg-white hover:border-forest/30'
                  }`}
                >
                  <div className="relative aspect-square bg-cream">
                    {p.image && (
                      <Image
                        src={p.image}
                        alt={p.name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-medium text-forest line-clamp-2 mb-1">{p.name}</p>
                    <p className="text-sm font-semibold text-forest tabular-nums">
                      ¥{p.priceCny.toLocaleString('en-US')}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selected && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-forest/15 bg-white p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-forest truncate">{selected.name}</div>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-20 rounded-lg border border-forest/15 bg-cream px-3 py-1.5 text-sm tabular-nums focus:border-forest focus:outline-none"
                />
              </div>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Email ou WhatsApp"
                className="w-full rounded-xl border border-forest/15 bg-cream px-4 py-3 text-sm text-forest focus:border-forest focus:outline-none focus:ring-2 focus:ring-lime/40"
              />
              {submitted ? (
                <div className="flex items-center gap-2 rounded-xl bg-lime/30 px-4 py-3">
                  <CheckCircle className="w-5 h-5 text-forest" />
                  <span className="text-sm text-forest">
                    Commande envoyée — un agent revient vers vous.
                  </span>
                </div>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handleOrder}
                  disabled={!contact.trim() || submitting}
                  className="w-full flex items-center justify-between gap-2 rounded-full bg-forest hover:bg-forest-soft px-5 py-3.5 text-sm font-semibold text-cream disabled:opacity-60"
                >
                  <span>
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Envoi…
                      </>
                    ) : (
                      'Commander ce produit'
                    )}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default TwinskYouTubeShop;
