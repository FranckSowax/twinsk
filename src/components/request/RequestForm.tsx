'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, User, Mail, Phone, FileText } from 'lucide-react';
import ImageUploader from './ImageUploader';
import SubmitConfirmation from './SubmitConfirmation';

interface UploadedImage {
  url: string;
  file: File;
  description: string;
}

interface RequestFormProps {
  requestId: string;
  initialData?: {
    client_name: string;
    client_email: string;
    client_phone: string;
    notes: string | null;
    status: string;
  };
}

export default function RequestForm({ requestId, initialData }: RequestFormProps) {
  const [clientName, setClientName] = useState(initialData?.client_name || '');
  const [clientEmail, setClientEmail] = useState(initialData?.client_email || '');
  const [clientPhone, setClientPhone] = useState(initialData?.client_phone || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(initialData?.status === 'submitted');
  const [error, setError] = useState('');

  if (submitted) {
    return <SubmitConfirmation />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!clientName.trim()) {
      setError('Veuillez entrer votre nom');
      return;
    }

    if (!images.length) {
      setError('Veuillez ajouter au moins une image');
      return;
    }

    setSubmitting(true);

    try {
      // Update request info
      const updateRes = await fetch(`/api/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: clientName,
          client_email: clientEmail,
          client_phone: clientPhone,
          notes: notes || null,
        }),
      });

      if (!updateRes.ok) throw new Error('Erreur mise à jour');

      // Submit items
      const itemsRes = await fetch(`/api/requests/${requestId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: images.map((img) => ({
            image_url: img.url,
            description: img.description || null,
          })),
        }),
      });

      if (!itemsRes.ok) throw new Error('Erreur envoi articles');

      setSubmitted(true);
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500 transition-colors';

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Client info */}
      <div className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
          Vos informations
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
              <User className="h-4 w-4" /> Nom complet *
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Jean Dupont"
              required
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
              <Mail className="h-4 w-4" /> Email
            </label>
            <input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="jean@exemple.com"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
              <Phone className="h-4 w-4" /> Téléphone
            </label>
            <input
              type="tel"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="+33 6 12 34 56 78"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
              <FileText className="h-4 w-4" /> Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Précisions sur votre demande..."
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Images */}
      <div className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
          Vos produits recherchés
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Ajoutez les photos des produits que vous souhaitez sourcer. Vous pouvez en envoyer plusieurs à la fois.
        </p>
        <ImageUploader images={images} onImagesChange={setImages} />
      </div>

      {/* Error */}
      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400"
        >
          {error}
        </motion.p>
      )}

      {/* Submit */}
      <motion.button
        type="submit"
        disabled={submitting}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 text-lg font-semibold text-white shadow-lg shadow-amber-500/25 transition-opacity hover:shadow-xl disabled:opacity-60"
      >
        {submitting ? (
          <>
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Envoi en cours...
          </>
        ) : (
          <>
            <Send className="h-5 w-5" />
            Envoyer ma demande
          </>
        )}
      </motion.button>
    </form>
  );
}
