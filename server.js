// server.js

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'database.sqlite');

app.use(cors());
app.use(express.json());

// Serve static UI from public/
app.use(express.static(path.join(__dirname, 'public')));

// Initialize SQLite database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Fehler beim Öffnen der Datenbank:', err);
  } else {
    console.log('SQLite Datenbank verbunden');
    initDatabase();
  }
});

// Create tables if they don't exist
function initDatabase() {
  db.serialize(() => {
    // Players table
    db.run(`
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Sessions table
    db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id TEXT NOT NULL,
        date TEXT NOT NULL,
        duration INTEGER NOT NULL,
        rpe INTEGER NOT NULL,
        training_load INTEGER NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
      )
    `);

    // Metadata table for version tracking
    db.run(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert initial metadata
    db.run(
      "INSERT OR IGNORE INTO metadata (key, value) VALUES ('version', '1.0')",
      (err) => {
        if (err) console.error('Fehler beim Initialisieren der Metadaten:', err);
      }
    );
  });
}

// GET entire data (compatible with JSON format)
app.get('/api/data', (req, res) => {
  db.all('SELECT * FROM players ORDER BY name', [], (err, players) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Fehler beim Lesen der Datenbank' });
    }

    // Get sessions for each player
    const promises = players.map(player => {
      return new Promise((resolve, reject) => {
        db.all(
          'SELECT * FROM sessions WHERE player_id = ? ORDER BY date DESC',
          [player.id],
          (err, sessions) => {
            if (err) reject(err);
            else {
              player.sessions = sessions.map(s => ({
                date: s.date,
                duration: s.duration,
                rpe: s.rpe,
                trainingLoad: s.training_load,
                notes: s.notes || ''
              }));
              resolve(player);
            }
          }
        );
      });
    });

    Promise.all(promises)
      .then(playersWithSessions => {
        db.get(
          "SELECT value, updated_at FROM metadata WHERE key = 'version'",
          [],
          (err, meta) => {
            res.json({
              players: playersWithSessions,
              version: meta ? meta.value : '1.0',
              updatedAt: meta ? meta.updated_at : new Date().toISOString()
            });
          }
        );
      })
      .catch(err => {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Sessions' });
      });
  });
});

// OVERWRITE entire data (use with care)
app.put('/api/data', (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || !Array.isArray(body.players)) {
    return res.status(400).json({ error: 'Ungültiger Body' });
  }

  db.serialize(() => {
    // Clear existing data
    db.run('DELETE FROM sessions');
    db.run('DELETE FROM players');

    // Insert new data
    const stmt = db.prepare('INSERT INTO players (id, name) VALUES (?, ?)');
    const sessionStmt = db.prepare(
      'INSERT INTO sessions (player_id, date, duration, rpe, training_load, notes) VALUES (?, ?, ?, ?, ?, ?)'
    );

    body.players.forEach(player => {
      stmt.run(player.id, player.name);
      if (player.sessions && Array.isArray(player.sessions)) {
        player.sessions.forEach(session => {
          sessionStmt.run(
            player.id,
            session.date,
            session.duration,
            session.rpe,
            session.trainingLoad || session.duration * session.rpe,
            session.notes || ''
          );
        });
      }
    });

    stmt.finalize();
    sessionStmt.finalize();

    // Update metadata
    db.run(
      "UPDATE metadata SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'version'",
      [body.version || '1.0'],
      (err) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Fehler beim Schreiben der Datenbank' });
        }
        res.json({ success: true });
      }
    );
  });
});

// Add a player
app.post('/api/players', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });

  const playerId = 'player_' + Date.now();

  // Check for duplicate (case-insensitive)
  db.get(
    'SELECT id FROM players WHERE LOWER(name) = LOWER(?)',
    [name],
    (err, row) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Fehler beim Hinzufügen des Spielers' });
      }
      if (row) {
        return res.status(409).json({ error: 'Player already exists' });
      }

      // Insert new player
      db.run(
        'INSERT INTO players (id, name) VALUES (?, ?)',
        [playerId, name],
        function(err) {
          if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Fehler beim Hinzufügen des Spielers' });
          }

          // Update metadata
          db.run("UPDATE metadata SET updated_at = CURRENT_TIMESTAMP WHERE key = 'version'");

          res.status(201).json({
            id: playerId,
            name,
            sessions: []
          });
        }
      );
    }
  );
});

