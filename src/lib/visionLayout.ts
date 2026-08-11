export interface VisionVertex {
  x?: number;
  y?: number;
}

export interface VisionWord {
  symbols?: Array<{ text?: string }>;
  boundingBox?: {
    vertices?: VisionVertex[];
    normalizedVertices?: VisionVertex[];
  };
  confidence?: number;
}

export interface VisionFullTextAnnotation {
  text?: string;
  pages?: Array<{
    blocks?: Array<{
      confidence?: number;
      paragraphs?: Array<{
        confidence?: number;
        words?: VisionWord[];
      }>;
    }>;
  }>;
}

interface PositionedWord {
  text: string;
  left: number;
  right: number;
  centerY: number;
  height: number;
}

interface TextRow {
  centerY: number;
  height: number;
  words: PositionedWord[];
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function positionWord(word: VisionWord): PositionedWord | null {
  const text = (word.symbols || []).map((symbol) => symbol.text || '').join('').trim();
  const vertices = word.boundingBox?.vertices || word.boundingBox?.normalizedVertices || [];
  if (!text || vertices.length < 2) return null;
  const xs = vertices.map((vertex) => vertex.x || 0);
  const ys = vertices.map((vertex) => vertex.y || 0);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  return { text, left, right, centerY: (top + bottom) / 2, height: Math.max(1, bottom - top) };
}

export function reconstructVisionText(annotation: VisionFullTextAnnotation) {
  const words = (annotation.pages || []).flatMap((page) =>
    (page.blocks || []).flatMap((block) =>
      (block.paragraphs || []).flatMap((paragraph) => paragraph.words || []),
    ),
  ).map(positionWord).filter((word): word is PositionedWord => Boolean(word));

  if (!words.length) return annotation.text?.trim() || '';

  const typicalHeight = median(words.map((word) => word.height));
  const rows: TextRow[] = [];
  for (const word of [...words].sort((a, b) => a.centerY - b.centerY || a.left - b.left)) {
    let nearest: TextRow | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const row of rows) {
      const distance = Math.abs(row.centerY - word.centerY);
      const threshold = Math.max(3, Math.min(row.height, word.height, typicalHeight || word.height) * .7);
      if (distance <= threshold && distance < nearestDistance) {
        nearest = row;
        nearestDistance = distance;
      }
    }

    if (!nearest) {
      rows.push({ centerY: word.centerY, height: word.height, words: [word] });
      continue;
    }

    nearest.words.push(word);
    nearest.centerY = nearest.words.reduce((sum, entry) => sum + entry.centerY, 0) / nearest.words.length;
    nearest.height = median(nearest.words.map((entry) => entry.height));
  }

  return rows
    .sort((a, b) => a.centerY - b.centerY)
    .map((row) => row.words.sort((a, b) => a.left - b.left).map((word) => word.text).join(' '))
    .filter(Boolean)
    .join('\n');
}
