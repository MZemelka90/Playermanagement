// server.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'database.json');

app.use(cors());
app.use(express.json());

// Serve static UI from public/
app.use(express.static(path.join(__dirname, 'public')));

// Helper: read DB
async function readDB() {
  try {
    const raw = await fs.readFile(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      // return default structure if file doesn't exist
      return { players: [], version: '1.0', updatedAt: new Date().toISOString() };
    }
    throw err;
  }
}

// Helper: write DB (atomic-ish: write temp then rename)
async function writeDB(obj) {
  const tmp = DB_PATH + '.tmp';
  const data = JSON.stringify({ ...obj, updatedAt: new Date().toISOString() }, null, 2);
  await fs.writeFile(tmp, data, 'utf8');
  await fs.rename(tmp, DB_PATH);
}

// GET entire data
app.get('/api/data', async (req, res) => {
  try {
    const db = await readDB();
    res.json(db);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Lesen der Datenbank' });
  }
});

// OVERWRITE entire data (use with care)
app.put('/api/data', async (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Ungültiger Body' });
    }
    await writeDB(body);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Schreiben der Datenbank' });
  }
});

// Add a player
app.post('/api/players', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });

    const db = await readDB();
    // duplicate name check (case-insensitive)
    if (db.players.find(p => p.name.toLowerCase() === name.toLowerCase())) {
      return res.status(409).json({ error: 'Player already exists' });
    }

    const newPlayer = {
      id: 'player_' + Date.now(),
      name,
      sessions: []
    };
    db.players.push(newPlayer);
    await writeDB(db);
    res.status(201).json(newPlayer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Hinzufügen des Spielers' });
  }
});

// Delete a player
app.delete('/api/players/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const db = await readDB();
    const exists = db.players.some(p => p.id === id);
    if (!exists) return res.status(404).json({ error: 'Player not found' });

    db.players = db.players.filter(p => p.id !== id);
    await writeDB(db);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Löschen des Spielers' });
  }
});

// Add a session to a player
app.post('/api/players/:id/sessions', async (req, res) => {
  try {
    const id = req.params.id;
    const session = req.body;
    if (!session || !session.date || !session.duration || !session.rpe) {
      return res.status(400).json({ error: 'Ungültige Session-Daten' });
    }
    session.trainingLoad = Number(session.duration) * Number(session.rpe);
    const db = await readDB();
    const player = db.players.find(p => p.id === id);
    if (!player) return res.status(404).json({ error: 'Player not found' });

    player.sessions = player.sessions || [];
    player.sessions.push(session);
    await writeDB(db);
    res.status(201).json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Hinzufügen der Session' });
  }
});

// Import (merge) - expects body { players: [...] }
app.post('/api/import', async (req, res) => {
  try {
    const incoming = req.body;
    if (!incoming || !Array.isArray(incoming.players)) {
      return res.status(400).json({ error: 'Ungültiges Importformat' });
    }

    const db = await readDB();
    let addedPlayers = 0;

    incoming.players.forEach(imp => {
      if (!imp.name) return;
      const existing = db.players.find(p => p.name.toLowerCase() === imp.name.toLowerCase());
      if (existing) {
        // merge sessions (basic merge: append valid sessions)
        (imp.sessions || []).forEach(s => {
          if (s.date && s.duration && s.rpe) {
            existing.sessions = existing.sessions || [];
            existing.sessions.push({
              date: s.date,
              duration: s.duration,
              rpe: s.rpe,
              trainingLoad: s.trainingLoad || (s.duration * s.rpe),
              notes: s.notes || ''
            });
          }
        });
      } else {
        db.players.push({
          id: 'player_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
          name: imp.name,
          sessions: (imp.sessions || []).filter(s => s.date && s.duration && s.rpe).map(s => ({
            date: s.date,
            duration: s.duration,
            rpe: s.rpe,
            trainingLoad: s.trainingLoad || (s.duration * s.rpe),
            notes: s.notes || ''
          }))
        });
        addedPlayers++;
      }
    });

    await writeDB(db);
    res.json({ success: true, addedPlayers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Import' });
  }
});

// Clear DB (delete all players) - careful
app.delete('/api/data', async (req, res) => {
  try {
    const empty = { players: [], version: '1.0', updatedAt: new Date().toISOString() };
    await writeDB(empty);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fehler beim Löschen der Daten' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
