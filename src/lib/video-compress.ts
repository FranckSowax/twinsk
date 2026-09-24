// Compression des vidéos envoyées (admin → /api/upload), pour limiter la bande
// passante Supabase (coupure du projet Gabon le 24 septembre 2026, quota de
// l'offre gratuite dépassé à cause de vidéos de 10 à 30 Mo).
//
// Règles : petit côté ramené à 720 px au plus (carré 720×720, vertical
// 720×1280, horizontal 1280×720), H.264 CRF 27, son AAC 96 kbit/s,
// « faststart » pour une lecture immédiate. La version compressée n'est
// gardée que si elle est plus légère. Toute erreur (ffmpeg absent, fichier
// illisible, délai dépassé) renvoie l'original : l'envoi ne casse jamais.

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const VIDEO_COMPRESS_TIMEOUT_MS = 120_000;

/** Arguments ffmpeg (pur, testé). */
export function videoCompressArgs(input: string, output: string): string[] {
  return [
    '-nostdin', '-v', 'error', '-y',
    '-i', input,
    '-vf', "scale='if(lte(iw,ih),min(720,iw),-2)':'if(lte(iw,ih),-2,min(720,ih))'",
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '96k',
    '-movflags', '+faststart',
    output,
  ];
}

/** Garde la version compressée seulement si elle fait gagner au moins 10 %. */
export function keepCompressed(originalBytes: number, compressedBytes: number): boolean {
  return compressedBytes > 0 && compressedBytes < originalBytes * 0.9;
}

export interface CompressResult {
  buffer: Buffer;
  compressed: boolean;
  reason?: string;
}

function runFfmpeg(args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.FFMPEG_PATH || 'ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr = (stderr + d).slice(-500); });
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('délai dépassé')); }, timeoutMs);
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg code ${code}: ${stderr.trim()}`));
    });
  });
}

export async function compressVideo(original: Buffer, timeoutMs = VIDEO_COMPRESS_TIMEOUT_MS): Promise<CompressResult> {
  const id = randomUUID();
  const input = join(tmpdir(), `up-${id}-in.mp4`);
  const output = join(tmpdir(), `up-${id}-out.mp4`);
  try {
    await writeFile(input, original);
    await runFfmpeg(videoCompressArgs(input, output), timeoutMs);
    const out = await readFile(output);
    if (!keepCompressed(original.length, out.length)) {
      return { buffer: original, compressed: false, reason: 'gain insuffisant' };
    }
    return { buffer: out, compressed: true };
  } catch (e) {
    return { buffer: original, compressed: false, reason: e instanceof Error ? e.message : 'erreur' };
  } finally {
    await Promise.all([rm(input, { force: true }), rm(output, { force: true })]);
  }
}
