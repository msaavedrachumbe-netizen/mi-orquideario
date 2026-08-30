export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const apiKey = process.env.PLANTNET_API_KEY;

  if (!apiKey) {
    return res.status(503).json({
      error: 'Falta configurar PLANTNET_API_KEY'
    });
  }

  const { image } = req.body || {};

  if (!image || typeof image !== 'string') {
    return res.status(400).json({
      error: 'Falta una imagen válida'
    });
  }

  try {
    const match = image.match(
      /^data:(image\/(?:jpeg|jpg|png));base64,(.+)$/
    );

    if (!match) {
      return res.status(400).json({
        error: 'Formato de imagen no compatible'
      });
    }

    const mimeType =
      match[1] === 'image/jpg' ? 'image/jpeg' : match[1];

    const buffer = Buffer.from(match[2], 'base64');

    const form = new FormData();

    const blob = new Blob([buffer], {
      type: mimeType
    });

    form.append(
      'images',
      blob,
      mimeType === 'image/png' ? 'orquidea.png' : 'orquidea.jpg'
    );

    form.append('organs', 'auto');

    const url =
      `https://my-api.plantnet.org/v2/identify/all` +
      `?api-key=${encodeURIComponent(apiKey)}` +
      `&lang=es` +
      `&nb-results=5`;

    const response = await fetch(url, {
      method: 'POST',
      body: form
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('PlantNet error:', data);

      return res.status(502).json({
        error:
          data?.message ||
          data?.error ||
          'Pl@ntNet no respondió correctamente'
      });
    }

    const results = (data.results || []).slice(0, 5).map((r) => ({
      score: Math.round((r.score || 0) * 100),
      scientificName:
        r.species?.scientificNameWithoutAuthor ||
        r.species?.scientificName ||
        '',
      commonNames: r.species?.commonNames || [],
      genus:
        r.species?.genus?.scientificNameWithoutAuthor ||
        r.species?.genus?.scientificName ||
        '',
      family:
        r.species?.family?.scientificNameWithoutAuthor ||
        r.species?.family?.scientificName ||
        ''
    }));

    if (!results.length) {
      return res.status
