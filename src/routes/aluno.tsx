import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { findOrCreateStudent } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/aluno")({
  head: () => ({
    meta: [
      { title: "Entrar como aluno — Tabuada Amazônica" },
      { name: "description", content: "Digite seu primeiro nome para começar a praticar a tabuada." },
    ],
  }),
  component: AlunoEntry,
});

function AlunoEntry() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Digite seu primeiro nome");
      return;
    }
    if (trimmed.length > 30 || /\s/.test(trimmed)) {
      toast.error("Use apenas o primeiro nome (sem espaços)");
      return;
    }
    setLoading(true);
    try {
      const student = await findOrCreateStudent(trimmed);
      sessionStorage.setItem("studentId", student.id);
      sessionStorage.setItem("studentName", student.first_name);
      navigate({ to: "/jogar" });
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível entrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen leaf-bg flex items-center justify-center px-4">
      <form
        onSubmit={handleStart}
        className="w-full max-w-md bg-card rounded-3xl p-8 shadow-[var(--shadow-soft)] border border-border"
      >
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl mb-3">
            👤
          </div>
          <h1 className="text-3xl font-extrabold text-foreground">Bem-vindo(a)!</h1>
          <p className="text-muted-foreground mt-2">Digite seu primeiro nome para começar.</p>
        </div>

        <label htmlFor="firstname" className="block text-sm font-semibold mb-2">
          Primeiro nome
        </label>
        <Input
          id="firstname"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Maria"
          className="h-14 text-lg rounded-xl"
          maxLength={30}
        />

        <Button
          type="submit"
          disabled={loading}
          className="btn-pop mt-6 w-full h-14 text-lg font-bold rounded-2xl bg-primary hover:bg-primary/90"
        >
          {loading ? "Entrando..." : "Começar a jogar"}
        </Button>

        <button
          type="button"
          onClick={() => navigate({ to: "/" })}
          className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground"
        >
          ← Voltar
        </button>
      </form>
    </main>
  );
}
