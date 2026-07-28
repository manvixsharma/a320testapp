"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import questionsRaw from "../data/questions.json";

type Question = {
  id: number;
  chapter: string;
  question: string;
  options: string[];
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

// ─── Color palette ─────────────────────────────────────────────────────────
const C = {
  bg: "#0f1c2e",
  card: "#162435",
  cardBorder: "#1e3a5f",
  accent: "#2e80f0",
  accentLight: "#4a9eff",
  correct: "#22c55e",
  wrong: "#ef4444",
  neutral: "#64748b",
  text: "#e2e8f0",
  textMuted: "#94a3b8",
  optionBg: "#1a2d42",
  optionBorder: "#2a3f58",
};

// ─── Screens ────────────────────────────────────────────────────────────────
type Screen = "home" | "quiz" | "review" | "results";

type SessionResult = {
  questionId: number;
  chapter: string;
  question: string;
  options: string[];
  chosen: number | null;
  correct: number | null; // null = open question
};

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set());
  const [quizMode, setQuizMode] = useState<"practice" | "exam">("practice");
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [reviewFilter, setReviewFilter] = useState<"all" | "wrong" | "correct">("all");
  const [examSize, setExamSize] = useState(20);

  const filteredQuestions = useMemo(() => {
    if (selectedChapters.size === 0) return ALL_QUESTIONS;
    return ALL_QUESTIONS.filter((q) => selectedChapters.has(q.chapter));
  }, [selectedChapters]);

  const startQuiz = useCallback(() => {
    const pool = shuffle(filteredQuestions);
    const qs = quizMode === "exam" ? pool.slice(0, Math.min(examSize, pool.length)) : pool;
    setQuizQuestions(qs);
    setCurrentIdx(0);
    setChosen(null);
    setRevealed(false);
    setResults([]);
    setScreen("quiz");
  }, [filteredQuestions, quizMode, examSize]);

  const currentQ = quizQuestions[currentIdx];

  const chapterCounts = useMemo(() => {
    const map: Record<string, number> = {};
    ALL_QUESTIONS.forEach((q) => { map[q.chapter] = (map[q.chapter] || 0) + 1; });
    return map;
  }, []);

  if (screen === "home") return <HomeScreen
    selectedChapters={selectedChapters}
    setSelectedChapters={setSelectedChapters}
    quizMode={quizMode}
    setQuizMode={setQuizMode}
    examSize={examSize}
    setExamSize={setExamSize}
    onStart={startQuiz}
    chapterCounts={chapterCounts}
    filteredCount={filteredQuestions.length}
  />;

  if (screen === "quiz" && currentQ) return <QuizScreen
    question={currentQ}
    idx={currentIdx}
    total={quizQuestions.length}
    chosen={chosen}
    revealed={revealed}
    mode={quizMode}
    onChoose={(i) => { if (!revealed && quizMode === "practice") { setChosen(i); setRevealed(true); } else if (quizMode === "exam") { setChosen(i); } }}
    onNext={() => {
      setResults((r) => [...r, {
        questionId: currentQ.id,
        chapter: currentQ.chapter,
        question: currentQ.question,
        options: currentQ.options,
        chosen,
        correct: null,
      }]);
      if (currentIdx + 1 < quizQuestions.length) {
        setCurrentIdx((i) => i + 1);
        setChosen(null);
        setRevealed(false);
      } else {
        setResults((r) => {
          const final = [...r, {
            questionId: currentQ.id,
            chapter: currentQ.chapter,
            question: currentQ.question,
            options: currentQ.options,
            chosen,
            correct: null,
          }];
          setTimeout(() => { setResults(final); setScreen("results"); }, 0);
          return final;
        });
      }
    }}
    onHome={() => setScreen("home")}
  />;

  if (screen === "results") return <ResultsScreen
    results={results}
    onReview={() => { setReviewFilter("all"); setScreen("review"); }}
    onHome={() => setScreen("home")}
    onRetry={() => { startQuiz(); }}
  />;

  if (screen === "review") return <ReviewScreen
    results={results}
    filter={reviewFilter}
    setFilter={setReviewFilter}
    onBack={() => setScreen("results")}
  />;

  return null;
}

