// public/app.js

let players = [];
let currentChart = null;
let sortDirection = {};
const API_BASE = '/api';

const rpeDescriptions = {
  1: 'Sehr, sehr leicht',
  2: 'Leicht',
  3: 'Moderat',
  4: 'Etwas hart',
  5: 'Hart',
  6: 'Hart',
  7: 'Sehr hart',
  8: 'Sehr hart',
  9: 'Sehr hart',
  10: 'Maximal'
};

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadDataFromServer();
  setTodayDate();
});

function setupEventListeners() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const section = e.target.dataset.section;
      showSection(section);
    });
  });

  document.getElementById('player-form').addEventListener('submit', handleAddPlayer);
  document.getElementById('session-form').addEventListener('submit', handleAddSession);
  document.getElementById('session-rpe').addEventListener('input', updateRpeDisplay);
  document.getElementById('session-duration').addEventListener('input', calculateTrainingLoad);
  document.getElementById('dashboard-player-select').addEventListener('change', updatePlayerStats);
  document.getElementById('export-btn').addEventListener('click', exportData);
  document.getElementById('import-file').addEventListener('change', handleFileImport);
  document.getElementById('clear-data-btn').addEventListener('click', clearAllData);
}

// UI Helpers
function showSection(sectionName) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const sec = document.getElementById(sectionName);
  if (sec) sec.classList.add('active');
  const navItem = document.querySelector(`[data-section="${sectionName}"]`);
  if (navItem) navItem.classList.add('active');
  if (sectionName === 'dashboard') updateDashboard();
}

// Load data from server
async function loadDataFromServer() {
  try {
    const res = await fetch(`${API_BASE}/data`);
    if (!res.ok) throw new Error('Fehler beim Laden der Daten');
    const db = await res.json();
    players = db.players || [];
    updatePlayerList();
    updatePlayerLists();
    updateDashboard();
  } catch (err) {
    console.error(err);
    showNotification('Fehler beim Laden der Daten vom Server', 'error');
  }
}

// Add player (POST)
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
    if (res.status === 409) return showNotification('Ein Spieler mit diesem Namen existiert bereits.', 'error');
    if (!res.ok) throw new Error('Fehler beim Hinzufügen');
    const created = await res.json();
    players.push(created);
    document.getElementById('player-name').value = '';
    updatePlayerList();
    updatePlayerLists();
    updateDashboard();
    showNotification(`Spieler "${name}" wurde hinzugefügt.`, 'success');
  } catch (err) {
    console.error(err);
    showNotification('Fehler beim Hinzufügen des Spielers', 'error');
  }
}

