import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { findOrCreateStudent } from "@/lib/api";
import { LEVELS, getLevel } from "@/lib/quiz";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/escolher-nivel")({
  head: () => ({
    meta: [{ title: "Escolher nível — Tabuada Amazônica" }],
  }),
  component: ChooseLevelPage,
});

function ChooseLevelPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [currentLevel, setCurrentLevel] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedName = sessionStorage.getItem("studentName");
    if (!storedName) {
      navigate({ to: "/aluno" });
      return;
    }
    setName(storedName);
    findOrCreateStudent(storedName)
      .then((s) => {
        setCurrentLevel(s.current_level);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Erro ao carregar progresso");
        setLoading(false);
      });
  }, [navigate]);

  const start = (lvl: number) => {
    sessionStorage.setItem("chosenLevel", String(lvl));
    navigate({ to: "/jogar" });
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center leaf-bg">
        <div className="text-muted-foreground">Carregando...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen leaf-bg px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-extrabold text-foreground">
            Olá de novo, {name}! 🌿
          </h1>
          <p className="text-muted-foreground mt-2">
            Você está no <span className="font-bold text-primary">Nível {currentLevel}</span>.
            Escolha onde quer praticar agora.
          </p>
        </div>

        <Button
          onClick={() => start(currentLevel)}
          className="btn-pop w-full h-16 text-lg font-bold rounded-2xl bg-primary hover:bg-primary/90 mb-6"
        >
          ▶ Continuar do Nível {currentLevel}
        </Button>

        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Ou revisar um nível anterior
        </div>

        <div className="grid gap-3">
          {LEVELS.map((l) => {
            const unlocked = l.level <= currentLevel;
            const def = getLevel(l.level);
            return (
              <button
                key={l.level}
                disabled={!unlocked}
                onClick={() => start(l.level)}
                className={cn(
                  "text-left bg-card rounded-2xl p-4 border border-border shadow-[var(--shadow-soft)] flex items-center gap-4 transition",
                  unlocked
                    ? "hover:border-primary cursor-pointer"
                    : "opacity-50 cursor-not-allowed",
                )}
              >
                <span
                  className={cn(
                    "inline-flex items-center justify-center w-12 h-12 rounded-full font-bold text-lg",
                    l.level === currentLevel
                      ? "bg-primary text-primary-foreground"
                      : unlocked
                        ? "bg-accent text-accent-foreground"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {unlocked ? l.level : "🔒"}
                </span>
                <div className="flex-1">
                  <div className="font-bold text-foreground">
                    Nível {l.level}
                    {l.level === currentLevel && (
                      <span className="ml-2 text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full">
                        atual
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Tabuadas: {def.tables.join(", ")}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => navigate({ to: "/" })}
          className="mt-6 w-full text-sm text-muted-foreground hover:text-foreground"
        >
          ← Sair
        </button>
      </div>
    </main>
  );
}
