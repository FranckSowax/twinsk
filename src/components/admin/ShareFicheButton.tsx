'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import QRCode from 'qrcode';
import { Share2, X, Copy, Check, MessageCircle, Loader2 } from 'lucide-react';

// Message d'accompagnement (bilingue FR/中文) pour le vendeur.
const MSG = '请填写产品的重量、体积、纸箱尺寸、运费和交货时间。Merci de remplir le poids, volume, dimensions du carton, frais et délai :';

export default function ShareFicheButton({ id, compact = false }: { id: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState('');
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const url = `${window.location.origin}/fiche/${id}`;
    setLink(url);
    QRCode.toDataURL(url, { margin: 1, width: 240 }).then(setQr).catch(() => {});
  }, [open, id]);

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const waHref = `https://wa.me/?text=${encodeURIComponent(`${MSG} ${link}`)}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Partager la fiche au vendeur (WeChat / WhatsApp)"
        className={`flex items-center gap-1.5 rounded-lg font-semibold text-white ${compact ? 'bg-emerald-500 px-2.5 py-1 text-[11px] hover:bg-emerald-600' : 'bg-emerald-500 px-3 py-2 text-sm hover:bg-emerald-600'}`}
      >
        <Share2 className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} /> Partager la fiche
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-t-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 sm:rounded-3xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold text-slate-900 dark:text-white">
                  <Share2 className="h-5 w-5 text-emerald-500" /> Partager la fiche
                </h2>
                <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="mb-3 text-xs text-slate-500">
                Envoyez ce lien au vendeur pour qu’il remplisse poids, volume, dimensions, frais et délai.
              </p>

              {/* Lien + copier */}
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800">
                <span className="min-w-0 flex-1 truncate text-xs text-slate-600 dark:text-slate-300">{link || '…'}</span>
                <button onClick={copy} className="flex flex-shrink-0 items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white dark:bg-slate-700">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copié' : 'Copier'}
                </button>
              </div>

              {/* WhatsApp */}
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white hover:brightness-95"
              >
                <MessageCircle className="h-4 w-4" /> Partager sur WhatsApp
              </a>

              {/* WeChat : QR à scanner */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center dark:border-slate-700 dark:bg-slate-800">
                <p className="mb-2 text-sm font-semibold text-[#07C160]">微信 · WeChat — 扫码打开 (scanner pour ouvrir)</p>
                {qr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qr} alt="QR WeChat" className="mx-auto h-44 w-44" />
                ) : (
                  <div className="flex h-44 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
                )}
                <p className="mt-2 text-[11px] text-slate-400">用微信扫一扫，转发给供应商 · Scannez avec WeChat puis transférez au vendeur</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
