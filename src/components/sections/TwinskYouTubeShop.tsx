'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Play, ShoppingBag, X, Loader2, CheckCircle, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';
import SectionHeader from './SectionHeader';

interface VideoProduct {
  name: string;
  priceCny: number;
  image: string;
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

const VIDEOS: YTVideo[] = [
  {
    id: 'v1',
    title: 'Visite usine — accessoires beauté Yiwu',
    thumbnail: '/Carte-1688-2.jpg',
    url: 'https://youtube.com/@twinsk',
    duration: '12:34',
    views: '24K',
    products: [
      { name: 'Set pinceaux maquillage', priceCny: 18, image: '/Carte-1688-2.jpg' },
      { name: 'Mini lisseur USB', priceCny: 45, image: '/Carte-sample-.jpg' },
      { name: 'Boîte rangement modulaire', priceCny: 12, image: '/Carte-By-project-.jpg' },
    ],
  },
  {
    id: 'v2',
    title: 'Top 10 voitures chinoises 2026',
    thumbnail: '/Carte-driveby-.jpg',
    url: 'https://youtube.com/@twinsk',
    duration: '08:12',
    views: '142K',
    products: [
      { name: 'BYD Seal', priceCny: 165000, image: '/Carte-driveby-.jpg' },
      { name: 'Geely Atlas Pro', priceCny: 138000, image: '/Carte-driveby-.jpg' },
      { name: 'Chery Tiggo 8', priceCny: 122000, image: '/Carte-driveby-.jpg' },
    ],
  },
  {
    id: 'v3',
    title: 'Sourcing tissus & vêtements Guangzhou',
    thumbnail: '/Carte-By-project-.jpg',
    url: 'https://youtube.com/@twinsk',
    duration: '15:48',
    views: '38K',
    products: [
      { name: 'Tissu wax 6 yards', priceCny: 35, image: '/Carte-By-project-.jpg' },
      { name: 'Robe ajourée premium', priceCny: 95, image: '/Carte-1688-2.jpg' },
    ],
  },
  {
    id: 'v4',
    title: "Réception conteneur 40' Libreville",
    thumbnail: '/Carte-Twinslk-logistic-.jpg',
    url: 'https://youtube.com/@twinsk',
    duration: '06:55',
    views: '11K',
    products: [
      { name: 'Pack matériel BTP', priceCny: 8500, image: '/Carte-Twinslk-logistic-.jpg' },
      { name: 'Mobilier bureau (lot)', priceCny: 4200, image: '/Carte-By-project-.jpg' },
    ],
  },
];

const TwinskYouTubeShop = () => {
  const [active, setActive] = useState<YTVideo | null>(null);

  return (
    <section
      id="youtube-shop"
      className="relative bg-white dark:bg-slate-900 py-24 lg:py-32"
    >
      <div className="absolute inset-x-0 top-0 section-divider" />
      <div className="max-w-[1600px] mx-auto px-4 md:px-8">
        <SectionHeader
          index="03"
          kicker="Twinsk Studio"
          accent="red"
          title={
            <>
              <span className="block">Shop</span>
              <span className="block">par <span className="text-red-600">vidéo</span></span>
            </>
          }
          lead="Chaque vidéo de notre chaîne YouTube référence des produits réellement disponibles. Sélectionnez, commandez, recevez."
          meta={
            <a
              href="https://youtube.com/@twinsk"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-red-600 transition-colors"
            >
              <span>youtube.com/@twinsk</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          }
        />

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
          }}
          className="mt-16 lg:mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
        >
          {VIDEOS.map((video, i) => (
            <motion.button
              key={video.id}
              variants={{
                hidden: { opacity: 0, y: 30 },
                visible: { opacity: 1, y: 0 },
              }}
              whileHover={{ y: -6 }}
              transition={{ ease: [0.215, 0.61, 0.355, 1] }}
              onClick={() => setActive(video)}
              className="group relative bg-white dark:bg-slate-800 rounded-2xl overflow-hidden text-left border border-slate-200/70 dark:border-slate-700 hover:border-red-300 dark:hover:border-red-700/50 hover:shadow-2xl hover:shadow-red-500/10 transition-all"
            >
              <div className="relative aspect-video overflow-hidden bg-slate-200 dark:bg-slate-700">
                <Image
                  src={video.thumbnail}
                  alt={video.title}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-2xl">
                    <Play className="w-6 h-6 text-white fill-white ml-1" />
                  </div>
                </div>
                <span className="absolute bottom-2.5 right-2.5 bg-black/80 text-white kicker px-2 py-1 rounded tabular-nums">
                  {video.duration}
                </span>
                <span className="absolute top-2.5 left-2.5 kicker text-white">
                  EP {String(i + 1).padStart(2, '0')}
                </span>
              </div>
              <div className="p-4">
                <h4 className="font-medium text-[15px] text-slate-900 dark:text-white line-clamp-2 mb-3 leading-snug">
                  {video.title}
                </h4>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 tabular-nums">{video.views} vues</span>
                  <span className="inline-flex items-center gap-1 font-medium text-slate-900 dark:text-white">
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span className="tabular-nums">{video.products.length}</span> produits
                  </span>
                </div>
              </div>
            </motion.button>
          ))}
        </motion.div>
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-2xl"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/95 dark:bg-slate-900/90 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-white"
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative aspect-video bg-slate-900">
          <Image src={video.thumbnail} alt={video.title} fill className="object-cover opacity-90" />
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
          <h3 className="font-display text-2xl uppercase tracking-tight text-slate-900 dark:text-white mb-4">
            {video.title}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            {video.products.map((p) => (
              <button
                key={p.name}
                onClick={() => setSelected(p)}
                className={`group rounded-2xl border-2 overflow-hidden text-left transition-all ${
                  selected?.name === p.name
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-amber-300'
                }`}
              >
                <div className="relative aspect-square bg-slate-100">
                  <Image src={p.image} alt={p.name} fill className="object-cover" />
                </div>
                <div className="p-3">
                  <p className="text-xs font-medium text-slate-900 dark:text-white line-clamp-2 mb-1">
                    {p.name}
                  </p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
                    ¥{p.priceCny.toLocaleString('en-US')}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {selected && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/40 p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {selected.name}
                </div>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-20 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm tabular-nums focus:border-amber-400 focus:outline-none"
                />
              </div>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Email ou WhatsApp"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
              />
              {submitted ? (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                  <span className="text-sm text-emerald-700 dark:text-emerald-300">
                    Commande envoyée — un agent revient vers vous.
                  </span>
                </div>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handleOrder}
                  disabled={!contact.trim() || submitting}
                  className="w-full flex items-center justify-between gap-2 rounded-xl bg-slate-900 dark:bg-amber-500 px-5 py-3.5 text-sm font-semibold text-white dark:text-slate-950 disabled:opacity-60"
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
