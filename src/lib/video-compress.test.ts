import { describe, expect, it } from 'vitest';
import { compressVideo, keepCompressed, videoCompressArgs } from './video-compress';

describe('videoCompressArgs', () => {
  it('petit côté 720 px, H.264, faststart, sortie en dernier', () => {
    const a = videoCompressArgs('in.mp4', 'out.mp4');
    expect(a.slice(a.indexOf('-i'), a.indexOf('-i') + 2)).toEqual(['-i', 'in.mp4']);
    expect(a).toContain('libx264');
    expect(a).toContain('+faststart');
    expect(a[a.indexOf('-vf') + 1]).toContain('min(720');
    expect(a[a.length - 1]).toBe('out.mp4');
  });
});

describe('keepCompressed', () => {
  it('seulement si au moins 10 % plus léger', () => {
    expect(keepCompressed(10_000_000, 1_000_000)).toBe(true);
    expect(keepCompressed(10_000_000, 9_500_000)).toBe(false);
    expect(keepCompressed(10_000_000, 0)).toBe(false);
  });
});

describe('compressVideo', () => {
  it('renvoie l’original si ffmpeg est introuvable', async () => {
    const saved = process.env.FFMPEG_PATH;
    process.env.FFMPEG_PATH = '/nexiste/pas/ffmpeg';
    const buf = Buffer.from('pas une vidéo');
    const r = await compressVideo(buf, 5_000);
    process.env.FFMPEG_PATH = saved;
    expect(r.compressed).toBe(false);
    expect(r.buffer).toBe(buf);
  });

  it('renvoie l’original si le fichier est illisible', async () => {
    const buf = Buffer.from('pas une vidéo');
    const r = await compressVideo(buf, 20_000);
    expect(r.compressed).toBe(false);
    expect(r.buffer).toBe(buf);
  });
});
