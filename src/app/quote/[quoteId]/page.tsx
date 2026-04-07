'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import QuotePreview from '@/components/quote/QuotePreview';
import PackingListPreview from '@/components/quote/PackingListPreview';
import type { Request as RequestType, Quote } from '@/lib/types/database';

interface RawSearchResult {
  title: string;
  image_url: string;
  price: number;
  quantity: number;
  margin_percent: number;
  moq: number | null;
  weight: number | null;
  volume: number | null;
  dimensions: string | null;
}

interface QuoteItemDisplay {
  title: string;
  image_url: string;
  price: number;
  quantity: number;
  margin_percent: number;
}

interface PackingItemDisplay {
  title: string;
  image_url: string;
  moq: number | null;
  quantity: number;
  weight: number | null;
  volume: number | null;
  dimensions: string | null;
}

export default function QuotePage() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [request, setRequest] = useState<RequestType | null>(null);
  const [quoteItems, setQuoteItems] = useState<QuoteItemDisplay[]>([]);
  const [packingItems, setPackingItems] = useState<PackingItemDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/quotes/${quoteId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Devis non trouvé');
        return res.json();
      })
      .then((data) => {
        setQuote(data.quote);
        setRequest(data.request);

        const flatRaw: RawSearchResult[] = (data.items || []).flatMap(
          (item: { search_results: RawSearchResult[] }) => item.search_results
        );

        setQuoteItems(
          flatRaw.map((r) => ({
            title: r.title,
            image_url: r.image_url,
            price: r.price,
            quantity: r.quantity,
            margin_percent: r.margin_percent,
          }))
        );

        setPackingItems(
          flatRaw.map((r) => ({
            title: r.title,
            image_url: r.image_url,
            moq: r.moq,
            quantity: r.quantity,
            weight: r.weight,
            volume: r.volume,
            dimensions: r.dimensions,
          }))
        );
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [quoteId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !quote || !request) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <p className="text-slate-500">{error || 'Devis non trouvé'}</p>
      </div>
    );
  }

  const isPackingList = quote.document_type === 'packing_list';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50 px-4 py-8 print:bg-white print:p-0 sm:py-12 dark:from-slate-900 dark:to-slate-800">
      {isPackingList ? (
        <PackingListPreview quote={quote} request={request} items={packingItems} />
      ) : (
        <QuotePreview quote={quote} request={request} items={quoteItems} />
      )}
    </div>
  );
}
