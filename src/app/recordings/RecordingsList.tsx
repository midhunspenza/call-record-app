"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, FileAudio, Loader2, Pause, Play, Search } from "lucide-react";
import { Recording, fmtBytes, fmtRelTime } from "./data";
import { parseRecordingKey } from "@/lib/phone";
import { cn } from "@/lib/cn";

export function RecordingsList({
  recordings,
  selectedKey,
  onSelect,
  loading,
  error,
}: {
  recordings: Recording[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  loading: boolean;
  error: string | null;
}) {
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(Date.now());
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const visible = recordings.filter((r) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    // Search both the raw filename and the formatted phones (so e.g. typing
    // "(555)" or "+1 555" matches even though the S3 key is bare digits).
    const parsed = parseRecordingKey(r.key);
    const haystack = [
      r.name,
      parsed?.from ?? "",
      parsed?.to ?? "",
      parsed?.fromRaw ?? "",
      parsed?.toRaw ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });

  async function togglePlay(key: string) {
    if (playingKey === key) {
      audioRef.current?.pause();
      setPlayingKey(null);
      return;
    }
    audioRef.current?.pause();
    setLoadingKey(key);
    try {
      const res = await fetch(`/api/recordings/url?key=${encodeURIComponent(key)}`);
      if (!res.ok) throw new Error(`presign failed: ${res.status}`);
      const { url } = (await res.json()) as { url: string };
      const audio = new Audio(url);
      audio.onended = () => setPlayingKey((cur) => (cur === key ? null : cur));
      audio.onerror = () => setPlayingKey((cur) => (cur === key ? null : cur));
      audioRef.current = audio;
      await audio.play();
      setPlayingKey(key);
    } catch (err) {
      console.warn("[recordings] play failed:", err);
    } finally {
      setLoadingKey((cur) => (cur === key ? null : cur));
    }
  }

  return (
    <aside className="bg-white border border-spenza-border rounded-card shadow-card flex flex-col overflow-hidden lg:h-auto min-h-0">
      <div className="p-3 sm:p-3.5 sm:px-4 sm:pb-2.5 border-b border-spenza-border bg-white sticky top-0 z-[2]">
        <div className="relative">
          <Search strokeWidth={1.75} className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-spenza-mute" />
          <input
            placeholder="Search recordings"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-9 px-3 pl-9 border border-spenza-border rounded-[10px] text-[13px] bg-[#fafafa] focus:outline-none focus:border-spenza-orange focus:shadow-focus focus:bg-white"
          />
        </div>
        <div className="mono text-[11px] text-spenza-mute mt-2">
          {loading ? "Loading…" : `${visible.length} of ${recordings.length}`}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 scroll">
        {error ? (
          <div className="py-8 px-4 text-center text-spenza-danger text-[13px]">
            {error}
          </div>
        ) : loading && recordings.length === 0 ? (
          <div className="py-8 px-4 text-center text-spenza-mute text-[13px]">
            Fetching recordings…
          </div>
        ) : visible.length === 0 ? (
          <div className="py-8 px-4 text-center text-spenza-mute text-[13px]">
            {recordings.length === 0
              ? "No recordings in the bucket yet."
              : "No recordings match your search."}
          </div>
        ) : (
          visible.map((r) => {
            const selected = r.key === selectedKey;
            const playing = playingKey === r.key;
            const isLoading = loadingKey === r.key;
            return (
              <div
                key={r.key}
                onClick={() => onSelect(r.key)}
                className={cn(
                  "relative grid grid-cols-[28px_1fr_auto] gap-x-2.5 gap-y-1 px-3 py-3 pl-3.5 rounded-xl border cursor-pointer transition-[background,border-color] duration-[120ms]",
                  selected
                    ? "bg-spenza-orange-soft border-[#fde0cd]"
                    : "border-transparent hover:bg-[#fafafa]",
                )}
              >
                {selected && (
                  <span className="absolute -left-px top-2 bottom-2 w-[3px] bg-spenza-orange rounded-r-[3px]" />
                )}
                <div className="w-7 h-7 rounded-full bg-spenza-orange-soft text-spenza-orange flex items-center justify-center self-start">
                  {(() => {
                    const parsed = parseRecordingKey(r.key);
                    if (parsed?.direction === "in") {
                      return <ArrowDownLeft strokeWidth={1.75} className="w-3.5 h-3.5 text-spenza-success" />;
                    }
                    if (parsed?.direction === "out") {
                      return <ArrowUpRight strokeWidth={1.75} className="w-3.5 h-3.5 text-spenza-orange" />;
                    }
                    return <FileAudio strokeWidth={1.75} className="w-3.5 h-3.5" />;
                  })()}
                </div>
                <div className="min-w-0" title={r.name}>
                  {(() => {
                    const parsed = parseRecordingKey(r.key);
                    if (!parsed) {
                      return (
                        <div
                          className="mono text-[13px] font-medium text-spenza-ink whitespace-nowrap overflow-hidden text-ellipsis"
                          style={{ letterSpacing: "-0.01em" }}
                        >
                          {r.name}
                        </div>
                      );
                    }
                    return (
                      <>
                        <div
                          className="mono text-[13px] font-medium text-spenza-ink whitespace-nowrap overflow-hidden text-ellipsis"
                          style={{ letterSpacing: "-0.01em" }}
                        >
                          {parsed.from}
                        </div>
                        <div
                          className="mono text-[12px] text-spenza-slate whitespace-nowrap overflow-hidden text-ellipsis"
                          style={{ letterSpacing: "-0.01em" }}
                        >
                          <span className="text-spenza-mute mr-1">→</span>
                          {parsed.to}
                        </div>
                      </>
                    );
                  })()}
                  <div className="text-xs text-spenza-mute mt-0.5">
                    <span suppressHydrationWarning>{fmtRelTime(r.lastModified, now)}</span>
                    <span className="mx-1.5">·</span>
                    <span className="mono">{fmtBytes(r.size)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={playing ? "Pause" : "Play"}
                  onClick={(e) => {
                    e.stopPropagation();
                    void togglePlay(r.key);
                  }}
                  className={cn(
                    "self-center w-8 h-8 rounded-[10px] flex items-center justify-center border transition-colors duration-150",
                    playing
                      ? "bg-spenza-orange border-spenza-orange text-white hover:bg-[#d44d09]"
                      : "bg-white border-spenza-border text-spenza-slate hover:bg-[#fafafa] hover:text-spenza-ink",
                  )}
                >
                  {isLoading ? (
                    <Loader2 strokeWidth={1.75} className="w-3.5 h-3.5 animate-spin" />
                  ) : playing ? (
                    <Pause strokeWidth={1.75} className="w-3.5 h-3.5" />
                  ) : (
                    <Play strokeWidth={1.75} className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
