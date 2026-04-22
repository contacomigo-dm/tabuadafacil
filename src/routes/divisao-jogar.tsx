import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  buildPlan,
  getDivisionLevel,
  quotientHint,
  randomDividend,
  randomDivisor,
  remainderHint,
  type DivisionPlan,
} from "@/lib/divisao";

export const Route = createFileRoute("/divisao-jogar")({
  head: () => ({
    meta: [{ title: "Jogar — Divisão Longa" }],
  }),
  component: PlayDivisao,
});

type Phase = "quotient" | "verifyMul" | "subtract" | "done";

interface StepRecord {
  digitIndex: number; // index in dividendDigits AFTER which the bring-down happens
  quotient: number;
  product: number; // shown under the chunk
  remainder: number;
  chunkBefore: number; // chunk used to compute quotient
  // Visual: column where the product is written (right-aligned to digitIndex)
  productCols: number[]; // digit per column (length = product digits)
}

function PlayDivisao() {
  const navigate = useNavigate();

  // Resolve mode (free vs level) only once
  const setup = useMemo(() => {
    const free = sessionStorage.getItem("divFreeMode") === "1";
    if (free) {
      const d = Number(sessionStorage.getItem("divFreeDividend") ?? "0");
      const s = Number(sessionStorage.getItem("divFreeDivisor") ?? "2");
      return { mode: "free" as const, dividend: d, divisor: s, level: 0 };
    }
    const lvl = Number(sessionStorage.getItem("divLevel") ?? "1");
    const def = getDivisionLevel(lvl);
    return {
      mode: "level" as const,
      level: lvl,
      def,
      dividend: randomDividend(def.digits),
      divisor: randomDivisor(),
    };
  }, []);

  const [plan, setPlan] = useState<DivisionPlan>(() =>
    buildPlan(setup.dividend, setup.divisor),
  );
  const [stepIdx, setStepIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("quotient");
  const [quotientInput, setQuotientInput] = useState("");
  const [remainderInput, setRemainderInput] = useState("");
  const [confirmedQuotient, setConfirmedQuotient] = useState<number | null>(null);
  const [history, setHistory] = useState<StepRecord[]>([]);
  const [quotientAttempts, setQuotientAttempts] = useState(0);
  const [remainderAttempts, setRemainderAttempts] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [problemsDone, setProblemsDone] = useState(0);
  const [showFinish, setShowFinish] = useState(false);

  const currentStep = plan.steps[stepIdx];
  const totalDigits = plan.dividendDigits.length;

  // Determine which digit column is currently "active" (highlighted in dividend row)
  const activeDigitIndex = currentStep ? currentStep.digitIndex : -1;

  // Compute "broughtDown" digits visualization for the current chunk:
  // We build a row that shows, under each dividend column, the bring-down chain.
  // Easier approach: render the dividend line PLUS for each step we render its product
  // and remainder rows directly underneath aligned by digitIndex.

  function newProblem() {
    if (setup.mode === "free") {
      // free mode: just go back to setup screen
      navigate({ to: "/divisao-treino" });
      return;
    }
    const def = (setup as Extract<typeof setup, { mode: "level" }>).def;
    let d: number;
    let s: number;
    let p: DivisionPlan;
    // avoid trivial division (chunk < divisor for everything → all zeros)
    do {
      d = randomDividend(def.digits);
      s = randomDivisor();
      p = buildPlan(d, s);
    } while (p.steps.length < 2);
    setPlan(p);
    setStepIdx(0);
    setPhase("quotient");
    setQuotientInput("");
    setRemainderInput("");
    setConfirmedQuotient(null);
    setHistory([]);
    setQuotientAttempts(0);
    setRemainderAttempts(0);
    setHint(null);
  }

  function checkQuotient() {
    const v = Number(quotientInput);
    if (!Number.isInteger(v) || v < 0 || v > 9) {
      toast.error("Digite 1 algarismo (0 a 9)");
      return;
    }
    setConfirmedQuotient(v);
    setPhase("verifyMul");
  }

  function confirmMul() {
    // Move on to subtraction
    setPhase("subtract");
    setHint(null);
  }

  function changeQuotient() {
    // Student rejected the multiplication, go back and try again
    setConfirmedQuotient(null);
    setQuotientInput("");
    setPhase("quotient");
    // We DO count this as an attempt (they realized it was wrong via multiplication)
    const newAttempts = quotientAttempts + 1;
    setQuotientAttempts(newAttempts);
    setHint(quotientHint(currentStep.chunk, plan.divisor, newAttempts));
  }

  function checkRemainder() {
    const v = Number(remainderInput);
    if (!Number.isInteger(v) || v < 0) {
      toast.error("Digite um número válido");
      return;
    }
    const q = confirmedQuotient!;
    const product = q * plan.divisor;
    const correctRem = currentStep.chunk - product;

    // First: verify that the chosen quotient was actually correct
    if (q !== currentStep.correctQuotient) {
      // The remainder might be valid arithmetic but the quotient was wrong (e.g. too small → remainder > divisor)
      if (correctRem >= plan.divisor) {
        const newAttempts = quotientAttempts + 1;
        setQuotientAttempts(newAttempts);
        toast.error("O resto ficou maior ou igual ao divisor. Volte e escolha um número maior no quociente.");
        setHint(quotientHint(currentStep.chunk, plan.divisor, newAttempts));
        // Reset back to quotient phase
        setConfirmedQuotient(null);
        setQuotientInput("");
        setRemainderInput("");
        setPhase("quotient");
        return;
      }
      if (product > currentStep.chunk) {
        // shouldn't happen — they would have rejected at verifyMul; safety
        const newAttempts = quotientAttempts + 1;
        setQuotientAttempts(newAttempts);
        toast.error("Esse número é grande demais. Tente um menor no quociente.");
        setHint(quotientHint(currentStep.chunk, plan.divisor, newAttempts));
        setConfirmedQuotient(null);
        setQuotientInput("");
        setRemainderInput("");
        setPhase("quotient");
        return;
      }
    }

    if (v !== correctRem) {
      const newAttempts = remainderAttempts + 1;
      setRemainderAttempts(newAttempts);
      setHint(remainderHint(currentStep.chunk, q, plan.divisor, newAttempts));
      toast.error("Verifique a subtração");
      return;
    }

    // Correct! Record this step.
    const productStr = String(product);
    const productCols = productStr.split("").map(Number);
    const rec: StepRecord = {
      digitIndex: currentStep.digitIndex,
      quotient: q,
      product,
      remainder: v,
      chunkBefore: currentStep.chunk,
      productCols,
    };
    setHistory((h) => [...h, rec]);

    // Advance
    const next = stepIdx + 1;
    if (next >= plan.steps.length) {
      // done
      setPhase("done");
      const newDone = problemsDone + 1;
      setProblemsDone(newDone);
      toast.success("🎉 Conta concluída!");
      if (setup.mode === "level") {
        const def = (setup as Extract<typeof setup, { mode: "level" }>).def;
        if (newDone >= def.problemsToAdvance) {
          setShowFinish(true);
        }
      }
    } else {
      setStepIdx(next);
      setPhase("quotient");
      setQuotientInput("");
      setRemainderInput("");
      setConfirmedQuotient(null);
      setQuotientAttempts(0);
      setRemainderAttempts(0);
      setHint(null);
    }
  }

  // Build the visual quotient string so far
  const quotientSoFar = history
    .map((h, i) => {
      // For digits skipped at the start (chunk < divisor), no quotient digit was emitted.
      // history aligns 1:1 with plan.steps from index 0; plan.steps already accounts for skipping.
      return String(h.quotient);
    })
    .join("");

  // Pending quotient digit (currently being chosen) shown as "?"
  const quotientDisplay = phase === "done" ? quotientSoFar : quotientSoFar + "?";

  // Determine what the active chunk visually should look like:
  // It's: previous remainder digits + the dividend digit at digitIndex (if a bring-down)
  // For the FIRST step it's just dividend[0..digitIndex]
  // We show this as the "highlighted" overlay below the dividend.

  return (
    <main className="min-h-screen leaf-bg px-4 py-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate({ to: "/divisao" })}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Sair
          </button>
          <div className="text-sm font-semibold text-muted-foreground">
            {setup.mode === "level" ? (
              <>
                Nível {setup.level} · Conta {problemsDone + (phase === "done" ? 0 : 1)} /{" "}
                {(setup as Extract<typeof setup, { mode: "level" }>).def.problemsToAdvance}
              </>
            ) : (
              <>Treino livre</>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          {/* Conta armada */}
          <div className="bg-card rounded-3xl p-6 sm:p-10 border border-border shadow-[var(--shadow-soft)]">
            <DivisionBoard
              plan={plan}
              history={history}
              activeDigitIndex={activeDigitIndex}
              quotientDisplay={quotientDisplay}
              phase={phase}
              currentChunk={currentStep?.chunk ?? 0}
              currentProduct={
                confirmedQuotient !== null ? confirmedQuotient * plan.divisor : null
              }
              currentDigitIndex={currentStep?.digitIndex ?? -1}
            />
          </div>

          {/* Painel lateral */}
          <aside className="bg-card rounded-3xl p-6 border border-border shadow-[var(--shadow-soft)] flex flex-col">
            {phase === "quotient" && currentStep && (
              <div>
                <div className="text-xs uppercase tracking-wider font-semibold text-river mb-2">
                  Passo: dividir
                </div>
                <h3 className="text-xl font-bold text-foreground">
                  Quantas vezes o <span className="text-river">{plan.divisor}</span> cabe em{" "}
                  <span className="text-accent-foreground bg-accent/40 px-2 rounded">
                    {currentStep.chunk}
                  </span>
                  ?
                </h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Digite 1 algarismo no quociente.
                </p>
                <Input
                  autoFocus
                  inputMode="numeric"
                  value={quotientInput}
                  onChange={(e) =>
                    setQuotientInput(e.target.value.replace(/\D/g, "").slice(0, 1))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && quotientInput) checkQuotient();
                  }}
                  className="h-16 text-3xl text-center font-mono mt-4 rounded-xl"
                  maxLength={1}
                />
                <Button
                  onClick={checkQuotient}
                  disabled={!quotientInput}
                  className="btn-pop mt-3 w-full h-12 text-base font-bold rounded-xl bg-river hover:bg-river/90 text-river-foreground"
                >
                  Conferir
                </Button>
                {hint && (
                  <div className="mt-3 text-sm bg-warning/15 text-warning-foreground rounded-xl p-3 border border-warning/30">
                    💡 {hint}
                  </div>
                )}
              </div>
            )}

            {phase === "verifyMul" && currentStep && confirmedQuotient !== null && (
              <div>
                <div className="text-xs uppercase tracking-wider font-semibold text-accent-foreground mb-2">
                  Verifique a multiplicação
                </div>
                <h3 className="text-xl font-bold text-foreground">
                  Você escolheu <span className="text-river">{confirmedQuotient}</span>.
                </h3>
                <div className="mt-4 bg-accent/20 rounded-xl p-4 text-center">
                  <div className="text-3xl font-mono font-bold text-foreground">
                    {confirmedQuotient} × {plan.divisor} ={" "}
                    <span className="text-river">{confirmedQuotient * plan.divisor}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    Esse valor cabe em {currentStep.chunk}?
                  </div>
                </div>
                <Button
                  onClick={confirmMul}
                  className="btn-pop mt-4 w-full h-12 text-base font-bold rounded-xl bg-primary hover:bg-primary/90"
                >
                  ✓ Sim, é esse número
                </Button>
                <Button
                  onClick={changeQuotient}
                  variant="outline"
                  className="mt-2 w-full h-12 text-base font-bold rounded-xl"
                >
                  ↺ Trocar o número
                </Button>
              </div>
            )}

            {phase === "subtract" && currentStep && confirmedQuotient !== null && (
              <div>
                <div className="text-xs uppercase tracking-wider font-semibold text-river mb-2">
                  Passo: subtrair
                </div>
                <h3 className="text-xl font-bold text-foreground">
                  Faça <span className="text-river">{currentStep.chunk}</span> −{" "}
                  <span className="text-river">{confirmedQuotient * plan.divisor}</span>
                </h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Digite o resto da subtração.
                </p>
                <Input
                  autoFocus
                  inputMode="numeric"
                  value={remainderInput}
                  onChange={(e) =>
                    setRemainderInput(e.target.value.replace(/\D/g, "").slice(0, 2))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && remainderInput) checkRemainder();
                  }}
                  className="h-16 text-3xl text-center font-mono mt-4 rounded-xl"
                  maxLength={2}
                />
                <Button
                  onClick={checkRemainder}
                  disabled={!remainderInput}
                  className="btn-pop mt-3 w-full h-12 text-base font-bold rounded-xl bg-river hover:bg-river/90 text-river-foreground"
                >
                  Conferir
                </Button>
                {hint && (
                  <div className="mt-3 text-sm bg-warning/15 text-warning-foreground rounded-xl p-3 border border-warning/30">
                    💡 {hint}
                  </div>
                )}
              </div>
            )}

            {phase === "done" && (
              <div className="text-center">
                <div className="text-5xl mb-2">🎉</div>
                <h3 className="text-2xl font-extrabold text-primary">Conta pronta!</h3>
                <div className="mt-3 bg-primary/10 rounded-xl p-4 text-left">
                  <div className="font-mono text-lg">
                    {plan.dividend} ÷ {plan.divisor} ={" "}
                    <span className="font-bold text-primary">{plan.finalQuotient}</span>
                  </div>
                  <div className="font-mono text-sm text-muted-foreground">
                    resto {plan.finalRemainder}
                  </div>
                </div>
                <Button
                  onClick={newProblem}
                  className="btn-pop mt-5 w-full h-12 text-base font-bold rounded-xl bg-primary hover:bg-primary/90"
                >
                  ▶ Próxima conta
                </Button>
                <button
                  onClick={() => navigate({ to: "/divisao" })}
                  className="mt-3 w-full text-sm text-muted-foreground hover:text-foreground"
                >
                  ← Voltar ao menu
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>

      {showFinish && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-3xl max-w-md w-full p-8 text-center border border-border shadow-2xl">
            <div className="text-6xl mb-3">🏆</div>
            <h2 className="text-3xl font-extrabold text-primary">Nível concluído!</h2>
            <p className="text-muted-foreground mt-2">
              Parabéns! Você completou {problemsDone} contas do Nível {setup.level}.
            </p>
            <div className="mt-6 grid gap-2">
              <Button
                onClick={() => {
                  setShowFinish(false);
                  setProblemsDone(0);
                  if (setup.mode === "level" && setup.level < 4) {
                    sessionStorage.setItem("divLevel", String(setup.level + 1));
                    navigate({ to: "/divisao-jogar" });
                    // Force a fresh setup by navigating to menu first would be cleaner; reload instead:
                    setTimeout(() => window.location.reload(), 50);
                  } else {
                    navigate({ to: "/divisao" });
                  }
                }}
                className="btn-pop h-12 text-base font-bold rounded-xl bg-primary hover:bg-primary/90"
              >
                {setup.mode === "level" && setup.level < 4
                  ? "▶ Avançar para o próximo nível"
                  : "Voltar ao menu"}
              </Button>
              <Button
                onClick={() => {
                  setShowFinish(false);
                  setProblemsDone(0);
                  newProblem();
                }}
                variant="outline"
                className="h-12 text-base font-bold rounded-xl"
              >
                Continuar treinando este nível
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/** Renders the long-division "house" board with aligned columns. */
function DivisionBoard({
  plan,
  history,
  activeDigitIndex,
  quotientDisplay,
  phase,
  currentChunk,
  currentProduct,
  currentDigitIndex,
}: {
  plan: DivisionPlan;
  history: StepRecord[];
  activeDigitIndex: number;
  quotientDisplay: string;
  phase: Phase;
  currentChunk: number;
  currentProduct: number | null;
  currentDigitIndex: number;
}) {
  const cols = plan.dividendDigits.length;
  const colW = 44; // px per column

  // Build rows of subtraction blocks. Each completed step contributes:
  //   - product row, right-aligned to digitIndex
  //   - remainder row underneath
  // The "current chunk" highlight is rendered as the most recent remainder + bring-down digit.

  // Compute vertical offsets for each step's block.
  // Each step's block sits at row index = stepIndexInHistory * 2 (product, then minus/remainder)
  // We render with simple flex columns.

  // Build a "long visual" representation:
  // Top row: dividend digits (each in a column).
  // For each completed step k:
  //   - render product centered ending at column = step.digitIndex
  //   - render a horizontal line under it from (digitIndex - product.length + 1) to digitIndex
  //   - render the remainder (right-aligned to digitIndex)
  //   - if not last step, the remainder digits + next dividend digit form the new chunk

  // For simplicity, we render per-step rows below the dividend, each row offset to the
  // appropriate digit column.

  return (
    <div className="overflow-x-auto">
      <div className="font-mono inline-block min-w-full">
        {/* Quotient row at top right (above the dividend, separated by horizontal bar on right) */}
        <div className="flex items-end justify-center mb-2">
          <div
            className="grid"
            style={{ gridTemplateColumns: `repeat(${cols}, ${colW}px) auto ${colW * 2}px` }}
          >
            {/* dividend columns spacer (top row empty above dividend) */}
            {plan.dividendDigits.map((_, i) => (
              <div key={`q-spacer-${i}`} />
            ))}
            <div />
            {/* Quotient block (right side, under the divisor, separated by a horizontal line) */}
            <div className="flex flex-col items-center">
              <div className="h-10 flex items-end text-3xl sm:text-4xl font-bold text-river">
                {quotientDisplay || "?"}
              </div>
              <div className="w-full h-0.5 bg-foreground" />
            </div>
          </div>
        </div>

        {/* Dividend row + divisor */}
        <div
          className="grid items-center"
          style={{ gridTemplateColumns: `repeat(${cols}, ${colW}px) auto ${colW * 2}px` }}
        >
          {plan.dividendDigits.map((d, i) => (
            <div
              key={`div-${i}`}
              className={cn(
                "text-3xl sm:text-4xl font-bold text-center transition-colors",
                i === activeDigitIndex && phase !== "done"
                  ? "text-river bg-river/15 rounded-md"
                  : "text-foreground",
              )}
              style={{ width: `${colW}px` }}
            >
              {d}
            </div>
          ))}
          {/* Vertical divider "|" of the casinha */}
          <div className="px-2 text-3xl sm:text-4xl font-bold text-foreground">│</div>
          {/* Divisor */}
          <div className="text-3xl sm:text-4xl font-bold text-center text-foreground">
            {plan.divisor}
          </div>
        </div>

        {/* History rows: each step's product + remainder underneath */}
        {history.map((rec, idx) => (
          <StepRows key={`h-${idx}`} rec={rec} cols={cols} colW={colW} />
        ))}

        {/* Current in-progress product (during verifyMul / subtract) */}
        {phase !== "done" &&
          phase !== "quotient" &&
          currentProduct !== null && (
            <CurrentProductRow
              product={currentProduct}
              digitIndex={currentDigitIndex}
              chunk={currentChunk}
              cols={cols}
              colW={colW}
              showSubtract={phase === "subtract"}
            />
          )}
      </div>
    </div>
  );
}

function StepRows({ rec, cols, colW }: { rec: StepRecord; cols: number; colW: number }) {
  const productStr = String(rec.product).padStart(String(rec.chunkBefore).length, "0");
  const remainderStr = String(rec.remainder);
  // Right-align both to rec.digitIndex
  const endCol = rec.digitIndex; // 0-based
  const productStart = endCol - productStr.length + 1;
  const remStart = endCol - remainderStr.length + 1;

  return (
    <>
      {/* Minus + product */}
      <div
        className="grid items-center"
        style={{ gridTemplateColumns: `repeat(${cols}, ${colW}px) auto ${colW * 2}px` }}
      >
        {Array.from({ length: cols }).map((_, i) => {
          if (i === productStart - 1) {
            return (
              <div
                key={`p-${i}`}
                className="text-2xl sm:text-3xl font-bold text-destructive text-center"
                style={{ width: `${colW}px` }}
              >
                −
              </div>
            );
          }
          if (i >= productStart && i <= endCol) {
            const ch = productStr[i - productStart];
            return (
              <div
                key={`p-${i}`}
                className="text-2xl sm:text-3xl font-bold text-destructive text-center"
                style={{ width: `${colW}px` }}
              >
                {ch}
              </div>
            );
          }
          return <div key={`p-${i}`} />;
        })}
        <div />
        <div />
      </div>

      {/* Horizontal bar under product (spans product cols) */}
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${cols}, ${colW}px) auto ${colW * 2}px` }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <div
            key={`bar-${i}`}
            className={cn("h-0.5", i >= productStart && i <= endCol ? "bg-foreground" : "")}
            style={{ width: `${colW}px` }}
          />
        ))}
        <div />
        <div />
      </div>

      {/* Remainder row */}
      <div
        className="grid items-center"
        style={{ gridTemplateColumns: `repeat(${cols}, ${colW}px) auto ${colW * 2}px` }}
      >
        {Array.from({ length: cols }).map((_, i) => {
          if (i >= remStart && i <= endCol) {
            const ch = remainderStr[i - remStart];
            return (
              <div
                key={`r-${i}`}
                className="text-2xl sm:text-3xl font-bold text-foreground text-center"
                style={{ width: `${colW}px` }}
              >
                {ch}
              </div>
            );
          }
          return <div key={`r-${i}`} />;
        })}
        <div />
        <div />
      </div>
    </>
  );
}

function CurrentProductRow({
  product,
  digitIndex,
  chunk,
  cols,
  colW,
  showSubtract,
}: {
  product: number;
  digitIndex: number;
  chunk: number;
  cols: number;
  colW: number;
  showSubtract: boolean;
}) {
  const productStr = String(product).padStart(String(chunk).length, "0");
  const endCol = digitIndex;
  const productStart = endCol - productStr.length + 1;

  return (
    <>
      <div
        className="grid items-center"
        style={{ gridTemplateColumns: `repeat(${cols}, ${colW}px) auto ${colW * 2}px` }}
      >
        {Array.from({ length: cols }).map((_, i) => {
          if (i === productStart - 1) {
            return (
              <div
                key={`cp-${i}`}
                className="text-2xl sm:text-3xl font-bold text-river text-center"
                style={{ width: `${colW}px` }}
              >
                −
              </div>
            );
          }
          if (i >= productStart && i <= endCol) {
            const ch = productStr[i - productStart];
            return (
              <div
                key={`cp-${i}`}
                className="text-2xl sm:text-3xl font-bold text-river text-center bg-river/10 rounded-md"
                style={{ width: `${colW}px` }}
              >
                {ch}
              </div>
            );
          }
          return <div key={`cp-${i}`} />;
        })}
        <div />
        <div />
      </div>
      {showSubtract && (
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${cols}, ${colW}px) auto ${colW * 2}px` }}
        >
          {Array.from({ length: cols }).map((_, i) => (
            <div
              key={`cbar-${i}`}
              className={cn("h-0.5", i >= productStart && i <= endCol ? "bg-river" : "")}
              style={{ width: `${colW}px` }}
            />
          ))}
          <div />
          <div />
        </div>
      )}
    </>
  );
}
