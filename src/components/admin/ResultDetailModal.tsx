'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Check, Tag, Package, Scale, Box, Ruler, Store, Globe, Phone, Mail, MessageCircle, BatteryWarning, Info } from 'lucide-react';
import { formatCNY, applyMargin } from '@/lib/utils/formatCurrency';
import SmartImage from '@/components/ui/SmartImage';
import ImageGallery from '@/components/ui/ImageGallery';
import { VideoEmbed } from '@/components/ui/VideoEmbed';
import MultiCurrencyPrice from '@/components/ui/MultiCurrencyPrice';

interface SearchResultRow {
  id: string;
  source: 'taobao' | '1688' | 'manual' | 'factory';
  taobao_item_id: string;
  title: string;
  title_original: string | null;
  description: string | null;
  description_admin?: string | null; // interne — jamais montré au client
  price: number | null; // null = prix à confirmer
  image_url: string;
  main_image_url: string | null;
  extra_images: string[] | null;
  videos: string[] | null;
  has_battery: boolean | null;
  info_manquante: string | null;
  dimensions_cm: { length?: number | null; width?: number | null; height?: number | null } | null;
  variants: {
    id: string;
    name: string;
    image_url?: string | null;
    price?: number | null;
    moq?: number | null;
    weight?: number | null;
    volume?: number | null;
    dimensions?: string | null;
    capacity?: string | null;
  }[] | null;
  seller: string | null;
  product_url: string;
  selected: boolean;
  quantity: number;
  margin_percent: number;
  moq: number | null;
  weight: number | null;
  volume: number | null;
  dimensions: string | null;
  client_quantity: number | null;
  client_selected: boolean | null;
  client_variant_id: string | null;
}

interface ResultDetailModalProps {
  result: SearchResultRow | null;
  onClose: () => void;
  onToggleSelect: (result: SearchResultRow) => void;
}

const SOURCE_BADGE: Record<string, string> = {
  taobao: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  '1688': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  manual: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  factory: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
};

const SOURCE_LABEL: Record<string, string> = {
  taobao: 'taobao',
  '1688': '1688',
  manual: 'manuel',
  factory: '🏭 usine',
};

