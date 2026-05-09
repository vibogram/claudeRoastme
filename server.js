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
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  }
}));

// ── JSONBIN HELPERS ──
var BIN_ID = process.env.JSONBIN_ID;
var BIN_KEY = process.env.JSONBIN_KEY;

function readBin() {
  return fetch('https://api.jsonbin.io/v3/b/' + BIN_ID + '/latest', {
    method: 'GET',
    headers: {
      'X-Master-Key': BIN_KEY,
      'X-Bin-Meta': 'false'
    }
  }).then(function(res) {
    if (!res.ok) throw new Error('JSONBin read failed: ' + res.status);
    return res.json();
  }).then(function(data) {
    if (data && data.roasts) return data;
    return { roasts: [] };
  });
}

function writeBin(record) {
  return fetch('https://api.jsonbin.io/v3/b/' + BIN_ID, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': BIN_KEY
    },
    body: JSON.stringify(record)
  }).then(function(res) {
    if (!res.ok) throw new Error('JSONBin write failed: ' + res.status);
    return res.json();
  });
}

// ── HEALTH CHECK ──
app.get('/', function(req, res) {
  res.json({
    status: 'ok',
    service: 'RoastMe AI Backend',
    jsonbinConfigured: !!(BIN_ID && BIN_KEY)
  });
});

