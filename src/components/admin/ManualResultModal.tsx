'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Upload,
  Loader2,
  Plus,
  Image as ImageIcon,
  Trash2,
  Save,
  Layers,
} from 'lucide-react';

export interface ProductVariant {
  id: string;
  name: string;
  price?: number | null;
  moq?: number | null;
  weight?: number | null;
  volume?: number | null;
  dimensions?: string | null;
  capacity?: string | null;
}

export interface ExistingResult {
  id: string;
  title: string;
  description: string | null;
  price: number;
  image_url: string;
  main_image_url: string | null;
  extra_images: string[] | null;
  seller: string | null;
  product_url: string;
  moq: number | null;
  weight: number | null;
  volume: number | null;
  dimensions: string | null;
  quantity: number;
  variants?: ProductVariant[] | null;
}

interface ManualResultModalProps {
  open: boolean;
  requestId: string;
  requestItemId: string;
  // When provided, the modal switches to edit mode and pre-fills its fields.
  existingResult?: ExistingResult | null;
  // Override the API base path. Defaults to /api/requests so existing callers
  // work unchanged. Pass /api/offers from the offers admin.
  basePath?: string;
  // Endpoint suffix for creating manual products. Defaults to 'manual-result'.
  // /api/offers uses 'manual-product' for the same purpose.
  createPathSuffix?: string;
  // Endpoint suffix for batch updating products. Defaults to 'results'.
  // /api/offers uses 'products'.
  updatePathSuffix?: string;
  onClose: () => void;
  onCreated: () => void;
}

function makeVariantId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function emptyVariant(): ProductVariant {
  return {
    id: makeVariantId(),
    name: '',
    price: null,
    moq: null,
    weight: null,
    volume: null,
    dimensions: null,
    capacity: null,
  };
}

