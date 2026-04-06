'use client';

import { motion } from 'framer-motion';
import { Eye, Clock, Package, CheckCircle, FileText, Search } from 'lucide-react';
import Link from 'next/link';

export interface RequestRow {
  id: string;
  created_at: string;
  client_name: string;
  client_email: string;
  status: string;
  request_items: { count: number }[];
}

interface RequestsTableProps {
  requests: RequestRow[];
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  draft: { label: 'Brouillon', icon: FileText, color: 'text-slate-500 bg-slate-100 dark:bg-slate-700' },
  submitted: { label: 'Soumise', icon: Package, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' },
  processing: { label: 'En cours', icon: Search, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30' },
  quoted: { label: 'Devisée', icon: CheckCircle, color: 'text-green-600 bg-green-50 dark:bg-green-900/30' },
  completed: { label: 'Terminée', icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30' },
};

export default function RequestsTable({ requests }: RequestsTableProps) {
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
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Client</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Date</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Images</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Statut</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {requests.map((req, i) => {
              const status = statusConfig[req.status] || statusConfig.draft;
              const StatusIcon = status.icon;
              const itemCount = req.request_items?.[0]?.count ?? 0;

              return (
                <motion.tr
                  key={req.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-900 dark:text-white">
                      {req.client_name || 'Sans nom'}
                    </p>
                    <p className="text-sm text-slate-500">{req.client_email || '—'}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                    {new Date(req.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                    {itemCount} image(s)
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${status.color}`}>
                      <StatusIcon className="h-3.5 w-3.5" />
                      {status.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/admin/requests/${req.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20"
                    >
                      <Eye className="h-4 w-4" />
                      Voir
                    </Link>
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
