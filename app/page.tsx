"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import questionsRaw from "../data/questions.json";

type Question = {
  id: number;
  chapter: string;
  question: string;
  options: string[];
  correct: number | null;
};

const ALL_QUESTIONS: Question[] = questionsRaw as Question[];
const ALL_CHAPTERS = Array.from(new Set(ALL_QUESTIONS.map((q) => q.chapter))).sort();

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const C = {
  bg: "#0f1c2e", card: "#162435", cardBorder: "#1e3a5f",
  accent: "#2e80f0", accentLight: "#4a9eff",
  correct: "#22c55e", correctBg: "rgba(34,197,94,0.15)",
  wrong: "#ef4444", wrongBg: "rgba(239,68,68,0.15)",
  neutral: "#64748b", text: "#e2e8f0", textMuted: "#94a3b8",
  optionBg: "#1a2d42", optionBorder: "#2a3f58", gold: "#f5b100",
};

const LS = {
  getBookmarks(): number[] {
    try { return JSON.parse(localStorage.getItem("a320_bookmarks") || "[]"); } catch { return []; }
  },
  setBookmarks(ids: number[]) {
    try { localStorage.setItem("a320_bookmarks", JSON.stringify(ids)); } catch {}
  },
};

type Screen = "home" | "quiz" | "results" | "review" | "bookmarks";
type Mode = "practice" | "exam" | "bookmarks";

