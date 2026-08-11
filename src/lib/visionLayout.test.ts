import assert from 'node:assert/strict';
import test from 'node:test';
import { reconstructVisionText, type VisionFullTextAnnotation } from './visionLayout';

function word(text: string, x: number, y: number, width = text.length * 8) {
  return {
    symbols: [...text].map((character) => ({ text: character })),
    boundingBox: { vertices: [{ x, y }, { x: x + width, y }, { x: x + width, y: y + 16 }, { x, y: y + 16 }] },
  };
}

test('reconstructs receipt rows using word coordinates instead of OCR block order', () => {
  const annotation: VisionFullTextAnnotation = {
    text: '1 Classic Chicken\n2 Nasi Lemak\n19.90\n33.80',
    pages: [{ blocks: [{ paragraphs: [{ words: [
      word('1', 20, 20), word('Classic', 45, 20), word('Chicken', 110, 20),
      word('2', 20, 48), word('Nasi', 45, 48), word('Lemak', 85, 48),
      word('19.90', 300, 20), word('33.80', 300, 48),
    ] }] }] }],
  };

  assert.equal(reconstructVisionText(annotation), '1 Classic Chicken 19.90\n2 Nasi Lemak 33.80');
});
