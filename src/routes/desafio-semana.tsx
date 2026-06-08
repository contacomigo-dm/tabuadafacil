import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  WEEKLY_DIV_TOTAL,
  WEEKLY_MULT_TIMER,
  WEEKLY_MULT_TOTAL,
  WEEKLY_TOTAL,
  computeStreak,
  generateWeeklyDivProblems,
  generateWeeklyProblems,
  getISOWeek,
  getWeeklyRecord,
  listWeeklyRecords,
  saveWeeklyRecord,
  type WeeklyRecord,
} from "@/lib/weekly";
import { logAttempt } from "@/lib/api";

export const Route = createFileRoute("/desafio-semana")({
  head: () => ({
    meta: [{ title: "Desafio da Semana — Tabuada Amazônica" }],
  }),
  component: DesafioSemana,
});

type Phase = "intro" | "mult" | "div" | "done";

function DesafioSemana() {
  const navigate = useNavigate();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("");
  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [feedback, setFeedback] = useState<null | { ok: boolean; ans: number }>(null);
  const [locked, setLocked] = useState(false);
  const [existingRecord, setExistingRecord] = useState<WeeklyRecord | null>(null);
  const [streak, setStreak] = useState(0);
  const [history, setHistory] = useState<WeeklyRecord[]>([]);
  const [timeLeft, setTimeLeft] = useState(WEEKLY_MULT_TIMER);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { year, week } = useMemo(() => getISOWeek(), []);
  const multProblems = useMemo(() => generateWeeklyProblems(year, week), [year, week]);
  const divProblems = useMemo(() => generateWeeklyDivProblems(year, week), [year, week]);

  useEffect(() => {
    const id = sessionStorage.getItem("studentId");
    const name = sessionStorage.getItem("studentName");
    if (!id) {
      navigate({ to: "/aluno" });
      return;
    }
    setStudentId(id);
    setStudentName(name ?? "");
    (async () => {
      const rec = await getWeeklyRecord(id, year, week);
      setExistingRecord(rec);
      const all = await listWeeklyRecords(id);
      setHistory(all);
      setStreak(computeStreak(all));
    })().catch(() => {});
  }, [navigate, year, week]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const finishChallenge = useCallback(
    async (finalCorrect: number, finalWrong: number) => {
      if (!studentId) return;
      try {
        await saveWeeklyRecord(studentId, year, week, finalCorrect, finalWrong);
        const all = await listWeeklyRecords(studentId);
        setHistory(all);
        setStreak(computeStreak(all));
        setExistingRecord(all.find((r) => r.year === year && r.week === week) ?? null);
      } catch (e) {
        console.error(e);
        toast.error("Erro ao salvar o desafio");
      }
      setPhase("done");
    },
    [studentId, year, week],
  );

  const handleMultAnswer = useCallback(
    (opt: number | null) => {
      if (locked || !studentId) return;
      clearTimer();
      setLocked(true);
      const p = multProblems[index];
      const ok = opt === p.answer;
      setFeedback({ ok, ans: p.answer });
      if (ok) setCorrect((c) => c + 1);
      else setWrong((w) => w + 1);

      logAttempt({
        studentId,
        tableNum: p.a,
        multiplier: p.b,
        correct: ok,
        questionType: "weekly_challenge",
      }).catch(() => {});

      setTimeout(() => {
        const next = index + 1;
        if (next >= multProblems.length) {
          // mudar para divisão
          setIndex(0);
          setFeedback(null);
          setLocked(false);
          setPhase("div");
        } else {
          setIndex(next);
          setFeedback(null);
          setLocked(false);
          setTimeLeft(WEEKLY_MULT_TIMER);
        }
      }, 1100);
    },
    [locked, studentId, multProblems, index, clearTimer],
  );

  // Timer da multiplicação
  useEffect(() => {
    if (phase !== "mult" || locked) return;
    setTimeLeft(WEEKLY_MULT_TIMER);
    clearTimer();
    const started = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - started) / 1000;
      const left = Math.max(0, WEEKLY_MULT_TIMER - elapsed);
      setTimeLeft(left);
      if (left <= 0) {
        clearTimer();
        handleMultAnswer(null);
      }
    }, 100);
    return () => clearTimer();
  }, [phase, index, locked, clearTimer, handleMultAnswer]);

  const handleDivAnswer = (opt: number) => {
    if (locked || !studentId) return;
    setLocked(true);
    const p = divProblems[index];
    const ok = opt === p.quotient;
    setFeedback({ ok, ans: p.quotient });
    const newCorrect = correct + (ok ? 1 : 0);
    const newWrong = wrong + (ok ? 0 : 1);
    if (ok) setCorrect(newCorrect);
    else setWrong(newWrong);

    logAttempt({
      studentId,
      tableNum: p.divisor,
      multiplier: p.quotient,
      correct: ok,
      questionType: "weekly_division",
    }).catch(() => {});

    setTimeout(() => {
      const next = index + 1;
      if (next >= divProblems.length) {
        void finishChallenge(newCorrect, newWrong);
      } else {
        setIndex(next);
        setFeedback(null);
        setLocked(false);
      }
    }, 1400);
  };

  const start = () => {
    setIndex(0);
    setCorrect(0);
    setWrong(0);
    setFeedback(null);
    setLocked(false);
    setPhase("mult");
  };

  if (!studentId) {
    return (
      <main className="min-h-screen flex items-center justify-center leaf-bg">
        <div className="text-muted-foreground">Carregando…</div>
      </main>
    );
  }

  const totalDone =
    phase === "mult" ? index : phase === "div" ? WEEKLY_MULT_TOTAL + index : 0;

  return (
    <main className="min-h-screen leaf-bg px-4 py-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate({ to: "/escolher-atividade" })}
            className="text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            ← Voltar
          </button>
          <div className="text-sm font-semibold text-muted-foreground">
            Olá, <span className="text-foreground">{studentName}</span>
          </div>
        </div>

        <header className="bg-card rounded-3xl p-6 border border-border shadow-[var(--shadow-soft)] mb-4 text-center">
          <div className="text-4xl mb-2">🏆</div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
            Desafio da Semana
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Semana {week} de {year} · {WEEKLY_MULT_TOTAL} multiplicações + {WEEKLY_DIV_TOTAL} divisões
          </p>
          <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/30 px-3 py-1 text-sm font-bold text-primary">
              🔥 Streak: {streak} {streak === 1 ? "semana" : "semanas"}
            </span>
            {existingRecord && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 border border-success/30 px-3 py-1 text-sm font-bold text-success">
                ⭐ Selo Semana {week}/{year}
              </span>
            )}
          </div>
        </header>

        {phase === "intro" && (
          <div className="bg-card rounded-3xl p-6 border border-border text-center">
            {existingRecord ? (
              <>
                <p className="text-foreground font-bold text-lg mb-1">
                  Você já fez o desafio desta semana! 🎉
                </p>
                <p className="text-muted-foreground mb-4">
                  Acertos: <span className="text-success font-bold">{existingRecord.correct_count}</span>{" "}
                  · Erros: <span className="text-warning font-bold">{existingRecord.wrong_count}</span>
                </p>
              </>
            ) : (
              <div className="text-muted-foreground mb-4 space-y-2 text-left sm:text-center">
                <p>
                  <b>Parte 1 — Multiplicação:</b> {WEEKLY_MULT_TOTAL} contas com {WEEKLY_MULT_TIMER}s
                  para responder, 3 opções.
                </p>
                <p>
                  <b>Parte 2 — Divisão:</b> {WEEKLY_DIV_TOTAL} contas (3 fáceis com 3 algarismos, 3
                  médias com 4 algarismos e 3 difíceis com 0 no quociente). Sem temporizador.
                </p>
              </div>
            )}
            <Button
              onClick={start}
              className="btn-pop h-14 w-full text-lg font-bold rounded-2xl bg-primary hover:bg-primary/90"
            >
              {existingRecord ? "Refazer o desafio" : "▶ Começar agora"}
            </Button>

            {history.length > 0 && (
              <div className="mt-6 text-left">
                <h2 className="font-bold text-foreground mb-2">Seus selos</h2>
                <div className="flex flex-wrap gap-2">
                  {history.slice(0, 12).map((r) => (
                    <span
                      key={r.id}
                      className="inline-flex items-center gap-1 rounded-full bg-accent/20 border border-accent/40 px-3 py-1 text-xs font-bold text-foreground"
                    >
                      ⭐ S{r.week}/{r.year} · {r.correct_count}/{r.total_questions}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {phase === "mult" && (
          <div className="bg-card rounded-3xl p-6 border border-border shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-muted-foreground">
                ✖ Multiplicação {index + 1}/{WEEKLY_MULT_TOTAL} · Geral {totalDone + 1}/{WEEKLY_TOTAL}
              </span>
              <span className="text-sm font-semibold">
                <span className="text-success">{correct} ✓</span>{" "}
                <span className="text-warning">{wrong} ✗</span>
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(totalDone / WEEKLY_TOTAL) * 100}%` }}
              />
            </div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Tempo
              </span>
              <span
                className={cn(
                  "text-sm font-bold",
                  timeLeft < 2 ? "text-destructive" : "text-foreground",
                )}
              >
                {timeLeft.toFixed(1)}s
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-6">
              <div
                className={cn(
                  "h-full transition-all",
                  timeLeft < 2 ? "bg-destructive" : "bg-accent",
                )}
                style={{ width: `${(timeLeft / WEEKLY_MULT_TIMER) * 100}%` }}
              />
            </div>
            <p className="text-center text-sm text-muted-foreground font-semibold uppercase tracking-wider mb-2">
              Quanto é?
            </p>
            <div className="text-center text-6xl font-extrabold text-foreground mb-8">
              {multProblems[index].a} × {multProblems[index].b}
            </div>
            <div className="grid gap-3">
              {multProblems[index].options.map((opt) => (
                <Button
                  key={opt}
                  onClick={() => handleMultAnswer(opt)}
                  disabled={locked}
                  className={cn(
                    "btn-pop h-16 text-2xl font-bold rounded-2xl",
                    locked && opt === multProblems[index].answer && "bg-success hover:bg-success",
                    locked &&
                      feedback &&
                      !feedback.ok &&
                      opt !== multProblems[index].answer &&
                      "bg-muted text-muted-foreground hover:bg-muted",
                  )}
                >
                  {opt}
                </Button>
              ))}
            </div>
            {feedback && (
              <div
                className={cn(
                  "mt-4 rounded-2xl p-3 text-center font-bold",
                  feedback.ok
                    ? "bg-success/15 text-success"
                    : "bg-destructive/15 text-destructive",
                )}
              >
                {feedback.ok ? "✅ Acertou!" : `❌ Resposta certa: ${feedback.ans}`}
              </div>
            )}
          </div>
        )}

        {phase === "div" && divProblems[index] && (
          <div className="bg-card rounded-3xl p-6 border border-border shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-muted-foreground">
                ➗ Divisão {index + 1}/{WEEKLY_DIV_TOTAL} · Geral {totalDone + 1}/{WEEKLY_TOTAL}
              </span>
              <span className="text-sm font-semibold">
                <span className="text-success">{correct} ✓</span>{" "}
                <span className="text-warning">{wrong} ✗</span>
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(totalDone / WEEKLY_TOTAL) * 100}%` }}
              />
            </div>
            <div className="text-center mb-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/20 border border-accent/40 px-3 py-1 text-xs font-bold text-foreground">
                Nível {divProblems[index].level} · {divProblems[index].levelLabel}
              </span>
            </div>
            <p className="text-center text-sm text-muted-foreground font-semibold uppercase tracking-wider mb-2">
              Qual o quociente?
            </p>
            <div className="text-center text-5xl sm:text-6xl font-extrabold text-foreground mb-2">
              {divProblems[index].dividend} ÷ {divProblems[index].divisor}
            </div>
            <p className="text-center text-xs text-muted-foreground mb-6">
              (sem pressa — pode rabiscar no caderno!)
            </p>
            <div className="grid gap-3">
              {divProblems[index].options.map((opt) => (
                <Button
                  key={opt}
                  onClick={() => handleDivAnswer(opt)}
                  disabled={locked}
                  className={cn(
                    "btn-pop h-16 text-2xl font-bold rounded-2xl",
                    locked && opt === divProblems[index].quotient && "bg-success hover:bg-success",
                    locked &&
                      feedback &&
                      !feedback.ok &&
                      opt !== divProblems[index].quotient &&
                      "bg-muted text-muted-foreground hover:bg-muted",
                  )}
                >
                  {opt}
                </Button>
              ))}
            </div>
            {feedback && (
              <div
                className={cn(
                  "mt-4 rounded-2xl p-3 text-center font-bold",
                  feedback.ok
                    ? "bg-success/15 text-success"
                    : "bg-destructive/15 text-destructive",
                )}
              >
                {feedback.ok
                  ? `✅ Acertou! ${divProblems[index].dividend} ÷ ${divProblems[index].divisor} = ${divProblems[index].quotient}${divProblems[index].remainder ? ` resto ${divProblems[index].remainder}` : ""}`
                  : `❌ Resposta certa: ${feedback.ans}${divProblems[index].remainder ? ` (resto ${divProblems[index].remainder})` : ""}`}
              </div>
            )}
          </div>
        )}

        {phase === "done" && (
          <div className="bg-card rounded-3xl p-8 border border-border text-center">
            <div className="text-6xl mb-3">⭐</div>
            <h2 className="text-2xl font-extrabold text-foreground mb-2">
              Desafio concluído!
            </h2>
            <p className="text-muted-foreground mb-4">
              Você acertou <span className="text-success font-bold">{correct}</span> de{" "}
              {WEEKLY_TOTAL}.
            </p>
            <div className="inline-flex items-center gap-2 rounded-full bg-accent/20 border border-accent/40 px-4 py-2 text-sm font-bold text-foreground mb-2">
              ⭐ Selo Semana {week}/{year} desbloqueado
            </div>
            <div className="mt-2 mb-6">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/30 px-3 py-1 text-sm font-bold text-primary">
                🔥 Sequência: {streak} {streak === 1 ? "semana" : "semanas"}
              </span>
            </div>
            <div className="grid gap-3">
              <Button
                onClick={start}
                variant="outline"
                className="h-12 text-base font-bold rounded-2xl"
              >
                🔁 Tentar de novo
              </Button>
              <Button
                onClick={() => navigate({ to: "/escolher-atividade" })}
                className="btn-pop h-12 text-base font-bold rounded-2xl bg-primary hover:bg-primary/90"
              >
                Voltar ao menu
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
