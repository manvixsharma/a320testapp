"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import questionsRaw from "../data/questions.json";

type Question = { id: number; chapter: string; question: string; options: string[]; correct: number | null; };
const ALL_QUESTIONS: Question[] = questionsRaw as Question[];
const ALL_CHAPTERS = Array.from(new Set(ALL_QUESTIONS.map((q) => q.chapter))).sort();

const PILOT = "Ayesha"; // 💜

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ── Purple aviation palette ──
const C = {
  bg: "#12091f", bg2: "#1a0f2e", card: "#211436", cardBorder: "#3a2359",
  accent: "#a855f7", accentDeep: "#7c3aed", accentLight: "#c896ff",
  correct: "#34d399", correctBg: "rgba(52,211,153,0.15)",
  wrong: "#fb7185", wrongBg: "rgba(251,113,133,0.14)",
  neutral: "#6b5b8a", text: "#ede9f5", textMuted: "#a99cc4",
  optionBg: "#1c1030", optionBorder: "#3a2359", gold: "#fbbf24",
};

// Cheeky messages, rotated randomly
const AFFIRM = [
  `Cleared for takeoff, ${PILOT}! ✈️`,
  `Captain ${PILOT} strikes again 🫡`,
  `Smooth as autopilot, ${PILOT} 💜`,
  `That's a greaser landing! 🛬`,
  `${PILOT}, ATC says: chef's kiss 👩‍✈️`,
  `Full thrust brain today, ${PILOT}! 🚀`,
  `Textbook, Captain. Zorro's tail is wagging 🐶`,
];
const WRONG = [
  `Go around, ${PILOT}! 🔄`,
  `Ooh… not it. Reject takeoff 🛑`,
  `Check your instruments, ${PILOT} 👀`,
  `Turbulence! Try that one again 🌪️`,
  `Almost — pull up, pull up! ⬆️`,
  `Nope. But you got this next time 💪`,
];
const LOW = [
  `Rough approach, ${PILOT} — let's taxi back and try again.`,
  `Even the best pilots do sim retakes. Again? 💜`,
  `Bumpy flight. Reset, refuel, re-attempt.`,
];
const HIGH = [
  `Zorro's SO proud of you, Captain ${PILOT}! 🐶🎉`,
  `First class performance, ${PILOT}! 🥂✈️`,
  `Zorro put on his tux for this score 🤵🐶`,
];
const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

const LS = {
  get(): number[] { try { return JSON.parse(localStorage.getItem("a320_bm") || "[]"); } catch { return []; } },
  set(ids: number[]) { try { localStorage.setItem("a320_bm", JSON.stringify(ids)); } catch {} },
};

type LoggedAnswer = { qid: number; chapter: string; question: string; options: string[]; correct: number | null; chosen: number | null };
type LogEntry = {
  date: string;      // ISO
  mode: string;
  score: number;     // %
  correct: number;
  answered: number;
  total: number;
  answers?: LoggedAnswer[]; // full detail for review
};
const LOG = {
  get(): LogEntry[] { try { return JSON.parse(localStorage.getItem("a320_log") || "[]"); } catch { return []; } },
  add(e: LogEntry) {
    try {
      const cur = LOG.get();
      cur.unshift(e);                       // newest first
      localStorage.setItem("a320_log", JSON.stringify(cur.slice(0, 100))); // keep last 100
    } catch {}
  },
  clear() { try { localStorage.removeItem("a320_log"); } catch {} },
};

