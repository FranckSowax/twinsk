'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, LogIn, Users } from 'lucide-react';

interface AdminLoginProps {
  onLogin: () => void;
}

export default function AdminLogin({ onLogin }: AdminLoginProps) {
  const [tab, setTab] = useState<'admin' | 'collab'>('admin');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [collabPassword, setCollabPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submitAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError('Mot de passe incorrect');
        return;
      }
      onLogin();
    } catch {
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const submitCollab = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/collab/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: collabPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Identifiants incorrects');
        return;
      }
      onLogin();
    } catch {
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-white p-4 dark:from-slate-900 dark:to-slate-800">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-700 dark:bg-slate-800"
      >
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500">
            <Lock className="h-7 w-7 text-white" />
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">TWINSK</h1>
          <p className="mt-1 text-sm text-slate-500">Connexion / 登录</p>
        </div>

        {/* Onglets */}
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-700/50">
          <button
            type="button"
            onClick={() => { setTab('admin'); setError(''); }}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${tab === 'admin' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500'}`}
          >
            Admin
          </button>
          <button
            type="button"
            onClick={() => { setTab('collab'); setError(''); }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-colors ${tab === 'collab' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500'}`}
          >
            <Users className="h-3.5 w-3.5" /> Collaborateur
          </button>
        </div>

        {tab === 'admin' ? (
          <form onSubmit={submitAdmin} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe admin"
              required
              className={inputCls}
            />
            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-2 text-center text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</p>
            )}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 font-semibold text-white shadow-lg shadow-amber-500/25 disabled:opacity-60"
            >
              <LogIn className="h-5 w-5" />
              {loading ? 'Connexion…' : 'Se connecter'}
            </motion.button>
          </form>
        ) : (
          <form onSubmit={submitCollab} className="space-y-4">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Identifiant / 账号"
              autoCapitalize="none"
              required
              className={inputCls}
            />
            <input
              type="password"
              value={collabPassword}
              onChange={(e) => setCollabPassword(e.target.value)}
              placeholder="Mot de passe / 密码"
              required
              className={inputCls}
            />
            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-2 text-center text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</p>
            )}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 px-6 py-3 font-semibold text-white shadow-lg shadow-emerald-500/25 disabled:opacity-60"
            >
              <LogIn className="h-5 w-5" />
              {loading ? 'Connexion…' : '登录 / Se connecter'}
            </motion.button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
