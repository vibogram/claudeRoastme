const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

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
  res.json({ status: 'ok', service: 'RoastMe AI Backend', roasts: leaderboard.length });
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
    ? 'Write all roasts in English only. Use desi and Pakistani cultural references.'
    : language === 'roman'
    ? 'Write all roasts in Roman Urdu ONLY. Urdu spoken out loud written in English letters. Heavy Pakistani street slang. Zero English sentences in any roast.'
    : 'Write all roasts in proper Urdu script only. Use authentic Pakistani expressions.';

  const prompt = `You are the most savage Pakistani roast comedian.
${langInstruction}
Category: ${cat}
Intensity: ${lvl}/10 (${lvlLabel})
Person: "${bio}"

Write exactly 5 roasts about this person. Number them 1 to 5.
Each roast MUST use a completely different structure and angle:
1. A brutal one-liner — one sentence only
2. Start with a fake compliment then destroy them in sentence two
3. Compare them to something useless and explain exactly why
4. Write it like a disappointed Pakistani parent at a dawat
5. One rhetorical question that destroys their self-image

Rules:
- Each roast maximum 2 sentences
- NEVER use: chai, buffering, WiFi, GPS, CCTV, battery
- Be personal — use what they wrote
- No disclaimers or soft openers
- Just the number and roast — no labels like "Roast 1:"`;

  try {
    const apiKey = (process.env.ANTHROPIC_API_KEY || '').replace(/[\r\n\t\s]/g, '');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        temperature: 1,
        top_p: 0.95,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('Anthropic error:', JSON.stringify(err));
      return res.status(502).json({ error: 'AI service error' });
    }

    const data = await response.json();
    const raw = data.content && data.content[0] && data.content[0].text
      ? data.content[0].text.trim()
      : null;

    if (!raw) return res.status(502).json({ error: 'Empty response' });

    const lines = raw.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
    const roasts = [];
    let current = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isNew = /^[1-5][\.\)]\s/.test(line) || /^[1-5]\s/.test(line);
      if (isNew) {
        if (current) roasts.push(current.trim());
        current = line.replace(/^[1-5][\.\)\s]+/, '');
      } else if (current) {
        current = current + ' ' + line;
      }
    }
    if (current) roasts.push(current.trim());

    const validRoasts = roasts.filter(function(r) { return r.length > 10; });

    if (validRoasts.length === 0) {
      return res.json({ roasts: [raw] });
    }

    console.log('Generated ' + validRoasts.length + ' roasts for: ' + bio.substring(0, 20));
    res.json({ roasts: validRoasts });

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/leaderboard', function(req, res) {
  const sorted = leaderboard.slice().sort(function(a, b) {
    return b.votes - a.votes;
  }).slice(0, 10);
  res.json(sorted);
});

app.post('/api/leaderboard/submit', function(req, res) {
  const body = req.body;
  const victim_name = body.victim_name;
  const category = body.category;
  const language = body.language;
  const roast_text = body.roast_text;

  if (!roast_text || !victim_name) {
    return res.status(400).json({ error: 'Missing fields' });
  }

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
    leaderboard = leaderboard.sort(function(a, b) {
      return b.votes - a.votes;
    }).slice(0, 100);
  }

  console.log('Roast submitted by: ' + victim_name + ' | Total: ' + leaderboard.length);
  res.json({ success: true, id: newRoast.id });
});

app.post('/api/leaderboard/vote/:id', function(req, res) {
  const id = req.params.id;
  const roast = leaderboard.find(function(r) { return r.id === id; });
  if (!roast) return res.status(404).json({ error: 'Not found' });
  roast.votes += 1;
  res.json({ success: true, votes: roast.votes });
});

app.listen(PORT, function() {
  console.log('RoastMe backend running on port ' + PORT);
});