type Screen = "home" | "quiz" | "results" | "review" | "flightlog" | "logreview";
type Mode = "practice" | "exam" | "bookmarks";
type Answer = { q: Question; chosen: number | null; isCorrect: boolean };

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set());
  const [examSize, setExamSize] = useState(20);
  const [mode, setMode] = useState<Mode>("practice");
  const [quiz, setQuiz] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [bm, setBm] = useState<number[]>([]);
  const [reviewFilter, setReviewFilter] = useState<"all" | "wrong" | "correct">("all");
  const [flash, setFlash] = useState<string>("");
  const [logReview, setLogReview] = useState<{ answers: any[]; title: string } | null>(null);

  useEffect(() => { setBm(LS.get()); }, []);

  const toggleBm = useCallback((id: number) => {
    setBm((p) => { const n = p.includes(id) ? p.filter((x) => x !== id) : [...p, id]; LS.set(n); return n; });
  }, []);

  const filtered = useMemo(() =>
    selectedChapters.size === 0 ? ALL_QUESTIONS : ALL_QUESTIONS.filter((q) => selectedChapters.has(q.chapter)),
  [selectedChapters]);

  const chapterCounts = useMemo(() => {
    const m: Record<string, number> = {}; ALL_QUESTIONS.forEach((q) => { m[q.chapter] = (m[q.chapter] || 0) + 1; }); return m;
  }, []);

  const start = useCallback((m: Mode) => {
    let pool: Question[];
    if (m === "bookmarks") { const b = LS.get(); pool = shuffle(ALL_QUESTIONS.filter((q) => b.includes(q.id))); }
    else { pool = shuffle(filtered); if (m === "exam") pool = pool.slice(0, Math.min(examSize, pool.length)); }
    if (!pool.length) return;
    setMode(m); setQuiz(pool); setIdx(0); setChosen(null); setRevealed(false); setAnswers([]); setFlash(""); setScreen("quiz");
  }, [filtered, examSize]);

  const currentQ = quiz[idx];

  const onChoose = useCallback((i: number) => {
    if (mode === "practice" || mode === "bookmarks") {
      if (!revealed) {
        setChosen(i); setRevealed(true);
        setFlash(i === currentQ.correct ? pick(AFFIRM) : pick(WRONG));
      }
    } else { setChosen(i); }
  }, [mode, revealed, currentQ]);

  const next = useCallback(() => {
    if (!currentQ) return;
    const isCorrect = chosen !== null && chosen === currentQ.correct;
    const na = [...answers, { q: currentQ, chosen, isCorrect }];
    setAnswers(na);
    if (idx + 1 < quiz.length) { setIdx(idx + 1); setChosen(null); setRevealed(false); setFlash(""); }
    else {
      // Save this session to the flight log
      const answered = na.filter((a) => a.chosen !== null).length;
      const correct = na.filter((a) => a.isCorrect).length;
      LOG.add({
        date: new Date().toISOString(),
        mode,
        score: answered ? Math.round((correct / answered) * 100) : 0,
        correct,
        answered,
        total: na.length,
        answers: na.map((a) => ({ qid: a.q.id, chapter: a.q.chapter, question: a.q.question, options: a.q.options, correct: a.q.correct, chosen: a.chosen })),
      });
      setScreen("results");
    }
  }, [currentQ, chosen, answers, idx, quiz.length, mode]);

  if (screen === "home") return <Home {...{ selectedChapters, setSelectedChapters, examSize, setExamSize, chapterCounts, filteredCount: filtered.length, bmCount: bm.length, start, openLog: () => setScreen("flightlog") }} />;
  if (screen === "flightlog") return <FlightLog back={() => setScreen("home")} openReview={(answers: any[], title: string) => { setLogReview({ answers, title }); setReviewFilter("all"); setScreen("logreview"); }} />;
  if (screen === "logreview" && logReview) return <Review {...{ answers: logReview.answers, filter: reviewFilter, setFilter: setReviewFilter, bm, toggleBm, back: () => setScreen("flightlog"), title: logReview.title }} />;
  if (screen === "quiz" && currentQ) return <Quiz {...{ q: currentQ, idx, total: quiz.length, chosen, revealed, mode, flash, bookmarked: bm.includes(currentQ.id), onChoose, next, home: () => setScreen("home"), toggleBm: () => toggleBm(currentQ.id) }} />;
  if (screen === "results") return <Results {...{ answers, mode, review: () => { setReviewFilter("all"); setScreen("review"); }, home: () => setScreen("home"), retry: () => start(mode) }} />;
  if (screen === "review") return <Review {...{ answers, filter: reviewFilter, setFilter: setReviewFilter, bm, toggleBm, back: () => setScreen("results") }} />;
  return null;
}

// Wing divider — the signature aviation motif
function WingRule() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.5, margin: "0 auto", maxWidth: 200 }}>
      <div style={{ height: 1, flex: 1, background: `linear-gradient(90deg,transparent,${C.accent})` }} />
      <span style={{ fontSize: 11, color: C.accentLight, letterSpacing: 3 }}>✈</span>
      <div style={{ height: 1, flex: 1, background: `linear-gradient(90deg,${C.accent},transparent)` }} />
    </div>
  );
}

