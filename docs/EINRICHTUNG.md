# WattsUp einrichten

Einmalig, etwa 45 bis 60 Minuten. Am bequemsten am PC oder Tablet, am Handy geht es auch.
Alle Schlüssel bleiben nur auf deinen Geräten. Sie stehen nie im Code auf GitHub.

Adresse der Web-Version: **https://christophschmid-design.github.io/wattsup/**

---

## 1. GitHub vorbereiten (5 Minuten)

**Web-Version einschalten**
1. Öffne github.com/christophschmid-design/wattsup → **Settings** → **Pages**.
2. Unter *Build and deployment* bei **Source** die Option **GitHub Actions** wählen.

**Passwort für die App-Signatur hinterlegen**
1. **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
2. Name: `ANDROID_KEYSTORE_PASS`
3. Wert: das Passwort, das Claude dir im Chat genannt hat.
4. **Add secret**.

**Ersten Bau starten**
1. Reiter **Actions** → links **Web-Version veröffentlichen** → **Run workflow**.
2. Danach **Android-App bauen** → **Run workflow**.
3. Nach etwa 2 bzw. 8 Minuten ist ein grüner Haken zu sehen.

## 2. Strava-Zugang (5 Minuten)

1. Öffne **strava.com/settings/api** (angemeldet mit deinem Strava-Konto).
2. Formular ausfüllen:
   - Application Name: `WattsUp`
   - Category: `Training`
   - Website: `https://christophschmid-design.github.io/wattsup/`
   - **Authorization Callback Domain:** `christophschmid-design.github.io`
3. Ein beliebiges Bild als Symbol hochladen (zum Beispiel das WattsUp-Logo).
4. Notiere **Client ID** und **Client Secret** (bei „Client Secret“ auf *Show* tippen).

## 3. Google-Zugang für Kalender und Abgleich (20 Minuten)

1. Öffne **console.cloud.google.com** und melde dich mit deinem Google-Konto an.
2. Oben auf die Projektauswahl → **Neues Projekt** → Name `WattsUp` → **Erstellen**. Danach das Projekt auswählen.
3. **APIs aktivieren:** Im Suchfeld nacheinander **Google Calendar API** und **Google Drive API** suchen und jeweils **Aktivieren**.
4. **Google Auth Platform** (früher „OAuth-Zustimmungsbildschirm“) öffnen → **Jetzt starten**:
   - App-Name `WattsUp`, Support-E-Mail: deine Adresse
   - Zielgruppe: **Extern**
   - Kontakt: deine Adresse → Zustimmen → **Erstellen**
5. **Datenzugriff** → **Bereiche hinzufügen** und diese zwei auswählen:
   - `.../auth/calendar.events`
   - `.../auth/drive.appdata`
   → Aktualisieren → Speichern.
6. **Zielgruppe** → **App veröffentlichen** → bestätigen. Wichtig: Im Testmodus läuft die Anmeldung sonst alle 7 Tage ab.
7. **Clients** → **Client erstellen**:
   - Anwendungstyp: **Webanwendung**, Name `WattsUp`
   - Autorisierte JavaScript-Quellen: `https://christophschmid-design.github.io`
   - **Autorisierte Weiterleitungs-URIs:** `https://christophschmid-design.github.io/wattsup/`
   - **Erstellen**
8. Notiere **Client-ID** und **Clientschlüssel** (Client Secret).

Beim ersten Verbinden zeigt Google „Google hat diese App nicht überprüft“. Das ist normal, weil es deine eigene App ist: **Erweitert** → **Weiter zu WattsUp (unsicher)**.

## 4. Claude-Zugang für die Planung (10 Minuten)

1. Öffne **platform.claude.com** und melde dich an oder lege ein Konto an. Das ist ein eigenes Konto, getrennt von deinem Claude-Abo.
2. **Billing:** Guthaben aufladen, zum Beispiel 5 $. Die **automatische Aufladung ausgeschaltet** lassen. So kann nie mehr abgebucht werden als aufgeladen.
3. Optional unter **Limits** ein monatliches Ausgabenlimit setzen.
4. **API Keys** → **Create Key** → Name `WattsUp` → Schlüssel kopieren (beginnt mit `sk-ant-`). Er wird nur einmal angezeigt.

## 5. WattsUp verbinden

1. Öffne die Web-Version: **https://christophschmid-design.github.io/wattsup/**
2. Es erscheint **Einstellungen** (später: Menü → Einstellungen).
3. Strava: Client-ID und Client-Secret eintragen → **Mit Strava verbinden** → bei Strava bestätigen.
4. Google: Client-ID und Clientschlüssel eintragen → **Mit Google verbinden** → bestätigen (siehe Hinweis oben).
5. Claude: API-Schlüssel eintragen, Modell wählen (Standard Sonnet 5.5), Monatsgrenze festlegen → **Speichern**.

## 6. Daten aus der Claude-Version übernehmen

1. In der bisherigen WattsUp-Version in Claude: Menü → **Daten für WattsUp exportieren** → Datei speichern.
2. In der neuen Version: Menü → **Einstellungen** → bei **Daten** die Datei auswählen.

Bewertungen, Morgengefühl, Gewicht, Pläne, Einstellungen und die bereits berechneten Belastungswerte sind dann übernommen. Über Google Drive landen sie automatisch auch auf deinen anderen Geräten.

