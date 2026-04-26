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
  const [grade, setGrade] = useState("");
  const [className, setClassName] = useState("");
  const [shift, setShift] = useState("");
  const [loading, setLoading] = useState(false);

  const GRADES = ["1ª", "2ª", "3ª"];
  const CLASSES = ["A", "B", "C", "D"];
  const SHIFTS = ["Manhã", "Tarde", "Noite"];

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim().replace(/\s+/g, " ");
    if (!trimmed) {
      toast.error("Digite seu nome");
      return;
    }
    if (trimmed.length > 60) {
      toast.error("Nome muito longo");
      return;
    }
    if (!grade || !className || !shift) {
      toast.error("Selecione série, turma e turno");
      return;
    }
    setLoading(true);
    try {
      const student = await findOrCreateStudent(trimmed, {
        grade,
        class_name: className,
        shift,
      });
      sessionStorage.setItem("studentId", student.id);
      sessionStorage.setItem("studentName", student.first_name);
      sessionStorage.removeItem("chosenLevel");
      if (student.current_level > 1) {
        navigate({ to: "/escolher-nivel" });
      } else {
        sessionStorage.setItem("chosenLevel", "1");
        navigate({ to: "/jogar" });
      }
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível entrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen leaf-bg flex items-center justify-center px-4 py-8">
      <form
        onSubmit={handleStart}
        className="w-full max-w-md bg-card rounded-3xl p-8 shadow-[var(--shadow-soft)] border border-border"
      >
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl mb-3">
            👤
          </div>
          <h1 className="text-3xl font-extrabold text-foreground">Bem-vindo(a)!</h1>
          <p className="text-muted-foreground mt-2">Preencha seus dados para começar.</p>
        </div>

        <label htmlFor="firstname" className="block text-sm font-semibold mb-2">
          Nome
        </label>
        <Input
          id="firstname"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Maria Silva"
          className="h-14 text-lg rounded-xl"
          maxLength={60}
        />

        <div className="mt-4">
          <label className="block text-sm font-semibold mb-2">Série</label>
          <div className="grid grid-cols-3 gap-2">
            {GRADES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGrade(g)}
                className={`h-12 rounded-xl border font-bold transition ${
                  grade === g
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border hover:border-primary"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-semibold mb-2">Turma</label>
          <div className="grid grid-cols-4 gap-2">
            {CLASSES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setClassName(c)}
                className={`h-12 rounded-xl border font-bold transition ${
                  className === c
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border hover:border-primary"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-semibold mb-2">Turno</label>
          <div className="grid grid-cols-3 gap-2">
            {SHIFTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setShift(s)}
                className={`h-12 rounded-xl border font-semibold text-sm transition ${
                  shift === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border hover:border-primary"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

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
