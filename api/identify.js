export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const apiKey = process.env.PLANTNET_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Falta configurar PLANTNET_API_KEY en Vercel' });
  }

  const { image } = req.body || {};
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'Falta una imagen válida' });
  }

  try {
    const match = image.match(/^data:(image\/(?:jpeg|jpg|png));base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ error: 'Formato de imagen no compatible. Usa JPG o PNG.' });
    }

    const mimeType = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
    const buffer = Buffer.from(match[2], 'base64');

    const form = new FormData();
    const blob = new Blob([buffer], { type: mimeType });
    form.append('images', blob, mimeType === 'image/png' ? 'orquidea.png' : 'orquidea.jpg');

    const url =
      'https://my-api.plantnet.org/v2/identify/all' +
      '?api-key=' + encodeURIComponent(apiKey) +
      '&lang=es' +
      '&nb-results=5';

    const response = await fetch(url, {
      method: 'POST',
      body: form
    });

    let data = {};
    try {
      data = await response.json();
    } catch (_) {
      return res.status(502).json({ error: 'Pl@ntNet devolvió una respuesta no válida' });
    }

    if (!response.ok) {
      console.error('PlantNet error:', data);
      return res.status(response.status).json({
        error: data?.message || data?.error || 'Pl@ntNet no respondió correctamente'
      });
    }

    const results = (data.results || []).slice(0, 5).map((r) => ({
      score: Math.round(Number(r.score || 0) * 100),
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
      return res.status(200).json({
        identified: false,
        message: 'Pl@ntNet no encontró una coincidencia clara. Prueba otra foto, idealmente de la flor.'
      });
    }

    const best = results[0];

    return res.status(200).json({
      identified: true,
      name: best.scientificName || 'Planta sin identificar',
      scientificName: best.scientificName,
      commonNames: best.commonNames,
      confidence: best.score,
      genus: best.genus,
      family: best.family,
      alternatives: results,
      remaining: data.remainingIdentificationRequests ?? null
    });

  } catch (error) {
    console.error('Error interno PlantNet:', error);
    return res.status(500).json({ error: 'Error al analizar la imagen' });
  }
}
