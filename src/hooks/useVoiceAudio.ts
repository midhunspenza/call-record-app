"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveStream } from "@/components/LiveStreamProvider";

/**
 * Plays the live PCM audio stream coming over /api/stream's binary channel.
 *
 * Wire format (per spenza-backend's voice relay): raw PCM, signed 16-bit
 * little-endian, mono, 8000 Hz. Frames are typically 20–40 ms each.
 *
 * Playback strategy:
 *   - All actual playback happens in an AudioWorklet (public/pcm-player-worklet.js)
 *     that owns a ring buffer and renders ONE continuous, resampled signal. This
 *     replaces the old "one AudioBufferSourceNode per frame" path, whose
 *     per-buffer resampling and back-to-back scheduling clicked at every frame
 *     boundary and snapped to silence on underrun.
 *   - This hook's job is just transport + decode: convert each i16 frame to f32
 *     [-1,1] and post it to the worklet, which handles prebuffering, continuous
 *     fractional-rate resampling, click-free underrun fades, and latency capping.
 *
 * Sample alignment: a 16-bit sample can be split across two WS frames. We carry
 * the leftover odd byte to the next frame; decoding a half-sample would shift
 * every following sample by a byte and turn audio into noise.
 */

const SOURCE_SAMPLE_RATE = 8000;
const WORKLET_URL = "/pcm-player-worklet.js";
const EMPTY_CARRY = new Uint8Array(0);

type State = "idle" | "playing" | "muted";

export function useVoiceAudio() {
  const { onBinary } = useLiveStream();

  const [state, setState] = useState<State>("idle");
  const [framesPlayed, setFramesPlayed] = useState(0);
  const [bytesPlayed, setBytesPlayed] = useState(0);

  const ctxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<AudioWorkletNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const playingRef = useRef(false);
  // Promise guard so concurrent play() calls don't load the worklet twice.
  const setupRef = useRef<Promise<void> | null>(null);
  // Leftover odd byte from the previous frame, prepended to the next one so we
  // never decode a half-sample across a frame boundary.
  const carryRef = useRef<Uint8Array>(new Uint8Array(0));

  const ensureGraph = useCallback(async () => {
    if (nodeRef.current) return;
    if (setupRef.current) return setupRef.current;

    setupRef.current = (async () => {
      // Safari needs the webkit prefix on older versions.
      const Ctor: typeof AudioContext =
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
        window.AudioContext;
      const ctx = new Ctor();
      await ctx.audioWorklet.addModule(WORKLET_URL);

      const node = new AudioWorkletNode(ctx, "pcm-player", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        processorOptions: {
          sourceSampleRate: SOURCE_SAMPLE_RATE,
          targetLatencySec: 0.15, // jitter cushion held ahead of playback
          maxLatencySec: 1.0, // drop oldest beyond this so latency can't balloon
          fadeSec: 0.008, // click-free fade on under-run / mute
        },
      });
      const gain = ctx.createGain();
      gain.gain.value = 1;
      node.connect(gain).connect(ctx.destination);

      ctxRef.current = ctx;
      nodeRef.current = node;
      gainRef.current = gain;
    })();

    try {
      await setupRef.current;
    } finally {
      setupRef.current = null;
    }
  }, []);

  const play = useCallback(async () => {
    await ensureGraph();
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch (err) {
        console.warn("[voice-audio] resume failed:", err);
      }
    }
    if (gainRef.current) gainRef.current.gain.value = 1;
    // Clear any stale ring from a previous session so we re-prime cleanly.
    nodeRef.current?.port.postMessage({ type: "reset" });
    carryRef.current = new Uint8Array(0);
    playingRef.current = true;
    setState("playing");
  }, [ensureGraph]);

  const mute = useCallback(() => {
    if (gainRef.current) gainRef.current.gain.value = 0;
    playingRef.current = false;
    setState("muted");
  }, []);

  const stop = useCallback(async () => {
    playingRef.current = false;
    if (gainRef.current) gainRef.current.gain.value = 0;
    nodeRef.current?.port.postMessage({ type: "reset" });
    nodeRef.current?.disconnect();
    if (ctxRef.current && ctxRef.current.state !== "closed") {
      try {
        await ctxRef.current.close();
      } catch {
        // ignore close failures
      }
    }
    ctxRef.current = null;
    nodeRef.current = null;
    gainRef.current = null;
    carryRef.current = new Uint8Array(0);
    setState("idle");
    setFramesPlayed(0);
    setBytesPlayed(0);
  }, []);

  useEffect(() => {
    const unsub = onBinary((frame) => {
      if (!playingRef.current) return;
      const node = nodeRef.current;
      if (!node) return;

      // 16-bit little-endian. Prepend any carried byte, then split off a new
      // carry if this combined buffer is odd-length, so samples stay aligned
      // across frame boundaries.
      const incoming = new Uint8Array(frame);
      const carry = carryRef.current;
      const bytes =
        carry.length === 0
          ? incoming
          : (() => {
              const merged = new Uint8Array(carry.length + incoming.length);
              merged.set(carry, 0);
              merged.set(incoming, carry.length);
              return merged;
            })();

      const usableBytes = bytes.length - (bytes.length % 2);
      carryRef.current = bytes.length % 2 === 1 ? bytes.slice(usableBytes) : EMPTY_CARRY;
      const sampleCount = usableBytes / 2;
      if (sampleCount === 0) return;

      const view = new DataView(bytes.buffer, bytes.byteOffset, usableBytes);
      const float = new Float32Array(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        float[i] = view.getInt16(i * 2, /* littleEndian */ true) / 32768;
      }

      // Transfer the backing buffer to the worklet (zero-copy hand-off).
      node.port.postMessage({ type: "samples", samples: float }, [float.buffer]);

      setFramesPlayed((n) => n + 1);
      setBytesPlayed((n) => n + frame.byteLength);
    });

    return unsub;
  }, [onBinary]);

  useEffect(() => {
    return () => {
      void stop();
    };
  }, [stop]);

  return { state, play, mute, stop, framesPlayed, bytesPlayed };
}
