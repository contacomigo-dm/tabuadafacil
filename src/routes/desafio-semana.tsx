import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  WEEKLY_TOTAL,
  computeStreak,
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

type Phase = "intro" | "playing" | "done";

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

  const { year, week } = useMemo(() => getISOWeek(), []);
  const problems = useMemo(() => generateWeeklyProblems(year, week), [year, week]);

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

  const start = () => {
    setPhase("playing");
    setIndex(0);
    setCorrect(0);
    setWrong(0);
    setFeedback(null);
    setLocked(false);
  };

  const handleAnswer = async (opt: number) => {
    if (locked || !studentId) return;
    setLocked(true);
    const p = problems[index];
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

    setTimeout(async () => {
      const next = index + 1;
      if (next >= problems.length) {
        const finalCorrect = correct + (ok ? 1 : 0);
        const finalWrong = wrong + (ok ? 0 : 1);
        try {
          await saveWeeklyRecord(studentId, year, week, finalCorrect, finalWrong);
          const all = await listWeeklyRecords(studentId);
          setHistory(all);
          setStreak(computeStreak(all));
          setExistingRecord(
            all.find((r) => r.year === year && r.week === week) ?? null,
          );
        } catch (e) {
          console.error(e);
          toast.error("Erro ao salvar o desafio");
        }
        setPhase("done");
      } else {
        setIndex(next);
        setFeedback(null);
        setLocked(false);
      }
    }, 1200);
  };

  if (!studentId) {
    return (
      <main className="min-h-screen flex items-center justify-center leaf-bg">
        <div className="text-muted-foreground">Carregando…</div>
      </main>
    );
  }

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
            Semana {week} de {year} · {WEEKLY_TOTAL} contas iguais para toda a turma
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
                <p className="text-sm text-muted-foreground mb-4">
                  Você pode refazer para tentar melhorar — só o melhor resultado fica salvo.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground mb-4">
                São 10 contas. Você ganha o <b>selo da semana</b> ao terminar e mantém sua{" "}
                <b>sequência semanal</b> se voltar toda semana!
              </p>
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

        {phase === "playing" && (
          <div className="bg-card rounded-3xl p-6 border border-border shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-muted-foreground">
                Pergunta {index + 1} de {problems.length}
              </span>
              <span className="text-sm font-semibold">
                <span className="text-success">{correct} ✓</span>{" "}
                <span className="text-warning">{wrong} ✗</span>
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden mb-6">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(index / problems.length) * 100}%` }}
              />
            </div>
            <p className="text-center text-sm text-muted-foreground font-semibold uppercase tracking-wider mb-2">
              Quanto é?
            </p>
            <div className="text-center text-6xl font-extrabold text-foreground mb-8">
              {problems[index].a} × {problems[index].b}
            </div>
            <div className="grid gap-3">
              {problems[index].options.map((opt) => (
                <Button
                  key={opt}
                  onClick={() => handleAnswer(opt)}
                  disabled={locked}
                  className={cn(
                    "btn-pop h-16 text-2xl font-bold rounded-2xl",
                    locked && opt === problems[index].answer && "bg-success hover:bg-success",
                    locked &&
                      feedback &&
                      !feedback.ok &&
                      opt !== problems[index].answer &&
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
              {problems.length}.
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
