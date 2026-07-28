import { supabaseAdmin } from '@/lib/supabase/server';
import FicheForm from '@/components/fiche/FicheForm';

export const dynamic = 'force-dynamic';

interface Variant {
  name?: string;
  price?: number | null;
  moq?: number | null;
  weight?: number | null;
  volume?: number | null;
  dimensions?: string | null;
  capacity?: string | null;
}

export default async function FichePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: line } = await supabaseAdmin
    .from('collab_review_lines')
    .select(
      'id, title, title_original, offer_product_id, image_url, product_url, seller, variants, weight, volume, dimensions, has_battery, supplier_shipping_price, delivery_time, collab_notes',
    )
    .eq('id', id)
    .single();

  if (!line) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center text-slate-500">
        链接无效或已过期 · Lien invalide ou expiré
      </div>
    );
  }

  const variants = (Array.isArray(line.variants) ? line.variants : []) as Variant[];

  // Titre chinois d'origine (1688) pour le fournisseur. Fallback produit si la ligne
  // n'a pas encore la colonne renseignée (créée avant la migration 45).
  let titleZh = (line as { title_original?: string | null }).title_original || null;
  if (!titleZh && line.offer_product_id) {
    const { data: prod } = await supabaseAdmin
      .from('offer_products')
      .select('title_original')
      .eq('id', line.offer_product_id)
      .single();
    titleZh = prod?.title_original || null;
  }
  const headingZh = titleZh || line.title || '产品';
  const headingFr = titleZh && line.title && line.title !== titleZh ? line.title : null;

  return (
    <div className="min-h-screen bg-slate-100 py-6">
      <div className="mx-auto max-w-lg px-4">
        {/* En-tête produit */}
        <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
          {line.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={line.image_url} alt={line.title || ''} className="max-h-72 w-full object-contain bg-slate-50" />
          )}
          <div className="space-y-2 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">TWINSK · 产品信息表 · Fiche produit</p>
            <h1 className="font-display text-lg font-bold text-slate-900">{headingZh}</h1>
            {headingFr && <p className="text-xs text-slate-400">{headingFr}</p>}
            {line.product_url && (
              <a href={line.product_url} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-semibold text-orange-600 hover:underline">
                查看 1688 链接 →
              </a>
            )}

            {variants.length > 0 && (
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">规格 · Variantes</p>
                <div className="space-y-1">
                  {variants.map((v, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">{v.name || `规格 ${i + 1}`}</span>
                      {v.capacity && <span>容量: {v.capacity}</span>}
                      {v.weight != null && <span>重量: {v.weight} kg</span>}
                      {v.dimensions && <span>尺寸: {v.dimensions}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Formulaire à remplir par le vendeur */}
        <FicheForm
          id={line.id}
          initial={{
            weight: line.weight,
            volume: line.volume,
            dimensions: line.dimensions,
            has_battery: line.has_battery,
            supplier_shipping_price: line.supplier_shipping_price,
            delivery_time: line.delivery_time,
            collab_notes: line.collab_notes,
          }}
          variants={variants.map((v) => ({
            name: v.name || '',
            weight: v.weight ?? null,
            volume: v.volume ?? null,
            dimensions: v.dimensions ?? null,
          }))}
        />

        <p className="mt-4 text-center text-[11px] text-slate-400">
          请填写以上信息并提交 · Merci de compléter et d’envoyer
        </p>
      </div>
    </div>
  );
}
