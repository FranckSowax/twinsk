import { describe, expect, it } from 'vitest';
import { checkUpload, uploadMime } from './uploads';

describe('fichiers de l’espace projet : formats et tailles', () => {
  it('PDF, photos et vidéos acceptés, type déduit de l’extension si absent', () => {
    expect(checkUpload({ name: 'plan.pdf', type: 'application/pdf', size: 2e6 })).toBeNull();
    expect(checkUpload({ name: 'IMG_0042.MOV', type: '', size: 40 * 1048576 })).toBeNull();
    expect(uploadMime({ name: 'IMG_0042.MOV', type: '' })).toBe('video/quicktime');
    expect(uploadMime({ name: 'photo.jpeg', type: '' })).toBe('image/jpeg');
  });
  it('tailles : 25 Mo pour un document ou une photo, 50 Mo pour une vidéo', () => {
    expect(checkUpload({ name: 'scan.pdf', type: 'application/pdf', size: 30 * 1048576 })).toBe('« scan.pdf » : 30 Mo, au-delà de 25 Mo');
    expect(checkUpload({ name: 'site.mp4', type: 'video/mp4', size: 60.5 * 1048576 })).toBe('« site.mp4 » : 60,5 Mo, au-delà de 50 Mo (raccourcir ou compresser la vidéo)');
    expect(checkUpload({ name: 'site.mp4', type: 'video/mp4', size: 49 * 1048576 })).toBeNull();
  });
  it('formats refusés et fichier vide', () => {
    expect(checkUpload({ name: 'setup.exe', type: 'application/x-msdownload', size: 10 })).toMatch(/format non accepté/);
    expect(checkUpload({ name: 'vide.pdf', type: 'application/pdf', size: 0 })).toBe('« vide.pdf » : fichier vide');
  });
});
