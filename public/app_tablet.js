// Tablet-optimiertes JavaScript für Training Load Tracker

let players = [];
let selectedPlayer = null;
let selectedDuration = 0;
let selectedRPE = null;
const API_BASE = '/api';

// Initialisierung
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadDataFromServer();
});

function setupEventListeners() {
  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const section = e.target.dataset.section;
      showSection(section);
    });
  });

  // Player Form
  document.getElementById('player-form').addEventListener('submit', handleAddPlayer);

  // Settings
  document.getElementById('export-btn').addEventListener('click', exportData);
  document.getElementById('import-file').addEventListener('change', handleFileImport);
  document.getElementById('clear-data-btn').addEventListener('click', clearAllData);
}

// ========== NAVIGATION ==========

function showSection(sectionName) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const section = document.getElementById(sectionName);
  if (section) section.classList.add('active');

  const navItem = document.querySelector(`[data-section="${sectionName}"]`);
  if (navItem) navItem.classList.add('active');

  if (sectionName === 'dashboard') {
    updateDashboard();
  }
}

// ========== DATA LOADING ==========

async function loadDataFromServer() {
  try {
    const res = await fetch(`${API_BASE}/data`);
    if (!res.ok) throw new Error('Fehler beim Laden der Daten');
    const db = await res.json();
    players = db.players || [];
    updatePlayerGrid();
    updatePlayerList();
    updateDashboard();
  } catch (err) {
    console.error(err);
    showNotification('Fehler beim Laden der Daten vom Server', 'error');
  }
}

// ========== QUICK ENTRY - PLAYER SELECTION ==========

function updatePlayerGrid() {
  const playerGrid = document.getElementById('player-grid');

  if (!players || players.length === 0) {
    playerGrid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color: var(--color-text-secondary);">Keine Spieler vorhanden. Bitte fügen Sie zuerst Spieler in der Spielerverwaltung hinzu.</p>';
    return;
  }

  playerGrid.innerHTML = players.map(player => `
    <button class="player-btn" data-player-id="${player.id}" onclick="selectPlayer('${player.id}')">
      ${player.name}
    </button>
  `).join('');
}

function selectPlayer(playerId) {
  selectedPlayer = players.find(p => p.id === playerId);
  if (!selectedPlayer) return;

  // Visuelle Auswahl
  document.querySelectorAll('.player-btn').forEach(btn => {
    btn.classList.remove('selected');
  });
  document.querySelector(`[data-player-id="${playerId}"]`).classList.add('selected');

  // Zeige Bestätigung
  document.getElementById('selected-player-display').style.display = 'flex';
  document.getElementById('selected-player-name').textContent = selectedPlayer.name;

  updateSubmitButton();
}

function clearPlayerSelection() {
  selectedPlayer = null;
  document.querySelectorAll('.player-btn').forEach(btn => {
    btn.classList.remove('selected');
  });
  document.getElementById('selected-player-display').style.display = 'none';
  updateSubmitButton();
}

// ========== QUICK ENTRY - DURATION ==========

function addDuration(digit) {
  const input = document.getElementById('duration-input');
  let currentValue = input.value === '0' ? '' : input.value;

  // Maximal 3 Ziffern (999 Minuten)
  if (currentValue.length >= 3) return;

  currentValue += digit;
  selectedDuration = parseInt(currentValue) || 0;
  input.value = selectedDuration;

  updatePreview();
  updateSubmitButton();
}

function clearDuration() {
  const input = document.getElementById('duration-input');
  let currentValue = input.value;

  if (currentValue.length > 0) {
    currentValue = currentValue.slice(0, -1);
    selectedDuration = parseInt(currentValue) || 0;
    input.value = selectedDuration || '0';
  }

  updatePreview();
  updateSubmitButton();
}

function setQuickDuration(minutes) {
  selectedDuration = minutes;
  document.getElementById('duration-input').value = minutes;
  updatePreview();
  updateSubmitButton();
}

// ========== QUICK ENTRY - RPE ==========

function selectRPE(rpe) {
  selectedRPE = rpe;

  // Visuelle Auswahl
  document.querySelectorAll('.rpe-btn').forEach(btn => {
    btn.classList.remove('selected');
  });
  document.querySelector(`[data-rpe="${rpe}"]`).classList.add('selected');

  // Zeige Bestätigung
  document.getElementById('selected-rpe-display').style.display = 'block';
  document.getElementById('selected-rpe-value').textContent = rpe;

  updatePreview();
  updateSubmitButton();
}

