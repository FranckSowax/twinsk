'use client';

import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  User,
  Mail,
  Phone,
  Package,
  Ruler,
  Plane,
  Ship,
  Loader2,
  Upload,
  X,
  CheckCircle,
  MapPin,
  FileText,
} from 'lucide-react';
import Image from 'next/image';

export interface FreightInitialData {
  client_name: string;
  client_email: string;
  client_phone: string;
  mode: 'sea' | 'air';
  sea_service: 'lcl' | 'fcl20' | 'fcl40' | null;
  origin: string;
  destination: string;
  weight: number;
  volume: number;
  goods_nature: string;
  goods_description: string;
  photos: string[];
  estimated_price: number;
  estimated_days: number;
  status: string;
}

interface Props {
  freightId: string;
  initialData: FreightInitialData;
}

export default function FreightForm({ freightId, initialData }: Props) {
  const [clientName, setClientName] = useState(initialData.client_name);
  const [clientEmail, setClientEmail] = useState(initialData.client_email);
  const [clientPhone, setClientPhone] = useState(initialData.client_phone);
  const [mode, setMode] = useState<'sea' | 'air'>(initialData.mode);
  const [seaService, setSeaService] = useState<'lcl' | 'fcl20' | 'fcl40'>(
    initialData.sea_service ?? 'lcl',
  );
  const [destination, setDestination] = useState(initialData.destination);
  const [weight, setWeight] = useState(String(initialData.weight || ''));
  const [volume, setVolume] = useState(String(initialData.volume || ''));
  const [goodsNature, setGoodsNature] = useState(initialData.goods_nature);
  const [goodsDescription, setGoodsDescription] = useState(initialData.goods_description);
  const [photos, setPhotos] = useState<string[]>(initialData.photos);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(initialData.status === 'submitted');
  const [error, setError] = useState('');

  const onDrop = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload échoué');
      setPhotos((prev) => [...prev, ...(data.urls as string[])]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur upload');
    } finally {
      setUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!clientName.trim()) return setError('Veuillez entrer votre nom');
    if (!clientEmail.trim() && !clientPhone.trim())
      return setError('Email ou téléphone requis');
    if (!goodsNature.trim()) return setError('Veuillez préciser la nature de la marchandise');
    if (!destination.trim()) return setError('Veuillez préciser la destination');

    setSubmitting(true);
    try {
      const res = await fetch(`/api/freight-requests/${freightId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: clientName.trim(),
          client_email: clientEmail.trim(),
          client_phone: clientPhone.trim(),
          mode,
          sea_service: mode === 'sea' ? seaService : null,
          destination: destination.trim(),
          weight: parseFloat(weight) || 0,
          volume: parseFloat(volume) || 0,
          goods_nature: goodsNature.trim(),
          goods_description: goodsDescription.trim(),
          photos,
          status: 'submitted',
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Erreur');
      }
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 sm:p-10 text-center"
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500">
          <CheckCircle className="h-8 w-8 text-white" />
        </div>
        <h2 className="font-display text-2xl font-bold text-emerald-900 uppercase tracking-tight">
          Demande envoyée
        </h2>
        <p className="mt-3 text-emerald-800/80 max-w-md mx-auto">
          Notre équipe à Hong Kong étudie votre dossier et reviendra vers vous sous 48 h
          avec un devis détaillé.
        </p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card title="Type de fret" kicker="01">
        <div className="grid grid-cols-2 gap-3">
          <ModeButton
            active={mode === 'sea'}
            onClick={() => setMode('sea')}
            icon={Ship}
            label="Maritime"
          />
          <ModeButton
            active={mode === 'air'}
            onClick={() => setMode('air')}
            icon={Plane}
            label="Aérien"
          />
        </div>
        {mode === 'sea' && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(['lcl', 'fcl20', 'fcl40'] as const).map((id) => (
              <button
                type="button"
                key={id}
                onClick={() => setSeaService(id)}
                className={`rounded-xl px-3 py-2.5 text-xs font-medium transition-colors ${
                  seaService === id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {id === 'lcl' ? 'LCL · groupage' : id === 'fcl20' ? "FCL · 20'" : "FCL · 40'"}
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card title="Itinéraire" kicker="02">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field icon={MapPin} label="Origine">
            <input
              type="text"
              value={initialData.origin || 'Chine'}
              disabled
              className="bg-transparent text-sm text-slate-700 font-medium w-full focus:outline-none"
            />
          </Field>
          <Field icon={MapPin} label="Destination *">
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Ville / pays"
              className="bg-transparent text-sm text-slate-900 font-medium w-full focus:outline-none placeholder:text-slate-400"
              required
            />
          </Field>
        </div>
      </Card>

      <Card title="Marchandise" kicker="03">
        <div className="space-y-3">
          <Field icon={FileText} label="Nature *">
            <input
              type="text"
              value={goodsNature}
              onChange={(e) => setGoodsNature(e.target.value)}
              placeholder="Ex : Vêtements, électronique, mobilier…"
              className="bg-transparent text-sm text-slate-900 font-medium w-full focus:outline-none placeholder:text-slate-400"
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field icon={Package} label="Poids · kg">
              <input
                type="number"
                min={0}
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="bg-transparent text-sm text-slate-900 font-medium w-full focus:outline-none tabular-nums"
              />
            </Field>
            <Field icon={Ruler} label="Volume · m³">
              <input
                type="number"
                min={0}
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                className="bg-transparent text-sm text-slate-900 font-medium w-full focus:outline-none tabular-nums"
              />
            </Field>
          </div>
          <textarea
            value={goodsDescription}
            onChange={(e) => setGoodsDescription(e.target.value)}
            rows={3}
            placeholder="Description complémentaire (emballage, fragilité, valeur déclarée…)"
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
          />
        </div>
      </Card>

      <Card title="Photos (optionnel)" kicker="04">
        <div
          {...getRootProps()}
          className={`rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-amber-400 bg-amber-50'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              Upload en cours…
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-500">
              <Upload className="w-6 h-6" />
              <p className="text-sm">Déposez des photos ici ou cliquez pour choisir</p>
            </div>
          )}
        </div>

        {photos.length > 0 && (
          <div className="mt-4 grid grid-cols-3 sm:grid-cols-5 gap-2">
            {photos.map((url, i) => (
              <div
                key={url + i}
                className="relative aspect-square rounded-xl overflow-hidden bg-slate-100"
              >
                <Image
                  src={url}
                  alt={`Photo ${i + 1}`}
                  fill
                  sizes="200px"
                  className="object-cover"
                  unoptimized
                />
                <button
                  type="button"
                  onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center shadow-md text-slate-700 hover:bg-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Vos coordonnées" kicker="05">
        <div className="space-y-3">
          <Field icon={User} label="Nom *">
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nom complet ou société"
              className="bg-transparent text-sm text-slate-900 font-medium w-full focus:outline-none placeholder:text-slate-400"
              required
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field icon={Mail} label="Email">
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="vous@exemple.com"
                className="bg-transparent text-sm text-slate-900 font-medium w-full focus:outline-none placeholder:text-slate-400"
              />
            </Field>
            <Field icon={Phone} label="WhatsApp">
              <input
                type="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="+241 06 00 00 00"
                className="bg-transparent text-sm text-slate-900 font-medium w-full focus:outline-none placeholder:text-slate-400"
              />
            </Field>
          </div>
        </div>
      </Card>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <AnimatePresence>
        <motion.button
          type="submit"
          whileHover={{ scale: 1.005 }}
          whileTap={{ scale: 0.995 }}
          disabled={submitting || uploading}
          className="w-full flex items-center justify-between gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5 text-base font-semibold text-white shadow-xl shadow-amber-500/25 disabled:opacity-60 group"
        >
          <span>
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Envoi…
              </>
            ) : (
              'Envoyer ma demande de fret'
            )}
          </span>
          <Send className="w-5 h-5 transition-transform group-hover:translate-x-1" />
        </motion.button>
      </AnimatePresence>

      <p className="text-center text-xs text-slate-500">
        Devis personnalisé sous 48 h — équipe Twinsk Hong Kong.
      </p>
    </form>
  );
}

const Card = ({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker: string;
  children: React.ReactNode;
}) => (
  <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
    <div className="flex items-center gap-3 mb-4">
      <span className="text-xs font-mono text-amber-600 tabular-nums uppercase tracking-wider">
        {kicker}
      </span>
      <span className="text-xs text-slate-300">/</span>
      <h3 className="font-display text-base uppercase tracking-tight text-slate-900">
        {title}
      </h3>
    </div>
    {children}
  </section>
);

const Field = ({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) => (
  <div className="bg-slate-50 rounded-xl flex items-center gap-3 px-4 py-3 border border-slate-100 focus-within:border-amber-400 transition-colors">
    <div className="w-9 h-9 rounded-lg bg-white text-amber-600 border border-amber-100 flex items-center justify-center flex-shrink-0">
      <Icon className="w-4 h-4" />
    </div>
    <div className="flex-1 min-w-0">
      <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
        {label}
      </label>
      {children}
    </div>
  </div>
);

const ModeButton = ({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-sm font-medium border transition-all ${
      active
        ? 'bg-slate-900 text-white border-slate-900'
        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
    }`}
  >
    <Icon className="w-4 h-4" /> {label}
  </button>
);
