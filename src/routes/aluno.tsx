import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  studentLogin,
  studentSetPasswordFirstTime,
  studentResetWithSecurity,
  validatePasswordStrength,
  validateBirthYear,
  validateFavoriteColor,
  validateFavoriteSubject,
  listStudentsByEnrollment,
  findStudentByUsername,
  getSchoolCode,
  buildUsernameBase,
  createVisitor,
  FAVORITE_COLORS,
  FAVORITE_SUBJECTS,
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

type Step =
  | "choose-mode"
  | "login-by-username"
  | "enrollment"
  | "school-code"
  | "pick-name"
  | "login"
  | "set-password"
  | "show-login"
  | "visitor-register"
  | "reset-login"
  | "reset-security"
  | "reset-set-password";

type Flow = "first" | "reset";

const GRADES = ["1ª", "2ª", "3ª", "1º EJA"];
const CLASSES = ["A", "B", "C", "D"];
const SHIFTS = ["Manhã", "Tarde", "Noite"];
const isEja = (g: string) => g.includes("EJA");

// Mapa de cor → swatch CSS (oklch-friendly hex aproximado).
const COLOR_SWATCH: Record<string, string> = {
  vermelho: "#dc2626",
  azul: "#2563eb",
  verde: "#16a34a",
  amarelo: "#facc15",
  rosa: "#ec4899",
  roxo: "#9333ea",
  laranja: "#f97316",
  preto: "#0a0a0a",
  branco: "#f8fafc",
  marrom: "#92400e",
};

