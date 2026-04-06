'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Loader2 } from 'lucide-react';

interface UploadedImage {
  url: string;
  file: File;
  description: string;
}

interface ImageUploaderProps {
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
}

export default function ImageUploader({ images, onImagesChange }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles.length) return;

    setUploading(true);
    setUploadProgress(`Upload de ${acceptedFiles.length} image(s)...`);

    try {
      const formData = new FormData();
      acceptedFiles.forEach((file) => formData.append('files', file));

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erreur upload');
      }

      const newImages: UploadedImage[] = acceptedFiles.map((file, i) => ({
        url: data.urls[i],
        file,
        description: '',
      }));

      onImagesChange([...images, ...newImages]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors de l\'upload');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  }, [images, onImagesChange]);

  const removeImage = (index: number) => {
    onImagesChange(images.filter((_, i) => i !== index));
  };

  const updateDescription = (index: number, description: string) => {
    const updated = [...images];
    updated[index] = { ...updated[index], description };
    onImagesChange(updated);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.gif'] },
    maxSize: 10 * 1024 * 1024,
    disabled: uploading,
  });

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`
          relative cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all hover:scale-[1.01] active:scale-[0.99]
          ${isDragActive
            ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10'
            : 'border-slate-300 hover:border-amber-400 dark:border-slate-600 dark:hover:border-amber-500'
          }
          ${uploading ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          {uploading ? (
            <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
          ) : (
            <Upload className="h-10 w-10 text-slate-400" />
          )}
          <div>
            <p className="text-lg font-medium text-slate-700 dark:text-slate-200">
              {isDragActive ? 'Déposez vos images ici' : 'Glissez-déposez vos images'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {uploading ? uploadProgress : 'ou cliquez pour sélectionner • JPG, PNG, WebP • Max 10MB'}
            </p>
          </div>
        </div>
      </div>

      {/* Image grid */}
      <AnimatePresence mode="popLayout">
        {images.map((img, index) => (
          <motion.div
            key={img.url}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
          >
            {/* Thumbnail */}
            <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl">
              <img
                src={img.url}
                alt={`Image ${index + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-md hover:bg-red-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Description */}
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
                Description (optionnelle)
              </label>
              <textarea
                value={img.description}
                onChange={(e) => updateDescription(index, e.target.value)}
                placeholder="Décrivez ce que vous recherchez pour cette image..."
                rows={2}
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500"
              />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {images.length > 0 && (
        <p className="text-center text-sm text-slate-500">
          {images.length} image(s) ajoutée(s)
        </p>
      )}
    </div>
  );
}
