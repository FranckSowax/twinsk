'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, Loader2, Save, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface EditRequestItemModalProps {
  open: boolean;
  requestId: string;
  item: {
    id: string;
    image_url: string | null;
    description: string | null;
  } | null;
  basePath?: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditRequestItemModal({
  open,
  requestId,
  item,
  basePath = '/api/requests',
  onClose,
  onSaved,
}: EditRequestItemModalProps) {
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (item) {
      setDescription(item.description || '');
      setImageUrl(item.image_url);
      setError('');
    }
  }, [item]);

  const handleClose = () => {
    if (saving || uploading) return;
    setError('');
    onClose();
  };

  const handleFile = async (file: File) => {
    setError('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('files', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || !data.urls?.[0]) {
        throw new Error(data.error || 'Erreur upload');
      }
      setImageUrl(data.urls[0] as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur upload');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!item) return;
    setError('');

    const trimmedDesc = description.trim();
    if (!imageUrl && !trimmedDesc) {
      setError('Un article doit avoir au moins une image ou une description');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${basePath}/${requestId}/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          description: trimmedDesc || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur');
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && item && (
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
            className="my-8 w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-800"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Modifier l&apos;article
              </h2>
              <button
                type="button"
                onClick={handleClose}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 px-6 py-5">
              {/* Image */}
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Image
                </label>
                {imageUrl ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt="Aperçu"
                      className="h-48 w-full rounded-xl border border-slate-200 object-cover dark:border-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => setImageUrl(null)}
                      disabled={uploading || saving}
                      className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600 disabled:opacity-60"
                      title="Retirer l'image"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || saving}
                    className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-600 dark:border-slate-600 dark:bg-slate-700/40"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="text-sm">Envoi en cours…</span>
                      </>
                    ) : (
                      <>
                        <ImageIcon className="h-6 w-6" />
                        <span className="text-sm font-medium">Cliquer pour téléverser</span>
                      </>
                    )}
                  </button>
                )}
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || saving}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-700"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {uploading ? 'Envoi…' : 'Remplacer'}
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                    e.target.value = '';
                  }}
                />
              </div>

              {/* Description */}
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Décrivez le produit…"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
              </div>

              {error && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
              <button
                type="button"
                onClick={handleClose}
                disabled={saving || uploading}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
              >
                Annuler
              </button>
              <motion.button
                type="button"
                onClick={handleSave}
                disabled={saving || uploading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-amber-500/25 disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Enregistrement…
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" /> Enregistrer
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