// ─── HOME SCREEN ─────────────────────────────────────────────────────────────
function HomeScreen({ selectedChapters, setSelectedChapters, quizMode, setQuizMode,
  examSize, setExamSize, onStart, chapterCounts, filteredCount }: {
  selectedChapters: Set<string>;
  setSelectedChapters: (s: Set<string>) => void;
  quizMode: "practice" | "exam";
  setQuizMode: (m: "practice" | "exam") => void;
  examSize: number;
  setExamSize: (n: number) => void;
  onStart: () => void;
  chapterCounts: Record<string, number>;
  filteredCount: number;
}) {
  const toggle = (ch: string) => {
    const next = new Set(selectedChapters);
    if (next.has(ch)) next.delete(ch); else next.add(ch);
    setSelectedChapters(next);
  };
  const allSelected = selectedChapters.size === 0;
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%)", padding: "24px 20px 20px", textAlign: "center", borderBottom: `1px solid ${C.cardBorder}` }}>
        <div style={{ fontSize: 36, marginBottom: 4 }}>✈️</div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: "-0.5px" }}>A320 MCQ Trainer</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: C.textMuted }}>Technical Systems — {ALL_QUESTIONS.length} questions</p>
      </div>

      <div style={{ padding: "16px 16px 0" }}>
        {/* Mode Toggle */}
        <div style={{ background: C.card, borderRadius: 12, padding: 4, display: "flex", marginBottom: 16, border: `1px solid ${C.cardBorder}` }}>
          {(["practice", "exam"] as const).map((m) => (
            <button key={m} onClick={() => setQuizMode(m)} style={{
              flex: 1, padding: "10px 0", border: "none", borderRadius: 10, cursor: "pointer",
              fontSize: 14, fontWeight: 600,
              background: quizMode === m ? C.accent : "transparent",
              color: quizMode === m ? "#fff" : C.textMuted,
              transition: "all 0.2s",
            }}>
              {m === "practice" ? "📖 Practice" : "📝 Exam"}
            </button>
          ))}
        </div>

        {quizMode === "exam" && (
          <div style={{ background: C.card, borderRadius: 12, padding: "12px 14px", marginBottom: 16, border: `1px solid ${C.cardBorder}` }}>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 8 }}>Questions per session</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[10, 20, 30, 40].map((n) => (
                <button key={n} onClick={() => setExamSize(n)} style={{
                  flex: 1, padding: "8px 0", borderRadius: 8, border: `1px solid ${examSize === n ? C.accent : C.cardBorder}`,
                  background: examSize === n ? C.accent : "transparent", color: examSize === n ? "#fff" : C.textMuted,
                  fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chapter selector */}
        <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.cardBorder}`, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.cardBorder}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Chapters</span>
            <button onClick={() => setSelectedChapters(new Set())} style={{
              fontSize: 12, color: allSelected ? C.accent : C.textMuted, background: "none", border: "none", cursor: "pointer", padding: 0,
            }}>
              {allSelected ? "✓ All" : "All"}
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
                    width: 20, height: 20, borderRadius: 6, border: `2px solid ${active ? C.accent : C.neutral}`,
                    background: active ? C.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    {active && <span style={{ color: "#fff", fontSize: 13, lineHeight: 1 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 14 }}>{ch}</span>
                </div>
                <span style={{ fontSize: 12, color: C.textMuted, background: C.optionBg, padding: "2px 7px", borderRadius: 10 }}>
                  {chapterCounts[ch] || 0}
                </span>
              </div>
            );
          })}
        </div>

        {/* Start button */}
        <button onClick={onStart} style={{
          width: "100%", padding: "16px 0", borderRadius: 14, border: "none",
          background: `linear-gradient(135deg, ${C.accent} 0%, #1a65d0 100%)`,
          color: "#fff", fontSize: 17, fontWeight: 700, cursor: "pointer",
          boxShadow: "0 4px 20px rgba(46,128,240,0.4)",
        }}>
          Start — {filteredCount} questions
        </button>
      </div>
    </div>
  );
}

