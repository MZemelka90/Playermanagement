# ⚽ Training Load Monitor

Eine webbasierte App zur Erfassung und Visualisierung der Trainingsbelastung von Fußballspielern.  
Die App ermöglicht das Anlegen von Spielern, das Erfassen von Trainingssessions sowie die Anzeige individueller und teamweiter Belastungsstatistiken.

---

## 🚀 Funktionen

- 🧍‍♂️ Verwaltung von Spielern  
- 🏋️‍♂️ Erfassen von Trainingseinheiten (Dauer, RPE, Trainingslast, Datum)
- 📊 Dashboard mit:
  - Einzelspieler-Analyse
  - Team-Gesamtübersicht (Summen und Durchschnittswerte)
- 💾 Speicherung aller Daten in einer lokalen **`database.json`**
- 🔄 REST-API (Node.js + Express)
- 🖥️ Vollständig lokal nutzbar — kein externer Server notwendig

---

## 📁 Projektstruktur

```
training-load-monitor/
│
├── public/               # Frontend-Dateien
│   ├── index.html        # UI und Layout
│   ├── style.css         # Styling
│   └── app.js            # Logik (Dashboard, Spieler, Sessions)
│
├── database.json         # Lokale JSON-Datenbank (wird automatisch aktualisiert)
├── server.js             # Node.js-Server mit REST-API
├── package.json          # Projekt-Setup und Abhängigkeiten
└── .gitignore            # Ignorierte Dateien
```

---

## ⚙️ Installation & Start

### 1️⃣ Voraussetzungen

- [Node.js](https://nodejs.org/) (Version 18 oder höher)
- npm (wird mit Node.js installiert)

### 2️⃣ Installation

Klonen oder herunterladen:

```bash
git clone https://github.com/MZemelka90/training-load-monitor.git
cd training-load-monitor
```

Dann Abhängigkeiten installieren:

```bash
npm install
```

### 3️⃣ Start des Servers

```bash
node server.js
```

Der Server startet standardmäßig auf:

👉 [http://localhost:3000](http://localhost:3000)

---

## 🧠 Nutzung

1. Öffne die App im Browser (`http://localhost:3000`).
2. Lege Spieler im Tab **"Spieler"** an.
3. Erfasse Trainingseinheiten im Tab **"Sessions"**.
4. Im **Dashboard** kannst du:
   - Einen Spieler auswählen, um seine individuellen Werte zu sehen.
   - **Gesamt-Team** auswählen, um die Summen- und Durchschnittsbelastung aller Spieler zu sehen.

---

## 🔌 API-Endpunkte

| Methode | Endpoint             | Beschreibung                          |
|----------|----------------------|--------------------------------------|
| `GET`    | `/api/players`       | Gibt alle Spieler zurück              |
| `POST`   | `/api/players`       | Fügt einen neuen Spieler hinzu        |
| `PUT`    | `/api/players/:id`   | Aktualisiert einen Spieler            |
| `DELETE` | `/api/players/:id`   | Löscht einen Spieler                  |

🗃️ Alle Daten werden automatisch in `database.json` gespeichert und beim Neustart geladen.

---

## 🧱 Datenstruktur (`database.json`)

Beispiel:

```json
{
  "players": [
    {
      "id": "p1",
      "name": "Max Mustermann",
      "sessions": [
        {
          "date": "2025-10-15",
          "duration": 75,
          "rpe": 7,
          "trainingLoad": 525
        }
      ]
    }
  ]
}
```

---

## 🔒 Hinweise

- Wenn du `database.json` versionieren willst, kannst du in `.gitignore` die Zeile `database.json` entfernen.  
- Standardmäßig ist sie ausgeschlossen, um versehentliches Committen von Trainingsdaten zu vermeiden.
- Die App kann problemlos offline verwendet werden, solange der Node-Server läuft.

---

## 🧰 Technologien

- **Frontend:** HTML, CSS, JavaScript (Vanilla)
- **Backend:** Node.js mit Express
- **Datenbank:** JSON-Datei (lokal lesend/schreibend)
- **Visualisierung:** Chart.js

---

## 🧑‍💻 Entwicklung

Wenn du Änderungen im Code machst, kannst du den Server mit **Hot-Reloading** starten (optional):

```bash
npm install -g nodemon
nodemon server.js
```

---

## 📈 Ideen für Erweiterungen

- Authentifizierung für Trainer
- Export/Import der Datenbank (z. B. CSV, Excel)
- Mobile-optimiertes Layout
- Integration von GPS-Daten oder Herzfrequenzmessungen
- Rollen- und Rechtesystem (Trainer / Spieler)

---

## 🏁 Lizenz

Dieses Projekt ist unter der **MIT-Lizenz** veröffentlicht.  
Frei nutzbar, anpassbar und erweiterbar für Trainings- und Analysezwecke.