type Answer = {
  q: Question;
  chosen: number | null;
  isCorrect: boolean;
};

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>("practice");
  const [examSize, setExamSize] = useState(20);
  const [quiz, setQuiz] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [reviewFilter, setReviewFilter] = useState<"all" | "wrong" | "correct">("all");

  useEffect(() => { setBookmarks(LS.getBookmarks()); }, []);

  const toggleBookmark = useCallback((id: number) => {
    setBookmarks((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      LS.setBookmarks(next);
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    if (selectedChapters.size === 0) return ALL_QUESTIONS;
    return ALL_QUESTIONS.filter((q) => selectedChapters.has(q.chapter));
  }, [selectedChapters]);

  const chapterCounts = useMemo(() => {
    const m: Record<string, number> = {};
    ALL_QUESTIONS.forEach((q) => { m[q.chapter] = (m[q.chapter] || 0) + 1; });
    return m;
  }, []);

  const startQuiz = useCallback((m: Mode) => {
    let pool: Question[];
    if (m === "bookmarks") {
      const bm = LS.getBookmarks();
      pool = shuffle(ALL_QUESTIONS.filter((q) => bm.includes(q.id)));
    } else {
      pool = shuffle(filtered);
      if (m === "exam") pool = pool.slice(0, Math.min(examSize, pool.length));
    }
    if (pool.length === 0) return;
    setMode(m);
    setQuiz(pool);
    setIdx(0);
    setChosen(null);
    setRevealed(false);
    setAnswers([]);
    setScreen("quiz");
  }, [filtered, examSize]);

  const currentQ = quiz[idx];

  const recordAndNext = useCallback(() => {
    if (!currentQ) return;
    const isCorrect = chosen !== null && chosen === currentQ.correct;
    const ans: Answer = { q: currentQ, chosen, isCorrect };
    const nextAnswers = [...answers, ans];
    setAnswers(nextAnswers);
    if (idx + 1 < quiz.length) {
      setIdx(idx + 1);
      setChosen(null);
      setRevealed(false);
    } else {
      setScreen("results");
    }
  }, [currentQ, chosen, answers, idx, quiz.length]);

  const onChoose = useCallback((i: number) => {
    if (mode === "practice" || mode === "bookmarks") {
      if (!revealed) { setChosen(i); setRevealed(true); }
    } else {
      setChosen(i); // exam: can change until Next
    }
  }, [mode, revealed]);

  if (screen === "home") return (
    <Home
      selectedChapters={selectedChapters} setSelectedChapters={setSelectedChapters}
      examSize={examSize} setExamSize={setExamSize}
      chapterCounts={chapterCounts} filteredCount={filtered.length}
      bookmarkCount={bookmarks.length}
      onStart={startQuiz}
    />
  );

  if (screen === "quiz" && currentQ) return (
    <Quiz
      q={currentQ} idx={idx} total={quiz.length} chosen={chosen} revealed={revealed}
      mode={mode} bookmarked={bookmarks.includes(currentQ.id)}
      onChoose={onChoose} onNext={recordAndNext} onHome={() => setScreen("home")}
      onToggleBookmark={() => toggleBookmark(currentQ.id)}
    />
  );

  if (screen === "results") return (
    <Results
      answers={answers} mode={mode}
      onReview={() => { setReviewFilter("all"); setScreen("review"); }}
      onHome={() => setScreen("home")}
      onRetry={() => startQuiz(mode)}
    />
  );

  if (screen === "review") return (
    <Review
      answers={answers} filter={reviewFilter} setFilter={setReviewFilter}
      bookmarks={bookmarks} onToggleBookmark={toggleBookmark}
      onBack={() => setScreen("results")}
    />
  );

  return null;
}

// ─────────────────────────── HOME ───────────────────────────
function Home({ selectedChapters, setSelectedChapters, examSize, setExamSize,
  chapterCounts, filteredCount, bookmarkCount, onStart }: {
  selectedChapters: Set<string>; setSelectedChapters: (s: Set<string>) => void;
  examSize: number; setExamSize: (n: number) => void;
  chapterCounts: Record<string, number>; filteredCount: number; bookmarkCount: number;
  onStart: (m: Mode) => void;
}) {
  const [tab, setTab] = useState<"practice" | "exam">("practice");
  const toggle = (ch: string) => {
    const n = new Set(selectedChapters);
    n.has(ch) ? n.delete(ch) : n.add(ch);
    setSelectedChapters(n);
  };
  const allSel = selectedChapters.size === 0;
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, paddingBottom: 40 }}>
      <div style={{ background: "linear-gradient(135deg,#1e3a5f,#0f2744)", padding: "26px 20px 20px", textAlign: "center", borderBottom: `1px solid ${C.cardBorder}` }}>
        <div style={{ fontSize: 38 }}>✈️</div>
        <h1 style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>A320 MCQ Trainer</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: C.textMuted }}>Technical Systems · {ALL_QUESTIONS.length} questions</p>
      </div>

      <div style={{ padding: "16px 16px 0" }}>
        <div style={{ background: C.card, borderRadius: 12, padding: 4, display: "flex", marginBottom: 14, border: `1px solid ${C.cardBorder}` }}>
          {(["practice", "exam"] as const).map((m) => (
            <button key={m} onClick={() => setTab(m)} style={{
              flex: 1, padding: "10px 0", border: "none", borderRadius: 10, cursor: "pointer",
              fontSize: 14, fontWeight: 700,
              background: tab === m ? C.accent : "transparent",
              color: tab === m ? "#fff" : C.textMuted,
            }}>{m === "practice" ? "📖 Practice" : "📝 Exam"}</button>
          ))}
        </div>

        <p style={{ fontSize: 12, color: C.textMuted, margin: "0 4px 14px", lineHeight: 1.5 }}>
          {tab === "practice"
            ? "Instant feedback — see the correct answer after each question."
            : "Answer a set number of questions, then get your score at the end."}
        </p>

        {tab === "exam" && (
          <div style={{ background: C.card, borderRadius: 12, padding: "12px 14px", marginBottom: 14, border: `1px solid ${C.cardBorder}` }}>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 8 }}>Questions per session</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[10, 20, 30, 50].map((n) => (
                <button key={n} onClick={() => setExamSize(n)} style={{
                  flex: 1, padding: "8px 0", borderRadius: 8,
                  border: `1px solid ${examSize === n ? C.accent : C.cardBorder}`,
                  background: examSize === n ? C.accent : "transparent",
                  color: examSize === n ? "#fff" : C.textMuted, fontSize: 14, fontWeight: 700, cursor: "pointer",
                }}>{n}</button>
              ))}
            </div>
          </div>
        )}

        <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.cardBorder}`, overflow: "hidden", marginBottom: 14 }}>
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.cardBorder}`, display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Chapters</span>
            <button onClick={() => setSelectedChapters(new Set())} style={{ fontSize: 12, color: allSel ? C.accent : C.textMuted, background: "none", border: "none", cursor: "pointer" }}>
              {allSel ? "✓ All selected" : "Select all"}
            </button>
          </div>
          {ALL_CHAPTERS.map((ch, i) => {
            const active = selectedChapters.has(ch);
            return (
              <div key={ch} onClick={() => toggle(ch)} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "11px 14px", cursor: "pointer",
                borderBottom: i < ALL_CHAPTERS.length - 1 ? `1px solid ${C.cardBorder}` : "none",
                background: active ? "rgba(46,128,240,0.08)" : "transparent",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 6,
                    border: `2px solid ${active ? C.accent : C.neutral}`,
                    background: active ? C.accent : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>{active && <span style={{ color: "#fff", fontSize: 12 }}>✓</span>}</div>
                  <span style={{ fontSize: 14 }}>{ch}</span>
                </div>
                <span style={{ fontSize: 12, color: C.textMuted, background: C.optionBg, padding: "2px 7px", borderRadius: 10 }}>{chapterCounts[ch] || 0}</span>
              </div>
            );
          })}
        </div>

        <button onClick={() => onStart(tab)} style={{
          width: "100%", padding: "16px 0", borderRadius: 14, border: "none",
          background: `linear-gradient(135deg,${C.accent},#1a65d0)`, color: "#fff",
          fontSize: 17, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 20px rgba(46,128,240,0.4)",
        }}>Start — {filteredCount} questions</button>

        <button onClick={() => onStart("bookmarks")} disabled={bookmarkCount === 0} style={{
          width: "100%", padding: "13px 0", borderRadius: 12, marginTop: 10,
          border: `1px solid ${bookmarkCount ? C.gold : C.cardBorder}`, background: "transparent",
          color: bookmarkCount ? C.gold : C.neutral, fontSize: 14, fontWeight: 700,
          cursor: bookmarkCount ? "pointer" : "default",
        }}>★ Bookmarked ({bookmarkCount})</button>
      </div>
    </div>
  );
}

