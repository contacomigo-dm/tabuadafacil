import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DIVISION_LEVELS, getDivisionUnlockedLevel } from "@/lib/divisao";
import { findStudentByName } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/divisao")({
  head: () => ({
    meta: [
      { title: "Divisão Longa — Conta Armada Guiada" },
      {
        name: "description",
        content:
          "Aprenda a fazer a conta armada de divisão por 1 algarismo, passo a passo, com verificação da multiplicação e dicas progressivas.",
      },
      { property: "og:title", content: "Divisão Longa — Conta Armada Guiada" },
      {
        property: "og:description",
        content: "App guiado de divisão longa para EJA: digite o quociente, confirme a multiplicação, subtraia e baixe o próximo algarismo.",
      },
    ],
  }),
  component: DivisaoMenu,
});

function DivisaoMenu() {
  const navigate = useNavigate();
  const [unlocked, setUnlocked] = useState(1);

  useEffect(() => {
    const name = sessionStorage.getItem("studentName");
    if (!name) {
      setUnlocked(1);
      return;
    }
    findStudentByName(name)
      .then((s) => setUnlocked(getDivisionUnlockedLevel(s?.id ?? null)))
      .catch(() => setUnlocked(1));
  }, []);

  const startLevel = (lvl: number) => {
    if (lvl > unlocked) {
      toast.error(`Para liberar o nível ${lvl}, faça 3 contas seguidas sem erro no nível ${lvl - 1}.`);
      return;
    }
    sessionStorage.setItem("divLevel", String(lvl));
    sessionStorage.removeItem("divFreeMode");
    navigate({ to: "/divisao-jogar" });
  };

  return (
    <main className="min-h-screen leaf-bg px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Voltar ao início
        </Link>

        <div className="text-center mt-4 mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-river/30 bg-card/60 backdrop-blur px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-river">
            <span aria-hidden>➗</span> EJA · Conta armada
          </div>
          <h1 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">
            Divisão <span className="text-river">Longa</span>
          </h1>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            Pratique a conta armada (divisão por 1 algarismo) passo a passo. O app destaca
            cada algarismo e te ajuda a verificar a multiplicação antes de seguir.
          </p>
        </div>

        <section className="mb-8">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Escolha um nível
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {DIVISION_LEVELS.map((l) => (
              <button
                key={l.level}
                onClick={() => startLevel(l.level)}
                className="text-left bg-card rounded-2xl p-5 border border-border shadow-[var(--shadow-soft)] hover:border-river transition flex items-center gap-4"
              >
                <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-river text-river-foreground font-bold text-lg">
                  {l.level}
                </span>
                <div>
                  <div className="font-bold text-foreground">{l.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {l.problemsToAdvance} contas para concluir o nível
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Treino livre
          </h2>
          <div className="bg-card rounded-2xl p-5 border border-border shadow-[var(--shadow-soft)]">
            <p className="text-sm text-muted-foreground mb-4">
              Você escolhe o dividendo e o divisor (de 2 a 9) e pratica do seu jeito,
              sem contar para o progresso.
            </p>
            <Button
              onClick={() => navigate({ to: "/divisao-treino" })}
              className="btn-pop-amber w-full h-14 text-lg font-bold rounded-2xl bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              ✏️ Abrir treino livre
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
