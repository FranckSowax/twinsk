'use client';

import { useState } from 'react';
import { Loader2, CheckCircle2, Send } from 'lucide-react';

interface Initial {
  weight: number | null;
  volume: number | null;
  dimensions: string | null;
  has_battery: boolean | null;
  supplier_shipping_price: number | null;
  delivery_time: string | null;
  collab_notes: string | null;
}

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-800 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400';

export default function FicheForm({ id, initial }: { id: string; initial: Initial }) {
  const [weight, setWeight] = useState(initial.weight != null ? String(initial.weight) : '');
  const [volume, setVolume] = useState(initial.volume != null ? String(initial.volume) : '');
  const [dimensions, setDimensions] = useState(initial.dimensions || '');
  const [battery, setBattery] = useState(!!initial.has_battery);
  const [shipping, setShipping] = useState(initial.supplier_shipping_price != null ? String(initial.supplier_shipping_price) : '');
  const [delivery, setDelivery] = useState(initial.delivery_time || '');
  const [notes, setNotes] = useState(initial.collab_notes || '');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/fiche/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weight,
          volume,
          dimensions,
          has_battery: battery,
          supplier_shipping_price: shipping,
          delivery_time: delivery,
          collab_notes: notes,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || '提交失败 · Échec');
        return;
      }
      setDone(true);
    } catch {
      setError('网络错误 · Erreur réseau');
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="mt-4 flex flex-col items-center gap-2 rounded-3xl bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="h-12 w-12 text-emerald-500" />
        <p className="font-display text-lg font-bold text-slate-900">已提交，谢谢！</p>
        <p className="text-sm text-slate-500">Informations envoyées, merci !</p>
        <button onClick={() => setDone(false)} className="mt-2 text-xs font-semibold text-emerald-600 hover:underline">
          修改 · Modifier
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4 rounded-3xl bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-slate-900">请填写 · À compléter</p>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-slate-700">单件重量 (公斤) · Poids/pièce (kg)</span>
        <input type="number" inputMode="decimal" step="any" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0.0" className={inputCls} />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-slate-700">纸箱尺寸 (长×宽×高 cm) · Dimensions carton</span>
        <input type="text" value={dimensions} onChange={(e) => setDimensions(e.target.value)} placeholder="例如 / ex: 60×40×85" className={inputCls} />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-slate-700">单件体积 (立方米) · Volume/pièce (m³)</span>
        <input type="number" inputMode="decimal" step="any" value={volume} onChange={(e) => setVolume(e.target.value)} placeholder="0.00" className={inputCls} />
        <span className="mt-1 block text-[11px] text-slate-400">如不知道，请填纸箱尺寸即可 · Si inconnu, remplissez les dimensions du carton</span>
      </label>

      <label className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5">
        <input type="checkbox" checked={battery} onChange={(e) => setBattery(e.target.checked)} className="h-5 w-5 rounded" />
        <span className="text-sm font-semibold text-amber-800">含电池 · Contient une batterie</span>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-slate-700">运费 (到仓库, 人民币) · Frais de livraison → entrepôt (CNY)</span>
        <input type="number" inputMode="decimal" step="any" value={shipping} onChange={(e) => setShipping(e.target.value)} placeholder="¥" className={inputCls} />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-slate-700">交货时间 · Délai de livraison</span>
        <input type="text" value={delivery} onChange={(e) => setDelivery(e.target.value)} placeholder="例如 / ex: 3-5 天 / jours" className={inputCls} />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-slate-700">备注 · Remarques</span>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
      </label>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <button
        onClick={submit}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 px-5 py-3.5 text-base font-bold text-white shadow-lg shadow-emerald-500/25 disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        提交 · Envoyer
      </button>
    </div>
  );
}