// ─────────────────────────── QUIZ ───────────────────────────
function Quiz({ q, idx, total, chosen, revealed, mode, bookmarked, onChoose, onNext, onHome, onToggleBookmark }: {
  q: Question; idx: number; total: number; chosen: number | null; revealed: boolean;
  mode: Mode; bookmarked: boolean;
  onChoose: (i: number) => void; onNext: () => void; onHome: () => void; onToggleBookmark: () => void;
}) {
  const isLast = idx === total - 1;
  const isPractice = mode === "practice" || mode === "bookmarks";
  const canAdvance = isPractice ? revealed : chosen !== null;
  const letters = "ABCDEF";

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "12px 16px 10px", background: C.card, borderBottom: `1px solid ${C.cardBorder}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <button onClick={onHome} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 26, cursor: "pointer", lineHeight: 1 }}>‹</button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textMuted }}>{q.chapter}</div>
            <div style={{ fontSize: 12, color: C.neutral }}>{idx + 1} / {total}</div>
          </div>
          <button onClick={onToggleBookmark} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: bookmarked ? C.gold : C.neutral, lineHeight: 1 }}>
            {bookmarked ? "★" : "☆"}
          </button>
        </div>
        <div style={{ height: 3, background: C.cardBorder, borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(idx / total) * 100}%`, background: C.accent, transition: "width 0.3s" }} />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>
        <div style={{ background: C.card, borderRadius: 14, padding: 16, marginBottom: 14, border: `1px solid ${C.cardBorder}` }}>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, fontWeight: 500 }}>{q.question}</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {q.options.map((opt, i) => {
            let bg = C.optionBg, border = C.optionBorder, tc = C.text, badge = C.cardBorder, badgeTc = C.textMuted;
            const showResult = isPractice && revealed;
            const isCorrectOpt = q.correct === i;
            const isChosen = chosen === i;

            if (showResult) {
              if (isCorrectOpt) { bg = C.correctBg; border = C.correct; tc = "#86efac"; badge = C.correct; badgeTc = "#fff"; }
              else if (isChosen) { bg = C.wrongBg; border = C.wrong; tc = "#fca5a5"; badge = C.wrong; badgeTc = "#fff"; }
            } else if (mode === "exam" && isChosen) {
              bg = "rgba(46,128,240,0.15)"; border = C.accent; tc = C.accentLight; badge = C.accent; badgeTc = "#fff";
            }

            return (
              <button key={i} onClick={() => onChoose(i)} disabled={showResult} style={{
                display: "flex", alignItems: "flex-start", gap: 12, background: bg,
                border: `1.5px solid ${border}`, borderRadius: 12, padding: "13px 14px",
                cursor: showResult ? "default" : "pointer", textAlign: "left", color: tc, transition: "all 0.15s",
              }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, background: badge, color: badgeTc, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
                  {showResult && isCorrectOpt ? "✓" : showResult && isChosen ? "✕" : letters[i]}
                </span>
                <span style={{ fontSize: 14, lineHeight: 1.5, paddingTop: 3 }}>{opt.replace(/^[A-F][.)]\s*/, "")}</span>
              </button>
            );
          })}
        </div>

        {isPractice && revealed && q.correct === null && (
          <div style={{ marginTop: 12, padding: "10px 14px", background: C.card, borderRadius: 10, fontSize: 13, color: C.textMuted, border: `1px solid ${C.cardBorder}` }}>
            No marked answer for this question in the source.
          </div>
        )}
      </div>

      <div style={{ padding: "12px 16px 28px", background: C.card, borderTop: `1px solid ${C.cardBorder}` }}>
        {isPractice && !revealed && <div style={{ textAlign: "center", fontSize: 13, color: C.textMuted, marginBottom: 8 }}>Tap an option to answer</div>}
        {canAdvance && (
          <button onClick={onNext} style={{
            width: "100%", padding: "15px 0", borderRadius: 13, border: "none",
            background: `linear-gradient(135deg,${C.accent},#1a65d0)`, color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer",
          }}>{isLast ? "Finish" : "Next →"}</button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────── RESULTS ───────────────────────────
function Results({ answers, mode, onReview, onHome, onRetry }: {
  answers: Answer[]; mode: Mode; onReview: () => void; onHome: () => void; onRetry: () => void;
}) {
  const answered = answers.filter((a) => a.chosen !== null);
  const correct = answers.filter((a) => a.isCorrect).length;
  const pct = answered.length ? Math.round((correct / answered.length) * 100) : 0;
  const pass = pct >= 75;

  const byCh: Record<string, { total: number; correct: number }> = {};
  answers.forEach((a) => {
    if (!byCh[a.q.chapter]) byCh[a.q.chapter] = { total: 0, correct: 0 };
    byCh[a.q.chapter].total++;
    if (a.isCorrect) byCh[a.q.chapter].correct++;
  });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, paddingBottom: 40 }}>
      <div style={{ background: `linear-gradient(135deg,${pass ? "#14532d" : "#1e3a5f"},#0f2744)`, padding: "30px 20px 26px", textAlign: "center" }}>
        <div style={{ fontSize: 46 }}>{pass ? "🎉" : "🏁"}</div>
        <div style={{ fontSize: 52, fontWeight: 800, color: pass ? C.correct : "#fff", lineHeight: 1.1 }}>{pct}%</div>
        <p style={{ margin: "4px 0 0", fontSize: 15, color: C.textMuted }}>{correct} / {answered.length} correct{pass ? " · Pass" : ""}</p>
      </div>

      <div style={{ padding: "16px 16px 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
          <Stat label="Correct" value={correct} color={C.correct} />
          <Stat label="Wrong" value={answered.length - correct} color={C.wrong} />
          <Stat label="Skipped" value={answers.length - answered.length} color={C.neutral} />
        </div>

        <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.cardBorder}`, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.cardBorder}`, fontSize: 14, fontWeight: 700 }}>By Chapter</div>
          {Object.entries(byCh).map(([ch, s], i, arr) => {
            const p = Math.round((s.correct / s.total) * 100);
            return (
              <div key={ch} style={{ padding: "10px 14px", borderBottom: i < arr.length - 1 ? `1px solid ${C.cardBorder}` : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 13 }}>{ch}</span>
                  <span style={{ fontSize: 13, color: p >= 75 ? C.correct : p >= 50 ? C.gold : C.wrong, fontWeight: 700 }}>{s.correct}/{s.total}</span>
                </div>
                <div style={{ height: 4, background: C.cardBorder, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${p}%`, background: p >= 75 ? C.correct : p >= 50 ? C.gold : C.wrong }} />
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={onReview} style={{ padding: "14px 0", borderRadius: 12, border: `1px solid ${C.accent}`, background: "transparent", color: C.accentLight, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Review Answers</button>
          <button onClick={onRetry} style={{ padding: "14px 0", borderRadius: 12, border: "none", background: C.accent, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>New Session</button>
          <button onClick={onHome} style={{ padding: "14px 0", borderRadius: 12, border: `1px solid ${C.cardBorder}`, background: "transparent", color: C.textMuted, fontSize: 15, cursor: "pointer" }}>Home</button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: C.card, borderRadius: 12, padding: "16px 8px", textAlign: "center", border: `1px solid ${C.cardBorder}` }}>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ─────────────────────────── REVIEW ───────────────────────────
function Review({ answers, filter, setFilter, bookmarks, onToggleBookmark, onBack }: {
  answers: Answer[]; filter: "all" | "wrong" | "correct"; setFilter: (f: "all" | "wrong" | "correct") => void;
  bookmarks: number[]; onToggleBookmark: (id: number) => void; onBack: () => void;
}) {
  const letters = "ABCDEF";
  const list = answers.filter((a) => filter === "all" ? true : filter === "correct" ? a.isCorrect : !a.isCorrect);
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, paddingBottom: 40 }}>
      <div style={{ background: C.card, padding: "12px 16px", borderBottom: `1px solid ${C.cardBorder}`, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 26, cursor: "pointer" }}>‹</button>
        <span style={{ fontSize: 16, fontWeight: 700 }}>Review</span>
      </div>
      <div style={{ display: "flex", gap: 6, padding: "12px 16px 8px" }}>
        {(["all", "correct", "wrong"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{
            flex: 1, padding: "8px 0", borderRadius: 8,
            border: `1px solid ${filter === f ? C.accent : C.cardBorder}`,
            background: filter === f ? "rgba(46,128,240,0.15)" : "transparent",
            color: filter === f ? C.accentLight : C.textMuted, fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>{f[0].toUpperCase() + f.slice(1)}</button>
        ))}
      </div>
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {list.map((a, i) => (
          <div key={i} style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.cardBorder}`, overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.cardBorder}`, display: "flex", gap: 10, justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>{a.q.chapter}</div>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{a.q.question}</p>
              </div>
              <button onClick={() => onToggleBookmark(a.q.id)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: bookmarks.includes(a.q.id) ? C.gold : C.neutral, flexShrink: 0 }}>
                {bookmarks.includes(a.q.id) ? "★" : "☆"}
              </button>
            </div>
            <div style={{ padding: "10px 14px" }}>
              {a.q.options.map((opt, oi) => {
                const isCorrect = a.q.correct === oi;
                const isChosen = a.chosen === oi;
                let bg = "transparent", bd = "transparent", col = C.textMuted;
                if (isCorrect) { bg = C.correctBg; bd = C.correct; col = "#86efac"; }
                else if (isChosen) { bg = C.wrongBg; bd = C.wrong; col = "#fca5a5"; }
                return (
                  <div key={oi} style={{ padding: "7px 10px", borderRadius: 8, marginBottom: oi < a.q.options.length - 1 ? 6 : 0, background: bg, border: `1px solid ${bd}`, fontSize: 13, color: col, display: "flex", gap: 8 }}>
                    <span style={{ fontWeight: 800, flexShrink: 0 }}>{isCorrect ? "✓" : isChosen ? "✕" : letters[oi]}</span>
                    {opt.replace(/^[A-F][.)]\s*/, "")}
                  </div>
                );
              })}
              {a.chosen === null && <div style={{ fontSize: 12, color: C.neutral, fontStyle: "italic", marginTop: 4 }}>Skipped</div>}
            </div>
          </div>
        ))}
        {list.length === 0 && <div style={{ textAlign: "center", color: C.textMuted, padding: 40, fontSize: 14 }}>Nothing here.</div>}
      </div>
    </div>
  );
}