// Remove player (DELETE)
async function removePlayer(playerId) {
  const player = players.find(p => p.id === playerId);
  if (!player) return;
  if (!confirm(`Möchten Sie den Spieler "${player.name}" wirklich löschen? Alle Sessions dieses Spielers werden ebenfalls gelöscht.`)) return;

  try {
    const res = await fetch(`${API_BASE}/players/${playerId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    players = players.filter(p => p.id !== playerId);
    updatePlayerList();
    updatePlayerLists();
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
    playerList.innerHTML = '<p style="text-align: center; color: var(--color-text-secondary);">Keine Spieler vorhanden</p>';
    return;
  }
  playerList.innerHTML = players.map(player => `
    <div class="player-item">
      <div>
        <strong>${player.name}</strong>
        <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">
          ${player.sessions ? player.sessions.length : 0} Sessions
        </div>
      </div>
      <button class="btn btn--sm btn--outline" onclick="removePlayer('${player.id}')" style="border-color: var(--color-error); color: var(--color-error);">Löschen</button>
    </div>
  `).join('');
}

function updatePlayerLists() {
  const selects = ['session-player', 'dashboard-player-select'];
  selects.forEach(selectId => {
    const select = document.getElementById(selectId);
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = '<option value="">Spieler auswählen...</option>' + players.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    if (players.find(p => p.id === currentValue)) select.value = currentValue;
  });
}

// Add session (POST to /players/:id/sessions)
async function handleAddSession(e) {
  e.preventDefault();
  const playerId = document.getElementById('session-player').value;
  const date = document.getElementById('session-date').value;
  const duration = parseInt(document.getElementById('session-duration').value, 10);
  const rpe = parseInt(document.getElementById('session-rpe').value, 10);
  const notes = document.getElementById('session-notes').value.trim();

  if (!playerId || !date || !duration || !rpe) {
    return showNotification('Bitte füllen Sie alle Pflichtfelder aus.', 'error');
  }

  const payload = { date, duration, rpe, notes };

  try {
    const res = await fetch(`${API_BASE}/players/${playerId}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Fehler beim Speichern der Session');
    const created = await res.json();
    // update local players array
    const player = players.find(p => p.id === playerId);
    if (player) {
      player.sessions = player.sessions || [];
      player.sessions.push(created);
    }
    document.getElementById('session-form').reset();
    document.getElementById('session-rpe').value = 5;
    updateRpeDisplay();
    setTodayDate();
    updateDashboard();
    showNotification(`Session für ${player ? player.name : 'Spieler'} wurde gespeichert.`, 'success');
  } catch (err) {
    console.error(err);
    showNotification('Fehler beim Speichern der Session', 'error');
  }
}

function updateRpeDisplay() {
  const rpe = document.getElementById('session-rpe').value;
  document.getElementById('rpe-value').textContent = rpe;
  document.getElementById('rpe-description').textContent = rpeDescriptions[rpe] || '';
  calculateTrainingLoad();
}

function calculateTrainingLoad() {
  const duration = Number(document.getElementById('session-duration').value) || 0;
  const rpe = Number(document.getElementById('session-rpe').value) || 0;
  const load = duration && rpe ? duration * rpe : 0;
  document.getElementById('calculated-load').textContent = load;
}

function setTodayDate() {
  const today = new Date().toISOString().split('T')[0];
  const el = document.getElementById('session-date');
  if (el) el.value = today;
}

function updateDashboard() {
  updateOverviewStats();
  updateRecentSessions();
  updatePlayerStats();
}

function updateOverviewStats() {
  const totalPlayers = players.length;
  const allSessions = players.flatMap(p => p.sessions || []);
  const totalSessions = allSessions.length;
  const avgRpe = totalSessions > 0 ? (allSessions.reduce((s, x) => s + x.rpe, 0) / totalSessions).toFixed(1) : 0;
  const avgLoad = totalSessions > 0 ? Math.round(allSessions.reduce((s, x) => s + (x.trainingLoad || x.duration * x.rpe), 0) / totalSessions) : 0;
  document.getElementById('total-players').textContent = totalPlayers;
  document.getElementById('total-sessions').textContent = totalSessions;
  document.getElementById('avg-rpe').textContent = avgRpe;
  document.getElementById('avg-load').textContent = avgLoad;
}

function updateRecentSessions() {
  const all = [];
  players.forEach(player => {
    (player.sessions || []).forEach(s => {
      all.push({ ...s, playerName: player.name });
    });
  });
  all.sort((a,b) => new Date(b.date) - new Date(a.date));
  const tbody = document.getElementById('recent-sessions-tbody');
  if (all.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--color-text-secondary)">Keine Sessions vorhanden</td></tr>';
    return;
  }
  tbody.innerHTML = all.slice(0,20).map(s => {
    const rpeClass = getRpeClass(s.rpe);
    return `<tr>
      <td>${formatDate(s.date)}</td>
      <td>${s.playerName}</td>
      <td>${s.duration}</td>
      <td><span class="${rpeClass}">${s.rpe}</span></td>
      <td>${s.trainingLoad || (s.duration * s.rpe)}</td>
      <td>${s.notes || '-'}</td>
    </tr>`;
  }).join('');
}

function updatePlayerStats() {
  const playerId = document.getElementById('dashboard-player-select').value;
  const playerStatsDiv = document.getElementById('player-stats');
  if (!playerId) {
    playerStatsDiv.classList.add('hidden');
    updateChart([]);
    return;
  }
  const player = players.find(p => p.id === playerId);
  if (!player) {
    playerStatsDiv.classList.add('hidden');
    updateChart([]);
    return;
  }
  const sessions = player.sessions || [];
  const totalSessions = sessions.length;
  const avgRpe = totalSessions > 0 ? (sessions.reduce((s,x) => s + x.rpe,0) / totalSessions).toFixed(1) : 0;
  const avgLoad = totalSessions > 0 ? Math.round(sessions.reduce((s,x) => s + (x.trainingLoad || x.duration * x.rpe),0) / totalSessions) : 0;
  const totalTime = sessions.reduce((s,x) => s + x.duration, 0);
  document.getElementById('player-sessions').textContent = totalSessions;
  document.getElementById('player-avg-rpe').textContent = avgRpe;
  document.getElementById('player-avg-load').textContent = avgLoad;
  document.getElementById('player-total-time').textContent = totalTime + ' Min';
  playerStatsDiv.classList.remove('hidden');

  const recentSessions = sessions.slice().sort((a,b) => new Date(a.date) - new Date(b.date)).slice(-15);
  updateChart(recentSessions);
}

