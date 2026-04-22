import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/divisao-treino")({
  head: () => ({
    meta: [{ title: "Treino livre — Divisão Longa" }],
  }),
  component: TreinoLivre,
});

function TreinoLivre() {
  const navigate = useNavigate();
  const [dividend, setDividend] = useState("");
  const [divisor, setDivisor] = useState("");

  const start = () => {
    const d = Number(dividend);
    const s = Number(divisor);
    if (!Number.isInteger(d) || d < 0 || d > 999999) {
      toast.error("Digite um dividendo entre 0 e 999999");
      return;
    }
    if (!Number.isInteger(s) || s < 2 || s > 9) {
      toast.error("O divisor deve ser de 2 a 9");
      return;
    }
    sessionStorage.setItem("divFreeMode", "1");
    sessionStorage.setItem("divFreeDividend", String(d));
    sessionStorage.setItem("divFreeDivisor", String(s));
    navigate({ to: "/divisao-jogar" });
  };

  return (
    <main className="min-h-screen leaf-bg flex items-center justify-center px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start();
        }}
        className="w-full max-w-md bg-card rounded-3xl p-8 shadow-[var(--shadow-soft)] border border-border"
      >
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-river/15 flex items-center justify-center text-3xl mb-3">
            ✏️
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">Treino livre</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Monte a sua conta. O divisor deve ser um número de 2 a 9.
          </p>
        </div>

        <label className="block text-sm font-semibold mb-2">Dividendo (número grande)</label>
        <Input
          autoFocus
          inputMode="numeric"
          value={dividend}
          onChange={(e) => setDividend(e.target.value.replace(/\D/g, ""))}
          placeholder="Ex: 9185"
          className="h-14 text-lg rounded-xl text-center font-mono tracking-wider"
          maxLength={6}
        />

        <label className="block text-sm font-semibold mb-2 mt-4">Divisor (2 a 9)</label>
        <Input
          inputMode="numeric"
          value={divisor}
          onChange={(e) => setDivisor(e.target.value.replace(/\D/g, "").slice(0, 1))}
          placeholder="Ex: 6"
          className="h-14 text-lg rounded-xl text-center font-mono tracking-wider"
          maxLength={1}
        />

        <Button
          type="submit"
          className="btn-pop mt-6 w-full h-14 text-lg font-bold rounded-2xl bg-river hover:bg-river/90 text-river-foreground"
        >
          ▶ Começar
        </Button>
        <button
          type="button"
          onClick={() => navigate({ to: "/divisao" })}
          className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground"
        >
          ← Voltar
        </button>
      </form>
    </main>
  );
}
