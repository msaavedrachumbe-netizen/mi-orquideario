
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'La IA todavía no está activada: falta configurar OPENAI_API_KEY en Vercel.'
    });
  }

  const { image, mode = 'identify', species = 'Otra', notes = '' } = req.body || {};
  if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Falta una imagen válida.' });
  }

  const prompt = mode === 'health'
    ? `Analiza visualmente esta orquídea con prudencia. Tipo registrado: ${species}. Notas del usuario: ${notes || 'ninguna'}.
Devuelve SOLO JSON válido con esta forma:
{"summary":"...","possible_issues":["..."],"suggested_actions":["..."],"confidence":0}
No diagnostiques enfermedades con certeza. Describe solo signos visibles y formula problemas como posibilidades. confidence debe ser entero 0-100.`
    : `Identifica esta orquídea con prudencia. Prioriza el género o grupo hortícola; no inventes especie/cultivar si la imagen no permite distinguirlo.
Devuelve SOLO JSON válido con esta forma:
{"likely_name":"...","type":"Phalaenopsis|Cattleya|Oncidium|Dendrobium|Dracula|Paphiopedilum|Otra","confidence":0,"reason":"...","visible_notes":"..."}
confidence debe ser entero 0-100. Si es un híbrido o no se puede precisar, dilo claramente.`;

  try {
    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-5.6-luna',
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            { type: 'input_image', image_url: image }
          ]
        }],
        max_output_tokens: 600
      })
    });

    const raw = await r.json();
    if (!r.ok) {
      console.error(raw);
      return res.status(502).json({ error: 'El servicio de IA no respondió correctamente.' });
    }

    const text = raw.output_text ||
      (raw.output || []).flatMap(x => x.content || []).find(x => x.type === 'output_text')?.text ||
      '';

    const cleaned = String(text).replace(/^```json\s*/i, '').replace(/```$/,'').trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return res.status(502).json({ error: 'La IA respondió, pero el resultado no pudo interpretarse.' });
    }

    return res.status(200).json(parsed);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error al analizar la imagen.' });
  }
}