// ─────────────────── HOME ───────────────────
function Home({ selectedChapters, setSelectedChapters, examSize, setExamSize, chapterCounts, filteredCount, bmCount, start, openLog }: any) {
  const [tab, setTab] = useState<"practice" | "exam">("practice");
  const toggle = (ch: string) => { const n = new Set<string>(selectedChapters); n.has(ch) ? n.delete(ch) : n.add(ch); setSelectedChapters(n); };
  const allSel = selectedChapters.size === 0;
  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(120% 60% at 50% 0%, ${C.bg2}, ${C.bg})`, color: C.text, paddingBottom: 40 }}>
      <div style={{ padding: "30px 20px 22px", textAlign: "center" }}>
        <div style={{ fontSize: 40, filter: "drop-shadow(0 0 12px rgba(168,85,247,0.6))" }}>✈️</div>
        <h1 style={{ margin: "6px 0 0", fontSize: 25, fontWeight: 900, letterSpacing: "-0.6px", background: `linear-gradient(90deg,${C.accentLight},${C.accent})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          A320 Flight Deck
        </h1>
        <p style={{ margin: "4px 0 14px", fontSize: 13, color: C.textMuted }}>Captain {PILOT}'s ground school · {ALL_QUESTIONS.length} Qs</p>
        <WingRule />
      </div>

      <div style={{ padding: "18px 16px 0" }}>
        <div style={{ background: C.card, borderRadius: 14, padding: 4, display: "flex", marginBottom: 14, border: `1px solid ${C.cardBorder}` }}>
          {(["practice", "exam"] as const).map((m) => (
            <button key={m} onClick={() => setTab(m)} style={{ flex: 1, padding: "11px 0", border: "none", borderRadius: 11, cursor: "pointer", fontSize: 13, fontWeight: 800, background: tab === m ? `linear-gradient(135deg,${C.accent},${C.accentDeep})` : "transparent", color: tab === m ? "#fff" : C.textMuted }}>
              {m === "practice" ? "📖 Practice" : "📝 Check Ride"}
            </button>
          ))}
          <button onClick={openLog} style={{ flex: 1, padding: "11px 0", border: "none", borderRadius: 11, cursor: "pointer", fontSize: 13, fontWeight: 800, background: "transparent", color: C.textMuted }}>
            🛩️ Flight Log
          </button>
        </div>
        <p style={{ fontSize: 12, color: C.textMuted, margin: "0 4px 14px", lineHeight: 1.5 }}>
          {tab === "practice" ? "Instant feedback after every question — with a cheer or a nudge 💜" : "Fly a set number of questions, then get your score & landing verdict."}
        </p>

        {tab === "exam" && (
          <div style={{ background: C.card, borderRadius: 14, padding: "12px 14px", marginBottom: 14, border: `1px solid ${C.cardBorder}` }}>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 8 }}>Questions this flight</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[10, 20, 30, 50].map((n) => (
                <button key={n} onClick={() => setExamSize(n)} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: `1px solid ${examSize === n ? C.accent : C.cardBorder}`, background: examSize === n ? `linear-gradient(135deg,${C.accent},${C.accentDeep})` : "transparent", color: examSize === n ? "#fff" : C.textMuted, fontSize: 14, fontWeight: 800, cursor: "pointer" }}>{n}</button>
              ))}
            </div>
          </div>
        )}

        <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.cardBorder}`, overflow: "hidden", marginBottom: 14 }}>
          <div style={{ padding: "13px 14px", borderBottom: `1px solid ${C.cardBorder}`, display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, fontWeight: 800 }}>Systems</span>
            <button onClick={() => setSelectedChapters(new Set())} style={{ fontSize: 12, color: allSel ? C.accentLight : C.textMuted, background: "none", border: "none", cursor: "pointer" }}>{allSel ? "✓ All aboard" : "Select all"}</button>
          </div>
          {ALL_CHAPTERS.map((ch, i) => {
            const active = selectedChapters.has(ch);
            return (
              <div key={ch} onClick={() => toggle(ch)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", cursor: "pointer", borderBottom: i < ALL_CHAPTERS.length - 1 ? `1px solid ${C.cardBorder}` : "none", background: active ? "rgba(168,85,247,0.09)" : "transparent" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${active ? C.accent : C.neutral}`, background: active ? C.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{active && <span style={{ color: "#fff", fontSize: 12 }}>✓</span>}</div>
                  <span style={{ fontSize: 14 }}>{ch}</span>
                </div>
                <span style={{ fontSize: 12, color: C.textMuted, background: C.optionBg, padding: "2px 8px", borderRadius: 10 }}>{chapterCounts[ch] || 0}</span>
              </div>
            );
          })}
        </div>

        <button onClick={() => start(tab)} style={{ width: "100%", padding: "17px 0", borderRadius: 15, border: "none", background: `linear-gradient(135deg,${C.accent},${C.accentDeep})`, color: "#fff", fontSize: 17, fontWeight: 900, cursor: "pointer", boxShadow: "0 6px 26px rgba(168,85,247,0.5)" }}>
          🛫 Start flight — {filteredCount} Qs
        </button>
        <button onClick={() => start("bookmarks")} disabled={!bmCount} style={{ width: "100%", padding: "13px 0", borderRadius: 12, marginTop: 10, border: `1px solid ${bmCount ? C.gold : C.cardBorder}`, background: "transparent", color: bmCount ? C.gold : C.neutral, fontSize: 14, fontWeight: 800, cursor: bmCount ? "pointer" : "default" }}>★ Flagged for review ({bmCount})</button>
      </div>
    </div>
  );
}

