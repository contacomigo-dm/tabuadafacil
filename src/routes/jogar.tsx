import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  generateQuestion,
  getLevel,
  LEVELS,
  TIMER_SECONDS,
  type Question,
} from "@/lib/quiz";
import {
  logAttempt,
  startSession,
  updateSession,
  updateStudent,
  findOrCreateStudent,
} from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/jogar")({
  head: () => ({
    meta: [{ title: "Jogar — Tabuada Amazônica" }],
  }),
  component: PlayPage,
});

type Feedback = null | { correct: boolean; correctAnswer: string };

function PlayPage() {
  const navigate = useNavigate();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string>("");
  const [level, setLevel] = useState<number>(1);
  const [streak, setStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0); // session-scoped
  const [wrongCount, setWrongCount] = useState(0); // session-scoped
  const [totalCorrect, setTotalCorrect] = useState(0); // lifetime
  const [totalWrong, setTotalWrong] = useState(0); // lifetime

  const [question, setQuestion] = useState<Question | null>(null);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [locked, setLocked] = useState(false);
  const [levelUpBanner, setLevelUpBanner] = useState<string | null>(null);
  const [levelCompleteChoice, setLevelCompleteChoice] = useState<{ newLevel: number } | null>(null);
  const [maxLevelReached, setMaxLevelReached] = useState(1);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const nextQuestion = useCallback(
    (lvl: number) => {
      const def = getLevel(lvl);
      setQuestion(generateQuestion(def));
      setTimeLeft(TIMER_SECONDS);
      setFeedback(null);
      setLocked(false);
    },
    [],
  );

  useEffect(() => {
    const id = sessionStorage.getItem("studentId");
    const name = sessionStorage.getItem("studentName");
    if (!id || !name) {
      navigate({ to: "/aluno" });
      return;
    }
    setStudentName(name);
    (async () => {
      const student = await findOrCreateStudent(name);
      setStudentId(student.id);
      setMaxLevelReached(student.current_level);
      const chosenRaw = sessionStorage.getItem("chosenLevel");
      const chosen = chosenRaw ? parseInt(chosenRaw, 10) : student.current_level;
      const startLevel = Math.min(
        Math.max(1, isNaN(chosen) ? student.current_level : chosen),
        student.current_level,
      );
      setLevel(startLevel);
      setBestStreak(student.best_streak);
      setStreak(0);
      setTotalCorrect(student.total_correct);
      setTotalWrong(student.total_wrong);
      const session = await startSession(student.id, startLevel);
      setSessionId(session.id as string);
      nextQuestion(startLevel);
    })().catch((e) => {
      console.error(e);
      toast.error("Erro ao iniciar a sessão");
    });
    return () => stopTimer();
  }, [navigate, nextQuestion]);

  useEffect(() => {
    return () => {
      if (sessionId) {
        updateSession(sessionId, {
          correct_count: correctCount,
          wrong_count: wrongCount,
          level_at_end: level,
          ended_at: new Date().toISOString(),
        }).catch(() => {});
      }
    };
  }, [sessionId, correctCount, wrongCount, level]);

  const handleAnswer = useCallback(
    async (isCorrect: boolean) => {
      if (!question || !studentId || locked) return;
      setLocked(true);
      stopTimer();

      const correctLabel =
        question.type === "choose_result"
          ? String(question.answer)
          : `${question.a} × ${question.b}`;
      setFeedback({ correct: isCorrect, correctAnswer: correctLabel });

      logAttempt({
        studentId,
        tableNum: question.tableNum,
        multiplier: question.multiplier,
        correct: isCorrect,
        questionType: question.type,
      }).catch(() => {});

      let newStreak = streak;
      let newLevel = level;
      let newCorrect = correctCount;
      let newWrong = wrongCount;
      let newBest = bestStreak;
      let newTotalCorrect = totalCorrect;
      let newTotalWrong = totalWrong;

      let levelJustCompleted = false;
      if (isCorrect) {
        newStreak = streak + 1;
        newCorrect = correctCount + 1;
        newTotalCorrect = totalCorrect + 1;
        if (newStreak > newBest) newBest = newStreak;
        const def = getLevel(level);
        if (newStreak >= def.streakRequired && level < LEVELS.length) {
          newLevel = level + 1;
          newStreak = 0;
          levelJustCompleted = true;
        }
      } else {
        newStreak = 0;
        newWrong = wrongCount + 1;
        newTotalWrong = totalWrong + 1;
      }

      setStreak(newStreak);
      setCorrectCount(newCorrect);
      setWrongCount(newWrong);
      setBestStreak(newBest);
      setTotalCorrect(newTotalCorrect);
      setTotalWrong(newTotalWrong);

      // current_level salvo = maior nível já alcançado (não regride ao revisar)
      const newMaxLevel = Math.max(maxLevelReached, newLevel);
      if (newMaxLevel > maxLevelReached) setMaxLevelReached(newMaxLevel);

      updateStudent(studentId, {
        current_level: newMaxLevel,
        current_streak: newStreak,
        best_streak: newBest,
        total_correct: newTotalCorrect,
        total_wrong: newTotalWrong,
      }).catch(() => {});

      if (sessionId) {
        updateSession(sessionId, {
          correct_count: newCorrect,
          wrong_count: newWrong,
          level_at_end: newMaxLevel,
        }).catch(() => {});
      }

      if (levelJustCompleted) {
        setLevel(newLevel);
        setLevelCompleteChoice({ newLevel });
        return;
      }

      setTimeout(() => {
        nextQuestion(newLevel);
      }, 1500);
    },
    [question, studentId, locked, streak, level, correctCount, wrongCount, bestStreak, totalCorrect, totalWrong, maxLevelReached, sessionId, nextQuestion],
  );

  useEffect(() => {
    if (!question || locked || levelCompleteChoice) return;
    stopTimer();
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          stopTimer();
          handleAnswer(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => stopTimer();
  }, [question, locked, levelCompleteChoice, handleAnswer]);

  const handleStop = () => {
    stopTimer();
    if (sessionId) {
      updateSession(sessionId, {
        correct_count: correctCount,
        wrong_count: wrongCount,
        level_at_end: maxLevelReached,
        ended_at: new Date().toISOString(),
      }).catch(() => {});
    }
    sessionStorage.removeItem("chosenLevel");
    navigate({ to: "/" });
  };

  const handleContinueAfterLevel = () => {
    if (!levelCompleteChoice) return;
    const lvl = levelCompleteChoice.newLevel;
    setLevelCompleteChoice(null);
    setLocked(false);
    nextQuestion(lvl);
  };

  if (!question || !studentId) {
    return (
      <main className="min-h-screen flex items-center justify-center leaf-bg">
        <div className="text-muted-foreground">Carregando...</div>
      </main>
    );
  }

  const def = getLevel(level);
  const progressPct = Math.min(100, Math.round((streak / def.streakRequired) * 100));

  return (
    <main className="min-h-screen leaf-bg px-4 py-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-4">
          <button
            onClick={handleStop}
            className="text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            ⏸ Parar e salvar
          </button>
          <div className="text-sm font-semibold text-muted-foreground">
            Olá, <span className="text-foreground">{studentName}</span>
          </div>
        </div>

        <div className="bg-card rounded-2xl p-4 border border-border shadow-[var(--shadow-soft)] mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-primary text-primary-foreground font-bold">
                {level}
              </span>
              <div>
                <div className="text-sm font-bold text-foreground">Nível {level}</div>
                <div className="text-xs text-muted-foreground">
                  Tabuadas: {def.tables.join(", ")}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Sequência</div>
              <div className="text-lg font-extrabold text-primary">
                {streak}
                <span className="text-muted-foreground text-sm font-medium">
                  /{def.streakRequired}
                </span>
              </div>
            </div>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-center mb-6">
          <div
            className={cn(
              "w-20 h-20 rounded-full border-4 flex items-center justify-center text-3xl font-extrabold transition-colors",
              timeLeft <= 2
                ? "border-destructive text-destructive animate-pulse"
                : "border-river text-river",
            )}
          >
            {timeLeft}
          </div>
        </div>

        <div className="bg-card rounded-3xl p-8 border border-border shadow-[var(--shadow-soft)]">
          {question.type === "choose_result" ? (
            <>
              <p className="text-center text-sm text-muted-foreground font-semibold uppercase tracking-wider mb-3">
                Quanto é?
              </p>
              <div className="text-center text-6xl font-extrabold text-foreground mb-8">
                {question.a} × {question.b}
              </div>
              <div className="grid gap-3">
                {question.options.map((opt) => (
                  <Button
                    key={opt}
                    onClick={() => handleAnswer(opt === question.answer)}
                    disabled={locked}
                    className={cn(
                      "btn-pop h-16 text-2xl font-bold rounded-2xl",
                      locked && opt === question.answer && "bg-success hover:bg-success",
                      locked &&
                        feedback &&
                        !feedback.correct &&
                        opt !== question.answer &&
                        "bg-muted text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {opt}
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="text-center text-sm text-muted-foreground font-semibold uppercase tracking-wider mb-3">
                Qual conta dá esse resultado?
              </p>
              <div className="text-center text-6xl font-extrabold text-foreground mb-8">
                {question.answer}
              </div>
              <div className="grid gap-3">
                {question.options.map((opt, i) => (
                  <Button
                    key={i}
                    onClick={() => handleAnswer(i === question.correctIndex)}
                    disabled={locked}
                    className={cn(
                      "btn-pop h-16 text-2xl font-bold rounded-2xl",
                      locked && i === question.correctIndex && "bg-success hover:bg-success",
                      locked &&
                        feedback &&
                        !feedback.correct &&
                        i !== question.correctIndex &&
                        "bg-muted text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </>
          )}
        </div>

        {feedback && (
          <div
            className={cn(
              "mt-4 rounded-2xl p-4 text-center font-bold text-lg",
              feedback.correct
                ? "bg-success/15 text-success"
                : "bg-destructive/15 text-destructive",
            )}
          >
            {feedback.correct
              ? "✅ Acertou!"
              : `❌ Resposta certa: ${feedback.correctAnswer}`}
          </div>
        )}

        {levelUpBanner && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground rounded-2xl px-6 py-3 font-bold shadow-[var(--shadow-pop-amber)] z-50">
            {levelUpBanner}
          </div>
        )}

        {levelCompleteChoice && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-card rounded-3xl p-8 max-w-md w-full border border-border shadow-[var(--shadow-soft)] text-center">
              <div className="text-5xl mb-3">🎉</div>
              <h2 className="text-2xl font-extrabold text-foreground mb-2">
                Parabéns! Você passou de nível!
              </h2>
              <p className="text-muted-foreground mb-6">
                Agora você está no <span className="font-bold text-primary">Nível {levelCompleteChoice.newLevel}</span>
                {getLevel(levelCompleteChoice.newLevel).newTable
                  ? `. Vai entrar a tabuada do ${getLevel(levelCompleteChoice.newLevel).newTable}.`
                  : "."}
                <br />
                Seu progresso já está salvo. Quer continuar ou parar por aqui?
              </p>
              <div className="grid gap-3">
                <Button
                  onClick={handleContinueAfterLevel}
                  className="btn-pop h-14 text-lg font-bold rounded-2xl bg-primary hover:bg-primary/90"
                >
                  ▶ Continuar jogando
                </Button>
                <Button
                  onClick={handleStop}
                  variant="outline"
                  className="h-14 text-lg font-bold rounded-2xl"
                >
                  ⏸ Parar e sair
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <Stat label="Acertos" value={correctCount} color="text-success" />
          <Stat label="Erros" value={wrongCount} color="text-destructive" />
          <Stat label="Melhor" value={bestStreak} color="text-accent-foreground" />
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-card rounded-xl p-3 border border-border">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("text-xl font-extrabold", color)}>{value}</div>
    </div>
  );
}
