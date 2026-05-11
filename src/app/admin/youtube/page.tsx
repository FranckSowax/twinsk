'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Plus,
  Loader2,
  Trash2,
  X,
  Edit3,
  Search,
  Youtube,
  Image as ImageIcon,
  ExternalLink,
  Eye,
  EyeOff,
  ShoppingBag,
  Save,
  Upload,
} from 'lucide-react';
import { extractYoutubeId, youtubeDefaultThumbnail } from '@/lib/youtube';

type VideoType = 'youtube' | 'upload';

interface YTProduct {
  id: string;
  video_id: string;
  name: string;
  price_usd: number;
  image_url: string;
  product_url: string;
  description: string;
  order_index: number;
  in_stock: boolean;
  created_at: string;
}

interface YTVideo {
  id: string;
  title: string;
  description: string;
  video_type: VideoType;
  video_url: string;
  youtube_id: string | null;
  thumbnail_url: string;
  duration: string;
  views: string;
  order_index: number;
  published: boolean;
  created_at: string;
  updated_at: string;
  youtube_video_products?: YTProduct[];
}

export default function AdminYoutubePage() {
  const [videos, setVideos] = useState<YTVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [active, setActive] = useState<YTVideo | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/youtube-videos')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setVideos(data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return videos;
    return videos.filter((v) =>
      `${v.title} ${v.description}`.toLowerCase().includes(q),
    );
  }, [videos, search]);

  const handleCreate = async () => {
    const url = prompt(
      'Collez un lien YouTube (https://youtube.com/watch?v=... ou https://youtu.be/...)',
    );
    if (!url) return;
    const yid = extractYoutubeId(url);
    if (!yid) {
      alert('Lien YouTube invalide');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/youtube-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Nouvelle vidéo',
          video_type: 'youtube',
          video_url: url,
          thumbnail_url: youtubeDefaultThumbnail(yid),
          published: true,
          order_index: videos.length,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Erreur création');
        return;
      }
      setVideos((prev) => [data, ...prev]);
      setActive(data);
    } finally {
      setCreating(false);
    }
  };

  const updateVideo = async (id: string, patch: Partial<YTVideo>) => {
    const res = await fetch(`/api/youtube-videos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || 'Erreur');
      return null;
    }
    const updated = await res.json();
    setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, ...updated } : v)));
    if (active?.id === id) setActive({ ...active, ...updated });
    return updated;
  };

  const deleteVideo = async (id: string) => {
    if (!confirm('Supprimer cette vidéo et tous ses produits ?')) return;
    const res = await fetch(`/api/youtube-videos/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      alert('Erreur');
      return;
    }
    setVideos((prev) => prev.filter((v) => v.id !== id));
    if (active?.id === id) setActive(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Youtube className="h-7 w-7 text-red-600" />
            YouTube Shop
          </h1>
          <p className="mt-1 text-slate-500">
            {videos.length} vidéo(s) · gérez les catalogues produits par vidéo
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-sm font-semibold shadow-sm disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Nouvelle vidéo
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par titre ou description…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-red-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800">
          <Youtube className="h-12 w-12 mx-auto mb-3 text-slate-300" />
          <p className="text-sm">Aucune vidéo encore. Cliquez sur « Nouvelle vidéo » pour commencer.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((video) => {
            const productCount = video.youtube_video_products?.length ?? 0;
            const thumb =
              video.thumbnail_url ||
              (video.youtube_id ? youtubeDefaultThumbnail(video.youtube_id) : '');
            return (
              <button
                key={video.id}
                onClick={() => setActive(video)}
                className="group relative rounded-2xl border border-slate-200 bg-white overflow-hidden text-left shadow-sm hover:shadow-lg transition-shadow dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="relative aspect-video bg-slate-900">
                  {thumb ? (
                    <Image src={thumb} alt={video.title} fill className="object-cover" unoptimized />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-500">
                      <ImageIcon className="h-8 w-8" />
                    </div>
                  )}
                  {!video.published && (
                    <span className="absolute top-2 left-2 bg-slate-900/90 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded">
                      Brouillon
                    </span>
                  )}
                  {video.duration && (
                    <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-semibold px-2 py-0.5 rounded">
                      {video.duration}
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-sm text-slate-900 dark:text-white line-clamp-2 mb-2">
                    {video.title || 'Sans titre'}
                  </h3>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <ShoppingBag className="h-3 w-3" />
                      <span className="tabular-nums">{productCount}</span> produit(s)
                    </span>
                    <span>{video.views || '—'}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {active && (
        <DetailModal
          video={active}
          onClose={() => {
            setActive(null);
            load();
          }}
          onUpdate={updateVideo}
          onDelete={deleteVideo}
        />
      )}
    </div>
  );
}

// ---------------- Detail Modal ----------------

const DetailModal = ({
  video,
  onClose,
  onUpdate,
  onDelete,
}: {
  video: YTVideo;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<YTVideo>) => Promise<YTVideo | null>;
  onDelete: (id: string) => Promise<void>;
}) => {
  const [title, setTitle] = useState(video.title);
  const [description, setDescription] = useState(video.description);
  const [videoUrl, setVideoUrl] = useState(video.video_url);
  const [thumbnailUrl, setThumbnailUrl] = useState(video.thumbnail_url);
  const [duration, setDuration] = useState(video.duration);
  const [views, setViews] = useState(video.views);
  const [published, setPublished] = useState(video.published);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [savingVideo, setSavingVideo] = useState(false);

  const [products, setProducts] = useState<YTProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [editingProduct, setEditingProduct] = useState<YTProduct | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);

  useEffect(() => {
    setLoadingProducts(true);
    fetch(`/api/youtube-videos/${video.id}/products`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setProducts(data);
      })
      .finally(() => setLoadingProducts(false));
  }, [video.id]);

  const uploadThumbnail = async (file: File) => {
    setUploadingThumb(true);
    try {
      const fd = new FormData();
      fd.append('files', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setThumbnailUrl(data.urls[0]);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur upload');
    } finally {
      setUploadingThumb(false);
    }
  };

  const saveVideo = async () => {
    setSavingVideo(true);
    await onUpdate(video.id, {
      title,
      description,
      video_url: videoUrl,
      thumbnail_url: thumbnailUrl,
      duration,
      views,
      published,
    });
    setSavingVideo(false);
  };

  const addProduct = async (patch: Partial<YTProduct>) => {
    const res = await fetch(`/api/youtube-videos/${video.id}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...patch, order_index: products.length }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || 'Erreur ajout produit');
      return;
    }
    const data = await res.json();
    setProducts((prev) => [...prev, data]);
    setShowProductForm(false);
    setEditingProduct(null);
  };

  const updateProduct = async (productId: string, patch: Partial<YTProduct>) => {
    const res = await fetch(`/api/youtube-videos/${video.id}/products/${productId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      alert('Erreur');
      return;
    }
    const updated = await res.json();
    setProducts((prev) => prev.map((p) => (p.id === productId ? updated : p)));
    setEditingProduct(null);
    setShowProductForm(false);
  };

  const deleteProduct = async (productId: string) => {
    if (!confirm('Supprimer ce produit ?')) return;
    const res = await fetch(`/api/youtube-videos/${video.id}/products/${productId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      alert('Erreur');
      return;
    }
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/70 p-4 backdrop-blur-sm sm:items-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative my-8 w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-800"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Youtube className="h-5 w-5 text-red-600" />
            <h2 className="font-display text-lg uppercase tracking-tight text-slate-900 dark:text-white">
              Vidéo &amp; produits
            </h2>
            {published ? (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
                Publiée
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-600 px-2 py-0.5 rounded">
                Brouillon
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 max-h-[75vh] overflow-y-auto">
          {/* Left: video details */}
          <div className="p-5 space-y-4 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Vidéo
            </p>

            <Field label="Titre">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-transparent border-none text-sm font-medium focus:outline-none"
              />
            </Field>

            <Field label="Lien YouTube">
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full bg-transparent border-none text-sm focus:outline-none"
              />
            </Field>

            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                Vignette
              </p>
              <div className="flex items-start gap-3">
                <div className="relative aspect-video w-32 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                  {thumbnailUrl ? (
                    <Image
                      src={thumbnailUrl}
                      alt="Vignette"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-400">
                      <ImageIcon className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <label className="flex-1 cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadThumbnail(file);
                    }}
                  />
                  <div className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 hover:border-red-300 px-3 py-3 text-xs font-medium text-slate-600 hover:text-red-600 transition-colors">
                    {uploadingThumb ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {uploadingThumb ? 'Upload…' : 'Charger / changer'}
                  </div>
                </label>
              </div>
              <input
                type="url"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="ou collez une URL d'image"
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:bg-slate-700 dark:border-slate-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Durée">
                <input
                  type="text"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="12:34"
                  className="w-full bg-transparent border-none text-sm focus:outline-none tabular-nums"
                />
              </Field>
              <Field label="Vues">
                <input
                  type="text"
                  value={views}
                  onChange={(e) => setViews(e.target.value)}
                  placeholder="24K"
                  className="w-full bg-transparent border-none text-sm focus:outline-none"
                />
              </Field>
            </div>

            <Field label="Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full resize-none bg-transparent border-none text-sm focus:outline-none"
              />
            </Field>

            <button
              onClick={() => setPublished((p) => !p)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
                published
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {published ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              {published ? 'Publiée sur la LP' : 'Brouillon — non visible'}
            </button>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={saveVideo}
                disabled={savingVideo}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-900 px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {savingVideo ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                Enregistrer
              </button>
              <button
                onClick={() => onDelete(video.id)}
                className="inline-flex items-center gap-1.5 rounded-lg p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Right: products */}
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Produits ({products.length})
              </p>
              <button
                onClick={() => {
                  setEditingProduct(null);
                  setShowProductForm(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 text-xs font-semibold"
              >
                <Plus className="h-3 w-3" />
                Ajouter
              </button>
            </div>

            {showProductForm && (
              <ProductForm
                initial={editingProduct}
                onSave={(payload) => {
                  if (editingProduct) updateProduct(editingProduct.id, payload);
                  else addProduct(payload);
                }}
                onCancel={() => {
                  setShowProductForm(false);
                  setEditingProduct(null);
                }}
              />
            )}

            {loadingProducts ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
              </div>
            ) : products.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                Aucun produit. Ajoutez ce que la vidéo référence.
              </p>
            ) : (
              <ul className="space-y-2">
                {products.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <div className="relative h-14 w-14 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                      {p.image_url ? (
                        <Image
                          src={p.image_url}
                          alt={p.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-300">
                          <ImageIcon className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {p.name || 'Sans nom'}
                      </p>
                      <p className="text-xs text-amber-600 font-semibold tabular-nums">
                        ${(p.price_usd || 0).toLocaleString('en-US')}
                      </p>
                      {!p.in_stock && (
                        <span className="text-[10px] text-slate-400">Indisponible</span>
                      )}
                    </div>
                    {p.product_url && (
                      <a
                        href={p.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-slate-400 hover:text-amber-600"
                        title="Lien externe"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <button
                      onClick={() => {
                        setEditingProduct(p);
                        setShowProductForm(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-700"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteProduct(p.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-700/40">
    <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">{label}</p>
    {children}
  </div>
);

// ---------------- Product Form ----------------

const ProductForm = ({
  initial,
  onSave,
  onCancel,
}: {
  initial: YTProduct | null;
  onSave: (p: Partial<YTProduct>) => void;
  onCancel: () => void;
}) => {
  const [name, setName] = useState(initial?.name ?? '');
  const [priceUsd, setPriceUsd] = useState(String(initial?.price_usd ?? ''));
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? '');
  const [productUrl, setProductUrl] = useState(initial?.product_url ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [inStock, setInStock] = useState(initial?.in_stock ?? true);
  const [uploading, setUploading] = useState(false);

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('files', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setImageUrl(data.urls[0]);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-xl border-2 border-amber-300 bg-amber-50/30 p-3 space-y-2 dark:border-amber-700/50 dark:bg-amber-900/10">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom du produit *"
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
        />
        <input
          type="number"
          value={priceUsd}
          onChange={(e) => setPriceUsd(e.target.value)}
          placeholder="$"
          className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums dark:border-slate-600 dark:bg-slate-800 dark:text-white"
        />
      </div>

      <input
        type="url"
        value={productUrl}
        onChange={(e) => setProductUrl(e.target.value)}
        placeholder="Lien externe 1688/Alibaba (optionnel)"
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
      />

      <div className="flex items-start gap-2">
        <div className="relative h-14 w-14 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt=""
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-300">
              <ImageIcon className="h-5 w-5" />
            </div>
          )}
        </div>
        <label className="flex-1 cursor-pointer">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadImage(file);
            }}
          />
          <div className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 px-3 py-3 text-xs text-slate-600 hover:border-amber-400 cursor-pointer">
            {uploading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Upload className="h-3 w-3" />
            )}
            Charger image
          </div>
        </label>
      </div>

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        placeholder="Description courte (optionnelle)"
        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
      />

      <div className="flex items-center justify-between">
        <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={inStock}
            onChange={(e) => setInStock(e.target.checked)}
            className="rounded"
          />
          En stock
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            onClick={() =>
              onSave({
                name: name.trim(),
                price_usd: parseFloat(priceUsd) || 0,
                image_url: imageUrl,
                product_url: productUrl.trim(),
                description: description.trim(),
                in_stock: inStock,
              })
            }
            disabled={!name.trim() || uploading}
            className="rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            {initial ? 'Mettre à jour' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
};
