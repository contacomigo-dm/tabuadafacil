import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getClassRanking, type RankingEntry } from "@/lib/api";

export const Route = createFileRoute("/escolher-atividade")({
  head: () => ({
    meta: [
      { title: "Escolher atividade — Tabuada Amazônica" },
      { name: "description", content: "Escolha entre Tabuada da multiplicação ou Divisão longa." },
    ],
  }),
  component: EscolherAtividade,
});

function EscolherAtividade() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [level, setLevel] = useState(1);
  const [top3, setTop3] = useState<RankingEntry[]>([]);
  const [turmaLabel, setTurmaLabel] = useState("");

  useEffect(() => {
    const id = sessionStorage.getItem("studentId");
    if (!id) {
      navigate({ to: "/aluno" });
      return;
    }
    setStudentId(id);
    setName(sessionStorage.getItem("studentName") ?? "");
    setLevel(Number(sessionStorage.getItem("studentLevel") ?? "1"));

    // Carrega ranking da turma
    (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: me } = await supabase
        .from("students")
        .select("class_name, grade")
        .eq("id", id)
        .single();
      const cn = (me?.class_name as string | null) ?? null;
      const gr = (me?.grade as string | null) ?? null;
      setTurmaLabel(cn ? `${gr ?? ""} ${cn}`.trim() : gr ?? "sua turma");
      const ranking = await getClassRanking(cn, gr);
      setTop3(ranking.slice(0, 3));
    })().catch(() => {});
  }, [navigate]);

  const goTabuada = () => {
    sessionStorage.removeItem("chosenLevel");
    if (level > 1) {
      navigate({ to: "/escolher-nivel" });
    } else {
      sessionStorage.setItem("chosenLevel", "1");
      navigate({ to: "/jogar" });
    }
  };

  const goDivisao = () => {
    navigate({ to: "/divisao" });
  };

  const sair = () => {
    sessionStorage.removeItem("studentId");
    sessionStorage.removeItem("studentName");
    sessionStorage.removeItem("studentLevel");
    navigate({ to: "/" });
  };

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <main className="min-h-screen leaf-bg flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl text-center">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/60 backdrop-blur px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
          <span aria-hidden>🌿</span> Olá, {name || "aluno(a)"}!
        </div>
        <h1 className="mt-4 text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">
          O que você quer <span className="text-primary">praticar</span> hoje?
        </h1>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <button onClick={goTabuada} className="block text-left">
            <div className="btn-pop bg-card border border-border rounded-3xl p-6 hover:border-primary transition h-full">
              <div className="text-4xl mb-2">✖️</div>
              <div className="text-xl font-extrabold text-foreground">Tabuada</div>
              <div className="text-sm text-muted-foreground mt-1">
                Multiplicação do 2 ao 9, em níveis com timer e sequências.
              </div>
            </div>
          </button>
          <button onClick={goDivisao} className="block text-left">
            <div className="btn-pop bg-card border border-border rounded-3xl p-6 hover:border-river transition h-full">
              <div className="text-4xl mb-2">➗</div>
              <div className="text-xl font-extrabold text-foreground">Divisão Longa</div>
              <div className="text-sm text-muted-foreground mt-1">
                Conta armada guiada, passo a passo.
              </div>
            </div>
          </button>
        </div>

        {/* Ranking TOP 3 da turma */}
        <div className="mt-8 bg-card border border-border rounded-3xl p-6 text-left">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-extrabold text-foreground">🏆 TOP 3 — Turma {turmaLabel}</h2>
          </div>
          {top3.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ninguém pontuou ainda. Pratique e seja o primeiro do ranking!
            </p>
          ) : (
            <ul className="space-y-2">
              {top3.map((r, i) => (
                <li
                  key={r.id}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
                    r.id === studentId ? "bg-primary/10 border border-primary/30" : "bg-secondary/50"
                  }`}
                >
                  <span className="text-2xl w-8 text-center">{medals[i]}</span>
                  <span className="flex-1 font-bold text-foreground">
                    {r.first_name}
                    {r.id === studentId && (
                      <span className="ml-2 text-xs font-semibold text-primary">(você)</span>
                    )}
                  </span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {r.total_correct} acertos · {r.accuracy}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          onClick={sair}
          className="mt-8 text-sm text-muted-foreground hover:text-foreground"
        >
          ← Sair
        </button>
      </div>
    </main>
  );
}
