package at.christophschmid.wattsup.coach

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.content.FileProvider
import io.hammerhead.karooext.KarooSystemService
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/** Test-Bildschirm: Liste mit Häkchen und Knöpfe für die einzelnen Prüfungen. */
class MainActivity : Activity() {
    private lateinit var ks: KarooSystemService
    private val h = Handler(Looper.getMainLooper())
    private lateinit var list: LinearLayout
    private lateinit var status: TextView
    private lateinit var url: EditText

    private val navy = Color.parseColor("#0F2236")
    private val green = Color.parseColor("#0B8A54")

    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        ks = KarooSystemService(this)
        checkUpdated()

        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(16, 12, 16, 24) }
        root.addView(TextView(this).apply {
            text = "WattsUp Coach · Machbarkeitstest"
            textSize = 20f; setTypeface(null, Typeface.BOLD); setTextColor(navy)
        })
        root.addView(small("Version " + BuildConfig.VERSION_NAME))
        list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(0, 10, 0, 10) }
        root.addView(list)
        status = small("").apply { setTextColor(navy) }
        root.addView(status)

        root.addView(head("Ton und Meldung"))
        root.addView(row(btn("Ton abspielen") { Karoo.beep(ks, long = true); ask("beep", "Ton gehört?") }))
        root.addView(row(btn("Meldung zeigen") {
            Karoo.alert(ks, "WattsUp Test", "Diese Meldung kommt von der Test-Erweiterung", 8_000)
            ask("alert", "Meldung gesehen?")
        }))

        root.addView(head("Verbindung"))
        url = EditText(this).apply {
            setText(Store.worker(this@MainActivity))
            hint = "Adresse des Push-Dienstes"
            textSize = 14f
            inputType = InputType.TYPE_TEXT_VARIATION_URI
            setSingleLine()
        }
        root.addView(url)
        root.addView(row(btn("Daten holen") { fetch() }, btn("Ergebnis ans Handy") { upload() }))
        root.addView(small("Einmal mit WLAN testen, dann am Karoo WLAN aus und nochmal (geht dann über das Handy)."))

        root.addView(head("Update"))
        root.addView(row(btn("Nach Update suchen") { update() }))

        root.addView(head("Fahrt"))
        root.addView(small("Feld „WattsUp Test“ auf eine Fahrseite legen, Fahrt starten. Nach 20 s kommt ein Vorschlag mit Ton. Mit der Bonus-Aktion „WattsUp: Annehmen/Ablehnen“ antworten, oder einmal nicht reagieren, um die Erinnerung zu testen."))
        root.addView(row(btn("Ergebnisse löschen") { Store.reset(this); refresh() }))

        setContentView(ScrollView(this).apply { setBackgroundColor(Color.WHITE); addView(root) })

        ks.connect { ok ->
            h.post {
                if (ok) Store.ok(this, "sys", (ks.hardwareType?.name ?: "?") + ", SDK " + (ks.libVersion ?: "?"))
                else Store.fail(this, "sys", "keine Verbindung")
                refresh()
            }
        }
    }

    private val loop = object : Runnable { override fun run() { refresh(); h.postDelayed(this, 2000) } }
    override fun onResume() { super.onResume(); h.post(loop) }
    override fun onPause() { h.removeCallbacks(loop); super.onPause() }
    override fun onDestroy() { ks.disconnect(); super.onDestroy() }

    // ---------- Anzeige ----------
    private fun refresh() {
        list.removeAllViews()
        Store.ITEMS.forEach { (k, label) ->
            val v = Store.get(this, k)
            val l = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; setPadding(0, 4, 0, 4) }
            l.addView(TextView(this).apply {
                text = when {
                    v == null -> "–"
                    v.startsWith("✓") -> "✓"
                    v.startsWith("✗") -> "✗"
                    else -> "…"
                }
                textSize = 18f; setTypeface(null, Typeface.BOLD); setWidth(40)
                setTextColor(if (v?.startsWith("✓") == true) green else if (v?.startsWith("✗") == true) Color.RED else Color.GRAY)
            })
            l.addView(LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                addView(TextView(this@MainActivity).apply { text = label; textSize = 15f; setTextColor(Color.BLACK) })
                if (v != null && v.length > 2) addView(small(v.substring(2)))
            })
            list.addView(l)
        }
    }

    private fun small(t: String) = TextView(this).apply { text = t; textSize = 12f; setTextColor(Color.DKGRAY) }
    private fun head(t: String) = TextView(this).apply {
        text = t; textSize = 16f; setTypeface(null, Typeface.BOLD); setTextColor(navy); setPadding(0, 18, 0, 4)
    }
    private fun btn(t: String, f: () -> Unit) = Button(this).apply { text = t; isAllCaps = false; setOnClickListener { f() } }
    private fun row(vararg v: View) = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
        v.forEach { addView(it, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)) }
    }
    private fun say(t: String) = h.post { status.text = t; refresh() }

    /** Ja/Nein-Abfrage direkt unter der Liste */
    private fun ask(key: String, q: String) {
        status.text = q
        val r = row(btn("Ja") { Store.ok(this, key); refresh() }, btn("Nein") { Store.fail(this, key, "nicht bemerkt"); refresh() })
        val parent = status.parent as LinearLayout
        val i = parent.indexOfChild(status)
        if (parent.getChildAt(i + 1)?.tag == "ask") parent.removeViewAt(i + 1)
        r.tag = "ask"
        parent.addView(r, i + 1)
    }

    // ---------- Verbindung ----------
    private fun base(): String? {
        val u = url.text.toString().trim().trimEnd('/')
        if (!u.startsWith("https://")) { say("Bitte die Adresse des Push-Dienstes eintragen (https://…)"); return null }
        Store.setStr(this, "worker", u)
        return u
    }

    private fun fetch() {
        val u = base() ?: return
        val wifi = Karoo.onWifi(this)
        val key = if (wifi) "http_wifi" else "http_handy"
        say("Hole Daten " + (if (wifi) "über WLAN" else "über das Handy") + " …")
        Karoo.http(ks, "GET", "$u/coach-test?k=${Karoo.KEY}", null) { code, body, err ->
            h.post {
                if (code == 200 && body != null) {
                    val name = try { JSONObject(body).optString("name") } catch (e: Exception) { "" }
                    Store.ok(this, key, "„$name“ " + Store.now())
                    say("Daten angekommen: $name")
                } else {
                    Store.fail(this, key, "Fehler $code ${err ?: ""}".trim())
                    say("Fehler $code ${err ?: ""}")
                }
            }
        }
    }

    private fun upload() {
        val u = base() ?: return
        val body = JSONObject().put("v", BuildConfig.VERSION_NAME).put("sum", Store.summary(this)).toString()
        say("Sende Ergebnis …")
        Karoo.http(ks, "POST", "$u/coach-test?k=${Karoo.KEY}", body) { code, _, err ->
            h.post {
                if (code == 200) { Store.ok(this, "upload"); say("Gesendet, Push-Nachricht sollte am Handy erscheinen") }
                else { Store.fail(this, "upload", "Fehler $code ${err ?: ""}".trim()); say("Fehler $code ${err ?: ""}") }
            }
        }
    }

    // ---------- Selbst-Update ----------
    private fun checkUpdated() {
        val last = Store.int(this, "vcode")
        if (last in 1 until BuildConfig.VERSION_CODE) Store.ok(this, "update", "von $last auf ${BuildConfig.VERSION_CODE}")
        Store.setInt(this, "vcode", BuildConfig.VERSION_CODE)
    }

    private fun update() {
        say("Suche Update …")
        Thread {
            try {
                val m = JSONObject(get(BuildConfig.REL + "manifest.json").toString(Charsets.UTF_8))
                val vc = m.optInt("latestVersionCode")
                if (vc <= BuildConfig.VERSION_CODE) {
                    Store.note(this, "update", "keine neuere Version ($vc)")
                    say("Keine neuere Version vorhanden.")
                    return@Thread
                }
                say("Lade Version " + m.optString("latestVersion") + " …")
                val dir = File(cacheDir, "upd").apply { mkdirs() }
                val f = File(dir, "coach.apk")
                f.writeBytes(get(m.optString("latestApkUrl")))
                h.post { install(f) }
            } catch (e: Exception) {
                Store.fail(this, "update", e.javaClass.simpleName + ": " + (e.message ?: ""))
                say("Update fehlgeschlagen: " + e.message)
            }
        }.start()
    }

    private fun get(u: String): ByteArray {
        var url = u
        repeat(5) {
            val c = URL(url).openConnection() as HttpURLConnection
            c.instanceFollowRedirects = false
            c.connectTimeout = 15_000; c.readTimeout = 60_000
            val code = c.responseCode
            if (code in 300..399) { url = c.getHeaderField("Location"); c.disconnect(); return@repeat }
            if (code != 200) throw RuntimeException("HTTP $code")
            return c.inputStream.use { it.readBytes() }
        }
        throw RuntimeException("zu viele Weiterleitungen")
    }

    private fun install(f: File) {
        if (Build.VERSION.SDK_INT >= 26 && !packageManager.canRequestPackageInstalls()) {
            Store.note(this, "update", "Erlaubnis zum Installieren nötig")
            say("Bitte „Apps installieren“ für den Coach erlauben, dann nochmal suchen.")
            startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:$packageName")))
            return
        }
        val uri = FileProvider.getUriForFile(this, "$packageName.files", f)
        Store.note(this, "update", "Installation gestartet")
        startActivity(Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        })
    }
}
