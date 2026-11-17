package at.christophschmid.wattsup.coach

import android.content.Context
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Ergebnisse des Machbarkeitstests, bleiben über Neustarts erhalten. */
object Store {
    /** Schlüssel und Beschriftung in der Reihenfolge der Liste */
    val ITEMS = listOf(
        "sys" to "Verbindung zum Karoo-System",
        "field" to "Eigenes Datenfeld angezeigt",
        "hr" to "Puls vom Gurt im Feld",
        "pwr" to "Watt vom Wattmesser (optional)",
        "beep" to "Ton",
        "alert" to "Meldung außerhalb der Fahrt",
        "ride_alert" to "Meldung während der Fahrt",
        "bonus" to "Annehmen / Ablehnen",
        "remind" to "Erinnerung ohne Antwort",
        "http_wifi" to "Daten holen über WLAN",
        "http_handy" to "Daten holen über Handy",
        "upload" to "Ergebnis ans Handy gesendet",
        "update" to "Selbst-Update",
    )

    private fun p(c: Context) = c.getSharedPreferences("test", Context.MODE_PRIVATE)

    fun now(): String = SimpleDateFormat("HH:mm:ss", Locale.GERMANY).format(Date())

    fun ok(c: Context, key: String, info: String = "") = put(c, key, "✓ " + (if (info.isEmpty()) now() else info))
    fun fail(c: Context, key: String, info: String) = put(c, key, "✗ $info")
    fun note(c: Context, key: String, info: String) {
        // Notiz nur setzen, wenn noch kein Erfolg vermerkt ist
        if (get(c, key)?.startsWith("✓") != true) put(c, key, "… $info")
    }

    fun put(c: Context, key: String, v: String) = p(c).edit().putString("r_$key", v).apply()
    fun get(c: Context, key: String): String? = p(c).getString("r_$key", null)

    fun str(c: Context, key: String, def: String = ""): String = p(c).getString(key, def) ?: def
    fun setStr(c: Context, key: String, v: String) = p(c).edit().putString(key, v).apply()
    fun int(c: Context, key: String): Int = p(c).getInt(key, 0)
    fun setInt(c: Context, key: String, v: Int) = p(c).edit().putInt(key, v).apply()

    fun reset(c: Context) {
        val e = p(c).edit()
        ITEMS.forEach { e.remove("r_" + it.first) }
        e.apply()
    }

    fun summary(c: Context): String = ITEMS.joinToString("\n") { (k, label) ->
        val v = get(c, k)
        (when {
            v == null -> "– "
            v.startsWith("✓") -> "✓ "
            v.startsWith("✗") -> "✗ "
            else -> "… "
        }) + label
    }

    fun worker(c: Context): String = str(c, "worker", BuildConfig.WORKER).trimEnd('/')
}
