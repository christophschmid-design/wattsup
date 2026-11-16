// Passt das von Capacitor erzeugte Android-Projekt an: Rücksprung-Adresse für die
// Google-Anmeldung, Widget, Updates, Signatur, Versionsnummer und App-Symbol.
import fs from 'node:fs';
import path from 'node:path';

const A = 'android/app';
const PKG = 'at/christophschmid/wattsup';
function must(ok, msg) { if (!ok) { console.error('Anpassung fehlgeschlagen: ' + msg); process.exit(1); } }

// Manifest
const man = `${A}/src/main/AndroidManifest.xml`;
let m = fs.readFileSync(man, 'utf8');
if (!m.includes('android:scheme="wattsup"')) {
  m = m.replace('</activity>', `    <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="wattsup" />
            </intent-filter>
        </activity>
        <receiver android:name=".WattsUpWidget" android:exported="false" android:label="WattsUp">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/wattsup_widget_info" />
        </receiver>`);
}
for (const p of ['android.permission.REQUEST_INSTALL_PACKAGES', 'android.permission.POST_NOTIFICATIONS']) {
  if (!m.includes(p)) m = m.replace('</manifest>', `    <uses-permission android:name="${p}" />\n</manifest>`);
}
fs.writeFileSync(man, m);
must(m.includes('WattsUpWidget') && m.includes('REQUEST_INSTALL_PACKAGES'), 'Manifest');

// Gradle: Signatur, Version, Hintergrund-Plugin
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
if (!b.includes('background-runner/android/src/main/libs')) {
  b = b.replace(/\nrepositories \{/, `\nrepositories {\n    flatDir {\n        dirs '../../node_modules/@capacitor/background-runner/android/src/main/libs', 'libs'\n    }`);
}
fs.writeFileSync(g, b);
must(b.includes('signingConfig signingConfigs.release'), 'Signatur');
must(b.includes('background-runner/android/src/main/libs'), 'flatDir für Hintergrund-Plugin');

// Java-Code
const jd = `${A}/src/main/java/${PKG}`;
fs.mkdirSync(jd, { recursive: true });
for (const f of fs.readdirSync('native/java')) fs.copyFileSync(`native/java/${f}`, `${jd}/${f}`);

// Ressourcen: App-Symbol, Widget
const dst = `${A}/src/main/res`;
function copyTree(src) {
  for (const d of fs.readdirSync(src)) {
    fs.mkdirSync(path.join(dst, d), { recursive: true });
    for (const f of fs.readdirSync(path.join(src, d))) fs.copyFileSync(path.join(src, d, f), path.join(dst, d, f));
  }
}
copyTree('res/android');
copyTree('native/res');
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

// Download-Ordner für Updates freigeben
const fp = `${dst}/xml/file_paths.xml`;
let x = fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : '<?xml version="1.0" encoding="utf-8"?>\n<paths xmlns:android="http://schemas.android.com/apk/res/android">\n</paths>\n';
if (!x.includes('wu_cache')) x = x.replace('</paths>', '    <cache-path name="wu_cache" path="." />\n</paths>');
fs.writeFileSync(fp, x);
// Push-Nachrichten (nur wenn google-services.json vorhanden)
if (fs.existsSync('google-services.json')) {
  fs.copyFileSync('google-services.json', `${A}/google-services.json`);
  let mm = fs.readFileSync(man, 'utf8');
  if (!mm.includes('default_notification_icon')) {
    mm = mm.replace('<application', '<application').replace(/(<application[^>]*>)/, `$1
        <meta-data android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@drawable/ic_stat_wattsup" />
        <meta-data android:name="com.google.firebase.messaging.default_notification_color" android:resource="@color/wu_accent" />`);
    fs.writeFileSync(man, mm);
  }
  fs.mkdirSync(`${dst}/values`, { recursive: true });
  fs.writeFileSync(`${dst}/values/wu_colors.xml`, '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="wu_accent">#3DDC97</color>\n</resources>\n');
  console.log('Push-Nachrichten aktiviert');
} else {
  console.log('Ohne Push-Nachrichten (google-services.json fehlt)');
}
// Health Connect: Berechtigung, Begründungs-Einstieg und Abfrage der Health-Connect-App
{
  let mh = fs.readFileSync(man, 'utf8');
  if (!mh.includes('android.permission.health.READ_WEIGHT')) mh = mh.replace('</manifest>', '    <uses-permission android:name="android.permission.health.READ_WEIGHT" />\n</manifest>');
  if (!mh.includes('com.google.android.apps.healthdata')) mh = mh.replace('</manifest>', '    <queries>\n        <package android:name="com.google.android.apps.healthdata" />\n    </queries>\n</manifest>');
  if (!mh.includes('ACTION_SHOW_PERMISSIONS_RATIONALE')) mh = mh.replace('</activity>', `    <intent-filter>
                <action android:name="androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" />
            </intent-filter>
        </activity>
        <activity-alias
            android:name="ViewPermissionUsageActivity"
            android:exported="true"
            android:targetActivity=".MainActivity"
            android:permission="android.permission.START_VIEW_PERMISSION_USAGE">
            <intent-filter>
                <action android:name="android.intent.action.VIEW_PERMISSION_USAGE" />
                <category android:name="android.intent.category.HEALTH_PERMISSIONS" />
            </intent-filter>
        </activity-alias>`);
  fs.writeFileSync(man, mh);
  must(mh.includes('HEALTH_PERMISSIONS') && mh.includes('READ_WEIGHT'), 'Health-Connect-Manifest');
}
// Health Connect: Mindestversion Android 8 und Datenschutz-Link
const vg = 'android/variables.gradle';
if (fs.existsSync(vg)) {
  let v = fs.readFileSync(vg, 'utf8');
  v = v.replace(/minSdkVersion\s*=\s*\d+/, 'minSdkVersion = 26');
  fs.writeFileSync(vg, v);
}
fs.mkdirSync(`${dst}/values`, { recursive: true });
fs.writeFileSync(`${dst}/values/wu_strings.xml`, '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="health_connect_privacy_policy_url">https://christophschmid-design.github.io/wattsup/datenschutz.html</string>\n</resources>\n');
console.log('Android-Projekt angepasst');
