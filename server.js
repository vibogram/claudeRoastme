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

var SHEETDB_URL = process.env.SHEETDB_URL;
var rawKey = process.env.ANTHROPIC_API_KEY || '';
var cleanKey = rawKey.replace(/[\r\n\t\s]/g, '');

app.get('/', function(req, res) {
  res.json({
    status: 'ok',
    service: 'RoastMe AI Backend',
    apiKeySet: !!cleanKey,
    sheetdb: !!SHEETDB_URL
  });
});

app.post('/api/roast', async function(req, res) {
  var bio = req.body.bio;
  var category = req.body.category;
  var language = req.body.language;
  var intensity = req.body.intensity;

  if (!bio || typeof bio !== 'string') {
    return res.status(400).json({ error: 'bio is required' });
  }
  if (bio.length > 500) {
    return res.status(400).json({ error: 'bio too long' });
  }

  var intensityLabels = {
    1:'Mild', 2:'Soft', 3:'Light', 4:'Medium', 5:'Spicy',
    6:'Hot', 7:'Savage', 8:'Brutal', 9:'Nuclear', 10:'DESTROYER'
  };

  var catInstructions = {
    general:       'Savage personality roast - attack their whole existence.',
    career:        'Demolish their career, job, and professional life.',
    relationships: 'Destroy their love life and romantic history.',
    family:        'Classic desi family roast - cousins, parents, rishta rejections.',
    fashion:       'Obliterate their fashion sense completely.',
    rizq:          'Roast their broke energy and bad money decisions.'
  };

  var cat = catInstructions[category] || catInstructions.general;
  var lvl = parseInt(intensity) || 7;
  var lvlLabel = intensityLabels[lvl] || 'Savage';

  var langInstruction = language === 'english'
    ? 'Write all roasts in English only. Use desi and Pakistani cultural references.'
    : language === 'roman'
    ? 'Write all roasts in Roman Urdu ONLY. Urdu written in English letters. Heavy Pakistani street slang. Zero English sentences in any roast.'
    : 'Write all roasts in proper Urdu script only. Use authentic Pakistani expressions.';

  var prompt = 'You are the most savage Pakistani roast comedian.\n'
    + langInstruction + '\n'
    + 'Category: ' + cat + '\n'
    + 'Intensity: ' + lvl + '/10 (' + lvlLabel + ')\n'
    + 'Person: "' + bio + '"\n\n'
    + 'Write exactly 5 roasts. Number them 1 to 5.\n'
    + 'Each must use a completely different structure:\n'
    + '1. One brutal sentence - no mercy\n'
    + '2. Fake compliment then destroy them\n'
    + '3. Compare them to something useless\n'
    + '4. Like a disappointed Pakistani parent at dawat\n'
    + '5. One rhetorical question that destroys their self-image\n\n'
    + 'Rules:\n'
    + '- Max 2 sentences each\n'
    + '- NEVER use: chai, buffering, WiFi, GPS, CCTV, battery\n'
    + '- Be personal, use what they wrote\n'
    + '- No disclaimers, just number and roast';

  try {
    var response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cleanKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 500,
        temperature: 1,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      var errBody = await response.json();
      console.error('Anthropic error:', JSON.stringify(errBody));
      return res.status(502).json({ error: 'AI service error' });
    }

    var data = await response.json();
    var raw = data.content && data.content[0] && data.content[0].text
      ? data.content[0].text.trim() : null;

    if (!raw) {
      return res.status(502).json({ error: 'Empty response' });
    }

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

app.get('/api/leaderboard', async function(req, res) {
  try {
    var response = await fetch(SHEETDB_URL + '?limit=500');
    if (!response.ok) {
      throw new Error('SheetDB read failed: ' + response.status);
    }
    var rows = await response.json();
    var valid = rows.filter(function(r) { return r.roast_text; });
    var sorted = valid.sort(function(a, b) {
      return parseInt(b.votes || 0) - parseInt(a.votes || 0);
    }).map(function(r) {
      return {
        id: r.id,
        victim_name: r.victim_name || '',
        category: r.category || 'general',
        language: r.language || 'english',
        roast_text: r.roast_text || '',
        votes: parseInt(r.votes || 0)
      };
    });
    res.json(sorted);
  } catch (err) {
    console.error('Leaderboard error:', err.message);
    res.status(500).json({ error: 'Could not fetch leaderboard' });
  }
});

app.post('/api/leaderboard/submit', async function(req, res) {
  var victim_name = req.body.victim_name;
  var category = req.body.category;
  var language = req.body.language;
  var roast_text = req.body.roast_text;

  if (!roast_text || !victim_name) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    var newId = Date.now().toString();
    var response = await fetch(SHEETDB_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [{
          id: newId,
          victim_name: victim_name.substring(0, 30),
          category: category || 'general',
          language: language || 'english',
          roast_text: roast_text.substring(0, 500),
          votes: '0'
        }]
      })
    });

    if (!response.ok) {
      var errText = await response.text();
      console.error('SheetDB submit error:', errText);
      return res.status(500).json({ error: 'Could not submit' });
    }

    console.log('Submitted roast by: ' + victim_name);
    res.json({ success: true, id: newId });

  } catch (err) {
    console.error('Submit error:', err.message);
    res.status(500).json({ error: 'Could not submit' });
  }
});

app.post('/api/leaderboard/vote/:id', async function(req, res) {
  var id = req.params.id;
  try {
    var getRes = await fetch(SHEETDB_URL + '/search?id=' + id);
    if (!getRes.ok) {
      throw new Error('Could not find record');
    }
    var records = await getRes.json();
    if (!records || records.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    var currentVotes = parseInt(records[0].votes || 0);
    var newVotes = currentVotes + 1;

    var patchRes = await fetch(SHEETDB_URL + '/id/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { votes: newVotes.toString() } })
    });

    if (!patchRes.ok) {
      throw new Error('Could not update votes');
    }

    res.json({ success: true, votes: newVotes });

  } catch (err) {
    console.error('Vote error:', err.message);
    res.status(500).json({ error: 'Could not vote' });
  }
});

app.listen(PORT, function() {
  console.log('RoastMe backend running on port ' + PORT);
  console.log('API Key loaded: ' + (cleanKey ? 'YES (length: ' + cleanKey.length + ')' : 'NO - MISSING'));
  console.log('SheetDB configured: ' + (SHEETDB_URL ? 'YES' : 'NO'));
});