export default function ManualResultModal({
  open,
  requestId,
  requestItemId,
  existingResult,
  basePath = '/api/requests',
  createPathSuffix = 'manual-result',
  updatePathSuffix = 'results',
  onClose,
  onCreated,
}: ManualResultModalProps) {
  const isEdit = !!existingResult;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [extraImages, setExtraImages] = useState<string[]>([]);
  const [extrasUploading, setExtrasUploading] = useState(false);
  const [productUrl, setProductUrl] = useState('');
  const [seller, setSeller] = useState('');
  const [moq, setMoq] = useState('');
  const [weight, setWeight] = useState('');
  const [volume, setVolume] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [variants, setVariants] = useState<ProductVariant[]>([]);

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const extrasInputRef = useRef<HTMLInputElement>(null);

  // Pre-fill or reset whenever existingResult changes / modal opens.
  useEffect(() => {
    if (!open) return;
    if (existingResult) {
      setTitle(existingResult.title || '');
      setDescription(existingResult.description || '');
      setPrice(
        existingResult.price != null && existingResult.price !== 0
          ? String(existingResult.price)
          : ''
      );
      setImageUrl(existingResult.main_image_url || existingResult.image_url || '');
      setExtraImages(existingResult.extra_images || []);
      setProductUrl(existingResult.product_url || '');
      setSeller(existingResult.seller || '');
      setMoq(existingResult.moq != null ? String(existingResult.moq) : '');
      setWeight(existingResult.weight != null ? String(existingResult.weight) : '');
      setVolume(existingResult.volume != null ? String(existingResult.volume) : '');
      setDimensions(existingResult.dimensions || '');
      setQuantity(String(existingResult.quantity || 1));
      setVariants(
        (existingResult.variants || []).map((v) => ({
          ...v,
          id: v.id || makeVariantId(),
        }))
      );
      setError('');
    } else {
      setTitle('');
      setDescription('');
      setPrice('');
      setImageUrl('');
      setExtraImages([]);
      setProductUrl('');
      setSeller('');
      setMoq('');
      setWeight('');
      setVolume('');
      setDimensions('');
      setQuantity('1');
      setVariants([]);
      setError('');
    }
  }, [open, existingResult]);

  const handleClose = () => {
    if (submitting || uploading || extrasUploading) return;
    setError('');
    onClose();
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('files', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload échoué');
      setImageUrl(data.urls[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur upload');
    } finally {
      setUploading(false);
    }
  };

  const handleExtrasUpload = async (files: FileList) => {
    if (!files.length) return;
    setExtrasUploading(true);
    setError('');
    try {
      const formData = new FormData();
      Array.from(files).forEach((f) => formData.append('files', f));
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload échoué');
      const newUrls = (data.urls || []) as string[];
      setExtraImages((prev) => Array.from(new Set([...prev, ...newUrls])));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur upload');
    } finally {
      setExtrasUploading(false);
    }
  };

  const removeExtra = (url: string) => {
    setExtraImages((prev) => prev.filter((u) => u !== url));
  };

  const updateVariant = (id: string, patch: Partial<ProductVariant>) => {
    setVariants((prev) =>
      prev.map((v) => (v.id === id ? { ...v, ...patch } : v))
    );
  };
  const removeVariant = (id: string) => {
    setVariants((prev) => prev.filter((v) => v.id !== id));
  };
  const addVariant = () => {
    setVariants((prev) => [...prev, emptyVariant()]);
  };

  // Build a clean variants array for the API (drop empties, coerce numbers, strip local fields).
  const cleanVariantsForApi = (): ProductVariant[] => {
    return variants
      .map((v) => {
        const name = (v.name || '').trim();
        const cleaned: ProductVariant = {
          id: v.id,
          name,
          price:
            v.price != null && v.price !== ('' as unknown as number)
              ? Number(v.price)
              : null,
          moq:
            v.moq != null && v.moq !== ('' as unknown as number)
              ? Number(v.moq)
              : null,
          weight:
            v.weight != null && v.weight !== ('' as unknown as number)
              ? Number(v.weight)
              : null,
          volume:
            v.volume != null && v.volume !== ('' as unknown as number)
              ? Number(v.volume)
              : null,
          dimensions: (v.dimensions || '').trim() || null,
          capacity: (v.capacity || '').trim() || null,
        };
        return cleaned;
      })
      .filter((v) => v.name.length > 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Le titre est requis');
      return;
    }

    const cleanedVariants = cleanVariantsForApi();
    // Reject named-but-incomplete only if user typed names with no values? — keep permissive.
    // Reject duplicate variant names to avoid client-side confusion.
    const seenNames = new Set<string>();
    for (const v of cleanedVariants) {
      const key = v.name.toLowerCase();
      if (seenNames.has(key)) {
        setError(`Variante en double: "${v.name}"`);
        return;
      }
      seenNames.add(key);
    }

    setSubmitting(true);
    try {
      if (isEdit && existingResult) {
        // EDIT mode: PATCH /results with a single update entry.
        const res = await fetch(`${basePath}/${requestId}/${updatePathSuffix}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            updates: [
              {
                id: existingResult.id,
                title: title.trim(),
                description: description.trim() || null,
                price:
                  price !== ''
                    ? Number(price)
                    : existingResult.price ?? 0,
                image_url: imageUrl || '',
                main_image_url: imageUrl || null,
                extra_images: extraImages.length ? extraImages : null,
                product_url: productUrl.trim() || '',
                seller: seller.trim() || null,
                moq: moq !== '' ? Number(moq) : null,
                weight: weight !== '' ? Number(weight) : null,
                volume: volume !== '' ? Number(volume) : null,
                dimensions: dimensions.trim() || null,
                quantity: quantity !== '' ? Math.max(1, Number(quantity)) : 1,
                variants: cleanedVariants.length ? cleanedVariants : null,
              },
            ],
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Erreur mise à jour');
        }
      } else {
        // CREATE mode
        const res = await fetch(`${basePath}/${requestId}/${createPathSuffix}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            request_item_id: requestItemId,
            title,
            description,
            price,
            image_url: imageUrl,
            extra_images: extraImages,
            product_url: productUrl,
            seller,
            moq,
            weight,
            volume,
            dimensions,
            quantity,
            variants: cleanedVariants,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur création');
      }

      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500';
  const tinyInputClass =
    'w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/70 p-4 backdrop-blur-sm sm:items-center"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="my-8 w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-800"
          >
            <form onSubmit={handleSubmit}>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  {isEdit ? 'Modifier le produit' : 'Ajouter un produit manuellement'}
                </h2>
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div className="max-h-[calc(100vh-220px)] space-y-4 overflow-y-auto px-6 py-5">
                {/* Image upload */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Image du produit
                  </label>
                  <div className="flex gap-3">
                    <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-700/50">
                      {imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : uploading ? (
                        <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-slate-300" />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-amber-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                      >
                        <Upload className="h-4 w-4" />
                        Uploader une image
                      </button>
                      <input
                        type="url"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="ou coller une URL d'image"
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>

                {/* Extra images (multi-upload) */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Photos supplémentaires
                      {extraImages.length > 0 && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          {extraImages.length}
                        </span>
                      )}
                    </label>
                    <button
                      type="button"
                      onClick={() => extrasInputRef.current?.click()}
                      disabled={extrasUploading}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                    >
                      {extrasUploading ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" /> Envoi…
                        </>
                      ) : (
                        <>
                          <Upload className="h-3 w-3" /> Ajouter
                        </>
                      )}
                    </button>
                    <input
                      ref={extrasInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files) handleExtrasUpload(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </div>
                  {extraImages.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                      {extraImages.map((url) => (
                        <div
                          key={url}
                          className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-700/50"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="extra" className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeExtra(url)}
                            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500/90 text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100 hover:bg-red-600"
                            title="Retirer"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-center text-xs text-slate-400 dark:border-slate-700 dark:bg-slate-700/30">
                      Aucune photo supplémentaire — utilisez « Ajouter » pour téléverser plusieurs images.
                    </p>
                  )}
                </div>

                {/* Title */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Titre du produit *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Sac en cuir noir 35cm"
                    required
                    className={inputClass}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    placeholder="Détails sur le produit..."
                    className={inputClass}
                  />
                </div>

                {/* Price + Quantity + MOQ */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Prix (CNY)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="0.00"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Quantité
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                      MOQ
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={moq}
                      onChange={(e) => setMoq(e.target.value)}
                      placeholder="—"
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Weight + Volume + Dimensions */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Poids (kg)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder="—"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Volume (m³)
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={volume}
                      onChange={(e) => setVolume(e.target.value)}
                      placeholder="—"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Dimensions
                    </label>
                    <input
                      type="text"
                      value={dimensions}
                      onChange={(e) => setDimensions(e.target.value)}
                      placeholder="30x20x15 cm"
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Seller */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Vendeur / Fournisseur
                  </label>
                  <input
                    type="text"
                    value={seller}
                    onChange={(e) => setSeller(e.target.value)}
                    placeholder="Nom du fournisseur"
                    className={inputClass}
                  />
                </div>

                {/* Product URL */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    URL du produit
                  </label>
                  <input
                    type="url"
                    value={productUrl}
                    onChange={(e) => setProductUrl(e.target.value)}
                    placeholder="https://..."
                    className={inputClass}
                  />
                </div>

                {/* Variants */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-700/30">
                  <div className="mb-3 flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <Layers className="h-3.5 w-3.5" />
                      Variantes
                      {variants.length > 0 && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          {variants.length}
                        </span>
                      )}
                    </label>
                    <button
                      type="button"
                      onClick={addVariant}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                    >
                      <Plus className="h-3 w-3" /> Ajouter une variante
                    </button>
                  </div>

                  {variants.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3 text-center text-xs text-slate-400 dark:border-slate-600 dark:bg-slate-800">
                      Aucune variante — utilisez « Ajouter une variante » pour
                      proposer plusieurs options (prix, dimensions, capacité…).
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {variants.map((v) => (
                        <div
                          key={v.id}
                          className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-800"
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <input
                              type="text"
                              value={v.name}
                              onChange={(e) =>
                                updateVariant(v.id, { name: e.target.value })
                              }
                              placeholder="Nom (ex: Petit, 1L, Rouge)"
                              className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-700 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                            />
                            <button
                              type="button"
                              onClick={() => removeVariant(v.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-white text-red-500 hover:bg-red-50 dark:border-red-800 dark:bg-slate-700 dark:text-red-400"
                              title="Supprimer la variante"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                Prix (CNY)
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={v.price ?? ''}
                                onChange={(e) =>
                                  updateVariant(v.id, {
                                    price:
                                      e.target.value === ''
                                        ? null
                                        : Number(e.target.value),
                                  })
                                }
                                placeholder="—"
                                className={tinyInputClass}
                              />
                            </div>
                            <div>
                              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                MOQ
                              </span>
                              <input
                                type="number"
                                min="0"
                                value={v.moq ?? ''}
                                onChange={(e) =>
                                  updateVariant(v.id, {
                                    moq:
                                      e.target.value === ''
                                        ? null
                                        : Number(e.target.value),
                                  })
                                }
                                placeholder="—"
                                className={tinyInputClass}
                              />
                            </div>
                            <div>
                              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                Capacité
                              </span>
                              <input
                                type="text"
                                value={v.capacity ?? ''}
                                onChange={(e) =>
                                  updateVariant(v.id, { capacity: e.target.value })
                                }
                                placeholder="500ml"
                                className={tinyInputClass}
                              />
                            </div>
                            <div>
                              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                Poids (kg)
                              </span>
                              <input
                                type="number"
                                step="0.001"
                                min="0"
                                value={v.weight ?? ''}
                                onChange={(e) =>
                                  updateVariant(v.id, {
                                    weight:
                                      e.target.value === ''
                                        ? null
                                        : Number(e.target.value),
                                  })
                                }
                                placeholder="—"
                                className={tinyInputClass}
                              />
                            </div>
                            <div>
                              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                Volume (m³)
                              </span>
                              <input
                                type="number"
                                step="0.0001"
                                min="0"
                                value={v.volume ?? ''}
                                onChange={(e) =>
                                  updateVariant(v.id, {
                                    volume:
                                      e.target.value === ''
                                        ? null
                                        : Number(e.target.value),
                                  })
                                }
                                placeholder="—"
                                className={tinyInputClass}
                              />
                            </div>
                            <div>
                              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                Dimensions
                              </span>
                              <input
                                type="text"
                                value={v.dimensions ?? ''}
                                onChange={(e) =>
                                  updateVariant(v.id, { dimensions: e.target.value })
                                }
                                placeholder="30x20x15 cm"
                                className={tinyInputClass}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {error && (
                  <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    {error}
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={submitting}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
                >
                  Annuler
                </button>
                <motion.button
                  type="submit"
                  disabled={submitting || uploading || extrasUploading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {isEdit ? 'Enregistrement…' : 'Création…'}
                    </>
                  ) : isEdit ? (
                    <>
                      <Save className="h-4 w-4" />
                      Enregistrer
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Ajouter le produit
                    </>
                  )}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
