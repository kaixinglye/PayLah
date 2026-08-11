import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { reconstructVisionText, type VisionFullTextAnnotation } from './src/lib/visionLayout';

const app = express();
const port = Number(process.env.PORT) || 3000;
const projectRoot = process.cwd();

app.use(express.json({ limit: '15mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    ocrProvider: 'google-cloud-vision',
    cloudVisionConfigured: Boolean(process.env.GOOGLE_CLOUD_VISION_API_KEY),
  });
});

app.post('/api/ocr/cloud-vision', async (req, res) => {
  const { image } = req.body as { image?: string };
  if (!image) return res.status(400).json({ error: 'Receipt image is required.' });
  if (!process.env.GOOGLE_CLOUD_VISION_API_KEY) {
    return res.status(503).json({ error: 'Google Cloud Vision is not configured. Add GOOGLE_CLOUD_VISION_API_KEY to the server environment.' });
  }

  try {
    const cloudResponse = await fetch('https://vision.googleapis.com/v1/images:annotate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-goog-api-key': process.env.GOOGLE_CLOUD_VISION_API_KEY },
      body: JSON.stringify({
        requests: [{
          image: { content: image.replace(/^data:[^;]+;base64,/, '') },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
        }],
      }),
    });

    if (!cloudResponse.ok) {
      const failure = await cloudResponse.json().catch(() => ({})) as { error?: { message?: string } };
      console.error('Cloud Vision request failed', cloudResponse.status, failure.error?.message || 'Unknown provider error');
      if (cloudResponse.status === 403) {
        return res.status(502).json({ error: 'Google Cloud Vision denied the request. Enable the Vision API and billing, then check the API key restrictions.' });
      }
      if (cloudResponse.status === 429) {
        return res.status(429).json({ error: 'Google Cloud Vision quota has been reached. Try again later or increase the project quota.' });
      }
      return res.status(502).json({ error: failure.error?.message || 'Google Cloud Vision could not process the receipt.' });
    }

    const payload = await cloudResponse.json() as {
      responses?: Array<{
        fullTextAnnotation?: VisionFullTextAnnotation;
        error?: { message?: string };
      }>;
    };
    const result = payload.responses?.[0];
    if (result?.error || !result?.fullTextAnnotation?.text) {
      return res.status(422).json({ error: result?.error?.message || 'Google Cloud Vision did not detect text in this image.' });
    }

    const confidenceValues = (result.fullTextAnnotation.pages || []).flatMap((page) =>
      (page.blocks || []).flatMap((block) => [
        block.confidence,
        ...(block.paragraphs || []).flatMap((paragraph) => [paragraph.confidence, ...(paragraph.words || []).map((word) => word.confidence)]),
      ]),
    ).filter((value): value is number => typeof value === 'number');
    const confidence = confidenceValues.length ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length : .8;
    res.json({ text: reconstructVisionText(result.fullTextAnnotation), confidence, provider: 'cloud-vision' });
  } catch (error) {
    console.error('Google Cloud Vision OCR failed', error);
    res.status(500).json({ error: 'Google Cloud Vision is temporarily unavailable.' });
  }
});

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(projectRoot, 'dist', 'client')));
    app.use((_req, res) => res.sendFile(path.join(projectRoot, 'dist', 'client', 'index.html')));
  }

  app.listen(port, '0.0.0.0', () => console.log(`PayLah is running at http://localhost:${port}`));
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
