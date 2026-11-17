# WattsUp Coach: Machbarkeitstest auf dem Karoo 2

Ziel: herausfinden, was der Karoo 2 für den Coach hergibt. Alles geht auf der Couch, Dauer etwa 25 Minuten.
An der WattsUp-App ändert sich dadurch nichts.

Datei: **https://github.com/christophschmid-design/wattsup/releases/download/karoo/wattsup-coach.apk**

---

## 1. Karoo vorbereiten

1. Karoo einschalten, mit dem WLAN verbunden.
2. **Einstellungen → Über** (About) öffnen und mehrmals auf die **Build-/Softwarenummer** tippen, bis „Entwickler“ bestätigt wird.
3. Falls ein Punkt **USB-Debugging** erscheint: einschalten.

## 2. Installation vom Handy (Hauptweg)

1. Am Handy aus dem Play Store **„Bugjaeger Mobile ADB – USB OTG“** installieren.
2. Am Handy die Datei oben herunterladen.
3. Handy und Karoo mit einem **USB-C-auf-USB-C-Kabel** verbinden.
   - Findet das Handy den Karoo nicht: in der USB-Benachrichtigung am Handy „Dieses Gerät steuert USB“ bzw. „Dateiübertragung“ wählen oder das Kabel umdrehen.
4. Am Karoo erscheint „USB-Debugging zulassen?“ → **Zulassen** (Haken bei „immer“).
5. In Bugjaeger: Reiter mit dem Paket-Symbol (**Packages / Install**) → **wattsup-coach.apk** auswählen → installieren.
6. Kabel ab, **Karoo aus- und wieder einschalten**.

Hinweis aus dem ersten Versuch: Der Karoo setzt sich am Kabel gerne als steuerndes Gerät durch („Wechsel nicht möglich“ am Handy). Dann klappt der Handy-Weg nur mit OTG-Adapter (USB-C-Stecker auf USB-A-Buchse plus Karoo-Ladekabel). In den Karoo-Entwickleroptionen die USB-Konfiguration auf **MTP** stellen. Der WLAN-Weg in Bugjaeger geht beim Karoo 2 nicht ohne vorheriges Kabel.

**Empfohlen: MacBook (oder PC)**
1. Datei und die Google **Platform-Tools für Mac** (developer.android.com/tools/releases/platform-tools) herunterladen und entpacken.
2. Karoo per USB-C anstecken (USB-Debugging an).
3. Terminal:
   ```
   cd ~/Downloads/platform-tools
   ./adb devices
   ```
   Am Karoo „USB-Debugging zulassen?“ → immer → Zulassen. Erneut `./adb devices`, es muss „device“ stehen.
4. `./adb install ~/Downloads/wattsup-coach.apk` → „Success“ → Kabel ab, Karoo neu starten.
5. Blockiert macOS adb: Systemeinstellungen → Datenschutz & Sicherheit → „Dennoch erlauben“.

## 3. Test-Bildschirm

Am Karoo die App **WattsUp Coach Test** öffnen (bei den Apps bzw. Erweiterungen). Oben steht eine Liste mit Häkchen, die sich beim Testen füllt.

1. **Ton abspielen** → gehört? Ja/Nein
2. **Meldung zeigen** → gesehen? Ja/Nein (außerhalb einer Fahrt kann es sein, dass keine Meldung kommt; das ist ein Ergebnis)
3. **Daten holen** mit WLAN.
4. Am Karoo **WLAN ausschalten**, Handy mit Companion App in der Nähe, nochmal **Daten holen** (geht dann über das Handy).
5. WLAN wieder an.

## 4. Fahrt im Stand

1. In einem Fahrprofil eine Seite bearbeiten und das Feld **„WattsUp Test“** hinzufügen (bei den Feldern der Erweiterungen).
2. Pulsgurt anziehen (optional), Fahrt **starten**. Bewegung ist nicht nötig.
3. Das Feld zeigt Puls, Watt und Uhrzeit.
4. Nach etwa 20 Sekunden: Ton und Meldung „Vorschlag −5 %“.
5. Antworten mit der Bonus-Aktion **„WattsUp: Annehmen“** oder **„WattsUp: Ablehnen“**:
   - zuerst in der Schublade während der Fahrt suchen (beide unteren Tasten gleichzeitig),
   - sonst in den Profil-Einstellungen bei den Tasten bzw. Bonus-Aktionen.
   Wo du sie gefunden hast, ist für mich wichtig.
6. Fahrt beenden (verwerfen geht), **neue Fahrt starten** und diesmal **nicht** antworten: nach 30 und 60 Sekunden sollte eine Erinnerung kommen, danach „Plan bleibt unverändert“.

## 5. Update und Ergebnis

1. Ich stelle danach eine zweite Version bereit. Dann am Karoo: **Nach Update suchen**.
   Beim ersten Mal fragt der Karoo eventuell, ob die App Apps installieren darf → erlauben → nochmal suchen.
   Zusätzlich interessant: Ob der Karoo die neue Version auch von selbst in seiner App-Übersicht anbietet.
2. **Ergebnis ans Handy** tippen → am Handy kommt eine Push-Nachricht mit der Liste.
3. Foto vom Test-Bildschirm oder kurze Rückmeldung an Claude.

## Wieder entfernen

Am Karoo die App wie jede Erweiterung deinstallieren. Den Entwicklermodus kannst du wieder ausschalten.
