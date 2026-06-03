'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, Package, CheckCircle, FileText, Search, Trash2, Copy, Pencil, X, Check, Share2, Clock } from 'lucide-react';
import Link from 'next/link';

export interface RequestRow {
  id: string;
  created_at: string;
  client_name: string;
  client_email: string;
  client_phone?: string | null;
  notes?: string | null;
  destination?: string | null;
  status: string;
  request_items: Array<{
    id: string;
    description?: string | null;
    search_results?: { title: string }[];
  }>;
}

interface RequestsTableProps {
  requests: RequestRow[];
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  draft: { label: 'Brouillon', icon: FileText, color: 'text-slate-500 bg-slate-100 dark:bg-slate-700' },
  submitted: { label: 'Soumise', icon: Package, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' },
  processing: { label: 'En cours', icon: Search, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30' },
  quoted: { label: 'Devisée', icon: CheckCircle, color: 'text-green-600 bg-green-50 dark:bg-green-900/30' },
  completed: { label: 'Terminée', icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30' },
  proposal_sent: { label: 'Proposition', icon: Share2, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/30' },
  client_reviewed: { label: 'Répondu', icon: Check, color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/30' },
};

export default function RequestsTable({ requests, onDelete, onRename }: RequestsTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const startEdit = (req: RequestRow) => {
    setEditingId(req.id);
    setEditName(req.client_name || '');
  };

  const confirmEdit = () => {
    if (editingId) {
      onRename(editingId, editName.trim());
      setEditingId(null);
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Supprimer la demande de "${name || 'Sans nom'}" ? Cette action est irréversible.`)) {
      onDelete(id);
    }
  };

  const handleCopyLink = async (id: string) => {
    const link = `${window.location.origin}/request/${id}`;
    try {
      await navigator.clipboard.writeText(link);
      alert('Lien copié !');
    } catch {
      prompt('Copiez ce lien :', link);
    }
  };

  if (!requests.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-800">
        <Package className="mx-auto h-12 w-12 text-slate-300" />
        <p className="mt-4 text-slate-500">Aucune demande pour le moment</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Client</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Articles</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Statut</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {requests.map((req, i) => {
              const status = statusConfig[req.status] || statusConfig.draft;
              const StatusIcon = status.icon;
              const itemCount = req.request_items?.length ?? 0;
              const isEditing = editingId === req.id;

              return (
                <motion.tr
                  key={req.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') confirmEdit();
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="w-32 rounded-lg border border-amber-400 bg-white px-2 py-1 text-sm dark:bg-slate-700 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={confirmEdit}
                          className="text-green-600 hover:text-green-700"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {req.client_name || 'Sans nom'}
                        </p>
                        <p className="text-xs text-slate-500">{req.client_email || '—'}</p>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                    {new Date(req.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                    {itemCount} article(s)
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.color}`}>
                      <StatusIcon className="h-3.5 w-3.5" />
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/requests/${req.id}`}
                        className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20"
                        title="Voir"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleCopyLink(req.id)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                        title="Copier le lien client"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(req)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                        title="Renommer"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(req.id, req.client_name)}
                        className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
