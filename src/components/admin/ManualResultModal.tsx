'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Loader2, Plus, Image as ImageIcon } from 'lucide-react';

interface ManualResultModalProps {
  open: boolean;
  requestId: string;
  requestItemId: string;
  onClose: () => void;
  onCreated: () => void;
}

export default function ManualResultModal({
  open,
  requestId,
  requestItemId,
  onClose,
  onCreated,
}: ManualResultModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [seller, setSeller] = useState('');
  const [moq, setMoq] = useState('');
  const [weight, setWeight] = useState('');
  const [volume, setVolume] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [quantity, setQuantity] = useState('1');

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setTitle('');
    setDescription('');
    setPrice('');
    setImageUrl('');
    setProductUrl('');
    setSeller('');
    setMoq('');
    setWeight('');
    setVolume('');
    setDimensions('');
    setQuantity('1');
    setError('');
  };

  const handleClose = () => {
    if (submitting || uploading) return;
    reset();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Le titre est requis');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/manual-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_item_id: requestItemId,
          title,
          description,
          price,
          image_url: imageUrl,
          product_url: productUrl,
          seller,
          moq,
          weight,
          volume,
          dimensions,
          quantity,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur création');

      reset();
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
                  Ajouter un produit manuellement
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

                {/* Price + Quantity + Seller */}
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
                  disabled={submitting || uploading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Création...
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
