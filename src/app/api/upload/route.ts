import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB (cover vidéo mp4)
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4'];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files.length) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    const urls: string[] = [];

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `Type de fichier non supporté: ${file.type}` },
          { status: 400 }
        );
      }

      const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
      const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
      if (file.size > maxSize) {
        return NextResponse.json(
          { error: `Fichier trop volumineux: ${file.name} (max ${isVideo ? '50MB' : '10MB'})` },
          { status: 400 }
        );
      }

      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${uuidv4()}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error } = await supabaseAdmin.storage
        .from('request-images')
        .upload(fileName, buffer, {
          contentType: file.type,
          upsert: false,
        });

      if (error) {
        return NextResponse.json(
          { error: `Erreur upload: ${error.message}` },
          { status: 500 }
        );
      }

      const { data: urlData } = supabaseAdmin.storage
        .from('request-images')
        .getPublicUrl(fileName);

      urls.push(urlData.publicUrl);
    }

    return NextResponse.json({ urls });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
