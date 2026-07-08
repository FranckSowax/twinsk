'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import QRCode from 'qrcode';
import { Loader2, Printer } from 'lucide-react';

interface LabelOrder {
  id: string;
  offer_id: string;
  offer_title: string | null;
  client_name: string;
  client_phone: string;
  client_email: string | null;
  transport_mode: string | null;
  grand_total_fcfa: number | null;
  items_total_fcfa: number | null;
  order_status: string;
}

const TYPE_LABEL: Record<string, string> = {
  air: 'FRET AÉRIEN',
  sea: 'FRET MARITIME',
  quote: 'DEVIS',
};

function fmt(n: number | null) {
  return n != null ? `${Math.round(n).toLocaleString('fr-FR')} FCFA` : '—';
}

export default function EtiquettePage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params?.orderId;
  const [order, setOrder] = useState<LabelOrder | null>(null);
  const [qr, setQr] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;
    (async () => {
      try {
        const res = await fetch(`/api/admin/orders/${orderId}`);
        const data = await res.json();
        if (!res.ok) return;
        const o = data.order as LabelOrder;
        setOrder(o);
        const type = o.transport_mode ? TYPE_LABEL[o.transport_mode] || o.transport_mode : 'NON DÉFINI';
        const payload = [
          'TWINSK',
          `Commande #${o.id.slice(0, 8)}`,
          `Client: ${o.client_name}`,
          `Tel: ${o.client_phone}`,
          `Envoi: ${type}`,
          `Total: ${fmt(o.grand_total_fcfa ?? o.items_total_fcfa)}`,
          o.offer_title ? `Offre: ${o.offer_title}` : '',
        ]
          .filter(Boolean)
          .join('\n');
        const dataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 320, errorCorrectionLevel: 'M' });
        setQr(dataUrl);
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!order) {
    return <div className="p-8 text-center text-slate-500">Commande introuvable.</div>;
  }

  const type = order.transport_mode ? TYPE_LABEL[order.transport_mode] || order.transport_mode : 'NON DÉFINI';

  return (
    <div className="mx-auto max-w-md p-4 sm:p-6">
      {/* Barre d'actions — masquée à l'impression */}
      <div className="mb-4 flex items-center justify-between print:hidden">
        <p className="text-sm text-slate-500">Étiquette d’envoi</p>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25"
        >
          <Printer className="h-4 w-4" /> Imprimer
        </button>
      </div>

      {/* Étiquette */}
      <div className="label-print rounded-3xl border-2 border-slate-900 bg-white p-6 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-500">TWINSK</p>

        {/* Type d'envoi — EN GROS ET GRAS */}
        <p className="mt-3 font-display text-4xl font-black uppercase leading-none text-slate-900 sm:text-5xl">
          {type}
        </p>

        <div className="my-5 h-px bg-slate-900/15" />

        {/* Nom + numéro du client */}
        <p className="text-2xl font-extrabold text-slate-900">{order.client_name || '—'}</p>
        <p className="mt-1 text-xl font-bold tracking-wide text-slate-800">{order.client_phone || '—'}</p>

        {/* QR code */}
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="QR commande" className="mx-auto mt-6 h-48 w-48" />
        )}

        <p className="mt-3 text-xs text-slate-500">
          Commande #{order.id.slice(0, 8)} · {fmt(order.grand_total_fcfa ?? order.items_total_fcfa)}
        </p>
        {order.offer_title && (
          <p className="mt-0.5 text-xs text-slate-400">{order.offer_title}</p>
        )}
      </div>

      <style jsx global>{`
        @media print {
          body {
            background: #fff;
          }
          .label-print {
            border-width: 2px;
          }
          @page {
            margin: 12mm;
          }
        }
      `}</style>
    </div>
  );
}
