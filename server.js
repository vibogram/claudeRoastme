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
    ? 'Write all roasts in English only. Use desi/Pakistani cultural references.'
    : language === 'roman'
    ? 'Write all roasts in Roman Urdu ONLY — Urdu spoken out loud written in English letters. Heavy Pakistani street slang. Zero English sentences. Every single roast must be pure Roman Urdu.'
    : 'Write all roasts in proper Urdu script only.';

  const prompt = `You are the most savage Pakistani roast comedian. 
${langInstruction}
Category: ${cat}
Intensity: ${lvl}/10 (${lvlLabel})
Person: "${bio}"

Write exactly 5 roasts about this person. Number them 1 to 5.
Each roast MUST use a completely different structure, tone and angle:
1. A brutal one-liner — one sentence only, hits like a slap
2. Start with a fake compliment, then completely destroy them in the second sentence
3. Compare them to something hilariously useless and explain why they are exactly like it
4. Write it like a disappointed Pakistani parent talking about their child at a dawat
5. Ask one rhetorical question that makes them question their entire existence

Hard rules:
- Each roast maximum 2 sentences
- NEVER use: chai, buffering, WiFi, GPS, CCTV, 1% battery, loading
- Be personal — use what they actually wrote
- Make each one feel completely different in wording and structure
- No disclaimers, no soft openers, no numbering labels like "Roast 1:" — just the number and the roast
- If Roman Urdu: every word of every roast must be Roman Urdu, zero English`;

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
    const raw = data.content?.[0]?.text?.trim();
    if (!raw) return res.status(502).json({ error: 'Empty response' });

    // Parse the 5 numbered roasts
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    const roasts = [];
    let current = '';

    for (const line of lines) {
      // Check if line starts with a number like "1." or "1)" or just "1"
      const isNewRoast = /^[1-5][\.\)]\s/.test(line) || /^[1-5]\s/.test(line);
      if (isNewRoast) {
        if (current) roasts.push(current.trim());
        current = line.replace(/^[1-5][\.\)]\s*/, '').replace(/^[1-5]\s*/, '');
      } else if (current) {
        current += ' ' + line;
      }
    }
    if (current) roasts.push(current.trim());

    // Make sure we have roasts
    const validRoasts = roasts.filter(r => r.length > 10);
    if (validRoasts.length === 0) {
      return res.status(502).json({ error: 'Could not parse roasts' });
    }

    console.log(`Generated ${validRoasts.length} roasts for: ${bio.substring(0,20)}`);
    res.json({ roasts: validRoasts });

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
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
    'one brutal one-liner — single sentence, no mercy, land it like a slap',
    'two sentences — first lull them with something almost nice, second sentence destroys them completely',
    'ask them one rhetorical question that makes them question every life decision they have made',
    'compare them to a broken or useless everyday object and explain exactly why',
    'roast them like a disappointed Pakistani father reading their results',
    'roast them like their best friend who has been holding this in for years',
    'start with "Bhai suno..." and then destroy their entire personality in one breath',
    'roast them like a disappointed desi mother at a rishta meeting',
    'roast them like a Pakistani uncle at a dawat who corners you near the biryani',
    'make an analogy — "Tu bilkul X ki tarah hai" — and make X hilariously specific and insulting',
  ];

  const angles = [
    'focus on their lack of ambition',
    'focus on how average and forgettable they are',
    'focus on their overconfidence vs zero results',
    'focus on how their friends secretly pity them',
    'focus on their relationship with failure',
    'focus on how even inanimate objects perform better than them',
    'focus on their delusional self-image',
    'focus on what their ammi secretly thinks of them',
  ];

  const randomStyle = styles[Math.floor(Math.random() * styles.length)];
  const randomAngle = angles[Math.floor(Math.random() * angles.length)];
  const randomSeed = Math.floor(Math.random() * 9999);

  const prompt = `You are the most savage Pakistani roast comedian on the internet. Every roast you write is completely unique.
${langInstruction}
Category: ${cat}
Intensity: ${lvl}/10 (${lvlLabel})
Person info: "${bio}"
Delivery style: ${randomStyle}
Angle to attack: ${randomAngle}
Random seed (use this to make your response unique): ${randomSeed}

Rules:
- Maximum 2 sentences. Short and punchy.
- NEVER use these overused phrases: "tu wo chai hai", "buffering", "CCTV", "GPS", "WiFi", "1% battery"
- Be personal — use what they actually wrote against them specifically
- Every roast must feel completely different in structure and wording from any previous roast
- Be funny AND savage — land the punchline hard
- No disclaimers or soft openers
- If Roman Urdu: pure Roman Urdu only, zero English sentences`;
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
        top_p: 0.95,,
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
