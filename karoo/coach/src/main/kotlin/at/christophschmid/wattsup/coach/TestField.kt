package at.christophschmid.wattsup.coach

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.widget.RemoteViews
import io.hammerhead.karooext.extension.DataTypeImpl
import io.hammerhead.karooext.internal.Emitter
import io.hammerhead.karooext.internal.ViewEmitter
import io.hammerhead.karooext.models.DataPoint
import io.hammerhead.karooext.models.DataType
import io.hammerhead.karooext.models.OnStreamState
import io.hammerhead.karooext.models.StreamState
import io.hammerhead.karooext.models.UpdateGraphicConfig
import io.hammerhead.karooext.models.ViewConfig

/** Grafisches Testfeld: zeigt Puls, Watt und Uhrzeit, so wie später die Coach-Felder. */
class TestField(private val ext: CoachExtension, extension: String) : DataTypeImpl(extension, "wutest") {

    override fun startStream(emitter: Emitter<StreamState>) {
        val h = Handler(Looper.getMainLooper())
        var n = 0
        val tick = object : Runnable {
            override fun run() {
                n++
                emitter.onNext(StreamState.Streaming(DataPoint(dataTypeId, mapOf(DataType.Field.SINGLE to n.toDouble()))))
                h.postDelayed(this, 1000)
            }
        }
        h.post(tick)
        emitter.setCancellable { h.removeCallbacks(tick) }
    }

    override fun startView(context: Context, config: ViewConfig, emitter: ViewEmitter) {
        val ks = ext.ks
        val h = Handler(Looper.getMainLooper())
        var hr = 0
        var pw = 0
        val ids = mutableListOf<String>()
        if (!config.preview) {
            Store.ok(context, "field")
            ids += ks.addConsumer<OnStreamState>(OnStreamState.StartStreaming(DataType.Type.HEART_RATE)) { ev: OnStreamState ->
                val v = (ev.state as? StreamState.Streaming)?.dataPoint?.singleValue?.toInt() ?: 0
                hr = v
                if (v > 0) Store.ok(context, "hr", "$v bpm")
            }
            ids += ks.addConsumer<OnStreamState>(OnStreamState.StartStreaming(DataType.Type.POWER)) { ev: OnStreamState ->
                val v = (ev.state as? StreamState.Streaming)?.dataPoint?.singleValue?.toInt() ?: 0
                pw = v
                if (v > 0) Store.ok(context, "pwr", "$v W")
            }
        }
        emitter.onNext(UpdateGraphicConfig(showHeader = false))
        val draw = object : Runnable {
            override fun run() {
                val rv = RemoteViews(context.packageName, R.layout.field)
                rv.setTextViewText(R.id.t1, "WattsUp Test ✓")
                rv.setTextViewText(R.id.t2, (if (hr > 0) "$hr bpm" else "– bpm") + "  ·  " + (if (pw > 0) "$pw W" else "– W"))
                rv.setTextViewText(R.id.t3, Store.now())
                emitter.updateView(rv)
                h.postDelayed(this, 1500)
            }
        }
        h.post(draw)
        emitter.setCancellable {
            h.removeCallbacks(draw)
            ids.forEach { ks.removeConsumer(it) }
        }
    }
}
