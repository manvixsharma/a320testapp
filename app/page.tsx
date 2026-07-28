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

type Screen = "home" | "quiz" | "results" | "review";
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
    else setScreen("results");
  }, [currentQ, chosen, answers, idx, quiz.length]);

  if (screen === "home") return <Home {...{ selectedChapters, setSelectedChapters, examSize, setExamSize, chapterCounts, filteredCount: filtered.length, bmCount: bm.length, start }} />;
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
function Home({ selectedChapters, setSelectedChapters, examSize, setExamSize, chapterCounts, filteredCount, bmCount, start }: any) {
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
            <button key={m} onClick={() => setTab(m)} style={{ flex: 1, padding: "11px 0", border: "none", borderRadius: 11, cursor: "pointer", fontSize: 14, fontWeight: 800, background: tab === m ? `linear-gradient(135deg,${C.accent},${C.accentDeep})` : "transparent", color: tab === m ? "#fff" : C.textMuted }}>
              {m === "practice" ? "📖 Practice" : "📝 Check Ride"}
            </button>
          ))}
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

// ─────────────────── PHOTO FLASH ───────────────────
function PhotoFlash({ src, msg, correct }: { src: string; msg: string; correct: boolean }) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", marginBottom: 12, borderRadius: 14, background: correct ? C.correctBg : C.wrongBg, border: `1.5px solid ${correct ? C.correct : C.wrong}`, animation: "pop 0.3s ease" }}>
      {imgOk ? (
        <img src={src} onError={() => setImgOk(false)} alt="" style={{ width: 52, height: 52, borderRadius: 12, objectFit: "cover", flexShrink: 0, border: `2px solid ${correct ? C.correct : C.wrong}` }} />
      ) : (
        <div style={{ width: 52, height: 52, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, background: C.optionBg }}>{correct ? "🎉" : "🔄"}</div>
      )}
      <span style={{ fontSize: 14, fontWeight: 700, color: correct ? "#a7f3d0" : "#fecdd3", lineHeight: 1.35 }}>{msg}</span>
      <style>{`@keyframes pop{0%{transform:scale(0.9);opacity:0}100%{transform:scale(1);opacity:1}}`}</style>
    </div>
  );
}

// ─────────────────── QUIZ ───────────────────
function Quiz({ q, idx, total, chosen, revealed, mode, flash, bookmarked, onChoose, next, home, toggleBm }: any) {
  const isLast = idx === total - 1;
  const isPractice = mode === "practice" || mode === "bookmarks";
  const canAdvance = isPractice ? revealed : chosen !== null;
  const letters = "ABCDEF";
  const wasCorrect = chosen !== null && chosen === q.correct;

  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(120% 50% at 50% 0%, ${C.bg2}, ${C.bg})`, color: C.text, display: "flex", flexDirection: "column" }}>
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
        {isPractice && revealed && flash && <PhotoFlash src={wasCorrect ? "/affirm.jpg" : "/notit.jpg"} msg={flash} correct={wasCorrect} />}

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
  const [imgOk, setImgOk] = useState(true);
  const heroImg = pass ? "/zorro.jpg" : "/disappoint.jpg";
  const heroMsg = pass ? pick(HIGH) : pick(LOW);

  const byCh: Record<string, { total: number; correct: number }> = {};
  answers.forEach((a: Answer) => { if (!byCh[a.q.chapter]) byCh[a.q.chapter] = { total: 0, correct: 0 }; byCh[a.q.chapter].total++; if (a.isCorrect) byCh[a.q.chapter].correct++; });

  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(120% 60% at 50% 0%, ${C.bg2}, ${C.bg})`, color: C.text, paddingBottom: 40 }}>
      <div style={{ padding: "28px 20px 20px", textAlign: "center" }}>
        {imgOk ? (
          <img src={heroImg} onError={() => setImgOk(false)} alt="" style={{ width: 132, height: 132, borderRadius: 24, objectFit: "cover", border: `3px solid ${pass ? C.correct : C.accent}`, boxShadow: `0 8px 30px ${pass ? "rgba(52,211,153,0.4)" : "rgba(168,85,247,0.4)"}` }} />
        ) : (
          <div style={{ fontSize: 54 }}>{pass ? "🐶🎉" : "🛬"}</div>
        )}
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
function Review({ answers, filter, setFilter, bm, toggleBm, back }: any) {
  const letters = "ABCDEF";
  const list = answers.filter((a: Answer) => filter === "all" ? true : filter === "correct" ? a.isCorrect : !a.isCorrect);
  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(120% 50% at 50% 0%, ${C.bg2}, ${C.bg})`, color: C.text, paddingBottom: 40 }}>
      <div style={{ background: C.card, padding: "12px 16px", borderBottom: `1px solid ${C.cardBorder}`, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={back} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 26, cursor: "pointer" }}>‹</button>
        <span style={{ fontSize: 16, fontWeight: 800 }}>Debrief</span>
      </div>
      <div style={{ display: "flex", gap: 6, padding: "12px 16px 8px" }}>
        {(["all", "correct", "wrong"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{ flex: 1, padding: "8px 0", borderRadius: 9, border: `1px solid ${filter === f ? C.accent : C.cardBorder}`, background: filter === f ? "rgba(168,85,247,0.16)" : "transparent", color: filter === f ? C.accentLight : C.textMuted, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>{f[0].toUpperCase() + f.slice(1)}</button>
        ))}
      </div>
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {list.map((a: Answer, i: number) => (
          <div key={i} style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.cardBorder}`, overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.cardBorder}`, display: "flex", gap: 10, justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, color: C.accentLight, marginBottom: 4 }}>{a.q.chapter}</div>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{a.q.question}</p>
              </div>
              <button onClick={() => toggleBm(a.q.id)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: bm.includes(a.q.id) ? C.gold : C.neutral, flexShrink: 0 }}>{bm.includes(a.q.id) ? "★" : "☆"}</button>
            </div>
            <div style={{ padding: "10px 14px" }}>
              {a.q.options.map((opt: string, oi: number) => {
                const isCorr = a.q.correct === oi, isCh = a.chosen === oi;
                let bg = "transparent", bd = "transparent", col = C.textMuted;
                if (isCorr) { bg = C.correctBg; bd = C.correct; col = "#a7f3d0"; }
                else if (isCh) { bg = C.wrongBg; bd = C.wrong; col = "#fecdd3"; }
                return (
                  <div key={oi} style={{ padding: "7px 10px", borderRadius: 8, marginBottom: oi < a.q.options.length - 1 ? 6 : 0, background: bg, border: `1px solid ${bd}`, fontSize: 13, color: col, display: "flex", gap: 8 }}>
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
