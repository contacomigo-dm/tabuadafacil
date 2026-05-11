import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

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
  const [level, setLevel] = useState(1);

  useEffect(() => {
    const id = sessionStorage.getItem("studentId");
    if (!id) {
      navigate({ to: "/aluno" });
      return;
    }
    setName(sessionStorage.getItem("studentName") ?? "");
    setLevel(Number(sessionStorage.getItem("studentLevel") ?? "1"));
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