// ========== QUICK ENTRY - PREVIEW & SUBMIT ==========

function updatePreview() {
  document.getElementById('preview-duration').textContent = selectedDuration;
  document.getElementById('preview-rpe').textContent = selectedRPE || 0;

  const load = selectedDuration * (selectedRPE || 0);
  document.getElementById('preview-load').textContent = load;
}

function updateSubmitButton() {
  const btn = document.getElementById('submit-session-btn');
  const isValid = selectedPlayer && selectedDuration > 0 && selectedRPE;

  btn.disabled = !isValid;
  btn.style.opacity = isValid ? '1' : '0.5';
  btn.style.cursor = isValid ? 'pointer' : 'not-allowed';
}

async function submitQuickSession() {
  if (!selectedPlayer || !selectedDuration || !selectedRPE) {
    showNotification('Bitte alle Felder ausfüllen', 'error');
    return;
  }

  const session = {
    date: new Date().toISOString().split('T')[0],
    duration: selectedDuration,
    rpe: selectedRPE,
    notes: ''
  };

  try {
    const res = await fetch(`${API_BASE}/players/${selectedPlayer.id}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session)
    });

    if (!res.ok) throw new Error('Fehler beim Speichern');

    const created = await res.json();

    // Aktualisiere lokale Daten
    const player = players.find(p => p.id === selectedPlayer.id);
    if (player) {
      if (!player.sessions) player.sessions = [];
      player.sessions.push(created);
    }

    showNotification(`✓ Session für ${selectedPlayer.name} gespeichert!`, 'success');

    // Reset
    resetQuickEntry();
    updateDashboard();

  } catch (err) {
    console.error(err);
    showNotification('Fehler beim Speichern der Session', 'error');
  }
}

function resetQuickEntry() {
  // Reset alle Auswahlen
  selectedPlayer = null;
  selectedDuration = 0;
  selectedRPE = null;

  // Reset UI
  clearPlayerSelection();
  document.getElementById('duration-input').value = '0';
  document.querySelectorAll('.rpe-btn').forEach(btn => btn.classList.remove('selected'));
  document.getElementById('selected-rpe-display').style.display = 'none';

  updatePreview();
  updateSubmitButton();
}

// ========== PLAYER MANAGEMENT ==========

async function handleAddPlayer(e) {
  e.preventDefault();
  const name = document.getElementById('player-name').value.trim();
  if (!name) return showNotification('Bitte geben Sie einen Spielernamen ein.', 'error');

  try {
    const res = await fetch(`${API_BASE}/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });

    if (res.status === 409) {
      return showNotification('Ein Spieler mit diesem Namen existiert bereits.', 'error');
    }

    if (!res.ok) throw new Error('Fehler beim Hinzufügen');

    const created = await res.json();
    players.push(created);

    document.getElementById('player-name').value = '';
    updatePlayerGrid();
    updatePlayerList();
    updateDashboard();

    showNotification(`Spieler "${name}" wurde hinzugefügt.`, 'success');
  } catch (err) {
    console.error(err);
    showNotification('Fehler beim Hinzufügen des Spielers', 'error');
  }
}

