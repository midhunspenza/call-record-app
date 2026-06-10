/**
 * pcm-player-worklet — continuous PCM playback for the live voice stream.
 *
 * Replaces the "one AudioBufferSourceNode per frame" approach. Instead of
 * scheduling hundreds of tiny 8 kHz buffers (each resampled in isolation, which
 * rings/clicks at every boundary), we keep a single ring buffer of source-rate
 * samples and render one unbroken signal:
 *
 *   - Continuous resampling: a fractional read cursor advances by
 *     (sourceRate / contextRate) per output sample, linearly interpolating
 *     between the two straddling source samples. No per-frame boundaries exist,
 *     so there's nothing to click.
 *   - Prebuffer: we hold output silent until `targetLatency` source samples are
 *     queued, giving network jitter a cushion.
 *   - Click-free underrun: if the ring runs dry mid-stream we don't snap to
 *     zero — a one-pole envelope fades the last value out, and fades back in
 *     once enough has re-buffered. Same envelope smooths play/mute.
 *   - Bounded latency: if we get too far ahead (clock drift / bursts) we drop
 *     the oldest samples so latency can't balloon.
 *
 * Messages from the main thread (port):
 *   { type: 'samples', samples: Float32Array }  — enqueue decoded PCM
 *   { type: 'reset' }                           — clear ring (on (re)start)
 */

class PcmPlayerProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    const srcRate = opts.sourceSampleRate || 8000;
    const targetLatencySec = opts.targetLatencySec ?? 0.15;
    const maxLatencySec = opts.maxLatencySec ?? 1.0;
    const fadeSec = opts.fadeSec ?? 0.008;

    // `sampleRate` is a global inside AudioWorkletGlobalScope = the context rate.
    this.ratio = srcRate / sampleRate;

    this.targetLatency = Math.max(1, Math.floor(targetLatencySec * srcRate));
    this.maxLatency = Math.max(this.targetLatency + 1, Math.floor(maxLatencySec * srcRate));
    this.capacity = this.maxLatency + srcRate; // headroom over the latency cap

    this.ring = new Float32Array(this.capacity);
    this.writePos = 0;
    this.readPos = 0;
    this.frac = 0;
    this.available = 0; // unread source samples

    this.primed = false;
    this.last = 0; // last emitted sample, held through underruns to fade from
    this.env = 0; // playback envelope [0,1]
    // One-pole coefficient for an ~fadeSec fade at the context rate.
    this.envCoeff = 1 - Math.exp(-1 / Math.max(1, fadeSec * sampleRate));

    this.port.onmessage = (e) => {
      const data = e.data;
      if (!data) return;
      if (data.type === "samples") this.enqueue(data.samples);
      else if (data.type === "reset") this.reset();
    };
  }

  reset() {
    this.writePos = 0;
    this.readPos = 0;
    this.frac = 0;
    this.available = 0;
    this.primed = false;
    this.last = 0;
    this.env = 0;
  }

  enqueue(samples) {
    const cap = this.capacity;
    for (let i = 0; i < samples.length; i++) {
      this.ring[this.writePos] = samples[i];
      this.writePos = (this.writePos + 1) % cap;
      if (this.available < cap) {
        this.available++;
      } else {
        // Ring physically full: overwrite oldest (should never hit with the
        // latency cap below, but keeps indices consistent if it ever does).
        this.readPos = (this.readPos + 1) % cap;
      }
    }
    // Bound latency: if we're sitting on more than maxLatency, drop the oldest
    // so live audio stays near real-time instead of drifting late.
    if (this.available > this.maxLatency) {
      const drop = this.available - this.maxLatency;
      this.readPos = (this.readPos + drop) % cap;
      this.available -= drop;
    }
  }

  process(_inputs, outputs) {
    const channel = outputs[0][0];
    if (!channel) return true;
    const n = channel.length;
    const cap = this.capacity;

    for (let i = 0; i < n; i++) {
      if (!this.primed && this.available >= this.targetLatency) this.primed = true;

      let target = 0;
      let s = this.last;

      if (this.primed && this.available >= 2) {
        const i0 = this.readPos;
        const i1 = (i0 + 1) % cap;
        s = this.ring[i0] * (1 - this.frac) + this.ring[i1] * this.frac;
        this.last = s;
        target = 1;

        this.frac += this.ratio;
        while (this.frac >= 1) {
          this.frac -= 1;
          this.readPos = (this.readPos + 1) % cap;
          this.available--;
        }
      } else if (this.primed) {
        // Ran dry mid-stream: require a fresh prebuffer before resuming, and
        // let the envelope fade the held sample out so there's no click.
        this.primed = false;
      }

      this.env += (target - this.env) * this.envCoeff;
      channel[i] = s * this.env;
    }

    return true;
  }
}

registerProcessor("pcm-player", PcmPlayerProcessor);
