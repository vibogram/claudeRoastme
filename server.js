const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Allow requests from your frontend domain
// Replace with your actual deployed frontend URL
const allowedOrigins = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  process.env.FRONTEND_URL, // e.g. https://roastmeai.pk
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  }
}));

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'RoastMe AI Backend' });
});

// Roast generation endpoint
app.post('/api/roast', async (req, res) => {
  const { bio, category, language, intensity } = req.body;

  // Basic validation
  if (!bio || typeof bio !== 'string') {
    return res.status(400).json({ error: 'bio is required' });
  }
  if (bio.length > 500) {
    return res.status(400).json({ error: 'bio too long (max 500 chars)' });
  }

  const intensityLabels = {
    1:'Mild',2:'Soft',3:'Light',4:'Medium',5:'Spicy',
    6:'Hot',7:'Savage',8:'Brutal',9:'Nuclear',10:'DESTROYER'
  };

  const catInstructions = {
    general:       'Savage personality roast — attack their whole existence.',
    career:        'Demolish their career, job, and professional life. Make it sting.',
    relationships: 'Destroy their love life, rizta prospects, and romantic history.',
    family:        'Classic desi family roast — cousins being compared, parents ashamed, rishta rejections.',
    fashion:       'Absolutely obliterate their fashion sense and how they look.',
    rizq:          'Roast their broke energy, bad money decisions, and empty wallet.'
  };

  const cat = catInstructions[category] || catInstructions.general;
  const lvl = parseInt(intensity) || 7;
  const lvlLabel = intensityLabels[lvl] || 'Savage';

  const langInstruction = language === 'english'
    ? 'Respond in English only. Use desi references and Pakistani cultural context.'
    : language === 'roman'
    ? `Respond ONLY in Roman Urdu — Urdu spoken out loud but written in English letters. Use heavy Pakistani street slang and desi expressions throughout. Examples of tone: "yaar tu itna useless hai ke teri ammi bhi pachtaati hai", "bhai seedha bata de, tune life mein kya achieve kiya hai — zero? haan socha hi tha", "tera confidence dekh ke Allah bhi kehta hoga yeh banda kahan se aaya". Every sentence should feel like it came from a Pakistani roast show. NO English sentences — pure Roman Urdu only.`
    : 'Respond in proper Urdu script (اردو) only. Use authentic Pakistani Urdu, street expressions, and cultural references.';

  const prompt = const styles = [
    'one brutal one-liner — single sentence, no mercy',
    'two short punchy sentences — first sets up, second destroys',
    'start with a fake compliment then flip it into a savage insult',
    'ask them a rhetorical question that makes them question their existence',
    'compare them to something hilariously useless or broken',
    'roast them like a disappointed desi parent',
    'roast them like their best friend who knows all their secrets',
  ];
  const randomStyle = styles[Math.floor(Math.random() * styles.length)];

  const openers = [
    'Yaar,', 'Bhai suno,', 'Dekho,', 'Seedha baat,',
    'Sunno,', 'Honestly,', 'Bhai,', 'Ek baat batao,'
  ];
  const randomOpener = activeLang === 'roman'
    ? openers[Math.floor(Math.random() * openers.length)]
    : '';

  const prompt = `You are the most savage Pakistani roast comedian on the internet.
${langInstruction}
Category: ${cat}
Intensity: ${lvl}/10 (${lvlLabel}).
Person's info: "${bio}"

Style for THIS roast: ${randomStyle}
${randomOpener ? `Start with: "${randomOpener}"` : ''}

Rules:
- NEVER repeat a roast structure you have used before in this conversation
- Every roast must feel completely different in angle and delivery
- Be personal — use what they wrote against them specifically
- Be funny AND savage
- Maximum 2 sentences
- No disclaimers, no soft openers unless specified above
- If Roman Urdu: pure Roman Urdu only, no English sentences`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 120,
        temperature: 1,
        messages: [{ role: 'user', content: prompt }]
      })

    if (!response.ok) {
      const err = await response.json();
      console.error('Anthropic error:', err);
      return res.status(502).json({ error: 'AI service error', details: err.error?.message });
    }

    const data = await response.json();
    const roast = data.content?.[0]?.text?.trim();

    if (!roast) {
      return res.status(502).json({ error: 'Empty response from AI' });
    }

    res.json({ roast });

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`RoastMe backend running on port ${PORT}`);
});
