import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  verifyStudentPassword,
  setStudentPassword,
  validatePasswordStrength,
  listStudentsByEnrollment,
  type Student,
} from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/aluno")({
  head: () => ({
    meta: [
      { title: "Entrar como aluno — Tabuada Amazônica" },
      { name: "description", content: "Escolha sua turma, seu nome e sua senha para começar." },
    ],
  }),
  component: AlunoEntry,
});

type Step = "enrollment" | "pick-name" | "login" | "set-password";

const GRADES = ["1ª", "2ª", "3ª", "1º EJA"];
const CLASSES = ["A", "B", "C", "D"];
const SHIFTS = ["Manhã", "Tarde", "Noite"];
const isEja = (g: string) => g.includes("EJA");

function AlunoEntry() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("enrollment");
  const [grade, setGrade] = useState("");
  const [className, setClassName] = useState("");
  const [shift, setShift] = useState("");
  const [roster, setRoster] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);

  const goPlay = (student: Student) => {
    sessionStorage.setItem("studentId", student.id);
    sessionStorage.setItem("studentName", student.first_name);
    sessionStorage.setItem("studentLevel", String(student.current_level));
    sessionStorage.removeItem("chosenLevel");
    navigate({ to: "/escolher-atividade" });
  };

  const handleEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grade) return toast.error("Selecione a série");
    if (!isEja(grade) && (!className || !shift)) return toast.error("Selecione turma e turno");
    setLoading(true);
    try {
      const list = await listStudentsByEnrollment(
        grade,
        isEja(grade) ? null : className,
        isEja(grade) ? null : shift,
      );
      if (list.length === 0) {
        toast.error("Nenhum aluno cadastrado nesta turma. Peça ao professor para te cadastrar.");
        return;
      }
      setRoster(list);
      setStep("pick-name");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar lista");
    } finally {
      setLoading(false);
    }
  };

  const handlePickName = (s: Student) => {
    setSelected(s);
    setPassword("");
    setPassword2("");
    setStep(s.password_hash ? "login" : "set-password");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    try {
      const ok = await verifyStudentPassword(selected, password);
      if (!ok) {
        toast.error("Senha incorreta");
        setPassword("");
        return;
      }
      goPlay(selected);
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const err = validatePasswordStrength(password);
    if (err) return toast.error(err);
    if (password.toLowerCase() !== password2.toLowerCase()) {
      return toast.error("As senhas não conferem");
    }
    setLoading(true);
    try {
      await setStudentPassword(selected, password);
      toast.success("Senha criada! Boa prática 🌱");
      goPlay(selected);
    } catch {
      toast.error("Erro ao salvar senha");
    } finally {
      setLoading(false);
    }
  };

  const back = () => {
    if (step === "login" || step === "set-password") {
      setSelected(null);
      setPassword("");
      setPassword2("");
      setStep("pick-name");
    } else if (step === "pick-name") {
      setRoster([]);
      setStep("enrollment");
    } else {
      navigate({ to: "/" });
    }
  };

  return (
    <main className="min-h-screen leaf-bg flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-card rounded-3xl p-8 shadow-[var(--shadow-soft)] border border-border">
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl mb-3">
            👤
          </div>
          <h1 className="text-3xl font-extrabold text-foreground">
            {step === "enrollment" && "Bem-vindo(a)!"}
            {step === "pick-name" && "Encontre seu nome"}
            {step === "login" && `Olá, ${selected?.first_name}!`}
            {step === "set-password" && "Crie sua senha"}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {step === "enrollment" && "Selecione sua série e turma."}
            {step === "pick-name" && "Toque no seu nome para continuar."}
            {step === "login" && "Digite sua senha para continuar."}
            {step === "set-password" && "Esta será sua senha para os próximos acessos."}
          </p>
        </div>

        {step === "enrollment" && (
          <form onSubmit={handleEnrollment}>
            <div>
              <label className="block text-sm font-semibold mb-2">Série</label>
              <div className="grid grid-cols-2 gap-2">
                {GRADES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => {
                      setGrade(g);
                      if (isEja(g)) { setClassName(""); setShift(""); }
                    }}
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

            {!isEja(grade) && grade && (
              <>
                <div className="mt-3">
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

                <div className="mt-3">
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
              </>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="btn-pop mt-6 w-full h-14 text-lg font-bold rounded-2xl bg-primary hover:bg-primary/90"
            >
              {loading ? "Carregando..." : "Continuar"}
            </Button>
          </form>
        )}

        {step === "pick-name" && (
          <div>
            <div className="text-xs text-muted-foreground mb-3 bg-secondary/50 rounded-xl p-3">
              {[grade, !isEja(grade) && className && `Turma ${className}`, !isEja(grade) && shift]
                .filter(Boolean)
                .join(" · ")}
            </div>
            <ul className="max-h-[50vh] overflow-y-auto space-y-1.5 pr-1">
              {roster.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => handlePickName(s)}
                    className="w-full text-left rounded-xl p-3 bg-background hover:bg-secondary border border-border hover:border-primary transition flex items-center justify-between"
                  >
                    <span className="font-bold">{s.first_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {s.password_hash ? "🔒 já tem senha" : "✨ criar senha"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {step === "login" && (
          <form onSubmit={handleLogin}>
            <label className="block text-sm font-semibold mb-2">Senha</label>
            <Input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
              className="h-14 text-lg rounded-xl"
            />
            <p className="text-xs text-muted-foreground mt-2">
              A senha não diferencia maiúsculas de minúsculas.
            </p>
            <Button
              type="submit"
              disabled={loading}
              className="btn-pop mt-6 w-full h-14 text-lg font-bold rounded-2xl bg-primary hover:bg-primary/90"
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        )}

        {step === "set-password" && (
          <form onSubmit={handleSetPassword} className="space-y-3">
            <p className="text-xs text-muted-foreground bg-secondary/50 rounded-xl p-3">
              Crie uma senha com pelo menos 6 caracteres, contendo letras e números.
              Não diferenciamos maiúsculas de minúsculas.
            </p>
            <Input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nova senha (letras + números)"
              className="h-14 text-lg rounded-xl"
            />
            <Input
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="Confirme a senha"
              className="h-14 text-lg rounded-xl"
            />
            <Button
              type="submit"
              disabled={loading}
              className="btn-pop w-full h-14 text-lg font-bold rounded-2xl bg-primary hover:bg-primary/90"
            >
              {loading ? "Salvando..." : "Salvar e jogar"}
            </Button>
          </form>
        )}

        <button
          type="button"
          onClick={back}
          className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground"
        >
          ← Voltar
        </button>
      </div>
    </main>
  );
}
