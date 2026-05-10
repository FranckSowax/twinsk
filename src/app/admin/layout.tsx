'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Package, Plus, LogOut, BookOpen, Inbox } from 'lucide-react';
import AdminLogin from '@/components/admin/AdminLogin';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check if already authenticated by trying to fetch requests
    fetch('/api/requests')
      .then((res) => {
        if (res.ok) setAuthenticated(true);
      })
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  if (!authenticated) {
    return <AdminLogin onLogin={() => setAuthenticated(true)} />;
  }

  const handleCreateRequest = async () => {
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_name: '' }),
      });
      const data = await res.json();
      if (!data.id) {
        alert(data.error || 'Erreur lors de la création');
        return;
      }
      const link = `${window.location.origin}/request/${data.id}`;
      try {
        await navigator.clipboard.writeText(link);
        alert(`Lien copié dans le presse-papier :\n${link}`);
      } catch {
        // Clipboard access denied — show link for manual copy
        prompt('Copiez ce lien et envoyez-le au client :', link);
      }
      window.location.reload();
    } catch {
      alert('Erreur réseau lors de la création');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Admin navbar */}
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/admin/requests" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500">
              <span className="text-sm font-bold text-white">T</span>
            </div>
            <span className="font-display text-lg font-bold text-slate-900 dark:text-white">
              TWINSK Admin
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCreateRequest}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:shadow-md"
            >
              <Plus className="h-4 w-4" />
              Nouvelle demande
            </button>
            <Link
              href="/admin/requests"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <Package className="h-4 w-4" />
              Demandes
            </Link>
            <Link
              href="/admin/leads"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <Inbox className="h-4 w-4" />
              Services
            </Link>
            <Link
              href="/admin/catalog"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <BookOpen className="h-4 w-4" />
              Catalogue
            </Link>
            <button
              type="button"
              onClick={() => {
                document.cookie = 'admin_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                setAuthenticated(false);
              }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
