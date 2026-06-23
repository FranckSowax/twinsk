#!/usr/bin/env bash
# Extrait les frames d'un clip Higgsfield pour la séquence scroll TWINSK /parcours.
# Usage: ./scripts/extract-frames.sh <scene_id> <clip_url_or_path> [fps] [width]
# Ex:    ./scripts/extract-frames.sh usine "https://cdn.higgsfield.ai/...mp4" 18 1280
#
# Produit: public/parcours/frames/<scene_id>_0001.webp ...
# Affiche le nombre de frames (à reporter dans scenes.ts -> frameCount + framesReady:true).

set -euo pipefail

SCENE="${1:?scene id requis (ex: usine)}"
SRC="${2:?url ou chemin du clip requis}"
FPS="${3:-18}"      # 18 fps -> ~90 frames pour 5s, fluide et léger
WIDTH="${4:-1280}"  # 1280px = 720p natif

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLIPS="$ROOT/public/parcours/clips"
OUT="$ROOT/public/parcours/frames"
mkdir -p "$CLIPS" "$OUT"

# Nettoie les anciennes frames de cette scène
rm -f "$OUT/${SCENE}_"*.jpg

# Récupère le clip (URL -> download, sinon chemin local)
CLIP="$CLIPS/${SCENE}.mp4"
if [[ "$SRC" =~ ^https?:// ]]; then
  echo "↓ Téléchargement $SCENE ..."
  curl -fsSL "$SRC" -o "$CLIP"
else
  CLIP="$SRC"
fi

echo "✂  Extraction frames $SCENE (fps=$FPS, width=$WIDTH) ..."
ffmpeg -hide_banner -loglevel error -i "$CLIP" \
  -vf "fps=${FPS},scale=${WIDTH}:-2:flags=lanczos" \
  -q:v 4 "$OUT/${SCENE}_%04d.jpg"

COUNT=$(ls "$OUT/${SCENE}_"*.jpg 2>/dev/null | wc -l | tr -d ' ')
SIZE=$(du -sh "$OUT/${SCENE}_"*.jpg 2>/dev/null | tail -1 | awk '{print $1}' || echo "?")
echo "✓ $SCENE : $COUNT frames extraites"
echo "  → scenes.ts: { framesReady: true, frameCount: $COUNT } pour '$SCENE'"
