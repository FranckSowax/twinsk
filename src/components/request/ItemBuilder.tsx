'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Loader2, ImagePlus, Type, Camera, FileText } from 'lucide-react';

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

export default function ItemBuilder({ items, onChange }: ItemBuilderProps) {
  const [uploading, setUploading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
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

  // React-dropzone for the main drop area
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: uploadFiles,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.gif'] },
    maxSize: 10 * 1024 * 1024,
    disabled: uploading,
    noClick: true, // we'll trigger via dedicated button
    noKeyboard: true,
  });

  // Paste image from clipboard support
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (uploading) return;
      const files: File[] = [];
      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;
      for (const item of Array.from(clipboardItems)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length) {
        e.preventDefault();
        uploadFiles(files);
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

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) uploadFiles(Array.from(e.target.files));
  };

  const addTextItem = () => {
    onChange([
      ...items,
      { id: newId(), type: 'text', description: '' },
    ]);
  };

  const updateDescription = (id: string, description: string) => {
    onChange(items.map((it) => (it.id === id ? { ...it, description } : it)));
  };

  const removeItem = (id: string) => {
    onChange(items.filter((it) => it.id !== id));
  };

  return (
    <div className="space-y-5">
      {/* Hidden camera input for mobile */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraChange}
      />

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <ActionButton
          icon={ImagePlus}
          label="Ajouter photos"
          onClick={handleFilePickerClick}
          disabled={uploading}
          primary
        />
        <ActionButton
          icon={Camera}
          label="Caméra"
          onClick={handleCameraClick}
          disabled={uploading}
          mobileOnly
        />
        <ActionButton
          icon={Type}
          label="Texte seul"
          onClick={addTextItem}
          disabled={uploading}
        />
      </div>

      {/* Drop zone (always visible, accepts drag & drop + paste) */}
      <div
        {...getRootProps()}
        className={`relative rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
          isDragActive
            ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10'
            : 'border-slate-300 dark:border-slate-600'
        } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          ) : (
            <Upload className="h-8 w-8 text-slate-400" />
          )}
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {uploading
              ? progressMsg
              : isDragActive
                ? 'Déposez vos images ici'
              : 'Glissez-déposez ou collez (Cmd+V) vos images'}
          </p>
          <p className="text-xs text-slate-400">JPG, PNG, WebP — max 10MB par image</p>
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

              {/* Index badge */}
              <span className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow">
                {index + 1}
              </span>

              {/* Remove button */}
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
                {item.type === 'image' ? 'Description (optionnelle)' : 'Description du produit recherché *'}
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

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  primary,
  mobileOnly,
}: {
  icon: typeof Upload;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  mobileOnly?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-all disabled:opacity-50 ${
        primary
          ? 'border-amber-500 bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25'
          : 'border-slate-200 bg-white text-slate-700 hover:border-amber-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200'
      } ${mobileOnly ? 'sm:hidden' : ''}`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </motion.button>
  );
}
