'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Send,
  Loader2,
  X,
  Upload,
  Trash2,
  Shield,
  User,
  ImagePlus,
  Play,
} from 'lucide-react';

export interface NoteItem {
  id: string;
  author: 'admin' | 'client';
  message: string | null;
  media_urls: string[] | null;
  created_at: string;
}

interface NotesThreadProps {
  notes: NoteItem[];
  requestItemId: string;
  /** 'admin' or 'client' — determines the author tag and available actions */
  currentUser: 'admin' | 'client';
  onNoteAdded: () => void;
}

export default function NotesThread({
  notes,
  requestItemId,
  currentUser,
  onNoteAdded,
}: NotesThreadProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const adminNoteCount = notes.filter((n) => n.author === 'admin').length;
  const hasNotes = notes.length > 0;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append('files', f));
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok && data.urls) {
        setMediaUrls((prev) => [...prev, ...data.urls]);
      }
    } catch {
      /* ignore */
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSend = async () => {
    if (!message.trim() && !mediaUrls.length) return;
    setSending(true);
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_item_id: requestItemId,
          author: currentUser,
          message: message.trim() || null,
          media_urls: mediaUrls.length ? mediaUrls : null,
        }),
      });
      if (res.ok) {
        setMessage('');
        setMediaUrls([]);
        onNoteAdded();
      }
    } catch {
      /* ignore */
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!window.confirm('Supprimer cette note ?')) return;
    await fetch('/api/notes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: noteId }),
    });
    onNoteAdded();
  };

  const isVideo = (url: string) =>
    /\.(mp4|webm|mov|avi)$/i.test(url) || url.includes('video');

  return (
    <div>
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
          hasNotes
            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300'
            : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
        }`}
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {hasNotes ? notes.length : ''}
        {adminNoteCount > 0 && !open && (
          <span className="flex h-2 w-2 rounded-full bg-amber-500" />
        )}
      </button>

      {/* Thread panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-900/10">
              {/* Messages */}
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {notes.length === 0 && (
                  <p className="py-2 text-center text-xs text-slate-400">Aucune note</p>
                )}
                {notes.map((note) => {
                  const isAdmin = note.author === 'admin';
                  return (
                    <div
                      key={note.id}
                      className={`rounded-xl p-2.5 ${
                        isAdmin
                          ? 'border border-amber-300 bg-amber-100 dark:border-amber-700 dark:bg-amber-900/30'
                          : 'border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span
                          className={`flex items-center gap-1 text-[10px] font-bold uppercase ${
                            isAdmin
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-slate-500'
                          }`}
                        >
                          {isAdmin ? (
                            <>
                              <Shield className="h-3 w-3" /> Admin
                            </>
                          ) : (
                            <>
                              <User className="h-3 w-3" /> Client
                            </>
                          )}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400">
                            {new Date(note.created_at).toLocaleString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {currentUser === 'admin' && (
                            <button
                              type="button"
                              onClick={() => handleDelete(note.id)}
                              className="text-slate-400 hover:text-red-500"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {note.message && (
                        <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
                          {note.message}
                        </p>
                      )}

                      {note.media_urls?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {note.media_urls.map((url, i) =>
                            isVideo(url) ? (
                              <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-700"
                              >
                                <Play className="h-5 w-5 text-slate-500" />
                              </a>
                            ) : (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={url}
                                  alt=""
                                  className="h-16 w-16 rounded-lg object-cover"
                                />
                              </a>
                            )
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {/* Input */}
              <div className="mt-2 space-y-2">
                {/* Media preview */}
                {mediaUrls.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {mediaUrls.map((url, i) => (
                      <div key={i} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="h-14 w-14 rounded-lg object-cover" />
                        <button
                          type="button"
                          onClick={() => setMediaUrls((prev) => prev.filter((_, j) => j !== i))}
                          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={handleUpload}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-700"
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="h-4 w-4" />
                    )}
                  </button>
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Écrire une note..."
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={sending || (!message.trim() && !mediaUrls.length)}
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white disabled:opacity-50"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
