"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Send,
  ChevronDown,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeft,
  MoreVertical,
  Paperclip,
  FileText,
  Clock,
  MessageSquare,
  Flag,
} from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import {
  CONVERSATIONS,
  Conversation,
  Message,
  NUMBERS,
  NumberRow,
  fmtRelTime,
  fmtTime,
  fmtDateSep,
} from "./data";
import { cn } from "@/lib/cn";
import { useLiveEvents } from "@/hooks/useLiveEvents";
import {
  applyIncoming,
  liveNumberId,
  makeLiveNumberRow,
  parseSmsEvent,
} from "./live";

type ConvoFilter = "all" | "in" | "out" | "failed";

const FIRST_CONVO_FOR_N1 =
  [...CONVERSATIONS]
    .filter((c) => c.spenzaNumberId === "n1")
    .sort((a, b) => b.lastMs - a.lastMs)[0]?.id ?? null;

type MobilePane = "numbers" | "convos" | "thread";

export default function SmsPage() {
  const [convos, setConvos] = useState<Conversation[]>(CONVERSATIONS);
  // numbers list is now state too: live events can add new Spenza numbers
  // we've never seen in the mock data.
  const [numbers, setNumbers] = useState<NumberRow[]>(NUMBERS);
  const [selectedNumberId, setSelectedNumberId] = useState<string>("n1");
  const [selectedConvoId, setSelectedConvoId] = useState<string | null>(FIRST_CONVO_FOR_N1);
  const [convoFilter, setConvoFilter] = useState<ConvoFilter>("all");
  const [convoQuery, setConvoQuery] = useState("");
  const [mobilePane, setMobilePane] = useState<MobilePane>("convos");

  const { subscribe } = useLiveEvents();

  // Wire live SMS events into the existing state.
  // sms.incoming → add (or extend) a conversation; sms.status → flip a message's status.
  useEffect(() => {
    const offIncoming = subscribe("sms.incoming", (event) => {
      const sms = parseSmsEvent(event);
      if (!sms) return;

      let spenzaNumberId = "";
      setNumbers((prev) => {
        const stripped = sms.to.replace(/\s+/g, "");
        const matched = prev.find((n) => n.num.replace(/\s+/g, "") === stripped);
        if (matched) {
          spenzaNumberId = matched.id;
          return prev;
        }
        spenzaNumberId = liveNumberId(sms.to);
        return [makeLiveNumberRow(sms.to, sms.body), ...prev];
      });

      setConvos((prev) => applyIncoming(prev, sms, spenzaNumberId));
      // Jump the user to the live number so they see the message immediately.
      setSelectedNumberId(spenzaNumberId);
    });

    const offStatus = subscribe("sms.status", (event) => {
      const sms = parseSmsEvent(event);
      if (!sms) return;
      setConvos((prev) =>
        prev.map((c) => {
          const idx = c.msgs.findIndex((m) =>
            // The bridge doesn't carry our internal ids, so match by text+direction
            // as a best-effort. This is fine for the demo; once delivery payloads
            // carry the same messageId we sent on the outbound path we'll switch.
            m.dir === "out" && m.status !== sms.status && m.text.length > 0,
          );
          if (idx < 0) return c;
          const msgs = c.msgs.slice();
          msgs[idx] = { ...msgs[idx], status: sms.status, errCode: sms.status === "failed" ? "30007" : null };
          return { ...c, msgs, hasFailure: msgs.some((m) => m.status === "failed") };
        }),
      );
    });

    return () => {
      offIncoming();
      offStatus();
    };
    // `numbers` is read inside the handler but we don't want to resubscribe on
    // every numbers change — the closure picks up the latest via setState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe]);

  const filteredConvos = useMemo(() => {
    let list = convos;
    if (selectedNumberId !== "all") {
      list = list.filter((c) => c.spenzaNumberId === selectedNumberId);
    }
    if (convoFilter === "in") list = list.filter((c) => c.lastDir === "in");
    if (convoFilter === "out") list = list.filter((c) => c.lastDir === "out");
    if (convoFilter === "failed") list = list.filter((c) => c.hasFailure);
    if (convoQuery.trim()) {
      const q = convoQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.peerDisplay.toLowerCase().includes(q) ||
          c.contactName.toLowerCase().includes(q) ||
          c.lastText.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => b.lastMs - a.lastMs);
  }, [convos, selectedNumberId, convoFilter, convoQuery]);

  // auto-pick first
  useEffect(() => {
    if (filteredConvos.length === 0) {
      setSelectedConvoId(null);
      return;
    }
    if (!selectedConvoId || !filteredConvos.find((c) => c.id === selectedConvoId)) {
      setSelectedConvoId(filteredConvos[0].id);
    }
  }, [filteredConvos, selectedConvoId]);

  const selectedConvo = convos.find((c) => c.id === selectedConvoId) ?? null;

  const sendMessage = (text: string) => {
    if (!selectedConvo) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    const newMsg: Message = {
      dir: "out",
      text: trimmed,
      ms: Date.now(),
      status: "pending",
      errCode: null,
    };
    setConvos((prev) =>
      prev.map((c) =>
        c.id === selectedConvo.id
          ? {
              ...c,
              msgs: [...c.msgs, newMsg],
              lastMs: newMsg.ms,
              lastDir: "out",
              lastText: trimmed,
            }
          : c,
      ),
    );
    setTimeout(() => {
      const failed = Math.random() < 0.07;
      setConvos((prev) =>
        prev.map((c) => {
          if (c.id !== selectedConvo.id) return c;
          const msgs = c.msgs.map((m, idx) =>
            idx === c.msgs.length - 1
              ? {
                  ...m,
                  status: failed ? ("failed" as const) : ("delivered" as const),
                  errCode: failed ? "30007" : null,
                }
              : m,
          );
          return { ...c, msgs, hasFailure: msgs.some((m) => m.status === "failed") };
        }),
      );
    }, 1100 + Math.random() * 900);
  };

  return (
    <AppShell crumb="SMS">
      <div className="-m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-6 mb-5 sm:mb-6">
          <div>
            <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight">SMS</h1>
            <div className="text-spenza-slate text-sm mt-1">
              All messages across your Spenza numbers
            </div>
          </div>
          <div className="flex gap-2.5 items-center flex-wrap">
            <div className="inline-flex items-center gap-2 h-9 px-3.5 border border-spenza-border rounded-[10px] bg-white text-[13px] text-spenza-slate">
              <Calendar strokeWidth={1.75} className="w-3.5 h-3.5" />
              <span className="mono text-xs text-spenza-ink">May 5 – May 19</span>
              <ChevronDown strokeWidth={1.75} className="w-3.5 h-3.5 text-spenza-mute" />
            </div>
            <button className="btn btn-primary">
              <Send strokeWidth={1.75} className="w-3.5 h-3.5" />
              Compose
            </button>
          </div>
        </div>

        <div className="sms-layout flex flex-col gap-4 lg:grid lg:[grid-template-columns:280px_minmax(0,1fr)_460px] lg:[height:calc(100vh-64px-24px-32px-60px)] lg:min-h-[720px] h-[calc(100vh-180px)]">
          <div className={cn("min-h-0 flex flex-col", mobilePane === "numbers" ? "" : "hidden", "lg:flex")}>
            <NumbersColumn
              numbers={numbers}
              selected={selectedNumberId}
              onSelect={(id) => {
                setSelectedNumberId(id);
                setSelectedConvoId(null);
                setMobilePane("convos");
              }}
            />
          </div>

          <div className={cn("min-h-0 flex flex-col", mobilePane === "convos" ? "" : "hidden", "lg:flex")}>
            <ConversationsColumn
              count={filteredConvos.length}
              list={filteredConvos}
              selectedId={selectedConvoId}
              onSelect={(id) => {
                setSelectedConvoId(id);
                setMobilePane("thread");
              }}
              query={convoQuery}
              onQuery={setConvoQuery}
              filter={convoFilter}
              onFilter={setConvoFilter}
              onBack={() => setMobilePane("numbers")}
            />
          </div>

          <div className={cn("min-h-0 flex flex-col", mobilePane === "thread" ? "" : "hidden", "lg:flex")}>
            <ThreadColumn
              convo={selectedConvo}
              onSend={sendMessage}
              onBack={() => setMobilePane("convos")}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function NumbersColumn({
  numbers,
  selected,
  onSelect,
}: {
  numbers: NumberRow[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const totalUnread = numbers.reduce((a, n) => a + n.unread, 0);
  return (
    <aside className="flex-1 w-full bg-white border border-spenza-border rounded-card shadow-card flex flex-col overflow-hidden min-h-0">
      <ColHead title="Numbers" count={String(numbers.length)}>
        <SearchInput placeholder="Filter numbers" />
      </ColHead>
      <div className="flex-1 overflow-y-auto p-1.5 scroll">
        <NumRow
          selected={selected === "all"}
          onClick={() => onSelect("all")}
          isAll
          unread={totalUnread}
        />
        {numbers.map((n) => (
          <NumRow
            key={n.id}
            selected={selected === n.id}
            onClick={() => onSelect(n.id)}
            flag={n.country}
            num={n.num}
            unread={n.unread}
            last={n.last}
          />
        ))}
      </div>
    </aside>
  );
}

function NumRow({
  selected,
  onClick,
  isAll,
  flag,
  num,
  unread,
  last,
}: {
  selected: boolean;
  onClick: () => void;
  isAll?: boolean;
  flag?: string;
  num?: string;
  unread?: number;
  last?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative grid grid-cols-[22px_minmax(0,1fr)_auto] gap-2.5 items-center px-3 py-2.5 rounded-[10px] border cursor-pointer transition-[background] duration-[120ms]",
        selected
          ? "bg-spenza-orange-soft border-[#fde0cd]"
          : isAll
            ? "bg-[#fafafa] border-spenza-border mb-1.5"
            : "border-transparent hover:bg-[#fafafa]",
      )}
    >
      {selected && (
        <span className="absolute -left-px top-2 bottom-2 w-[3px] bg-spenza-orange rounded-r-[3px]" />
      )}
      <div className="text-lg leading-none">
        {isAll ? (
          <Flag strokeWidth={1.75} className="w-[18px] h-[18px] text-spenza-orange" />
        ) : (
          flag
        )}
      </div>
      <div
        className={cn(
          "text-[13px] font-medium text-spenza-ink whitespace-nowrap overflow-hidden text-ellipsis",
          isAll ? "" : "mono",
        )}
        style={isAll ? undefined : { letterSpacing: "-0.01em" }}
      >
        {isAll ? "All numbers" : num}
      </div>
      {unread ? (
        <div className="bg-spenza-orange text-white mono text-[10px] font-semibold px-1.5 py-px rounded-full min-w-[18px] text-center">
          {unread}
        </div>
      ) : (
        <span />
      )}
      <div className="col-start-2 col-end-4 text-xs text-spenza-mute whitespace-nowrap overflow-hidden text-ellipsis mt-0.5">
        {isAll ? `${NUMBERS.length} active Spenza numbers` : last}
      </div>
    </div>
  );
}

function ConversationsColumn({
  count,
  list,
  selectedId,
  onSelect,
  query,
  onQuery,
  filter,
  onFilter,
  onBack,
}: {
  count: number;
  list: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  query: string;
  onQuery: (q: string) => void;
  filter: ConvoFilter;
  onFilter: (f: ConvoFilter) => void;
  onBack?: () => void;
}) {
  return (
    <section className="flex-1 w-full bg-white border border-spenza-border rounded-card shadow-card flex flex-col overflow-hidden min-h-0">
      <ColHead title="Conversations" count={String(count)} onBack={onBack}>
        <SearchInput
          placeholder="Search conversations"
          value={query}
          onChange={onQuery}
        />
        <div className="flex gap-1.5 mt-2.5 flex-wrap">
          {(["all", "in", "out", "failed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => onFilter(f)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium transition-[background,color] duration-150",
                filter === f
                  ? "bg-spenza-ink text-white"
                  : "bg-[#f4f4f4] text-spenza-slate hover:text-spenza-ink",
              )}
            >
              {f === "all" ? "All" : f === "in" ? "Inbound" : f === "out" ? "Outbound" : "Failed"}
            </button>
          ))}
        </div>
      </ColHead>

      <div className="flex-1 overflow-y-auto p-1.5 scroll">
        {list.length === 0 ? (
          <div className="py-8 px-4 text-center text-spenza-mute text-[13px]">
            No conversations match.
          </div>
        ) : (
          list.map((c) => {
            const last = c.msgs[c.msgs.length - 1];
            const isSelected = c.id === selectedId;
            const statusCls =
              last.status === "failed"
                ? { bg: "#FEF2F2", color: "#DC2626", border: "#f5cccc" }
                : last.status === "pending"
                  ? { bg: "#fef6e7", color: "#b45309", border: "#fde7b9" }
                  : { bg: "#ECFDF5", color: "#16A34A", border: "#cdebd9" };
            return (
              <div
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={cn(
                  "relative grid items-center gap-3 px-3.5 py-3.5 rounded-[10px] border cursor-pointer transition-[background] duration-[120ms] min-h-[72px]",
                  isSelected
                    ? "bg-spenza-orange-soft border-[#fde0cd]"
                    : "border-transparent hover:bg-[#fafafa]",
                )}
                style={{ gridTemplateColumns: "28px minmax(0, 1fr) auto" }}
              >
                {isSelected && (
                  <span className="absolute -left-px top-2.5 bottom-2.5 w-[3px] bg-spenza-orange rounded-r-[3px]" />
                )}
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center",
                    c.lastDir === "in"
                      ? "bg-spenza-success-soft text-spenza-success"
                      : "bg-spenza-orange-soft text-spenza-orange",
                  )}
                >
                  {c.lastDir === "in" ? (
                    <ArrowDownLeft strokeWidth={2} className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowUpRight strokeWidth={2} className="w-3.5 h-3.5" />
                  )}
                </div>
                <div className="min-w-0">
                  <div
                    className="mono text-[13px] font-medium whitespace-nowrap overflow-hidden text-ellipsis"
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    {c.peerDisplay}
                  </div>
                  <div className="text-xs text-spenza-mute whitespace-nowrap overflow-hidden text-ellipsis mt-0.5">
                    {c.lastText}
                  </div>
                </div>
                <div className="flex flex-col gap-[5px] items-end shrink-0">
                  <span className="mono text-[11px] text-spenza-mute" suppressHydrationWarning>
                    {fmtRelTime(c.lastMs)}
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full mono text-[10px] font-medium border"
                    style={{
                      padding: "2px 7px",
                      background: statusCls.bg,
                      color: statusCls.color,
                      borderColor: statusCls.border,
                      letterSpacing: "0.02em",
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: statusCls.color }}
                    />
                    {last.status}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function ThreadColumn({
  convo,
  onSend,
  onBack,
}: {
  convo: Conversation | null;
  onSend: (text: string) => void;
  onBack?: () => void;
}) {
  if (!convo) {
    return (
      <section className="flex-1 w-full bg-white border border-spenza-border rounded-card shadow-card flex flex-col overflow-hidden min-h-0">
        <div className="flex-1 flex flex-col items-center justify-center text-center py-16 px-5">
          <div className="w-24 h-24 rounded-full bg-spenza-orange-soft text-spenza-orange flex items-center justify-center mb-[22px]">
            <MessageSquare strokeWidth={1.5} className="w-12 h-12" />
          </div>
          <h3 className="text-[22px] font-semibold mb-2 tracking-tight">
            Pick a conversation to view the thread.
          </h3>
          <p className="text-spenza-slate text-sm max-w-[320px]">
            Select any conversation in the middle column to see the full message thread and delivery details.
          </p>
        </div>
      </section>
    );
  }
  return <Thread convo={convo} onSend={onSend} onBack={onBack} />;
}

function Thread({
  convo,
  onSend,
  onBack,
}: {
  convo: Conversation;
  onSend: (text: string) => void;
  onBack?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [convo.id, convo.msgs.length]);

  const handleSend = () => {
    if (!value.trim()) return;
    onSend(value);
    setValue("");
    if (taRef.current) taRef.current.style.height = "auto";
  };

  const remaining = 160 - value.length;
  const charWarn = remaining < 20;

  // build sections with date separators
  const parts: Array<{ kind: "sep"; key: string; label: string } | { kind: "msg"; key: string; m: Message }> = [];
  let lastDate: string | null = null;
  convo.msgs.forEach((m, i) => {
    const date = new Date(m.ms).toDateString();
    if (date !== lastDate) {
      parts.push({ kind: "sep", key: `s-${i}`, label: fmtDateSep(m.ms) });
      lastDate = date;
    }
    parts.push({ kind: "msg", key: `m-${i}`, m });
  });

  return (
    <section className="flex-1 w-full bg-white border border-spenza-border rounded-card shadow-card flex flex-col overflow-hidden min-h-0">
      <div className="py-3.5 px-4 sm:px-[18px] border-b border-spenza-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              aria-label="Back to conversations"
              className="lg:hidden -ml-1 w-9 h-9 rounded-lg flex items-center justify-center text-spenza-slate hover:bg-[#fafafa] shrink-0"
            >
              <ArrowLeft strokeWidth={1.75} className="w-5 h-5" />
            </button>
          )}
          <div className="min-w-0">
            <div className="mono text-sm sm:text-base font-medium truncate" style={{ letterSpacing: "-0.01em" }}>
              {convo.peerDisplay}
            </div>
            <span className="text-xs text-spenza-mute font-normal block mt-0.5 truncate">
              {convo.contactName} · {convo.msgs.length} messages
            </span>
          </div>
        </div>
        <div className="flex gap-1.5 items-center">
          <a href="#" className="text-[13px] text-spenza-orange font-medium">
            View contact
          </a>
          <button
            aria-label="More"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-spenza-slate hover:bg-[#fafafa]"
          >
            <MoreVertical strokeWidth={1.75} className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto pt-[22px] px-5 pb-3 flex flex-col gap-3.5 scroll"
        style={{ background: "linear-gradient(to bottom, #fafafa, #ffffff 20%)" }}
      >
        {parts.map((p) => {
          if (p.kind === "sep") {
            return (
              <div
                key={p.key}
                className="self-center text-[11px] uppercase text-spenza-mute font-medium px-2.5 py-1.5 bg-black/[0.03] rounded-full my-1.5"
                style={{ letterSpacing: "0.14em" }}
              >
                {p.label}
              </div>
            );
          }
          const m = p.m;
          return (
            <motion.div
              key={p.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className={cn("max-w-[75%]", m.dir === "in" ? "self-start" : "self-end text-right")}
            >
              <div
                className={cn(
                  "inline-block py-2.5 px-3.5 text-sm leading-snug text-left rounded-[18px]",
                  m.dir === "in"
                    ? "bg-white border border-spenza-border text-spenza-ink"
                    : "bg-spenza-orange text-white shadow-[0_6px_16px_-10px_rgba(234,88,12,0.6)]",
                )}
                style={
                  m.dir === "in"
                    ? { borderBottomLeftRadius: 6 }
                    : { borderBottomRightRadius: 6 }
                }
              >
                {m.text}
              </div>
              {m.dir === "out" && (
                <div
                  className={cn(
                    "mono text-[10px] mt-1",
                    m.status === "failed" ? "text-spenza-danger" : "text-spenza-mute",
                  )}
                  style={{ letterSpacing: "0.02em" }}
                  suppressHydrationWarning
                >
                  {m.status === "delivered" && `delivered ${fmtTime(m.ms)}`}
                  {m.status === "pending" && `pending ${fmtTime(m.ms)}`}
                  {m.status === "failed" && `failed: ${m.errCode} · ${fmtTime(m.ms)}`}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="py-3 px-4 pb-4 border-t border-spenza-border bg-white">
        <div className="grid grid-cols-[1fr_auto] gap-2.5 items-end p-2.5 px-3 border border-spenza-border rounded-[14px] bg-[#fafafa] focus-within:border-spenza-orange focus-within:bg-white focus-within:shadow-focus transition-[border-color,background,box-shadow] duration-150">
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              const ta = taRef.current;
              if (ta) {
                ta.style.height = "auto";
                ta.style.height = `${Math.min(120, ta.scrollHeight)}px`;
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            placeholder={`Type a message to ${convo.peerDisplay}…`}
            className="w-full border-none bg-transparent outline-none resize-none text-sm leading-snug min-h-[24px] max-h-[120px] py-1.5"
          />
          <button
            disabled={!value.trim()}
            onClick={handleSend}
            aria-label="Send"
            className={cn(
              "self-end w-10 h-10 rounded-[10px] flex items-center justify-center transition-colors duration-150",
              value.trim()
                ? "bg-spenza-orange text-white hover:bg-[#d44d09]"
                : "bg-[#e5e5e5] text-spenza-mute cursor-not-allowed",
            )}
          >
            <Send strokeWidth={1.75} className="w-[18px] h-[18px]" />
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex gap-1.5">
            <ToolbarBtn ariaLabel="Add attachment">
              <Paperclip strokeWidth={1.75} className="w-3.5 h-3.5" />
            </ToolbarBtn>
            <ToolbarBtn ariaLabel="Insert template">
              <FileText strokeWidth={1.75} className="w-3.5 h-3.5" />
            </ToolbarBtn>
            <ToolbarBtn ariaLabel="Schedule">
              <Clock strokeWidth={1.75} className="w-3.5 h-3.5" />
            </ToolbarBtn>
          </div>
          <span
            className={cn(
              "mono text-[11px]",
              charWarn ? "text-spenza-amber" : "text-spenza-mute",
            )}
          >
            {value.length}/160
          </span>
        </div>
      </div>
    </section>
  );
}

function ToolbarBtn({ children, ariaLabel }: { children: React.ReactNode; ariaLabel: string }) {
  return (
    <button
      aria-label={ariaLabel}
      className="w-8 h-8 border border-spenza-border rounded-lg flex items-center justify-center text-spenza-slate bg-white hover:bg-[#fafafa] hover:text-spenza-ink"
    >
      {children}
    </button>
  );
}

function ColHead({
  title,
  count,
  children,
  onBack,
}: {
  title: string;
  count: string;
  children?: React.ReactNode;
  onBack?: () => void;
}) {
  return (
    <div className="py-3.5 px-4 border-b border-spenza-border">
      <h4 className="text-sm font-semibold flex items-center justify-between mb-2.5 gap-2">
        <span className="flex items-center gap-2 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              aria-label="Back"
              className="lg:hidden -ml-1 w-7 h-7 rounded-md flex items-center justify-center text-spenza-slate hover:bg-[#fafafa] shrink-0"
            >
              <ArrowLeft strokeWidth={1.75} className="w-4 h-4" />
            </button>
          )}
          <span className="truncate">{title}</span>
        </span>
        <span className="mono text-[11px] font-medium text-spenza-mute shrink-0">{count}</span>
      </h4>
      {children}
    </div>
  );
}

function SearchInput({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <div className="relative">
      <Search strokeWidth={1.75} className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-spenza-mute" />
      <input
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full h-[34px] px-3 pl-9 border border-spenza-border rounded-[10px] text-[13px] bg-[#fafafa] focus:outline-none focus:border-spenza-orange focus:shadow-focus focus:bg-white"
      />
    </div>
  );
}