// Sticker image: tries /name.png first, falls back to /name.jpg, then emoji.
function StickerImg({ name, glow, fallbackEmoji, width, maxHeight, rotate }: { name: string; glow: string; fallbackEmoji: string; width: number; maxHeight: number; rotate: number }) {
  const [stage, setStage] = useState(0); // 0=png, 1=jpg, 2=emoji
  const src = stage === 0 ? `/${name}.png` : `/${name}.jpg`;
  if (stage >= 2) return <div style={{ fontSize: width * 0.55, filter: "drop-shadow(0 8px 20px rgba(0,0,0,0.5))" }}>{fallbackEmoji}</div>;
  return (
    <img src={src} onError={() => setStage((s) => s + 1)} alt="" style={{
      width, maxHeight, objectFit: "contain",
      filter: `drop-shadow(0 0 14px ${glow}) drop-shadow(0 10px 22px rgba(0,0,0,0.55))`,
      transform: `rotate(${rotate}deg)`,
    }} />
  );
}

// ─────────────────── CONFETTI BURST ───────────────────
function Confetti() {
  const colors = ["#a855f7", "#34d399", "#fbbf24", "#fb7185", "#4a9eff", "#c896ff"];
  const pieces = Array.from({ length: 80 }, (_, i) => {
    const angle = Math.random() * Math.PI - Math.PI / 2;      // upward-ish spread
    const dist = 140 + Math.random() * 220;
    const dx = Math.cos(angle) * dist * (Math.random() < 0.5 ? -1 : 1);
    const dy = -Math.abs(Math.sin(angle) * dist) - 80;        // burst up
    const rot = (Math.random() * 720 - 360) + "deg";
    const delay = Math.random() * 0.06;
    const size = 6 + Math.random() * 8;
    const color = colors[i % colors.length];
    const round = Math.random() < 0.4;
    return { dx, dy, rot, delay, size, color, round, key: i };
  });
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 99, pointerEvents: "none", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: "50%", top: "62%" }}>
        {pieces.map((p) => (
          <span key={p.key} style={{
            position: "absolute", width: p.size, height: p.round ? p.size : p.size * 0.5,
            background: p.color, borderRadius: p.round ? "50%" : 2,
            ["--dx" as any]: `${p.dx}px`, ["--dy" as any]: `${p.dy}px`, ["--rot" as any]: p.rot,
            animation: `confetti 1.5s cubic-bezier(0.15,0.6,0.4,1) ${p.delay}s forwards`,
            opacity: 0,
          }} />
        ))}
      </div>
      <style>{`
        @keyframes confetti {
          0% { transform: translate(0,0) rotate(0); opacity: 1; }
          15% { opacity: 1; }
          100% { transform: translate(var(--dx), calc(var(--dy) + 320px)) rotate(var(--rot)); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ─────────────────── STICKER TOAST (corner, non-blocking) ───────────────────
function StickerToast({ name, msg, correct, onClose }: { name: string; msg: string; correct: boolean; onClose: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 2400); // begin exit
    const t2 = setTimeout(onClose, 2800);                // unmount after exit anim
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [correct, onClose]);

  const ring = correct ? C.correct : C.wrong;
  const glow = correct ? "rgba(52,211,153,0.6)" : "rgba(251,113,133,0.6)";

  return (
    <>
    {correct && <Confetti />}
    <div
      onClick={() => { setLeaving(true); setTimeout(onClose, 300); }}
      style={{
        position: "fixed", left: 0, right: 0, bottom: 92, zIndex: 100,
        display: "flex", justifyContent: "center", pointerEvents: "auto",
        animation: leaving ? "toastOut 0.32s ease forwards" : "toastIn 0.5s cubic-bezier(0.34,1.56,0.64,1)",
      }}
    >
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        background: "rgba(33,20,54,0.92)", backdropFilter: "blur(8px)",
        border: `1.5px solid ${ring}`, borderRadius: 18, padding: "10px 16px 10px 10px",
        boxShadow: `0 8px 28px rgba(0,0,0,0.45), 0 0 22px ${glow}`, maxWidth: 340,
      }}>
        <div style={{ filter: `drop-shadow(0 0 8px ${glow})`, flexShrink: 0 }}>
          <StickerImg name={name} glow={glow} fallbackEmoji={correct ? "🎉" : "🔄"} width={70} maxHeight={84} rotate={-4} />
        </div>
        <span style={{ fontSize: 15, fontWeight: 800, color: correct ? "#a7f3d0" : "#fecdd3", lineHeight: 1.3 }}>{msg}</span>
      </div>
      <style>{`
        @keyframes toastIn{0%{transform:translateY(60px) scale(0.85);opacity:0}100%{transform:translateY(0) scale(1);opacity:1}}
        @keyframes toastOut{0%{transform:translateY(0);opacity:1}100%{transform:translateY(24px);opacity:0}}
      `}</style>
    </div>
    </>
  );
}

// ─────────────────── QUIZ ───────────────────
function Quiz({ q, idx, total, chosen, revealed, mode, flash, bookmarked, onChoose, next, home, toggleBm }: any) {
  const isLast = idx === total - 1;
  const isPractice = mode === "practice" || mode === "bookmarks";
  const canAdvance = isPractice ? revealed : chosen !== null;
  const letters = "ABCDEF";
  const wasCorrect = chosen !== null && chosen === q.correct;
  const [showPopup, setShowPopup] = useState(false);

  // Show popup whenever a new flash message arrives (practice mode reveal)
  useEffect(() => {
    if (isPractice && revealed && flash) setShowPopup(true);
  }, [flash, revealed, isPractice]);

  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(120% 50% at 50% 0%, ${C.bg2}, ${C.bg})`, color: C.text, display: "flex", flexDirection: "column" }}>
      {showPopup && <StickerToast name={wasCorrect ? "affirm" : "notit"} msg={flash} correct={wasCorrect} onClose={() => setShowPopup(false)} />}
      <div style={{ padding: "12px 16px 10px", background: C.card, borderBottom: `1px solid ${C.cardBorder}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <button onClick={home} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 26, cursor: "pointer", lineHeight: 1 }}>‹</button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.accentLight }}>{q.chapter}</div>
            <div style={{ fontSize: 12, color: C.neutral }}>leg {idx + 1} of {total}</div>
          </div>
          <button onClick={toggleBm} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: bookmarked ? C.gold : C.neutral, lineHeight: 1 }}>{bookmarked ? "★" : "☆"}</button>
        </div>
        <div style={{ height: 4, background: C.optionBg, borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(idx / total) * 100}%`, background: `linear-gradient(90deg,${C.accent},${C.accentLight})`, transition: "width 0.3s" }} />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>
        <div style={{ background: C.card, borderRadius: 16, padding: 17, marginBottom: 14, border: `1px solid ${C.cardBorder}`, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, fontWeight: 500 }}>{q.question}</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {q.options.map((opt: string, i: number) => {
            let bg = C.optionBg, border = C.optionBorder, tc = C.text, badge = C.cardBorder, btc = C.textMuted;
            const showRes = isPractice && revealed;
            const isCorr = q.correct === i, isCh = chosen === i;
            if (showRes) {
              if (isCorr) { bg = C.correctBg; border = C.correct; tc = "#a7f3d0"; badge = C.correct; btc = "#06281c"; }
              else if (isCh) { bg = C.wrongBg; border = C.wrong; tc = "#fecdd3"; badge = C.wrong; btc = "#3f0a15"; }
            } else if (mode === "exam" && isCh) { bg = "rgba(168,85,247,0.16)"; border = C.accent; tc = C.accentLight; badge = C.accent; btc = "#fff"; }
            return (
              <button key={i} onClick={() => onChoose(i)} disabled={showRes} style={{ display: "flex", alignItems: "flex-start", gap: 12, background: bg, border: `1.5px solid ${border}`, borderRadius: 13, padding: "13px 14px", cursor: showRes ? "default" : "pointer", textAlign: "left", color: tc, transition: "all 0.15s" }}>
                <span style={{ width: 27, height: 27, borderRadius: 9, background: badge, color: btc, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, flexShrink: 0 }}>{showRes && isCorr ? "✓" : showRes && isCh ? "✕" : letters[i]}</span>
                <span style={{ fontSize: 14, lineHeight: 1.5, paddingTop: 3 }}>{opt.replace(/^[A-F][.)]\s*/, "")}</span>
              </button>
            );
          })}
        </div>

        {isPractice && revealed && q.correct === null && (
          <div style={{ marginTop: 12, padding: "10px 14px", background: C.card, borderRadius: 10, fontSize: 13, color: C.textMuted, border: `1px solid ${C.cardBorder}` }}>No answer marked for this one in the source booklet.</div>
        )}
      </div>

      <div style={{ padding: "12px 16px 28px", background: C.card, borderTop: `1px solid ${C.cardBorder}` }}>
        {isPractice && !revealed && <div style={{ textAlign: "center", fontSize: 13, color: C.textMuted, marginBottom: 8 }}>Tap your answer, Captain 💜</div>}
        {canAdvance && (
          <button onClick={next} style={{ width: "100%", padding: "15px 0", borderRadius: 13, border: "none", background: `linear-gradient(135deg,${C.accent},${C.accentDeep})`, color: "#fff", fontSize: 16, fontWeight: 900, cursor: "pointer" }}>{isLast ? "🛬 Land it" : "Next leg →"}</button>
        )}
      </div>
    </div>
  );
}

