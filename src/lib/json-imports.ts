import { supabaseAdmin } from '@/lib/supabase/server';

// Enregistre une copie du JSON importé (bulk-load) pour réutilisation ultérieure.
// Best-effort : n'échoue jamais l'import.
export async function saveJsonImport(args: {
  target_type: 'offer' | 'request';
  target_id: string;
  payload: unknown;
  label?: string | null;
  product_count?: number | null;
}): Promise<void> {
  try {
    await supabaseAdmin.from('json_imports').insert({
      target_type: args.target_type,
      target_id: args.target_id,
      payload: args.payload,
      label: args.label ?? null,
      product_count: args.product_count ?? null,
    });
  } catch {
    // ne bloque jamais l'import
  }
}