function updateChart(sessions) {
  const ctx = document.getElementById('load-chart').getContext('2d');
  if (currentChart) currentChart.destroy();
  if (!sessions || sessions.length === 0) {
    currentChart = new Chart(ctx, {
      type: 'line',
      data: { labels: [], datasets: [] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}} }
    });
    return;
  }
  const labels = sessions.map(s => formatDate(s.date));
  const data = sessions.map(s => s.trainingLoad || (s.duration * s.rpe));
  currentChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Training Load',
        data,
        borderColor: '#1FB8CD',
        backgroundColor: 'rgba(31,184,205,0.1)',
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: 'Training Load' } },
        x: { title: { display: true, text: 'Datum' } }
      }
    }
  });
}

function getRpeClass(rpe){
  if (rpe >= 1 && rpe <= 3) return 'rpe-1-3';
  if (rpe >= 4 && rpe <= 6) return 'rpe-4-6';
  if (rpe >= 7 && rpe <= 8) return 'rpe-7-8';
  if (rpe >= 9 && rpe <= 10) return 'rpe-9-10';
  return '';
}

function formatDate(dateStr){
  return new Date(dateStr).toLocaleDateString('de-DE');
}

function sortTable(columnIndex){
  const table = document.getElementById('recent-sessions-table');
  const tbody = table.querySelector('tbody');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  if (rows.length === 0) return;
  const isAscending = !sortDirection[columnIndex];
  sortDirection[columnIndex] = isAscending;
  rows.sort((a,b) => {
    const aVal = a.cells[columnIndex].textContent.trim();
    const bVal = b.cells[columnIndex].textContent.trim();
    if (columnIndex === 0) {
      const aDate = aVal.split('.').reverse().join('-');
      const bDate = bVal.split('.').reverse().join('-');
      return isAscending ? new Date(aDate) - new Date(bDate) : new Date(bDate) - new Date(aDate);
    } else if (columnIndex === 2 || columnIndex === 3 || columnIndex === 4) {
      return isAscending ? parseFloat(aVal) - parseFloat(bVal) : parseFloat(bVal) - parseFloat(aVal);
    } else {
      return isAscending ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
  });
  tbody.innerHTML = '';
  rows.forEach(r => tbody.appendChild(r));
}

// Export data (GET /api/data, download)
async function exportData() {
  try {
    const res = await fetch(`${API_BASE}/data`);
    if (!res.ok) throw new Error('Fehler beim Export');
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `training_data_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('Daten wurden exportiert.', 'success');
  } catch (err) {
    console.error(err);
    showNotification('Fehler beim Exportieren der Daten', 'error');
  }
}

// Import via file input -> read file and POST to /api/import
function handleFileImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(evt) {
    try {
      const parsed = JSON.parse(evt.target.result);
      if (!parsed.players || !Array.isArray(parsed.players)) throw new Error('Ungültiges Format');
      const res = await fetch(`${API_BASE}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed)
      });
      if (!res.ok) throw new Error('Import fehlgeschlagen');
      const json = await res.json();
      await loadDataFromServer();
      showNotification(`Daten importiert. ${json.addedPlayers || 0} neue Spieler hinzugefügt.`, 'success');
    } catch (err) {
      console.error(err);
      showNotification('Fehler beim Importieren: Ungültiges JSON-Format', 'error');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}

// Clear all data (DELETE /api/data)
async function clearAllData() {
  const confirmation = prompt('ACHTUNG: Alle Daten werden gelöscht! Geben Sie "LÖSCHEN" ein, um zu bestätigen:');
  if (confirmation !== 'LÖSCHEN') return;
  try {
    const res = await fetch(`${API_BASE}/data`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Clear failed');
    players = [];
    updatePlayerList();
    updatePlayerLists();
    updateDashboard();
    showNotification('Alle Daten wurden gelöscht.', 'success');
  } catch (err) {
    console.error(err);
    showNotification('Fehler beim Löschen der Daten', 'error');
  }
}

function showNotification(message, type = 'success') {
  const n = document.getElementById('notification');
  n.textContent = message;
  n.className = `notification ${type} show`;
  setTimeout(() => {
    n.classList.remove('show');
  }, 3000);
}
