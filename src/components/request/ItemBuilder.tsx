'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  X,
  Loader2,
  Plus,
  Camera,
  FileText,
  ClipboardList,
  ImagePlus,
} from 'lucide-react';

export interface RequestBuildItem {
  id: string;
  type: 'image' | 'text';
  url?: string;
  description: string;
}

interface ItemBuilderProps {
  items: RequestBuildItem[];
  onChange: (items: RequestBuildItem[]) => void;
}

let idCounter = 0;
const newId = () => `item-${Date.now()}-${++idCounter}`;

/** Detect if pasted text looks like a product list (multiple lines with product-like content) */
function parseProductList(text: string): string[] | null {
  if (!text || text.length < 5) return null;
  // Split by newlines, bullet points, numbered list items, semicolons
  const lines = text
    .split(/[\n;]|(?:\d+[.)]\s)/)
    .map((l) => l.replace(/^[-•*–—]\s*/, '').trim())
    .filter((l) => l.length >= 3);
  // Consider it a list if we have 2+ items
  return lines.length >= 2 ? lines : null;
}

export default function ItemBuilder({ items, onChange }: ItemBuilderProps) {
  const [uploading, setUploading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [showListInput, setShowListInput] = useState(false);
  const [listText, setListText] = useState('');
  const [listPreview, setListPreview] = useState<string[] | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;

      setUploading(true);
      setProgressMsg(`Upload de ${files.length} image(s)...`);

      try {
        const formData = new FormData();
        files.forEach((file) => formData.append('files', file));

        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Erreur upload');

        const newItems: RequestBuildItem[] = data.urls.map((url: string) => ({
          id: newId(),
          type: 'image' as const,
          url,
          description: '',
        }));

        onChange([...items, ...newItems]);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erreur lors de l'upload");
      } finally {
        setUploading(false);
        setProgressMsg('');
      }
    },
    [items, onChange]
  );

  // Dropzone (drag & drop + paste images)
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: uploadFiles,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.gif'] },
    maxSize: 10 * 1024 * 1024,
    disabled: uploading,
    noClick: true,
    noKeyboard: true,
  });

  // Paste handler: images → upload, text list → detect & propose
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (uploading) return;
      const clipItems = e.clipboardData?.items;
      if (!clipItems) return;

      // Check for images first
      const files: File[] = [];
      let pastedText = '';
      for (const ci of Array.from(clipItems)) {
        if (ci.type.startsWith('image/')) {
          const file = ci.getAsFile();
          if (file) files.push(file);
        } else if (ci.type === 'text/plain') {
          pastedText = e.clipboardData?.getData('text/plain') || '';
        }
      }

      if (files.length) {
        e.preventDefault();
        uploadFiles(files);
        return;
      }

      // Check for product list in text
      if (pastedText) {
        const parsed = parseProductList(pastedText);
        if (parsed && parsed.length >= 2) {
          e.preventDefault();
          setListText(pastedText);
          setListPreview(parsed);
          setShowListInput(true);
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [uploadFiles, uploading]);

  const handleFilePickerClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files) uploadFiles(Array.from(target.files));
    };
    input.click();
  };

  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) uploadFiles(Array.from(e.target.files));
  };

  const addTextItem = () => {
    onChange([...items, { id: newId(), type: 'text', description: '' }]);
  };

  const updateDescription = (id: string, description: string) => {
    onChange(items.map((it) => (it.id === id ? { ...it, description } : it)));
  };

  const removeItem = (id: string) => {
    onChange(items.filter((it) => it.id !== id));
  };

  // List import: parse text and create one item per line
  const handleListTextChange = (text: string) => {
    setListText(text);
    setListPreview(parseProductList(text));
  };

  const handleImportList = () => {
    if (!listPreview?.length) return;
    const newItems: RequestBuildItem[] = listPreview.map((line) => ({
      id: newId(),
      type: 'text' as const,
      description: line,
    }));
    onChange([...items, ...newItems]);
    setShowListInput(false);
    setListText('');
    setListPreview(null);
  };

  return (
    <div className="space-y-5">
      {/* Hidden camera input */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraChange}
      />

      {/* Main add button + secondary actions */}
      <div className="space-y-3">
        {/* Big primary button */}
        <motion.button
          type="button"
          onClick={addTextItem}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-amber-500/25"
        >
          <Plus className="h-5 w-5" />
          Ajouter un produit
        </motion.button>

        {/* Secondary row: photos, camera, paste list */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={handleFilePickerClick}
            disabled={uploading}
            className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 transition-all hover:border-amber-400 hover:bg-amber-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          >
            <ImagePlus className="h-4 w-4" />
            <span className="hidden sm:inline">Ajouter</span> photos
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 transition-all hover:border-amber-400 hover:bg-amber-50 disabled:opacity-50 sm:hidden dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          >
            <Camera className="h-4 w-4" />
            Caméra
          </button>
          <button
            type="button"
            onClick={() => setShowListInput(!showListInput)}
            className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 transition-all hover:border-purple-400 hover:bg-purple-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          >
            <ClipboardList className="h-4 w-4" />
            Coller une liste
          </button>
        </div>
      </div>

      {/* List import panel */}
      <AnimatePresence>
        {showListInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-2xl border border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-900/10"
          >
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  <ClipboardList className="h-3.5 w-3.5" />
                  Importer une liste de produits
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowListInput(false);
                    setListText('');
                    setListPreview(null);
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <textarea
                value={listText}
                onChange={(e) => handleListTextChange(e.target.value)}
                placeholder={`Collez ou tapez votre liste ici (un produit par ligne) :\n\n- 100 sacs en cuir noir\n- 50 portefeuilles marron\n- 200 ceintures taille M`}
                rows={5}
                className="w-full resize-none rounded-xl border border-purple-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
              />

              {/* Preview */}
              {listPreview && listPreview.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-purple-600 dark:text-purple-400">
                    {listPreview.length} produit(s) détecté(s) :
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {listPreview.map((line, i) => (
                      <span
                        key={i}
                        className="inline-flex rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                      >
                        {line.length > 40 ? line.slice(0, 40) + '…' : line}
                      </span>
                    ))}
                  </div>
                  <motion.button
                    type="button"
                    onClick={handleImportList}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/25"
                  >
                    <Plus className="h-4 w-4" />
                    Importer {listPreview.length} produit(s)
                  </motion.button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drop zone (drag & drop + paste images) */}
      <div
        {...getRootProps()}
        className={`relative rounded-2xl border-2 border-dashed p-5 text-center transition-all ${
          isDragActive
            ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10'
            : 'border-slate-300 dark:border-slate-600'
        } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-1.5">
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          ) : (
            <Upload className="h-6 w-6 text-slate-400" />
          )}
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {uploading
              ? progressMsg
              : isDragActive
                ? 'Déposez vos images ici'
                : 'Glissez-déposez ou collez (Cmd+V) vos images ici'}
          </p>
        </div>
      </div>

      {/* Items list */}
      <AnimatePresence mode="popLayout">
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:gap-4 sm:p-4 dark:border-slate-700 dark:bg-slate-800"
          >
            {/* Thumbnail or text icon */}
            <div className="relative h-20 w-20 flex-shrink-0 sm:h-24 sm:w-24">
              {item.type === 'image' && item.url ? (
                <div className="h-full w-full overflow-hidden rounded-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.url} alt={`Article ${index + 1}`} className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30">
                  <FileText className="h-8 w-8 text-purple-500" />
                </div>
              )}

              <span className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow">
                {index + 1}
              </span>

              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-md hover:bg-red-600"
                aria-label="Supprimer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Description */}
            <div className="flex-1 min-w-0">
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                {item.type === 'image' ? 'Description (optionnelle)' : 'Description du produit *'}
              </label>
              <textarea
                value={item.description}
                onChange={(e) => updateDescription(item.id, e.target.value)}
                placeholder={
                  item.type === 'image'
                    ? 'Ex: Quantité souhaitée, taille, couleur...'
                    : 'Ex: 100 pcs de stylos bleus avec logo personnalisé...'
                }
                rows={item.type === 'text' ? 3 : 2}
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500"
              />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {items.length > 0 && (
        <p className="text-center text-sm text-slate-500">
          {items.length} article(s) ajouté(s)
        </p>
      )}
    </div>
  );
}