## 7. Android-App installieren

1. Am Handy öffnen: **https://github.com/christophschmid-design/wattsup/releases/download/apk/wattsup.apk**
2. Herunterladen und öffnen. Android fragt, ob der Browser Apps installieren darf → **Zulassen** → **Installieren**.
3. In der App einmal die Schlüssel aus Schritt 5 eintragen. Die App hat einen eigenen Speicher, getrennt vom Browser. Deine Trainingsdaten kommen über Google automatisch.

Neue Versionen: Änderungen an Inhalt und Funktionen kommen beim nächsten Start von selbst. Nur wenn sich die Android-Hülle ändert (Benachrichtigungen, Widget), lädst du die Datei unter derselben Adresse neu und installierst sie darüber.

## Surface oder anderer PC

Web-Version in Edge öffnen → Menü (…) → **Apps** → **Diese Website als App installieren**. Schlüssel einmal eintragen, die Daten kommen über Google.

## Benachrichtigungen, Widget und Updates (Android)

- **Benachrichtigungen:** Beim ersten Start fragt Android, ob WattsUp Mitteilungen senden darf → **Zulassen**. Einstellbar im Menü unter Einstellungen:
  - Morgengefühl ab 5 Uhr (entfällt, sobald es eingetragen ist)
  - Neue Strava-Aktivität bewerten (per Push, siehe Schritt 8)
  - Sonntag 19 Uhr: Wochenplanung
- **Widget:** Startbildschirm lange drücken → **Widgets** → **WattsUp** auf den Startbildschirm ziehen. Es zeigt Tagesampel, heutige Einheit, Form und Fitness.
- **Updates:** Gibt es eine neue App-Version, erscheint unten in WattsUp ein Hinweis. **Jetzt aktualisieren** lädt sie herunter und öffnet die Installation. Beim ersten Mal fragt Android einmalig, ob WattsUp Apps installieren darf.

## 8. Push-Nachrichten für neue Aktivitäten (etwa 25 Minuten)

Ablauf: Strava meldet eine neue Aktivität an einen kleinen Dienst bei Cloudflare, der schickt über Firebase sofort eine Nachricht ans Handy. Beides ist kostenlos.

**A. Firebase (Google)**
1. Öffne **console.firebase.google.com** → **Projekt erstellen** bzw. **Firebase zu einem Google Cloud-Projekt hinzufügen** → das bestehende Projekt **WattsUp** wählen. Google Analytics brauchst du nicht.
2. In der Projektübersicht **App hinzufügen** → **Android**:
   - Android-Paketname: `at.christophschmid.wattsup`
   - App-Nickname: `WattsUp`, SHA-1 leer lassen → **App registrieren**
3. **google-services.json herunterladen**. Diese Datei darfst du Claude im Chat schicken; Claude legt sie ins Projekt.
4. Zahnrad → **Projekteinstellungen** → **Dienstkonten** → **Neuen privaten Schlüssel generieren** → JSON-Datei wird heruntergeladen.
   Diese Datei ist geheim: **nicht** in den Chat schicken, sondern den kompletten Inhalt als GitHub-Secret `FCM_SA` speichern (siehe C).

**B. Cloudflare**
1. Konto anlegen auf **dash.cloudflare.com** (kostenloser Plan).
2. Links **Workers & Pages** öffnen. Beim ersten Mal wird eine eigene Subdomain abgefragt, zum Beispiel `christoph-schmid` → speichern.
3. Rechts auf der Übersicht steht die **Account ID** → kopieren.
4. Oben rechts Profil → **Mein Profil** → **API-Token** → **Token erstellen** → Vorlage **Cloudflare Workers bearbeiten** → **Weiter zur Zusammenfassung** → **Token erstellen** → Token kopieren.

**C. GitHub-Secrets** (Settings → Secrets and variables → Actions → New repository secret)
| Name | Wert |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Token aus B4 |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID aus B3 |
| `FCM_SA` | kompletter Inhalt der JSON-Datei aus A4 |

Dann **Actions** → **Push-Dienst veröffentlichen** → **Run workflow**. Die Adresse des Dienstes findest du bei Cloudflare unter Workers & Pages → **wattsup-push**, zum Beispiel `https://wattsup-push.christoph-schmid.workers.dev`.

**D. In WattsUp**
1. Sobald die google-services.json im Projekt ist, kommt eine neue App-Version → in der App aktualisieren.
2. Menü → **Einstellungen** → **Push für neue Aktivitäten** → Adresse eintragen → **Push aktivieren**.
3. Eine Test-Nachricht erscheint. Ab dann meldet WattsUp neue Aktivitäten sofort.

## 9. Gewicht automatisch von der Waage (Health Connect)

1. In der Renpho-App die Verbindung zu **Google Health / Health Connect** einschalten (Gewicht freigeben).
2. In WattsUp: Menü → **Einstellungen** → **Gewicht aus Google Health** → **Verbinden** → bei Android den Zugriff auf **Gewicht** erlauben.
3. Ab dann übernimmt WattsUp beim Öffnen automatisch neue Werte (die erste Messung des Tages) in den Gewichtsverlauf und rechnet damit Watt pro Kilo und die Zeitprognose.
