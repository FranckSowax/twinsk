import { describe, expect, it } from 'vitest';
import { checkCoverVideo } from './cover';

describe('vidéo de couverture : contrôle du fichier', () => {
  it('MP4 et WebM acceptés, extension suffit si le type manque', () => {
    expect(checkCoverVideo({ type: 'video/mp4', size: 20e6, name: 'psg.mp4' })).toBeNull();
    expect(checkCoverVideo({ type: '', size: 1e6, name: 'COVER.MP4' })).toBeNull();
    expect(checkCoverVideo({ type: 'video/webm', size: 1e6, name: 'a.webm' })).toBeNull();
  });
  it('MOV iPhone et fichiers trop lourds refusés, avec la marche à suivre', () => {
    expect(checkCoverVideo({ type: 'video/quicktime', size: 1e6, name: 'IMG_0001.MOV' })).toMatch(/MP4 « Plus compatible »/);
    expect(checkCoverVideo({ type: 'video/mp4', size: 60 * 1048576, name: 'a.mp4' })).toMatch(/60 Mo.*50 Mo au plus/);
  });
});