async function removePlayer(playerId) {
  const player = players.find(p => p.id === playerId);
  if (!player) return;

  if (!confirm(`Möchten Sie den Spieler "${player.name}" wirklich löschen?\nAlle Sessions dieses Spielers werden ebenfalls gelöscht.`)) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/players/${playerId}`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error('Delete failed');

    players = players.filter(p => p.id !== playerId);

    // Reset Auswahl falls gelöschter Spieler ausgewählt war
    if (selectedPlayer && selectedPlayer.id === playerId) {
      clearPlayerSelection();
    }

    updatePlayerGrid();
    updatePlayerList();
    updateDashboard();

    showNotification(`Spieler "${player.name}" wurde gelöscht.`, 'success');
  } catch (err) {
    console.error(err);
    showNotification('Fehler beim Löschen des Spielers', 'error');
  }
}

function updatePlayerList() {
  const playerList = document.getElementById('player-list');

  if (!players || players.length === 0) {
    playerList.innerHTML = '<p style="text-align:center; color: var(--color-text-secondary);">Keine Spieler vorhanden</p>';
    return;
  }

  playerList.innerHTML = players.map(player => `
    <div class="player-item">
      <span><strong>${player.name}</strong> (${player.sessions ? player.sessions.length : 0} Sessions)</span>
      <button class="btn btn--outline btn--sm" onclick="removePlayer('${player.id}')">Löschen</button>
    </div>
  `).join('');
}

// ========== DASHBOARD ==========

function updateDashboard() {
  const totalPlayers = players.length;
  let totalSessions = 0;
  let totalRPE = 0;
  let totalLoad = 0;
  let recentSessions = [];

  players.forEach(player => {
    if (player.sessions && player.sessions.length > 0) {
      totalSessions += player.sessions.length;
      player.sessions.forEach(session => {
        totalRPE += session.rpe;
        totalLoad += session.trainingLoad || (session.duration * session.rpe);
        recentSessions.push({
          ...session,
          playerName: player.name
        });
      });
    }
  });

  const avgRPE = totalSessions > 0 ? (totalRPE / totalSessions).toFixed(1) : 0;
  const avgLoad = totalSessions > 0 ? Math.round(totalLoad / totalSessions) : 0;

  document.getElementById('total-players').textContent = totalPlayers;
  document.getElementById('total-sessions').textContent = totalSessions;
  document.getElementById('avg-rpe').textContent = avgRPE;
  document.getElementById('avg-load').textContent = avgLoad;

  // Recent Sessions Tabelle
  recentSessions.sort((a, b) => new Date(b.date) - new Date(a.date));
  const recentTop = recentSessions.slice(0, 10);

  const tbody = document.getElementById('recent-sessions-tbody');
  if (recentTop.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Keine Sessions vorhanden</td></tr>';
  } else {
    tbody.innerHTML = recentTop.map(session => {
      const rpeClass = getRPEClass(session.rpe);
      return `
        <tr>
          <td>${formatDate(session.date)}</td>
          <td>${session.playerName}</td>
          <td>${session.duration} Min</td>
          <td class="${rpeClass}">${session.rpe}</td>
          <td>${session.trainingLoad || (session.duration * session.rpe)}</td>
        </tr>
      `;
    }).join('');
  }
}

function getRPEClass(rpe) {
  if (rpe >= 1 && rpe <= 3) return 'rpe-1-3';
  if (rpe >= 4 && rpe <= 6) return 'rpe-4-6';
  if (rpe >= 7 && rpe <= 8) return 'rpe-7-8';
  if (rpe >= 9 && rpe <= 10) return 'rpe-9-10';
  return '';
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

// ========== IMPORT/EXPORT ==========

function exportData() {
  const dataStr = JSON.stringify({
    players: players,
    version: '1.0',
    exportedAt: new Date().toISOString()
  }, null, 2);

  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `training-load-export-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);

  showNotification('Daten wurden exportiert', 'success');
}

async function handleFileImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const imported = JSON.parse(text);

    if (!imported.players || !Array.isArray(imported.players)) {
      throw new Error('Ungültiges Dateiformat');
    }

    const res = await fetch(`${API_BASE}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(imported)
    });

    if (!res.ok) throw new Error('Import fehlgeschlagen');

    await loadDataFromServer();
    showNotification('Daten wurden erfolgreich importiert', 'success');

    e.target.value = '';
  } catch (err) {
    console.error(err);
    showNotification('Fehler beim Importieren der Daten', 'error');
  }
}

async function clearAllData() {
  if (!confirm('Möchten Sie wirklich ALLE Daten löschen?\nDieser Vorgang kann nicht rückgängig gemacht werden!')) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/data`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error('Delete failed');

    players = [];
    resetQuickEntry();
    updatePlayerGrid();
    updatePlayerList();
    updateDashboard();

    showNotification('Alle Daten wurden gelöscht', 'success');
  } catch (err) {
    console.error(err);
    showNotification('Fehler beim Löschen der Daten', 'error');
  }
}

// ========== NOTIFICATIONS ==========

function showNotification(message, type = 'success') {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.className = `notification ${type}`;

  // Trigger reflow
  notification.offsetHeight;

  notification.classList.add('show');

  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}
