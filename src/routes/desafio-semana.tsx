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
  generateWeeklyProblems,
  getISOWeek,
  getWeeklyRecord,
  listWeeklyRecords,
  type WeeklyRecord,
} from "@/lib/weekly";
import { getStudentById, listSuspendedTurmas, logAttempt, turmaKeyFor } from "@/lib/api";

export const Route = createFileRoute("/desafio-semana")({
  head: () => ({
    meta: [{ title: "Desafio da Semana — Tabuada Amazônica" }],
  }),
  component: DesafioSemana,
});

type Phase = "intro" | "mult" | "done";

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
  const [suspended, setSuspended] = useState(false);
  const [turmaLabel, setTurmaLabel] = useState<string>("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const current = useMemo(() => getISOWeek(), []);
  const [year, setYear] = useState<number>(current.year);
  const [week, setWeek] = useState<number>(current.week);
  const isPast = year !== current.year || week !== current.week;
  const multProblems = useMemo(() => generateWeeklyProblems(year, week), [year, week]);

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
      const [all, student, suspendedList] = await Promise.all([
        listWeeklyRecords(id),
        getStudentById(id),
        listSuspendedTurmas(),
      ]);
      setHistory(all);
      setStreak(computeStreak(all));
      if (student) {
        const key = turmaKeyFor(student.grade, student.class_name);
        setTurmaLabel(key);
        setSuspended(suspendedList.includes(key));
      }
      if (sessionStorage.getItem("weeklyJustFinished") === "1") {
        const fy = Number(sessionStorage.getItem("weeklyYear") || current.year);
        const fw = Number(sessionStorage.getItem("weeklyWeek") || current.week);
        sessionStorage.removeItem("weeklyJustFinished");
        setYear(fy);
        setWeek(fw);
        const rec = await getWeeklyRecord(id, fy, fw);
        setExistingRecord(rec);
        if (rec) {
          setCorrect(rec.correct_count);
          setWrong(rec.wrong_count);
          setPhase("done");
        }
      } else {
        const rec = await getWeeklyRecord(id, year, week);
        setExistingRecord(rec);
      }
    })().catch(() => {});
  }, [navigate, year, week, current.year, current.week]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const goToWeeklyDivision = useCallback(
    (multCorrect: number, multWrong: number) => {
      sessionStorage.setItem("divWeeklyMode", "1");
      sessionStorage.setItem("weeklyYear", String(year));
      sessionStorage.setItem("weeklyWeek", String(week));
      sessionStorage.setItem("weeklyMultCorrect", String(multCorrect));
      sessionStorage.setItem("weeklyMultWrong", String(multWrong));
      sessionStorage.removeItem("divFreeMode");
      navigate({ to: "/divisao-jogar" });
    },
    [navigate, year, week],
  );

  const handleMultAnswer = useCallback(
    (opt: number | null) => {
      if (locked || !studentId) return;
      clearTimer();
      setLocked(true);
      const p = multProblems[index];
      const ok = opt === p.answer;
      setFeedback({ ok, ans: p.answer });
      const newCorrect = correct + (ok ? 1 : 0);
      const newWrong = wrong + (ok ? 0 : 1);
      if (ok) setCorrect(newCorrect);
      else setWrong(newWrong);

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
          // mult terminou → vai para divisão longa
          toast.success("Multiplicação concluída! Agora a divisão longa.");
          goToWeeklyDivision(newCorrect, newWrong);
        } else {
          setIndex(next);
          setFeedback(null);
          setLocked(false);
          setTimeLeft(WEEKLY_MULT_TIMER);
        }
      }, 1100);
    },
    [locked, studentId, multProblems, index, correct, wrong, clearTimer, goToWeeklyDivision],
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

  const start = () => {
    if (suspended) {
      toast.error("O desafio está suspenso para a sua turma. Fale com o professor.");
      return;
    }
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

  const totalDone = phase === "mult" ? index : 0;

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
            Semana {week} de {year} · {WEEKLY_MULT_TOTAL} multiplicações + {WEEKLY_DIV_TOTAL} divisões longas
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
            {suspended && (
              <div className="mb-4 rounded-2xl bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm font-bold text-destructive">
                🚫 O desafio semanal está <u>suspenso</u> para a turma {turmaLabel || "—"}.
                <div className="font-normal text-xs mt-1 text-destructive/80">
                  Aguarde o professor liberar para você poder participar.
                </div>
              </div>
            )}
            {isPast && (
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent/20 border border-accent/40 px-3 py-1 text-xs font-bold text-foreground">
                🗓️ Treinando semana {week}/{year} (semana anterior)
              </div>
            )}
            {existingRecord ? (
              <>
                <p className="text-foreground font-bold text-lg mb-1">
                  {isPast
                    ? `Você já fez o desafio da semana ${week}! 🎉`
                    : "Você já fez o desafio desta semana! 🎉"}
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
                  <b>Parte 2 — Divisão longa:</b> {WEEKLY_DIV_TOTAL} contas armadas passo a passo
                  (dificuldade crescente: 3, 3, 4, 4 e 5 algarismos). Sem temporizador.
                </p>
              </div>
            )}
            <Button
              onClick={start}
              className="btn-pop h-14 w-full text-lg font-bold rounded-2xl bg-primary hover:bg-primary/90"
            >
              {existingRecord ? "Refazer o desafio" : "▶ Começar agora"}
            </Button>

            {/* Semanas anteriores para treinar / recuperar */}
            {current.week > 1 && (
              <div className="mt-6 text-left">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-bold text-foreground">
                    📚 Semanas anteriores ({current.year})
                  </h2>
                  {isPast && (
                    <button
                      type="button"
                      onClick={() => {
                        setYear(current.year);
                        setWeek(current.week);
                      }}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Voltar à semana atual
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Toque em uma semana para treiná-la. As contas são as mesmas que toda a turma fez
                  naquela semana. Semanas com ⭐ você já completou.
                </p>
                <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
                  {Array.from({ length: current.week - 1 }, (_, i) => i + 1).map((w) => {
                    const done = history.some((r) => r.year === current.year && r.week === w);
                    const active = year === current.year && week === w;
                    return (
                      <button
                        key={w}
                        type="button"
                        onClick={() => {
                          setYear(current.year);
                          setWeek(w);
                        }}
                        className={cn(
                          "rounded-xl border px-2 py-2 text-sm font-bold text-center transition",
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : done
                              ? "bg-success/15 border-success/30 text-success hover:bg-success/25"
                              : "bg-secondary/60 border-border hover:border-primary",
                        )}
                        title={done ? `Semana ${w} concluída` : `Semana ${w}`}
                      >
                        {done && "⭐ "}S{w}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setYear(current.year);
                      setWeek(current.week);
                    }}
                    className={cn(
                      "rounded-xl border px-2 py-2 text-sm font-bold text-center transition",
                      !isPast
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-accent/20 border-accent/40 text-foreground hover:border-accent",
                    )}
                    title="Semana atual"
                  >
                    Atual
                  </button>
                </div>
              </div>
            )}

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
              {multProblems[index].options.map((opt: number) => (
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
