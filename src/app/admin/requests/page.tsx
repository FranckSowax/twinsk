'use client';

import { useEffect, useState } from 'react';
import RequestsTable, { type RequestRow } from '@/components/admin/RequestsTable';

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/requests')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setRequests(data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Demandes de sourcing
        </h1>
        <p className="mt-1 text-slate-500">
          {requests.length} demande(s) au total
        </p>
      </div>
      <RequestsTable requests={requests} />
    </div>
  );
}