// ─────────────────── RESULTS ───────────────────
function Results({ answers, mode, review, home, retry }: any) {
  const answered = answers.filter((a: Answer) => a.chosen !== null);
  const correct = answers.filter((a: Answer) => a.isCorrect).length;
  const pct = answered.length ? Math.round((correct / answered.length) * 100) : 0;
  const pass = pct >= 75;
  const heroName = pass ? "zorro" : "disappoint";
  const heroMsg = pass ? pick(HIGH) : pick(LOW);

  const byCh: Record<string, { total: number; correct: number }> = {};
  answers.forEach((a: Answer) => { if (!byCh[a.q.chapter]) byCh[a.q.chapter] = { total: 0, correct: 0 }; byCh[a.q.chapter].total++; if (a.isCorrect) byCh[a.q.chapter].correct++; });

  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(120% 60% at 50% 0%, ${C.bg2}, ${C.bg})`, color: C.text, paddingBottom: 40 }}>
      <div style={{ padding: "28px 20px 20px", textAlign: "center" }}>
        <StickerImg name={heroName} glow={pass ? "rgba(52,211,153,0.7)" : "rgba(168,85,247,0.6)"} fallbackEmoji={pass ? "🐶" : "🛬"} width={180} maxHeight={200} rotate={-2} />
        <div style={{ fontSize: 54, fontWeight: 900, marginTop: 12, color: pass ? C.correct : C.accentLight, lineHeight: 1 }}>{pct}%</div>
        <p style={{ margin: "6px 0 0", fontSize: 15, color: C.textMuted }}>{correct} / {answered.length} correct</p>
        <p style={{ margin: "10px auto 0", fontSize: 15, fontWeight: 700, color: pass ? "#a7f3d0" : C.accentLight, maxWidth: 300, lineHeight: 1.4 }}>{heroMsg}</p>
      </div>

      <div style={{ padding: "8px 16px 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
          <Stat label="Correct" value={correct} color={C.correct} />
          <Stat label="Missed" value={answered.length - correct} color={C.wrong} />
          <Stat label="Skipped" value={answers.length - answered.length} color={C.neutral} />
        </div>
        <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.cardBorder}`, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ padding: "13px 14px", borderBottom: `1px solid ${C.cardBorder}`, fontSize: 14, fontWeight: 800 }}>System breakdown</div>
          {Object.entries(byCh).map(([ch, s], i, arr) => {
            const p = Math.round((s.correct / s.total) * 100);
            const col = p >= 75 ? C.correct : p >= 50 ? C.gold : C.wrong;
            return (
              <div key={ch} style={{ padding: "10px 14px", borderBottom: i < arr.length - 1 ? `1px solid ${C.cardBorder}` : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 13 }}>{ch}</span>
                  <span style={{ fontSize: 13, color: col, fontWeight: 800 }}>{s.correct}/{s.total}</span>
                </div>
                <div style={{ height: 4, background: C.optionBg, borderRadius: 2, overflow: "hidden" }}><div style={{ height: "100%", width: `${p}%`, background: col }} /></div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={review} style={{ padding: "14px 0", borderRadius: 12, border: `1px solid ${C.accent}`, background: "transparent", color: C.accentLight, fontSize: 15, fontWeight: 800, cursor: "pointer" }}>Review answers</button>
          <button onClick={retry} style={{ padding: "14px 0", borderRadius: 12, border: "none", background: `linear-gradient(135deg,${C.accent},${C.accentDeep})`, color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>🔁 Fly again</button>
          <button onClick={home} style={{ padding: "14px 0", borderRadius: 12, border: `1px solid ${C.cardBorder}`, background: "transparent", color: C.textMuted, fontSize: 15, cursor: "pointer" }}>Home</button>
        </div>
      </div>
    </div>
  );
}
function Stat({ label, value, color }: any) {
  return (
    <div style={{ background: C.card, borderRadius: 13, padding: "16px 8px", textAlign: "center", border: `1px solid ${C.cardBorder}` }}>
      <div style={{ fontSize: 28, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{label}</div>
    </div>
  );
}


// ─────────────────── REVIEW ───────────────────
// Accepts either live Answer[] (with .q) or stored LoggedAnswer[] (flat).
type NormAns = { id: number; chapter: string; question: string; options: string[]; correct: number | null; chosen: number | null; isCorrect: boolean };
function normalizeAnswers(answers: any[]): NormAns[] {
  return (answers || []).map((a: any) => {
    if (a.q) return { id: a.q.id, chapter: a.q.chapter, question: a.q.question, options: a.q.options, correct: a.q.correct, chosen: a.chosen, isCorrect: a.isCorrect };
    return { id: a.qid, chapter: a.chapter, question: a.question, options: a.options, correct: a.correct, chosen: a.chosen, isCorrect: a.chosen !== null && a.chosen === a.correct };
  });
}
function Review({ answers, filter, setFilter, bm, toggleBm, back, title }: any) {
  const letters = "ABCDEF";
  const norm = normalizeAnswers(answers);
  const list = norm.filter((a) => filter === "all" ? true : filter === "correct" ? a.isCorrect : !a.isCorrect);
  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(120% 50% at 50% 0%, ${C.bg2}, ${C.bg})`, color: C.text, paddingBottom: 40 }}>
      <div style={{ background: C.card, padding: "12px 16px", borderBottom: `1px solid ${C.cardBorder}`, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={back} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 26, cursor: "pointer" }}>‹</button>
        <span style={{ fontSize: 16, fontWeight: 800 }}>{title || "Debrief"}</span>
      </div>
      <div style={{ display: "flex", gap: 6, padding: "12px 16px 8px" }}>
        {(["all", "correct", "wrong"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{ flex: 1, padding: "8px 0", borderRadius: 9, border: `1px solid ${filter === f ? C.accent : C.cardBorder}`, background: filter === f ? "rgba(168,85,247,0.16)" : "transparent", color: filter === f ? C.accentLight : C.textMuted, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>{f[0].toUpperCase() + f.slice(1)}</button>
        ))}
      </div>
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {list.map((a, i) => (
          <div key={i} style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.cardBorder}`, overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.cardBorder}`, display: "flex", gap: 10, justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, color: C.accentLight, marginBottom: 4 }}>{a.chapter}</div>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{a.question}</p>
              </div>
              <button onClick={() => toggleBm(a.id)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: bm.includes(a.id) ? C.gold : C.neutral, flexShrink: 0 }}>{bm.includes(a.id) ? "★" : "☆"}</button>
            </div>
            <div style={{ padding: "10px 14px" }}>
              {a.options.map((opt: string, oi: number) => {
                const isCorr = a.correct === oi, isCh = a.chosen === oi;
                let bg = "transparent", bd = "transparent", col = C.textMuted;
                if (isCorr) { bg = C.correctBg; bd = C.correct; col = "#a7f3d0"; }
                else if (isCh) { bg = C.wrongBg; bd = C.wrong; col = "#fecdd3"; }
                return (
                  <div key={oi} style={{ padding: "7px 10px", borderRadius: 8, marginBottom: oi < a.options.length - 1 ? 6 : 0, background: bg, border: `1px solid ${bd}`, fontSize: 13, color: col, display: "flex", gap: 8 }}>
                    <span style={{ fontWeight: 900, flexShrink: 0 }}>{isCorr ? "✓" : isCh ? "✕" : letters[oi]}</span>
                    {opt.replace(/^[A-F][.)]\s*/, "")}
                  </div>
                );
              })}
              {a.chosen === null && <div style={{ fontSize: 12, color: C.neutral, fontStyle: "italic", marginTop: 4 }}>Skipped</div>}
            </div>
          </div>
        ))}
        {!list.length && <div style={{ textAlign: "center", color: C.textMuted, padding: 40, fontSize: 14 }}>Nothing here.</div>}
      </div>
    </div>
  );
}

// ─────────────────── FLIGHT LOG (history) ───────────────────
function FlightLog({ back, openReview }: { back: () => void; openReview: (answers: any[], title: string) => void }) {
  const [log, setLog] = useState<LogEntry[]>([]);
  useEffect(() => { setLog(LOG.get()); }, []);

  const best = log.length ? Math.max(...log.map((e) => e.score)) : 0;
  const avg = log.length ? Math.round(log.reduce((s, e) => s + e.score, 0) / log.length) : 0;

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + " · " +
           d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  };
  const modeLabel = (m: string) => m === "exam" ? "Check ride" : m === "bookmarks" ? "Flagged" : "Practice";
  const clearAll = () => { if (confirm("Clear all flight log history?")) { LOG.clear(); setLog([]); } };

  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(120% 50% at 50% 0%, ${C.bg2}, ${C.bg})`, color: C.text, paddingBottom: 40 }}>
      <div style={{ background: C.card, padding: "12px 16px", borderBottom: `1px solid ${C.cardBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={back} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 26, cursor: "pointer" }}>‹</button>
          <span style={{ fontSize: 16, fontWeight: 800 }}>🛩️ Flight log</span>
        </div>
        {log.length > 0 && <button onClick={clearAll} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 13, cursor: "pointer" }}>Clear</button>}
      </div>

      {log.length === 0 ? (
        <div style={{ textAlign: "center", color: C.textMuted, padding: "60px 30px", fontSize: 14, lineHeight: 1.6 }}>
          No flights logged yet, Captain {PILOT}.<br />Finish a session and it&apos;ll show up here with the date and score. ✈️
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, padding: "14px 16px 4px" }}>
            <Stat label="Flights" value={log.length} color={C.accentLight} />
            <Stat label="Best" value={best} color={C.correct} />
            <Stat label="Average" value={avg} color={C.gold} />
          </div>
          <div style={{ padding: "8px 16px 0", display: "flex", flexDirection: "column", gap: 10 }}>
            {log.map((e, i) => {
              const col = e.score >= 75 ? C.correct : e.score >= 50 ? C.gold : C.wrong;
              const reviewable = !!(e.answers && e.answers.length);
              return (
                <div key={i} onClick={() => reviewable && openReview(e.answers!, fmt(e.date) + " · " + e.score + "%")} style={{ background: C.card, borderRadius: 13, border: `1px solid ${C.cardBorder}`, padding: "13px 15px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: reviewable ? "pointer" : "default" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{fmt(e.date)}</div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>{modeLabel(e.mode)} · {e.correct}/{e.answered} correct{reviewable ? " · tap to review" : ""}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontSize: 26, fontWeight: 900, color: col }}>{e.score}%</div>
                    {reviewable && <span style={{ color: C.textMuted, fontSize: 20 }}>›</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