// Delete a player
app.delete('/api/players/:id', (req, res) => {
  const id = req.params.id;

  db.get('SELECT id FROM players WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Fehler beim Löschen des Spielers' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Delete player (CASCADE will delete sessions automatically)
    db.run('DELETE FROM players WHERE id = ?', [id], function(err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Fehler beim Löschen des Spielers' });
      }

      // Update metadata
      db.run("UPDATE metadata SET updated_at = CURRENT_TIMESTAMP WHERE key = 'version'");

      res.json({ success: true });
    });
  });
});

// Add a session to a player
app.post('/api/players/:id/sessions', (req, res) => {
  const id = req.params.id;
  const session = req.body;

  if (!session || !session.date || !session.duration || !session.rpe) {
    return res.status(400).json({ error: 'Ungültige Session-Daten' });
  }

  const trainingLoad = Number(session.duration) * Number(session.rpe);

  // Check if player exists
  db.get('SELECT id FROM players WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Fehler beim Hinzufügen der Session' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Insert session
    db.run(
      'INSERT INTO sessions (player_id, date, duration, rpe, training_load, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [id, session.date, session.duration, session.rpe, trainingLoad, session.notes || ''],
      function(err) {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Fehler beim Hinzufügen der Session' });
        }

        // Update metadata
        db.run("UPDATE metadata SET updated_at = CURRENT_TIMESTAMP WHERE key = 'version'");

        res.status(201).json({
          date: session.date,
          duration: session.duration,
          rpe: session.rpe,
          trainingLoad: trainingLoad,
          notes: session.notes || ''
        });
      }
    );
  });
});

// Import (merge) - expects body { players: [...] }
app.post('/api/import', (req, res) => {
  const incoming = req.body;
  if (!incoming || !Array.isArray(incoming.players)) {
    return res.status(400).json({ error: 'Ungültiges Importformat' });
  }

  let addedPlayers = 0;

  db.serialize(() => {
    const checkStmt = db.prepare('SELECT id FROM players WHERE LOWER(name) = LOWER(?)');
    const insertPlayerStmt = db.prepare('INSERT INTO players (id, name) VALUES (?, ?)');
    const insertSessionStmt = db.prepare(
      'INSERT INTO sessions (player_id, date, duration, rpe, training_load, notes) VALUES (?, ?, ?, ?, ?, ?)'
    );

    incoming.players.forEach(imp => {
      if (!imp.name) return;

      checkStmt.get([imp.name], (err, row) => {
        if (err) {
          console.error(err);
          return;
        }

        let playerId;
        if (row) {
          // Player exists, use existing ID
          playerId = row.id;
        } else {
          // Create new player
          playerId = 'player_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          insertPlayerStmt.run([playerId, imp.name]);
          addedPlayers++;
        }

        // Add sessions
        if (imp.sessions && Array.isArray(imp.sessions)) {
          imp.sessions.forEach(s => {
            if (s.date && s.duration && s.rpe) {
              const trainingLoad = s.trainingLoad || (s.duration * s.rpe);
              insertSessionStmt.run([
                playerId,
                s.date,
                s.duration,
                s.rpe,
                trainingLoad,
                s.notes || ''
              ]);
            }
          });
        }
      });
    });

    checkStmt.finalize();
    insertPlayerStmt.finalize();
    insertSessionStmt.finalize(() => {
      // Update metadata
      db.run("UPDATE metadata SET updated_at = CURRENT_TIMESTAMP WHERE key = 'version'");
      res.json({ success: true, addedPlayers });
    });
  });
});

// Clear DB (delete all players and sessions)
app.delete('/api/data', (req, res) => {
  db.serialize(() => {
    db.run('DELETE FROM sessions', (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Fehler beim Löschen der Daten' });
      }

      db.run('DELETE FROM players', (err) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Fehler beim Löschen der Daten' });
        }

        // Update metadata
        db.run("UPDATE metadata SET updated_at = CURRENT_TIMESTAMP WHERE key = 'version'");

        res.json({ success: true });
      });
    });
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) console.error('Fehler beim Schließen der Datenbank:', err);
    else console.log('Datenbank geschlossen');
    process.exit(0);
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
