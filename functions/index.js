const { defineSecret } = require('firebase-functions/params');
const { onRequest } = require('firebase-functions/v2/https');

const visionApiKey = defineSecret('GOOGLE_CLOUD_VISION_API_KEY');

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function positionWord(word) {
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

function reconstructVisionText(annotation) {
  const words = (annotation.pages || []).flatMap((page) =>
    (page.blocks || []).flatMap((block) =>
      (block.paragraphs || []).flatMap((paragraph) => paragraph.words || []),
    ),
  ).map(positionWord).filter(Boolean);

  if (!words.length) return annotation.text?.trim() || '';
  const typicalHeight = median(words.map((word) => word.height));
  const rows = [];
  for (const word of [...words].sort((a, b) => a.centerY - b.centerY || a.left - b.left)) {
    let nearest;
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

exports.ocr = onRequest({
  region: 'asia-southeast1',
  memory: '512MiB',
  timeoutSeconds: 60,
  secrets: [visionApiKey],
}, async (request, response) => {
  if (request.method !== 'POST') {
    response.set('Allow', 'POST').status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const image = request.body?.image;
  if (!image || typeof image !== 'string') {
    response.status(400).json({ error: 'Receipt image is required.' });
    return;
  }

  try {
    const cloudResponse = await fetch('https://vision.googleapis.com/v1/images:annotate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-goog-api-key': visionApiKey.value() },
      body: JSON.stringify({
        requests: [{
          image: { content: image.replace(/^data:[^;]+;base64,/, '') },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
        }],
      }),
    });

    if (!cloudResponse.ok) {
      const failure = await cloudResponse.json().catch(() => ({}));
      console.error('Cloud Vision request failed', cloudResponse.status, failure.error?.message || 'Unknown provider error');
      if (cloudResponse.status === 403) {
        response.status(502).json({ error: 'Google Cloud Vision denied the request. Check the API and billing configuration.' });
        return;
      }
      if (cloudResponse.status === 429) {
        response.status(429).json({ error: 'Google Cloud Vision quota has been reached. Try again later.' });
        return;
      }
      response.status(502).json({ error: failure.error?.message || 'Google Cloud Vision could not process the receipt.' });
      return;
    }

    const payload = await cloudResponse.json();
    const result = payload.responses?.[0];
    if (result?.error || !result?.fullTextAnnotation?.text) {
      response.status(422).json({ error: result?.error?.message || 'Google Cloud Vision did not detect text in this image.' });
      return;
    }

    const confidenceValues = (result.fullTextAnnotation.pages || []).flatMap((page) =>
      (page.blocks || []).flatMap((block) => [
        block.confidence,
        ...(block.paragraphs || []).flatMap((paragraph) => [
          paragraph.confidence,
          ...(paragraph.words || []).map((word) => word.confidence),
        ]),
      ]),
    ).filter((value) => typeof value === 'number');
    const confidence = confidenceValues.length
      ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
      : .8;
    response.json({ text: reconstructVisionText(result.fullTextAnnotation), confidence, provider: 'cloud-vision' });
  } catch (error) {
    console.error('Google Cloud Vision OCR failed', error);
    response.status(500).json({ error: 'Google Cloud Vision is temporarily unavailable.' });
  }
});
