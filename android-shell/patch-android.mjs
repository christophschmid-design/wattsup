// Passt das von Capacitor erzeugte Android-Projekt an: Rücksprung-Adresse für die
// Google-Anmeldung, Signatur, Versionsnummer und App-Symbol.
import fs from 'node:fs';
import path from 'node:path';

const A = 'android/app';
const man = `${A}/src/main/AndroidManifest.xml`;
let m = fs.readFileSync(man, 'utf8');
if (!m.includes('android:scheme="wattsup"')) {
  m = m.replace('</activity>', `    <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="wattsup" />
            </intent-filter>
        </activity>`);
  fs.writeFileSync(man, m);
}

const g = `${A}/build.gradle`;
let b = fs.readFileSync(g, 'utf8');
b = b.replace(/versionCode \d+/, 'versionCode Integer.parseInt(System.getenv("VCODE") ?: "1")');
b = b.replace(/versionName "[^"]*"/, 'versionName "1." + (System.getenv("VCODE") ?: "0")');
if (!b.includes('signingConfigs')) {
  b = b.replace(/buildTypes \{/, `signingConfigs {
        release {
            storeFile file(System.getenv("KS_FILE") ?: "wattsup.jks")
            storePassword System.getenv("KS_PASS")
            keyAlias "wattsup"
            keyPassword System.getenv("KS_PASS")
        }
    }
    buildTypes {`);
  b = b.replace(/release \{\s*\n(\s*)minifyEnabled/, (s, ind) => `release {\n${ind}signingConfig signingConfigs.release\n${ind}minifyEnabled`);
}
fs.writeFileSync(g, b);
if (!b.includes('signingConfig signingConfigs.release')) { console.error('Signatur nicht eingetragen'); process.exit(1); }

const src = 'res/android', dst = `${A}/src/main/res`;
for (const d of fs.readdirSync(src)) {
  fs.mkdirSync(path.join(dst, d), { recursive: true });
  for (const f of fs.readdirSync(path.join(src, d))) fs.copyFileSync(path.join(src, d, f), path.join(dst, d, f));
}
const ad = `${dst}/mipmap-anydpi-v26`;
fs.mkdirSync(ad, { recursive: true });
const xml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
fs.writeFileSync(`${ad}/ic_launcher.xml`, xml);
fs.writeFileSync(`${ad}/ic_launcher_round.xml`, xml);
console.log('Android-Projekt angepasst');