// ── GENERATE ROAST ──
app.post('/api/roast', async function(req, res) {
  var bio = req.body.bio;
  var category = req.body.category;
  var language = req.body.language;
  var intensity = req.body.intensity;

  if (!bio || typeof bio !== 'string') return res.status(400).json({ error: 'bio is required' });
  if (bio.length > 500) return res.status(400).json({ error: 'bio too long' });

  var intensityLabels = {
    1:'Mild',2:'Soft',3:'Light',4:'Medium',5:'Spicy',
    6:'Hot',7:'Savage',8:'Brutal',9:'Nuclear',10:'DESTROYER'
  };

  var catInstructions = {
    general:       'Savage personality roast — attack their whole existence.',
    career:        'Demolish their career, job, and professional life.',
    relationships: 'Destroy their love life and romantic history.',
    family:        'Classic desi family roast — cousins, parents, rishta rejections.',
    fashion:       'Obliterate their fashion sense completely.',
    rizq:          'Roast their broke energy and bad money decisions.'
  };

  var cat = catInstructions[category] || catInstructions.general;
  var lvl = parseInt(intensity) || 7;
  var lvlLabel = intensityLabels[lvl] || 'Savage';

  var langInstruction = language === 'english'
    ? 'Write all roasts in English only. Use desi and Pakistani cultural references.'
    : language === 'roman'
    ? 'Write all roasts in Roman Urdu ONLY. Urdu spoken out loud written in English letters. Heavy Pakistani street slang. Zero English sentences in any roast.'
    : 'Write all roasts in proper Urdu script only. Use authentic Pakistani expressions.';

  var prompt = 'You are the most savage Pakistani roast comedian.\n'
    + langInstruction + '\n'
    + 'Category: ' + cat + '\n'
    + 'Intensity: ' + lvl + '/10 (' + lvlLabel + ')\n'
    + 'Person: "' + bio + '"\n\n'
    + 'Write exactly 5 roasts about this person. Number them 1 to 5.\n'
    + 'Each roast MUST use a completely different structure and angle:\n'
    + '1. A brutal one-liner — one sentence only\n'
    + '2. Start with a fake compliment then destroy them in sentence two\n'
    + '3. Compare them to something useless and explain exactly why\n'
    + '4. Write it like a disappointed Pakistani parent at a dawat\n'
    + '5. One rhetorical question that destroys their self-image\n\n'
    + 'Rules:\n'
    + '- Each roast maximum 2 sentences\n'
    + '- NEVER use: chai, buffering, WiFi, GPS, CCTV, battery\n'
    + '- Be personal — use what they wrote\n'
    + '- No disclaimers or soft openers\n'
    + '- Just the number and roast, no labels like Roast 1:';

  try {
    var apiKey = (process.env.ANTHROPIC_API_KEY || '').replace(/[\r\n\t\s]/g, '');
    var response = await fetch('https://api.anthropic.com/v1/messages', {
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
      var err = await response.json();
      console.error('Anthropic error:', JSON.stringify(err));
      return res.status(502).json({ error: 'AI service error' });
    }

    var data = await response.json();
    var raw = data.content && data.content[0] && data.content[0].text
      ? data.content[0].text.trim() : null;

    if (!raw) return res.status(502).json({ error: 'Empty response' });

    var lines = raw.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
    var roasts = [];
    var current = '';

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var isNew = /^[1-5][\.\)]\s/.test(line) || /^[1-5]\s/.test(line);
      if (isNew) {
        if (current) roasts.push(current.trim());
        current = line.replace(/^[1-5][\.\)\s]+/, '');
      } else if (current) {
        current = current + ' ' + line;
      }
    }
    if (current) roasts.push(current.trim());

    var validRoasts = roasts.filter(function(r) { return r.length > 10; });
    if (validRoasts.length === 0) return res.json({ roasts: [raw] });

    console.log('Generated ' + validRoasts.length + ' roasts for: ' + bio.substring(0, 20));
    res.json({ roasts: validRoasts });

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET LEADERBOARD ──
app.get('/api/leaderboard', async function(req, res) {
  try {
    var record = await readBin();
    var sorted = (record.roasts || []).slice().sort(function(a, b) {
      return b.votes - a.votes;
    }).slice(0, 10);
    res.json(sorted);
  } catch (err) {
    console.error('Leaderboard error:', err.message);
    res.status(500).json({ error: 'Could not fetch leaderboard' });
  }
});

// ── SUBMIT ROAST ──
app.post('/api/leaderboard/submit', async function(req, res) {
  var victim_name = req.body.victim_name;
  var category = req.body.category;
  var language = req.body.language;
  var roast_text = req.body.roast_text;

  if (!roast_text || !victim_name) return res.status(400).json({ error: 'Missing fields' });

  try {
    var record = await readBin();
    var newRoast = {
      id: Date.now().toString(),
      victim_name: victim_name.substring(0, 30),
      category: category || 'general',
      language: language || 'english',
      roast_text: roast_text.substring(0, 500),
      votes: 0,
      created_at: new Date().toISOString()
    };

    record.roasts.push(newRoast);

    if (record.roasts.length > 100) {
      record.roasts = record.roasts.sort(function(a, b) {
        return b.votes - a.votes;
      }).slice(0, 100);
    }

    await writeBin(record);
    console.log('Submitted: ' + victim_name + ' | Total: ' + record.roasts.length);
    res.json({ success: true, id: newRoast.id });

  } catch (err) {
    console.error('Submit error:', err.message);
    res.status(500).json({ error: 'Could not submit' });
  }
});

// ── VOTE ──
app.post('/api/leaderboard/vote/:id', async function(req, res) {
  var id = req.params.id;
  try {
    var record = await readBin();
    var roast = null;
    for (var i = 0; i < record.roasts.length; i++) {
      if (record.roasts[i].id === id) { roast = record.roasts[i]; break; }
    }
    if (!roast) return res.status(404).json({ error: 'Not found' });
    roast.votes += 1;
    await writeBin(record);
    res.json({ success: true, votes: roast.votes });
  } catch (err) {
    console.error('Vote error:', err.message);
    res.status(500).json({ error: 'Could not vote' });
  }
});

app.listen(PORT, function() {
  console.log('RoastMe backend running on port ' + PORT);
  console.log('JSONBin ID:', BIN_ID ? 'SET' : 'MISSING');
  console.log('JSONBin Key:', BIN_KEY ? 'SET' : 'MISSING');
});
