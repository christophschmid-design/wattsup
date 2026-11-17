package at.christophschmid.wattsup.coach

import android.os.Handler
import android.os.Looper
import io.hammerhead.karooext.KarooSystemService
import io.hammerhead.karooext.extension.DataTypeImpl
import io.hammerhead.karooext.extension.KarooExtension
import io.hammerhead.karooext.models.RideState

/**
 * Machbarkeitstest: läuft als Karoo-Erweiterung im Hintergrund.
 * Während einer Fahrt kommt nach 20 Sekunden ein Test-Vorschlag mit Ton,
 * der über die Bonus-Aktionen "Annehmen" oder "Ablehnen" beantwortet wird.
 */
class CoachExtension : KarooExtension("wattsupcoach", "1") {
    lateinit var ks: KarooSystemService
    private val h = Handler(Looper.getMainLooper())
    private var rideId: String? = null
    private var proposed = false
    private var waiting = false

    override val types: List<DataTypeImpl> by lazy { listOf(TestField(this, extension)) }

    override fun onCreate() {
        super.onCreate()
        ks = KarooSystemService(this)
        ks.connect { ok ->
            if (ok) {
                Store.ok(this, "sys", (ks.hardwareType?.name ?: "?") + ", SDK " + (ks.libVersion ?: "?"))
                if (rideId == null) {
                    rideId = ks.addConsumer<RideState> { st -> h.post { onRide(st) } }
                }
            } else {
                Store.fail(this, "sys", "keine Verbindung")
            }
        }
    }

    private fun onRide(st: RideState) {
        when (st) {
            is RideState.Recording -> if (!proposed) {
                proposed = true
                h.postDelayed({ propose() }, 20_000)
            }
            is RideState.Idle -> {
                proposed = false
                waiting = false
                h.removeCallbacksAndMessages(null)
            }
            else -> {}
        }
    }

    private fun propose() {
        waiting = true
        Store.note(this, "ride_alert", "Meldung geschickt " + Store.now())
        Karoo.beep(ks, long = true)
        Karoo.alert(ks, "WattsUp Test: Vorschlag −5 %", "Annehmen oder Ablehnen über die Bonus-Aktion", 25_000)
        h.postDelayed({ remind(1) }, 30_000)
    }

    private fun remind(n: Int) {
        if (!waiting) return
        if (n <= 2) {
            Store.note(this, "remind", "Erinnerung $n " + Store.now())
            Karoo.beep(ks, long = true)
            Karoo.alert(ks, "Erinnerung: Vorschlag −5 %", "Noch keine Antwort. Annehmen oder Ablehnen?", 20_000)
            h.postDelayed({ remind(n + 1) }, 30_000)
        } else {
            waiting = false
            Store.ok(this, "remind", "2 Erinnerungen, dann Plan beibehalten")
            Karoo.beep(ks)
            Karoo.alert(ks, "Keine Antwort", "Plan bleibt unverändert", 8_000)
        }
    }

    override fun onBonusAction(actionId: String) {
        h.post {
            val yes = actionId == "annehmen"
            Store.ok(this, "bonus", (if (yes) "Annehmen" else "Ablehnen") + " " + Store.now())
            if (waiting) Store.ok(this, "ride_alert", "gesehen und beantwortet")
            waiting = false
            Karoo.beep(ks)
            Karoo.alert(ks, if (yes) "Angenommen ✓" else "Abgelehnt", "Test-Antwort ist angekommen", 6_000)
        }
    }

    override fun onDestroy() {
        h.removeCallbacksAndMessages(null)
        rideId?.let { ks.removeConsumer(it) }
        ks.disconnect()
        super.onDestroy()
    }
}
