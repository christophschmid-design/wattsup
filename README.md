# WattsUp

Persönliche Trainings-App Richtung Ötztaler Radmarathon unter 10 Stunden.

- **Web-Version:** https://christophschmid-design.github.io/wattsup/
- **Android-App:** https://github.com/christophschmid-design/wattsup/releases/download/apk/wattsup.apk
- **Einrichtung:** [docs/EINRICHTUNG.md](docs/EINRICHTUNG.md)

## Aufbau

| Ordner | Inhalt |
|---|---|
| `src/app.html` | Die App selbst (eine Datei). Grundlage für alle Varianten. |
| `web/shim.js` | Ersetzt die Claude-Laufzeit: Strava, Google Kalender und Drive, Open-Meteo, Claude-Schnittstelle, Kostenkontrolle. |
| `web/export-claude.js` | Export-Funktion für die Claude-Version. |
| `tools/build.py` | Baut `dist/` (Web und Android) und `dist-claude/` (Claude-Artefakt). |
| `android-shell/` | Android-Hülle (Capacitor), lädt die Web-Version. |
| `.github/workflows/` | Veröffentlicht die Web-Version und baut die Android-App. |

Keine Schlüssel oder persönlichen Daten in diesem Repository. Die Signaturdatei `android-shell/wattsup.jks` ist mit einem Passwort geschützt, das nur als GitHub-Secret hinterlegt ist.
