'use client';

import { useEffect, useState, useCallback } from 'react';
import RequestsTable, { type RequestRow } from '@/components/admin/RequestsTable';

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);

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
      // Remove from local state immediately
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
      // Update local state
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, client_name: name } : r))
      );
    } catch {
      alert('Erreur réseau');
    }
  };

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
      <RequestsTable
        requests={requests}
        onDelete={handleDelete}
        onRename={handleRename}
      />
    </div>
  );
}
