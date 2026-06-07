'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, MapPin, Mail, Phone, User, X, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DESTINATION_LIST, DEFAULT_DESTINATION, DESTINATIONS, type DestinationCode } from '@/lib/destinations';

function isKnownDestination(value: string): value is DestinationCode {
  return value in DESTINATIONS;
}

interface ClientInfo {
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  destination: string | null;
  notes: string | null;
}

interface EditClientInfoModalProps {
  open: boolean;
  requestId: string;
  current: ClientInfo;
  onClose: () => void;
  onSaved: (next: ClientInfo) => void;
}

export default function EditClientInfoModal({
  open,
  requestId,
  current,
  onClose,
  onSaved,
}: EditClientInfoModalProps) {
  const [name, setName] = useState(current.client_name || '');
  const [email, setEmail] = useState(current.client_email || '');
  const [phone, setPhone] = useState(current.client_phone || '');
  const [destination, setDestination] = useState(current.destination || '');
  const [notes, setNotes] = useState(current.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setName(current.client_name || '');
      setEmail(current.client_email || '');
      setPhone(current.client_phone || '');
      setDestination(current.destination || '');
      setNotes(current.notes || '');
      setError('');
    }
  }, [open, current]);

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      const payload = {
        client_name: name.trim() || null,
        client_email: email.trim() || null,
        client_phone: phone.trim() || null,
        destination: destination.trim() || null,
        notes: notes.trim() || null,
      };
      const res = await fetch(`/api/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur sauvegarde');
      }
      onSaved(payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
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
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Informations client
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Modifiez les coordonnées et la destination de livraison.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <Field icon={<User className="h-4 w-4" />} label="Nom du client">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Acme SARL"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                />
              </Field>

              <Field icon={<Mail className="h-4 w-4" />} label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@acme.ga"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                />
              </Field>

              <Field icon={<Phone className="h-4 w-4" />} label="Téléphone / WhatsApp">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+241 00 00 00 00"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                />
              </Field>

              <Field icon={<MapPin className="h-4 w-4 text-emerald-500" />} label="Destination de livraison">
                <select
                  value={isKnownDestination(destination) ? destination : (destination ? '__legacy__' : DEFAULT_DESTINATION)}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '__legacy__') return; // ne pas reecrire la valeur legacy
                    setDestination(v);
                  }}
                  className="w-full rounded-xl border border-emerald-200 bg-emerald-50/30 px-3 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 dark:border-emerald-800 dark:bg-emerald-900/10 dark:text-slate-200"
                >
                  {DESTINATION_LIST.map((d) => (
                    <option key={d.code} value={d.code}>{d.label}</option>
                  ))}
                  {destination && !isKnownDestination(destination) && (
                    <option value="__legacy__">{destination} (à mettre à jour)</option>
                  )}
                </select>
                <p className="mt-1 text-[10px] text-slate-400">
                  Tarifs transport appliqués automatiquement selon le pays choisi.
                </p>
              </Field>

              <Field icon={<FileText className="h-4 w-4" />} label="Notes internes">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Notes admin (visible uniquement en interne)…"
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                />
              </Field>

              {error && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
              >
                Annuler
              </button>
              <motion.button
                type="button"
                onClick={handleSave}
                disabled={saving}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-amber-500/25 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Enregistrer
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
        <span className="text-slate-400">{icon}</span>
        {label}
      </label>
      {children}
    </div>
  );
}
