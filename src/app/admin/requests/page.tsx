'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import RequestsTable, { type RequestRow } from '@/components/admin/RequestsTable';

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadRequests = useCallback(() => {
    fetch('/api/requests')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setRequests(data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/requests/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Erreur suppression');
        return;
      }
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch {
      alert('Erreur réseau');
    }
  };

  const handleRename = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_name: name }),
      });
      if (!res.ok) {
        alert('Erreur renommage');
        return;
      }
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, client_name: name } : r))
      );
    } catch {
      alert('Erreur réseau');
    }
  };

  // Filtered list — searches client info AND product titles (case-insensitive)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((r) => {
      const haystack: string[] = [
        r.client_name || '',
        r.client_email || '',
        r.client_phone || '',
        r.notes || '',
        r.destination || '',
        r.id,
      ];
      for (const item of r.request_items || []) {
        if (item.description) haystack.push(item.description);
        for (const sr of item.search_results || []) {
          if (sr.title) haystack.push(sr.title);
        }
      }
      const combined = haystack.join(' ').toLowerCase();
      return combined.includes(q);
    });
  }, [requests, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Demandes de sourcing
          </h1>
          <p className="mt-1 text-slate-500">
            {search.trim()
              ? `${filtered.length} / ${requests.length} demande(s)`
              : `${requests.length} demande(s) au total`}
          </p>
        </div>

        {/* Search bar */}
        <div className="relative w-full sm:w-96">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher client, email, produit, destination…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-700 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
              aria-label="Effacer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <RequestsTable
        requests={filtered}
        onDelete={handleDelete}
        onRename={handleRename}
      />
    </div>
  );
}
