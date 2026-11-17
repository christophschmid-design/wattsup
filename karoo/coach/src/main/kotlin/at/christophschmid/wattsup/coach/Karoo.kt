package at.christophschmid.wattsup.coach

import android.content.Context
import android.net.ConnectivityManager
import io.hammerhead.karooext.KarooSystemService
import io.hammerhead.karooext.models.HttpResponseState
import io.hammerhead.karooext.models.InRideAlert
import io.hammerhead.karooext.models.OnHttpResponse
import io.hammerhead.karooext.models.PlayBeepPattern

/** Gemeinsame Helfer für Erweiterung und Test-Bildschirm */
object Karoo {
    /** Schlüssel nur für die Testphase; die Test-Adresse wird danach wieder entfernt */
    const val KEY = "wu-karoo-test-7f3a"

    fun beep(ks: KarooSystemService, long: Boolean = false) {
        val f = 1760
        val tones = if (long) listOf(
            PlayBeepPattern.Tone(f, 200), PlayBeepPattern.Tone(null, 100),
            PlayBeepPattern.Tone(f, 200), PlayBeepPattern.Tone(null, 100),
            PlayBeepPattern.Tone(2093, 350),
        ) else listOf(PlayBeepPattern.Tone(f, 150), PlayBeepPattern.Tone(null, 80), PlayBeepPattern.Tone(f, 150))
        ks.dispatch(PlayBeepPattern(tones))
    }

    fun alert(ks: KarooSystemService, title: String, detail: String, ms: Long = 15_000) {
        ks.dispatch(
            InRideAlert(
                id = "wu-test",
                icon = R.drawable.ic_wu,
                title = title,
                detail = detail,
                autoDismissMs = ms,
                backgroundColor = R.color.navy,
                textColor = R.color.white,
            ),
        )
    }

    fun onWifi(c: Context): Boolean {
        val cm = c.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        @Suppress("DEPRECATION")
        val ni = cm.activeNetworkInfo
        @Suppress("DEPRECATION")
        return ni != null && ni.isConnected && ni.type == ConnectivityManager.TYPE_WIFI
    }

    /** HTTP über die beste Verbindung des Karoo (WLAN oder Handy per Bluetooth) */
    fun http(ks: KarooSystemService, method: String, url: String, body: String?, cb: (Int, String?, String?) -> Unit) {
        var id = ""
        var done = false
        id = ks.addConsumer<OnHttpResponse>(
            OnHttpResponse.MakeHttpRequest(
                method = method,
                url = url,
                headers = mapOf("Content-Type" to "application/json"),
                body = body?.toByteArray(Charsets.UTF_8),
                waitForConnection = false,
            ),
            onError = { msg -> if (!done) { done = true; cb(-1, null, msg) } },
        ) { ev: OnHttpResponse ->
            val s = ev.state
            if (s is HttpResponseState.Complete && !done) {
                done = true
                cb(s.statusCode, s.body?.toString(Charsets.UTF_8), s.error)
                ks.removeConsumer(id)
            }
        }
    }
}