export default function ResultDetailModal({ result, onClose, onToggleSelect }: ResultDetailModalProps) {
  return (
    <AnimatePresence>
      {result && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/70 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="my-8 w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-800"
          >
            {/* Header with image(s) — fixed at top */}
            <div className="relative">
              {(() => {
                const gallery = Array.from(
                  new Set(
                    [
                      result.main_image_url,
                      result.image_url,
                      ...(result.extra_images || []),
                    ].filter((u): u is string => typeof u === 'string' && u.length > 0)
                  )
                );
                if (gallery.length > 1) {
                  return <ImageGallery images={gallery} alt={result.title} />;
                }
                return (
                  <div className="aspect-square w-full bg-slate-100 dark:bg-slate-900 sm:aspect-[16/10]">
                    {gallery.length === 1 ? (
                      <SmartImage
                        src={gallery[0]}
                        fallbackSrc={result.image_url}
                        alt={result.title}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30">
                        <span className="text-6xl">🏭</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Close button */}
              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-lg backdrop-blur hover:bg-white dark:bg-slate-700/90 dark:text-white"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Source badge */}
              <span
                className={`absolute left-3 top-3 inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase shadow-md ${
                  SOURCE_BADGE[result.source] || SOURCE_BADGE.taobao
                }`}
              >
                {SOURCE_LABEL[result.source] || result.source}
              </span>
            </div>

            {/* Body — scrolls when content exceeds viewport */}
            <div className="space-y-5 p-6">
              {/* Title */}
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                  {result.title}
                </h2>
                {result.title_original && result.title_original !== result.title && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                    <Globe className="h-3 w-3" />
                    <span className="italic">{result.title_original}</span>
                  </p>
                )}
              </div>

              {result.source === 'factory' ? (
                /* ========= FACTORY VIEW ========= */
                <>
                  {/* Contact section — parsed from description */}
                  <FactoryContactSection description={result.description} />

                  {/* Price estimate + MOQ */}
                  {result.price != null && result.price > 0 && (
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Prix estimé unitaire
                      </p>
                      <MultiCurrencyPrice amountCny={result.price} variant="large" />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    {result.moq != null && (
                      <InfoCard icon={Package} label="MOQ" value={`${result.moq} unités`} />
                    )}
                    {result.seller && (
                      <InfoCard icon={Store} label="Localisation" value={result.seller} />
                    )}
                  </div>

                  {/* Website link */}
                  {result.product_url && (
                    <a
                      href={result.product_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-cyan-600 hover:underline dark:text-cyan-400"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Visiter le site web
                    </a>
                  )}
                </>
              ) : (
                /* ========= PRODUCT VIEW (taobao / 1688 / manual) ========= */
                <>
                  {/* Price with product link */}
                  <div className="space-y-2">
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Prix {result.margin_percent > 0 ? 'avec marge' : 'd\'achat'}
                      </p>
                      <div className="flex items-start gap-3">
                        {result.price == null ? (
                          <p className="text-lg font-bold text-amber-600">Prix à confirmer</p>
                        ) : (
                          <MultiCurrencyPrice
                            amountCny={
                              result.margin_percent > 0
                                ? applyMargin(result.price, result.margin_percent)
                                : result.price
                            }
                            variant="large"
                          />
                        )}
                        {result.product_url && (
                          <a
                            href={result.product_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-cyan-400 hover:text-cyan-500 dark:border-slate-600 dark:hover:border-cyan-500"
                            title="Voir le produit"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>
                    {result.margin_percent > 0 && result.price != null && (
                      <p className="text-xs text-slate-500">
                        Prix d&apos;achat brut : {formatCNY(result.price)} · Marge : {result.margin_percent}%
                      </p>
                    )}
                  </div>

                  {result.has_battery && (
                    <div className="flex items-start gap-2 rounded-xl border-2 border-orange-300 bg-orange-50 px-3 py-2.5 text-sm text-orange-800 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-300">
                      <BatteryWarning className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      <div>
                        <p className="font-bold">Produit avec batterie</p>
                        <p className="text-xs opacity-80">
                          Transport aérien : tarif majoré (18 000 FCFA/kg). Documentation
                          douanière spécifique requise.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {result.description && (
                    <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-700/50 dark:text-slate-300">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Description</p>
                      {result.description}
                    </div>
                  )}

                  {/* Description admin (interne — jamais montrée au client) */}
                  {result.description_admin && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-600">
                        <Info className="h-3 w-3" /> Description admin · interne
                      </p>
                      <p className="whitespace-pre-line">{result.description_admin}</p>
                    </div>
                  )}

                  {result.videos && result.videos.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        {result.videos.length > 1 ? 'Vidéos' : 'Vidéo'}
                      </p>
                      <div className="space-y-2">
                        {result.videos.map((v) => (
                          <VideoEmbed key={v} url={v} />
                        ))}
                      </div>
                    </div>
                  )}

                  {result.info_manquante && (
                    <p className="flex items-start gap-1.5 text-xs italic text-slate-500 dark:text-slate-400">
                      <Info className="mt-0.5 h-3 w-3 flex-shrink-0" />
                      À confirmer : {result.info_manquante}
                    </p>
                  )}

                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {result.seller && (
                      <InfoCard icon={Store} label="Vendeur" value={result.seller} />
                    )}
                    {result.moq != null && (
                      <InfoCard icon={Package} label="MOQ" value={`${result.moq} unités`} />
                    )}
                    {result.weight != null && (
                      <InfoCard icon={Scale} label="Poids" value={`${result.weight} kg`} />
                    )}
                    {result.volume != null && (
                      <InfoCard icon={Box} label="Volume" value={`${result.volume} m³`} />
                    )}
                    {result.dimensions && (
                      <InfoCard icon={Ruler} label="Dimensions" value={result.dimensions} />
                    )}
                    {result.client_quantity != null && (
                      <InfoCard icon={Tag} label="Qté client" value={String(result.client_quantity)} />
                    )}
                  </div>

                  {/* Variants */}
                  {result.variants && result.variants.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-700/30">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Variantes ({result.variants.length})
                        {result.client_variant_id && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700 dark:bg-green-900/30 dark:text-green-300">
                            <Check className="h-2.5 w-2.5" /> Client a choisi
                          </span>
                        )}
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[440px] text-left text-xs">
                          <thead>
                            <tr className="text-[10px] uppercase tracking-wider text-slate-400">
                              <th className="w-10 px-2 py-1.5">Photo</th>
                              <th className="px-2 py-1.5">Variante</th>
                              <th className="px-2 py-1.5">Prix</th>
                              <th className="px-2 py-1.5">MOQ</th>
                              <th className="px-2 py-1.5">Capacité</th>
                              <th className="px-2 py-1.5">Poids</th>
                              <th className="px-2 py-1.5">Volume</th>
                              <th className="px-2 py-1.5">Dimensions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {result.variants.map((v) => {
                              const picked = v.id === result.client_variant_id;
                              return (
                                <tr
                                  key={v.id}
                                  className={`${picked ? 'bg-green-50 text-slate-800 dark:bg-green-900/20 dark:text-slate-100' : 'text-slate-700 dark:text-slate-200'}`}
                                >
                                  <td className="px-2 py-1.5">
                                    {v.image_url ? (
                                      <a
                                        href={v.image_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block h-10 w-10 overflow-hidden rounded-md ring-1 ring-slate-200 hover:ring-2 hover:ring-amber-400 dark:ring-slate-600"
                                        title="Ouvrir la photo"
                                      >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={v.image_url} alt={v.name} className="h-full w-full object-cover" />
                                      </a>
                                    ) : (
                                      <span className="text-[10px] text-slate-300">—</span>
                                    )}
                                  </td>
                                  <td className="px-2 py-1.5 font-semibold">
                                    <span className="inline-flex items-center gap-1.5">
                                      {picked && <Check className="h-3 w-3 text-green-600 dark:text-green-400" />}
                                      {v.name}
                                    </span>
                                  </td>
                                  <td className="px-2 py-1.5">
                                    {v.price != null ? (
                                      <div>
                                        <div className="font-semibold">
                                          {formatCNY(applyMargin(v.price, result.margin_percent))}
                                        </div>
                                        {result.margin_percent > 0 && (
                                          <div className="text-[10px] text-slate-400">
                                            brut : {formatCNY(v.price)}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                  <td className="px-2 py-1.5">{v.moq ?? '—'}</td>
                                  <td className="px-2 py-1.5">{v.capacity || '—'}</td>
                                  <td className="px-2 py-1.5">
                                    {v.weight != null ? `${v.weight} kg` : '—'}
                                  </td>
                                  <td className="px-2 py-1.5">
                                    {v.volume != null ? `${v.volume} m³` : '—'}
                                  </td>
                                  <td className="px-2 py-1.5">{v.dimensions || '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Actions — shared for all sources */}
              <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                <motion.button
                  type="button"
                  onClick={() => {
                    onToggleSelect(result);
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold transition-colors ${
                    result.selected
                      ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25 hover:bg-amber-600'
                      : 'border-2 border-slate-200 bg-white text-slate-700 hover:border-amber-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200'
                  }`}
                >
                  <Check className="h-4 w-4" />
                  {result.selected ? 'Sélectionné' : 'Sélectionner'}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Tag;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-700/30">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="truncate text-sm font-medium text-slate-900 dark:text-white" title={value}>
        {value}
      </p>
    </div>
  );
}

/** Parse factory description (which contains structured contact info) and render it nicely */
function FactoryContactSection({ description }: { description: string | null }) {
  if (!description) return null;

  // The description is formatted as: "Spécialités: ... · Expérience: ... · ...\nContact:\nTél: ...\nWhatsApp: ..."
  const contactStart = description.indexOf('Contact:');
  const metaPart = contactStart >= 0 ? description.slice(0, contactStart).trim() : description;
  const contactPart = contactStart >= 0 ? description.slice(contactStart + 'Contact:'.length).trim() : '';

  // Parse meta lines (split by · )
  const metaLines = metaPart
    .split('·')
    .map((s) => s.trim())
    .filter(Boolean);

  // Parse contact lines
  const contactLines = contactPart
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const getIcon = (line: string) => {
    if (line.startsWith('Tél')) return Phone;
    if (line.startsWith('WhatsApp')) return MessageCircle;
    if (line.startsWith('WeChat')) return MessageCircle;
    if (line.startsWith('Email')) return Mail;
    if (line.startsWith('Site')) return ExternalLink;
    return Tag;
  };

  return (
    <div className="space-y-4">
      {/* Meta info */}
      {metaLines.length > 0 && (
        <div className="space-y-2">
          {metaLines.map((line, i) => {
            const [label, ...rest] = line.split(':');
            const value = rest.join(':').trim();
            if (!value) return null;
            return (
              <div key={i} className="flex gap-2 text-sm">
                <span className="flex-shrink-0 font-semibold text-slate-500 dark:text-slate-400">
                  {label.trim()} :
                </span>
                <span className="text-slate-700 dark:text-slate-200">{value}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Contact cards */}
      {contactLines.length > 0 && (
        <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-4 dark:border-purple-800 dark:from-purple-900/20 dark:to-pink-900/20">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
            Coordonnées
          </p>
          <div className="space-y-2">
            {contactLines.map((line, i) => {
              const Icon = getIcon(line);
              const [label, ...rest] = line.split(':');
              const value = rest.join(':').trim();
              if (!value) return null;

              // Make emails and phones interactive
              const isEmail = label.trim() === 'Email';
              const isPhone = label.trim() === 'Tél' || label.trim() === 'WhatsApp';
              const isUrl = label.trim() === 'Site';

              const href = isEmail
                ? `mailto:${value}`
                : isPhone
                  ? `tel:${value}`
                  : isUrl
                    ? value.startsWith('http') ? value : `https://${value}`
                    : undefined;

              return (
                <div key={i} className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 flex-shrink-0 text-purple-500" />
                  <span className="text-xs font-medium text-slate-500">{label.trim()}</span>
                  {href ? (
                    <a
                      href={href}
                      target={isUrl ? '_blank' : undefined}
                      rel={isUrl ? 'noopener noreferrer' : undefined}
                      className="truncate text-sm font-medium text-purple-700 hover:underline dark:text-purple-300"
                    >
                      {value}
                    </a>
                  ) : (
                    <span className="truncate text-sm font-medium text-slate-900 dark:text-white">
                      {value}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