function AlunoEntry() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("choose-mode");
  const [grade, setGrade] = useState("");
  const [className, setClassName] = useState("");
  const [shift, setShift] = useState("");
  const [schoolCodeInput, setSchoolCodeInput] = useState("");
  const [roster, setRoster] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [assignedLogin, setAssignedLogin] = useState("");
  const [visitorName, setVisitorName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [favColor, setFavColor] = useState("");
  const [favSubject, setFavSubject] = useState("");
  const [loading, setLoading] = useState(false);
  const [flow, setFlow] = useState<Flow>("first");

  const goPlay = (student: Student) => {
    sessionStorage.setItem("studentId", student.id);
    sessionStorage.setItem("studentName", student.first_name);
    sessionStorage.setItem("studentLevel", String(student.current_level));
    sessionStorage.removeItem("chosenLevel");
    // Carrega tema preferido do aluno e aplica antes de navegar.
    import("@/lib/theme").then(({ loadStudentTheme, applyTheme }) => {
      loadStudentTheme(student.id).then(applyTheme).catch(() => {});
    });
    navigate({ to: "/escolher-atividade" });
  };

  const handleEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grade) return toast.error("Selecione a série");
    if (!isEja(grade) && (!className || !shift)) return toast.error("Selecione turma e turno");
    setSchoolCodeInput("");
    setStep("school-code");
  };

  const handleSchoolCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const expected = await getSchoolCode();
      if (schoolCodeInput.trim() !== expected) {
        toast.error("Código da escola inválido");
        return;
      }
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
      toast.error("Erro ao validar código");
    } finally {
      setLoading(false);
    }
  };

  const handlePickName = (s: Student) => {
    setSelected(s);
    setPassword("");
    setPassword2("");
    setBirthYear("");
    setFavColor("");
    setFavSubject("");
    if (flow === "reset") {
      // Sempre passa pela tela de perguntas de segurança antes de redefinir.
      setStep("reset-security");
      return;
    }
    if (s.password_hash) {
      if (s.username && s.username.trim().length > 0) {
        toast.info("Você já tem cadastro. Entre com seu LOGIN e senha.");
        setStep("login-by-username");
        setUsernameInput(s.username);
      } else {
        setStep("login");
      }
    } else {
      setStep("set-password");
    }
  };

  const handleLoginByUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const s = await studentLogin(usernameInput, password);
      if (!s) {
        toast.error("LOGIN ou senha incorretos");
        setPassword("");
        return;
      }
      goPlay(s);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    try {
      if (!selected.username || selected.username.trim().length === 0) {
        // No password set yet — go to set-password flow.
        setStep("set-password");
        return;
      }
      const s = await studentLogin(selected.username, password);
      if (!s) {
        toast.error("Senha incorreta");
        setPassword("");
        return;
      }
      goPlay(s);
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const yr = parseInt(birthYear, 10);
    const yErr = validateBirthYear(yr);
    if (yErr) return toast.error(yErr);
    const cErr = validateFavoriteColor(favColor);
    if (cErr) return toast.error(cErr);
    const sErr = validateFavoriteSubject(favSubject);
    if (sErr) return toast.error(sErr);
    const err = validatePasswordStrength(password);
    if (err) return toast.error(err);
    if (password.toLowerCase() !== password2.toLowerCase()) {
      return toast.error("As senhas não conferem");
    }
    setLoading(true);
    try {
      const login = await studentSetPasswordFirstTime({
        firstName: selected.first_name,
        grade: selected.grade,
        className: selected.class_name,
        shift: selected.shift,
        password,
        birthYear: yr,
        favoriteColor: favColor,
        favoriteSubject: favSubject,
      });
      setAssignedLogin(login);
      setStep("show-login");
    } catch (err) {
      const msg = (err as Error)?.message ?? "";
      console.error("set_password_first_time error:", msg);
      if (msg.includes("already_has_password")) {
        toast.error("Esta conta já tem senha. Use Entrar.");
      } else if (msg.includes("not_found")) {
        toast.error("Aluno não encontrado para esta turma. Confira nome/turma/turno.");
      } else if (msg.includes("invalid_input")) {
        toast.error("Dados inválidos. Verifique senha (mín. 6, com letra e número), ano e respostas.");
      } else {
        toast.error("Erro ao salvar senha: " + (msg || "tente novamente"));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVisitorRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = visitorName.trim().replace(/\s+/g, " ");
    if (name.length < 2) return toast.error("Digite seu nome completo");
    const yr = parseInt(birthYear, 10);
    const yErr = validateBirthYear(yr);
    if (yErr) return toast.error(yErr);
    const cErr = validateFavoriteColor(favColor);
    if (cErr) return toast.error(cErr);
    const sErr = validateFavoriteSubject(favSubject);
    if (sErr) return toast.error(sErr);
    const err = validatePasswordStrength(password);
    if (err) return toast.error(err);
    if (password.toLowerCase() !== password2.toLowerCase()) {
      return toast.error("As senhas não conferem");
    }
    setLoading(true);
    try {
      const { student, username } = await createVisitor(name, password, yr, favColor, favSubject);
      setSelected(student);
      setAssignedLogin(username);
      setStep("show-login");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao cadastrar visitante");
    } finally {
      setLoading(false);
    }
  };

  const handleResetLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const s = await findStudentByUsername(usernameInput);
      if (!s) {
        toast.error("LOGIN não encontrado");
        return;
      }
      const sameGrade = (s.grade ?? "") === grade;
      const sameClass = isEja(grade) ? true : (s.class_name ?? "") === className;
      const sameShift = isEja(grade) ? true : (s.shift ?? "") === shift;
      if (!sameGrade || !sameClass || !sameShift) {
        toast.error("Este LOGIN não pertence a esta turma");
        return;
      }
      setSelected(s);
      setPassword("");
      setPassword2("");
      setBirthYear("");
      setFavColor("");
      setFavSubject("");
      setStep("reset-security");
    } finally {
      setLoading(false);
    }
  };

  // Etapa de coleta das 3 respostas de segurança. A verificação acontece no servidor
  // ao gravar a nova senha (as respostas não são lidas pelo navegador).
  const handleResetSecurity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const yr = parseInt(birthYear, 10);
    const yErr = validateBirthYear(yr);
    if (yErr) return toast.error(yErr);
    const cErr = validateFavoriteColor(favColor);
    if (cErr) return toast.error(cErr);
    const sErr = validateFavoriteSubject(favSubject);
    if (sErr) return toast.error(sErr);
    setPassword("");
    setPassword2("");
    setStep("reset-set-password");
  };

  const handleResetSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const yr = parseInt(birthYear, 10);
    const yErr = validateBirthYear(yr);
    if (yErr) return toast.error(yErr);
    const err = validatePasswordStrength(password);
    if (err) return toast.error(err);
    if (password.toLowerCase() !== password2.toLowerCase()) {
      return toast.error("As senhas não conferem");
    }
    setLoading(true);
    try {
      const login = await studentResetWithSecurity({
        firstName: selected.first_name,
        grade: selected.grade,
        className: selected.class_name,
        shift: selected.shift,
        newPassword: password,
        birthYear: yr,
        favoriteColor: favColor,
        favoriteSubject: favSubject,
      });
      toast.success("Senha redefinida com sucesso!");
      setAssignedLogin(login);
      setStep("show-login");
    } catch (err) {
      const msg = (err as Error)?.message ?? "";
      if (msg.includes("wrong_answers")) {
        toast.error("Respostas não conferem. Procure seu professor.");
      } else if (msg.includes("no_security_answers")) {
        toast.error("Esta conta antiga não tem perguntas de segurança. Procure seu professor para resetar.");
      } else {
        toast.error("Erro ao redefinir senha");
      }
    } finally {
      setLoading(false);
    }
  };

  const back = () => {
    if (step === "choose-mode") {
      navigate({ to: "/" });
    } else if (step === "login-by-username") {
      setStep("choose-mode");
    } else if (step === "enrollment") {
      setStep("choose-mode");
    } else if (step === "school-code") {
      setStep("enrollment");
    } else if (step === "pick-name") {
      setStep("school-code");
    } else if (step === "login" || step === "set-password") {
      setSelected(null);
      setPassword("");
      setPassword2("");
      setStep("pick-name");
    } else if (step === "visitor-register") {
      setPassword("");
      setPassword2("");
      setVisitorName("");
      setStep("choose-mode");
    } else if (step === "reset-security") {
      setSelected(null);
      setStep("pick-name");
    } else if (step === "reset-set-password") {
      setStep("reset-security");
    } else {
      navigate({ to: "/" });
    }
  };

  const previewLogin = selected
    ? `${buildUsernameBase(selected.first_name)}${birthYear.trim().length === 4 ? birthYear.trim() : ""}`
    : "";
  const visitorPreview = visitorName.trim().length >= 2
    ? `${buildUsernameBase(visitorName)}${birthYear.trim().length === 4 ? birthYear.trim() : ""}`
    : "";

  return (
    <main className="min-h-screen leaf-bg flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-card rounded-3xl p-8 shadow-[var(--shadow-soft)] border border-border">
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl mb-3">
            👤
          </div>
          <h1 className="text-3xl font-extrabold text-foreground">
            {step === "choose-mode" && "Bem-vindo(a)!"}
            {step === "login-by-username" && "Entrar"}
            {step === "enrollment" && (flow === "reset" ? "Redefinir senha" : "Primeiro acesso")}
            {step === "school-code" && "Código da escola"}
            {step === "pick-name" && "Encontre seu nome"}
            {step === "login" && `Olá, ${selected?.first_name}!`}
            {step === "set-password" && "Crie sua senha"}
            {step === "show-login" && "Guarde seu LOGIN"}
            {step === "visitor-register" && "Cadastro de visitante"}
            {step === "reset-login" && "Confirme seu LOGIN"}
            {step === "reset-security" && `Olá, ${selected?.first_name}!`}
            {step === "reset-set-password" && `Olá, ${selected?.first_name}!`}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {step === "choose-mode" && "Como você quer entrar?"}
            {step === "login-by-username" && "Digite seu LOGIN e sua senha."}
            {step === "enrollment" && "Selecione sua série e turma."}
            {step === "school-code" && "Peça o código ao seu professor."}
            {step === "pick-name" && "Toque no seu nome para continuar."}
            {step === "login" && "Digite sua senha para continuar."}
            {step === "set-password" && "Esta será sua senha para os próximos acessos."}
            {step === "show-login" && "Anote em algum lugar seguro."}
            {step === "visitor-register" && "Treine livremente — seu desempenho fica salvo."}
            {step === "reset-login" && "Digite o LOGIN (iniciais do seu nome) que você criou."}
            {step === "reset-security" && "Responda as 3 perguntas para confirmar que é você."}
            {step === "reset-set-password" && "Agora cadastre sua nova senha."}
          </p>
        </div>

        {step === "choose-mode" && (
          <div className="space-y-3">
            <Button
              onClick={() => setStep("login-by-username")}
              className="btn-pop w-full h-14 text-base font-bold rounded-2xl bg-primary hover:bg-primary/90"
            >
              🔑 Já tenho login
            </Button>
            <Button
              onClick={() => {
                setFlow("first");
                setStep("enrollment");
              }}
              variant="outline"
              className="btn-pop w-full h-14 text-base font-bold rounded-2xl border-2"
            >
              ✨ Primeiro acesso (aluno da escola)
            </Button>
            <Button
              onClick={() => {
                setFlow("reset");
                setGrade("");
                setClassName("");
                setShift("");
                setStep("enrollment");
              }}
              variant="outline"
              className="btn-pop w-full h-14 text-base font-bold rounded-2xl border-2"
            >
              🔄 Esqueci minha senha
            </Button>
            <Button
              onClick={() => {
                setVisitorName("");
                setPassword("");
                setPassword2("");
                setStep("visitor-register");
              }}
              variant="outline"
              className="btn-pop w-full h-14 text-base font-bold rounded-2xl border-2 border-accent/60 hover:border-accent"
            >
              🌎 Sou visitante (público em geral)
            </Button>
          </div>
        )}

        {step === "visitor-register" && (
          <form onSubmit={handleVisitorRegister} className="space-y-3">
            <div>
              <label className="block text-sm font-semibold mb-2">Nome completo</label>
              <Input
                autoFocus
                value={visitorName}
                onChange={(e) => setVisitorName(e.target.value)}
                placeholder="ex: maria silva souza"
                className="h-14 text-lg rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Ano de nascimento</label>
              <Input
                inputMode="numeric"
                maxLength={4}
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="ex: 2012"
                className="h-14 text-lg rounded-xl tracking-widest text-center"
              />
              {visitorPreview && (
                <div className="text-xs text-muted-foreground mt-1">
                  Seu LOGIN será:{" "}
                  <span className="font-mono font-bold text-primary tracking-wider">
                    {visitorPreview}
                  </span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Cor preferida</label>
              <div className="grid grid-cols-5 gap-2">
                {FAVORITE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFavColor(c)}
                    className={`h-12 rounded-xl border-2 transition flex flex-col items-center justify-center ${
                      favColor === c ? "border-primary scale-105" : "border-border"
                    }`}
                    title={c}
                  >
                    <span
                      className="w-5 h-5 rounded-full border border-border"
                      style={{ background: COLOR_SWATCH[c] }}
                    />
                    <span className="text-[10px] mt-0.5 capitalize">{c}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Componente curricular preferido</label>
              <div className="grid grid-cols-2 gap-2">
                {FAVORITE_SUBJECTS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFavSubject(s)}
                    className={`h-11 rounded-xl border font-semibold text-sm transition ${
                      favSubject === s
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border hover:border-primary"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground bg-secondary/50 rounded-xl p-3">
              Crie uma senha com pelo menos 6 caracteres, contendo letras e números.
            </p>
            <Input
              type="password"
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
              {loading ? "Cadastrando..." : "Cadastrar e começar"}
            </Button>
          </form>
        )}

        {step === "login-by-username" && (
          <form onSubmit={handleLoginByUsername} className="space-y-3">
            <div>
              <label className="block text-sm font-semibold mb-2">LOGIN</label>
              <Input
                autoFocus
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="ex: jpss"
                className="h-14 text-lg rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Senha</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                className="h-14 text-lg rounded-xl"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="btn-pop mt-2 w-full h-14 text-lg font-bold rounded-2xl bg-primary hover:bg-primary/90"
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        )}

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
              Continuar
            </Button>
          </form>
        )}

        {step === "school-code" && (
          <form onSubmit={handleSchoolCode} className="space-y-3">
            <p className="text-xs text-muted-foreground bg-secondary/50 rounded-xl p-3">
              Para liberar a lista de alunos, digite o código da sua escola.
            </p>
            <Input
              autoFocus
              inputMode="numeric"
              value={schoolCodeInput}
              onChange={(e) => setSchoolCodeInput(e.target.value)}
              placeholder="Código da escola"
              className="h-14 text-lg rounded-xl tracking-widest text-center"
            />
            <Button
              type="submit"
              disabled={loading}
              className="btn-pop w-full h-14 text-lg font-bold rounded-2xl bg-primary hover:bg-primary/90"
            >
              {loading ? "Validando..." : "Validar código"}
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
            <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 text-sm">
              <div className="font-semibold text-foreground mb-1">Seu LOGIN será:</div>
              <div className="font-mono text-lg font-bold text-primary tracking-wider">
                {previewLogin || "—"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                (iniciais do seu nome + ano de nascimento — anote para os próximos acessos)
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Ano de nascimento</label>
              <Input
                autoFocus
                inputMode="numeric"
                maxLength={4}
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="ex: 2012"
                className="h-14 text-lg rounded-xl tracking-widest text-center"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Cor preferida</label>
              <div className="grid grid-cols-5 gap-2">
                {FAVORITE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFavColor(c)}
                    className={`h-12 rounded-xl border-2 transition flex flex-col items-center justify-center ${
                      favColor === c ? "border-primary scale-105" : "border-border"
                    }`}
                    title={c}
                  >
                    <span
                      className="w-5 h-5 rounded-full border border-border"
                      style={{ background: COLOR_SWATCH[c] }}
                    />
                    <span className="text-[10px] mt-0.5 capitalize">{c}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Vai te ajudar a recuperar a senha se você esquecer.
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Componente curricular preferido</label>
              <div className="grid grid-cols-2 gap-2">
                {FAVORITE_SUBJECTS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFavSubject(s)}
                    className={`h-11 rounded-xl border font-semibold text-sm transition ${
                      favSubject === s
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border hover:border-primary"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground bg-secondary/50 rounded-xl p-3">
              Crie uma senha com pelo menos 6 caracteres, contendo letras e números.
              Não diferenciamos maiúsculas de minúsculas.
            </p>
            <Input
              type="password"
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
              {loading ? "Salvando..." : "Salvar e continuar"}
            </Button>
          </form>
        )}

        {step === "show-login" && selected && (
          <div className="space-y-4">
            <div className="bg-primary/10 border-2 border-primary/40 rounded-2xl p-5 text-center">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                Seu LOGIN
              </div>
              <div className="font-mono text-3xl font-extrabold text-primary tracking-widest">
                {assignedLogin}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                ⚠️ Anote! Você vai precisar dele junto com a senha nas próximas vezes.
              </div>
            </div>
            <Button
              onClick={() => goPlay(selected)}
              className="btn-pop w-full h-14 text-lg font-bold rounded-2xl bg-primary hover:bg-primary/90"
            >
              Anotei, vamos jogar! 🚀
            </Button>
          </div>
        )}

        {step === "reset-login" && (
          <form onSubmit={handleResetLogin} className="space-y-3">
            <p className="text-xs text-muted-foreground bg-secondary/50 rounded-xl p-3">
              Digite o LOGIN que você criou (as iniciais do seu nome). Em seguida,
              você poderá cadastrar uma nova senha.
            </p>
            <Input
              autoFocus
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="ex: jpss"
              className="h-14 text-lg rounded-xl"
            />
            <Button
              type="submit"
              disabled={loading}
              className="btn-pop w-full h-14 text-lg font-bold rounded-2xl bg-primary hover:bg-primary/90"
            >
              {loading ? "Verificando..." : "Continuar"}
            </Button>
          </form>
        )}

        {step === "reset-security" && selected && (
          <form onSubmit={handleResetSecurity} className="space-y-3">
            <div className="bg-secondary/50 border border-border rounded-xl p-3 text-sm">
              <div className="font-semibold text-foreground mb-1">Aluno(a):</div>
              <div className="font-bold text-lg text-primary">{selected.first_name}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Para sua segurança, responda as 3 perguntas que você escolheu no cadastro.
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">1) Ano de nascimento</label>
              <Input
                autoFocus
                inputMode="numeric"
                maxLength={4}
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="ex: 2012"
                className="h-14 text-lg rounded-xl tracking-widest text-center"
              />
            </div>
            {(selected.favorite_color || selected.favorite_subject) ? (
              <>
                <div>
                  <label className="block text-sm font-semibold mb-2">2) Cor preferida</label>
                  <div className="grid grid-cols-5 gap-2">
                    {FAVORITE_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setFavColor(c)}
                        className={`h-12 rounded-xl border-2 transition flex flex-col items-center justify-center ${
                          favColor === c ? "border-primary scale-105" : "border-border"
                        }`}
                        title={c}
                      >
                        <span
                          className="w-5 h-5 rounded-full border border-border"
                          style={{ background: COLOR_SWATCH[c] }}
                        />
                        <span className="text-[10px] mt-0.5 capitalize">{c}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">3) Componente curricular preferido</label>
                  <div className="grid grid-cols-2 gap-2">
                    {FAVORITE_SUBJECTS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setFavSubject(s)}
                        className={`h-11 rounded-xl border font-semibold text-sm transition ${
                          favSubject === s
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
            ) : (
              <p className="text-xs text-muted-foreground bg-warning/20 rounded-xl p-3">
                Seu cadastro ainda não tem as perguntas de cor e componente curricular
                (cadastro antigo). Confirme só o ano de nascimento — você poderá escolher
                as outras duas na próxima etapa.
              </p>
            )}
            <Button
              type="submit"
              disabled={loading}
              className="btn-pop w-full h-14 text-lg font-bold rounded-2xl bg-primary hover:bg-primary/90"
            >
              Confirmar respostas
            </Button>
          </form>
        )}

        {step === "reset-set-password" && selected && (
          <form onSubmit={handleResetSetPassword} className="space-y-3">
            <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 text-sm">
              <div className="font-semibold text-foreground mb-1">Aluno(a):</div>
              <div className="font-bold text-lg text-primary">{selected.first_name}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Novo LOGIN:{" "}
                <span className="font-mono font-bold tracking-wider text-primary">
                  {previewLogin || "—"}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Ano de nascimento</label>
              <Input
                autoFocus
                inputMode="numeric"
                maxLength={4}
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="ex: 2012"
                className="h-14 text-lg rounded-xl tracking-widest text-center"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Confirme seu ano de nascimento — ele faz parte do seu novo LOGIN.
              </p>
            </div>
            {!selected.favorite_color && !selected.favorite_subject && (
              <>
                <div>
                  <label className="block text-sm font-semibold mb-2">Cor preferida (nova)</label>
                  <div className="grid grid-cols-5 gap-2">
                    {FAVORITE_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setFavColor(c)}
                        className={`h-12 rounded-xl border-2 transition flex flex-col items-center justify-center ${
                          favColor === c ? "border-primary scale-105" : "border-border"
                        }`}
                        title={c}
                      >
                        <span
                          className="w-5 h-5 rounded-full border border-border"
                          style={{ background: COLOR_SWATCH[c] }}
                        />
                        <span className="text-[10px] mt-0.5 capitalize">{c}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Componente curricular preferido (novo)</label>
                  <div className="grid grid-cols-2 gap-2">
                    {FAVORITE_SUBJECTS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setFavSubject(s)}
                        className={`h-11 rounded-xl border font-semibold text-sm transition ${
                          favSubject === s
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
            <p className="text-xs text-muted-foreground bg-secondary/50 rounded-xl p-3">
              Crie uma nova senha com pelo menos 6 caracteres, contendo letras e números.
            </p>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nova senha"
              className="h-14 text-lg rounded-xl"
            />
            <Input
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="Confirme a nova senha"
              className="h-14 text-lg rounded-xl"
            />
            <Button
              type="submit"
              disabled={loading}
              className="btn-pop w-full h-14 text-lg font-bold rounded-2xl bg-primary hover:bg-primary/90"
            >
              {loading ? "Salvando..." : "Salvar nova senha"}
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
