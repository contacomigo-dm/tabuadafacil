import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  findStudentByName,
  verifyStudentPassword,
  setStudentPassword,
  createStudentWithPassword,
  validatePasswordStrength,
  type Student,
} from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/aluno")({
  head: () => ({
    meta: [
      { title: "Entrar como aluno — Tabuada Amazônica" },
      { name: "description", content: "Digite seu nome e senha para começar a praticar a tabuada." },
    ],
  }),
  component: AlunoEntry,
});

type Step = "name" | "login" | "register" | "set-password";

const GRADES = ["1ª", "2ª", "3ª", "1º EJA"];
const CLASSES = ["A", "B", "C", "D"];
const SHIFTS = ["Manhã", "Tarde", "Noite"];
const isEja = (g: string) => g.includes("EJA");

function AlunoEntry() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [grade, setGrade] = useState("");
  const [className, setClassName] = useState("");
  const [shift, setShift] = useState("");
  const [existing, setExisting] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);

  const goPlay = (student: Student) => {
    sessionStorage.setItem("studentId", student.id);
    sessionStorage.setItem("studentName", student.first_name);
    sessionStorage.setItem("studentLevel", String(student.current_level));
    sessionStorage.removeItem("chosenLevel");
    navigate({ to: "/escolher-atividade" });
  };

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim().replace(/\s+/g, " ");
    if (!trimmed) return toast.error("Digite seu nome");
    if (trimmed.length > 60) return toast.error("Nome muito longo");
    setName(trimmed);
    setLoading(true);
    try {
      const found = await findStudentByName(trimmed);
      if (found) {
        setExisting(found);
        setStep(found.password_hash ? "login" : "set-password");
      } else {
        setStep("register");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao verificar nome");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!existing) return;
    setLoading(true);
    try {
      const ok = await verifyStudentPassword(existing, password);
      if (!ok) {
        toast.error("Senha incorreta");
        setPassword("");
        return;
      }
      goPlay(existing);
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!existing) return;
    const err = validatePasswordStrength(password);
    if (err) return toast.error(err);
    if (password !== password2) return toast.error("As senhas não conferem");
    setLoading(true);
    try {
      await setStudentPassword(existing, password);
      toast.success("Senha criada! Bem-vindo(a) de volta.");
      goPlay(existing);
    } catch {
      toast.error("Erro ao salvar senha");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grade) return toast.error("Selecione a série");
    if (!isEja(grade) && (!className || !shift)) return toast.error("Selecione turma e turno");
    const err = validatePasswordStrength(password);
    if (err) return toast.error(err);
    if (password !== password2) return toast.error("As senhas não conferem");
    setLoading(true);
    try {
      const student = await createStudentWithPassword(name, password, {
        grade,
        class_name: className,
        shift,
      });
      toast.success("Cadastro feito!");
      goPlay(student);
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível cadastrar.");
    } finally {
      setLoading(false);
    }
  };

  const back = () => {
    setStep("name");
    setPassword("");
    setPassword2("");
    setExisting(null);
  };

  return (
    <main className="min-h-screen leaf-bg flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-card rounded-3xl p-8 shadow-[var(--shadow-soft)] border border-border">
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl mb-3">
            👤
          </div>
          <h1 className="text-3xl font-extrabold text-foreground">
            {step === "name" && "Bem-vindo(a)!"}
            {step === "login" && `Olá, ${name}!`}
            {step === "set-password" && "Crie sua senha"}
            {step === "register" && "Novo cadastro"}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {step === "name" && "Digite seu nome para começar."}
            {step === "login" && "Digite sua senha para continuar."}
            {step === "set-password" && "Esta será sua senha para os próximos acessos."}
            {step === "register" && "Preencha seus dados e crie uma senha."}
          </p>
        </div>

        {step === "name" && (
          <form onSubmit={handleNameSubmit}>
            <label htmlFor="firstname" className="block text-sm font-semibold mb-2">Nome</label>
            <Input
              id="firstname"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Maria Silva"
              className="h-14 text-lg rounded-xl"
              maxLength={60}
            />
            <Button
              type="submit"
              disabled={loading}
              className="btn-pop mt-6 w-full h-14 text-lg font-bold rounded-2xl bg-primary hover:bg-primary/90"
            >
              {loading ? "Verificando..." : "Continuar"}
            </Button>
          </form>
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
              Reconhecemos seu cadastro. Crie uma senha (com letras e números) para proteger seu acesso.
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

        {step === "register" && (
          <form onSubmit={handleRegister}>
            <div>
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

            <div className="mt-4 space-y-2">
              <label className="block text-sm font-semibold">Senha (letras + números)</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mín. 6, com letras e números"
                className="h-12 rounded-xl"
              />
              <Input
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="Confirme a senha"
                className="h-12 rounded-xl"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="btn-pop mt-6 w-full h-14 text-lg font-bold rounded-2xl bg-primary hover:bg-primary/90"
            >
              {loading ? "Cadastrando..." : "Cadastrar e jogar"}
            </Button>
          </form>
        )}

        <button
          type="button"
          onClick={() => (step === "name" ? navigate({ to: "/" }) : back())}
          className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground"
        >
          ← Voltar
        </button>
      </div>
    </main>
  );
}