// ─── QUIZ SCREEN ─────────────────────────────────────────────────────────────
function QuizScreen({ question, idx, total, chosen, revealed, mode, onChoose, onNext, onHome }: {
  question: Question;
  idx: number;
  total: number;
  chosen: number | null;
  revealed: boolean;
  mode: "practice" | "exam";
  onChoose: (i: number) => void;
  onNext: () => void;
  onHome: () => void;
}) {
  const progress = (idx / total) * 100;
  const isLast = idx === total - 1;
  const canAdvance = mode === "exam" ? chosen !== null : revealed;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div style={{ padding: "12px 16px 10px", background: C.card, borderBottom: `1px solid ${C.cardBorder}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <button onClick={onHome} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 24, cursor: "pointer", padding: 0, lineHeight: 1 }}>‹</button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textMuted }}>{question.chapter}</div>
            <div style={{ fontSize: 12, color: C.neutral }}>{idx + 1} / {total}</div>
          </div>
          <div style={{ width: 24 }} />
        </div>
        {/* Progress bar */}
        <div style={{ height: 3, background: C.cardBorder, borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: C.accent, borderRadius: 2, transition: "width 0.3s" }} />
        </div>
      </div>

      {/* Question */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>
        <div style={{ background: C.card, borderRadius: 14, padding: "16px", marginBottom: 14, border: `1px solid ${C.cardBorder}` }}>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, fontWeight: 500 }}>{question.question}</p>
        </div>

        {/* Options */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {question.options.map((opt, i) => {
            // Determine background/border for this option
            let bg = C.optionBg;
            let border = C.optionBorder;
            let textColor = C.text;

            if (mode === "practice" && revealed) {
              // In practice mode, highlight chosen (we don't know correct answer)
              if (i === chosen) {
                bg = "rgba(46,128,240,0.15)";
                border = C.accent;
                textColor = C.accentLight;
              }
            } else if (mode === "exam" && i === chosen) {
              bg = "rgba(46,128,240,0.15)";
              border = C.accent;
              textColor = C.accentLight;
            }

            const letter = ["A", "B", "C", "D", "E", "F"][i];

            return (
              <button key={i} onClick={() => onChoose(i)} style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                background: bg, border: `1.5px solid ${border}`,
                borderRadius: 12, padding: "13px 14px", cursor: "pointer",
                textAlign: "left", color: textColor, transition: "all 0.15s",
              }}>
                <span style={{
                  width: 26, height: 26, borderRadius: 8, background: border === C.optionBorder ? C.cardBorder : border,
                  color: border === C.optionBorder ? C.textMuted : "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, flexShrink: 0,
                }}>
                  {letter}
                </span>
                <span style={{ fontSize: 14, lineHeight: 1.5, paddingTop: 3 }}>
                  {opt.replace(/^[A-D][.)]\s*/, "")}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom */}
      <div style={{ padding: "12px 16px 28px", background: C.card, borderTop: `1px solid ${C.cardBorder}` }}>
        {mode === "practice" && !revealed && (
          <div style={{ textAlign: "center", fontSize: 13, color: C.textMuted, marginBottom: 8 }}>Tap an option to continue</div>
        )}
        {canAdvance && (
          <button onClick={onNext} style={{
            width: "100%", padding: "15px 0", borderRadius: 13, border: "none",
            background: `linear-gradient(135deg, ${C.accent} 0%, #1a65d0 100%)`,
            color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer",
          }}>
            {isLast ? "Finish" : "Next →"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── RESULTS SCREEN ───────────────────────────────────────────────────────────
function ResultsScreen({ results, onReview, onHome, onRetry }: {
  results: SessionResult[];
  onReview: () => void;
  onHome: () => void;
  onRetry: () => void;
}) {
  const answered = results.filter((r) => r.chosen !== null).length;
  const skipped  = results.length - answered;

  // Group by chapter
  const byChapter: Record<string, { total: number; answered: number }> = {};
  results.forEach((r) => {
    if (!byChapter[r.chapter]) byChapter[r.chapter] = { total: 0, answered: 0 };
    byChapter[r.chapter].total++;
    if (r.chosen !== null) byChapter[r.chapter].answered++;
  });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, paddingBottom: 40 }}>
      <div style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%)", padding: "32px 20px 28px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🏁</div>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Session Complete</h2>
        <p style={{ margin: "8px 0 0", color: C.textMuted, fontSize: 14 }}>{results.length} questions attempted</p>
      </div>

      <div style={{ padding: "16px 16px 0" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          <StatCard label="Answered" value={answered} color={C.correct} />
          <StatCard label="Skipped" value={skipped} color={C.neutral} />
        </div>

        {/* By chapter */}
        <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.cardBorder}`, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.cardBorder}`, fontSize: 14, fontWeight: 600 }}>By Chapter</div>
          {Object.entries(byChapter).map(([ch, { total, answered }], i, arr) => (
            <div key={ch} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: i < arr.length - 1 ? `1px solid ${C.cardBorder}` : "none" }}>
              <span style={{ fontSize: 13 }}>{ch}</span>
              <span style={{ fontSize: 13, color: C.textMuted }}>{answered}/{total}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={onReview} style={{ padding: "14px 0", borderRadius: 12, border: `1px solid ${C.accent}`, background: "transparent", color: C.accentLight, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
            Review Answers
          </button>
          <button onClick={onRetry} style={{ padding: "14px 0", borderRadius: 12, border: "none", background: C.accent, color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
            New Session
          </button>
          <button onClick={onHome} style={{ padding: "14px 0", borderRadius: 12, border: `1px solid ${C.cardBorder}`, background: "transparent", color: C.textMuted, fontSize: 15, cursor: "pointer" }}>
            Home
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: C.card, borderRadius: 12, padding: "16px 14px", textAlign: "center", border: `1px solid ${C.cardBorder}` }}>
      <div style={{ fontSize: 32, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ─── REVIEW SCREEN ────────────────────────────────────────────────────────────
function ReviewScreen({ results, filter, setFilter, onBack }: {
  results: SessionResult[];
  filter: "all" | "wrong" | "correct";
  setFilter: (f: "all" | "wrong" | "correct") => void;
  onBack: () => void;
}) {
  const filtered = results.filter((r) => {
    if (filter === "all") return true;
    if (filter === "correct") return r.chosen !== null;
    return r.chosen === null;
  });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, paddingBottom: 40 }}>
      <div style={{ background: C.card, padding: "12px 16px", borderBottom: `1px solid ${C.cardBorder}`, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 24, cursor: "pointer", padding: 0 }}>‹</button>
        <span style={{ fontSize: 16, fontWeight: 600 }}>Review</span>
      </div>

      <div style={{ display: "flex", gap: 6, padding: "12px 16px 8px" }}>
        {(["all", "correct", "wrong"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{
            flex: 1, padding: "8px 0", borderRadius: 8, border: `1px solid ${filter === f ? C.accent : C.cardBorder}`,
            background: filter === f ? "rgba(46,128,240,0.15)" : "transparent",
            color: filter === f ? C.accentLight : C.textMuted, fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.map((r, i) => (
          <div key={i} style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.cardBorder}`, overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.cardBorder}` }}>
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>{r.chapter}</div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{r.question}</p>
            </div>
            <div style={{ padding: "10px 14px" }}>
              {r.options.map((opt, oi) => {
                const isChosen = oi === r.chosen;
                return (
                  <div key={oi} style={{
                    padding: "7px 10px", borderRadius: 8, marginBottom: oi < r.options.length - 1 ? 6 : 0,
                    background: isChosen ? "rgba(46,128,240,0.12)" : "transparent",
                    border: isChosen ? `1px solid ${C.accent}` : "1px solid transparent",
                    fontSize: 13, color: isChosen ? C.accentLight : C.textMuted,
                    display: "flex", gap: 8, alignItems: "flex-start",
                  }}>
                    <span style={{ flexShrink: 0, fontWeight: 700 }}>{isChosen ? "►" : " "}</span>
                    {opt.replace(/^[A-D][.)]\s*/, "")}
                  </div>
                );
              })}
              {r.chosen === null && (
                <div style={{ fontSize: 12, color: C.neutral, fontStyle: "italic" }}>Skipped</div>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", color: C.textMuted, padding: 40, fontSize: 14 }}>No questions in this filter.</div>
        )}
      </div>
    </div>
  );
}
