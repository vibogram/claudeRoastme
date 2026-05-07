const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Log environment check on startup
const rawKey = process.env.ANTHROPIC_API_KEY || '';
const cleanKey = rawKey.replace(/[\r\n\t\s]/g, '');
console.log('API Key loaded:', cleanKey ? `YES (length: ${cleanKey.length})` : 'NO - MISSING');
console.log('Frontend URL:', process.env.FRONTEND_URL || 'NOT SET');

const allowedOrigins = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  }
}));

let leaderboard = [];

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'RoastMe AI Backend',
    apiKeySet: !!cleanKey,
    roastsInMemory: leaderboard.length
  });
});

app.post('/api/roast', async (req, res) => {
  const { bio, category, language, intensity } = req.body;
  if (!bio || typeof bio !== 'string') return res.status(400).json({ error: 'bio is required' });
  if (bio.length > 500) return res.status(400).json({ error: 'bio too long' });

  const intensityLabels = {
    1:'Mild',2:'Soft',3:'Light',4:'Medium',5:'Spicy',
    6:'Hot',7:'Savage',8:'Brutal',9:'Nuclear',10:'DESTROYER'
  };
  const catInstructions = {
    general:       'Savage personality roast — attack their whole existence.',
    career:        'Demolish their career, job, and professional life.',
    relationships: 'Destroy their love life and romantic history.',
    family:        'Classic desi family roast — cousins, parents, rishta rejections.',
    fashion:       'Obliterate their fashion sense completely.',
    rizq:          'Roast their broke energy and bad money decisions.'
  };

  const cat = catInstructions[category] || catInstructions.general;
  const lvl = parseInt(intensity) || 7;
  const lvlLabel = intensityLabels[lvl] || 'Savage';

  const langInstruction = language === 'english'
    ? 'Respond in English only. Use desi references and Pakistani cultural context.'
    : language === 'roman'
    ? 'Respond ONLY in Roman Urdu — Urdu written in English letters. Heavy Pakistani street slang. NO English sentences at all.'
    : 'Respond in proper Urdu script only. Use authentic Pakistani Urdu expressions.';

  const styles = [
    'one brutal one-liner — single sentence, no mercy',
    'two short punchy sentences — first sets up, second destroys',
    'start with a fake compliment then flip it into a savage insult',
    'ask a rhetorical question that makes them question their existence',
    'compare them to something hilariously useless or broken',
    'roast them like a disappointed desi parent',
    'roast them like their best friend who knows all their secrets',
  ];
  const randomStyle = styles[Math.floor(Math.random() * styles.length)];

  const prompt = `You are the most savage Pakistani roast comedian on the internet.
${langInstruction}
Category: ${cat}
Intensity: ${lvl}/10 (${lvlLabel}).
Person info: "${bio}"
Style for THIS roast: ${randomStyle}
Rules:
- Maximum 2 sentences. Short and punchy.
- Be personal — use what they wrote against them.
- Be funny AND savage.
- No disclaimers or soft openers.
- If Roman Urdu: pure Roman Urdu only, zero English sentences.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cleanKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 120,
        temperature: 1,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('Anthropic error:', JSON.stringify(err));
      return res.status(502).json({ error: 'AI service error' });
    }

    const data = await response.json();
    const roast = data.content?.[0]?.text?.trim();
    if (!roast) return res.status(502).json({ error: 'Empty response' });
    res.json({ roast });

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/leaderboard', (req, res) => {
  const sorted = [...leaderboard].sort((a, b) => b.votes - a.votes).slice(0, 10);
  res.json(sorted);
});

app.post('/api/leaderboard/submit', (req, res) => {
  const { victim_name, category, language, roast_text } = req.body;
  if (!roast_text || !victim_name) return res.status(400).json({ error: 'Missing fields' });

  const newRoast = {
    id: Date.now().toString(),
    victim_name: victim_name.substring(0, 30),
    category: category || 'general',
    language: language || 'english',
    roast_text: roast_text.substring(0, 500),
    votes: 0,
    created_at: new Date().toISOString()
  };
  leaderboard.push(newRoast);
  if (leaderboard.length > 100) {
    leaderboard = leaderboard.sort((a, b) => b.votes - a.votes).slice(0, 100);
  }
  console.log(`Roast submitted by: ${victim_name} | Total roasts: ${leaderboard.length}`);
  res.json({ success: true, id: newRoast.id });
});

app.post('/api/leaderboard/vote/:id', (req, res) => {
  const { id } = req.params;
  const roast = leaderboard.find(r => r.id === id);
  if (!roast) return res.status(404).json({ error: 'Not found' });
  roast.votes += 1;
  res.json({ success: true, votes: roast.votes });
});

app.listen(PORT, () => {
  console.log(`RoastMe backend running on port ${PORT}`);
});
