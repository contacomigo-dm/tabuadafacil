import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getTeacherPassword, setTeacherPassword, listStudents, getStudentStats, deleteStudent, type Student } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/professor")({
  head: () => ({
    meta: [
      { title: "Painel do professor — Tabuada Amazônica" },
      { name: "description", content: "Acompanhe o progresso dos alunos." },
    ],
  }),
  component: TeacherPage,
});

function TeacherPage() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getStudentStats>> | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [loading, setLoading] = useState(false);

  // Session auth
  useEffect(() => {
    if (sessionStorage.getItem("teacherAuthed") === "1") setAuthed(true);
  }, []);

  useEffect(() => {
    if (!authed) return;
    listStudents().then(setStudents).catch(() => toast.error("Erro ao carregar alunos"));
  }, [authed]);

  useEffect(() => {
    if (!selected) {
      setStats(null);
      return;
    }
    getStudentStats(selected.id).then(setStats).catch(() => {});
  }, [selected]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const real = await getTeacherPassword();
      if (pw === real) {
        sessionStorage.setItem("teacherAuthed", "1");
        setAuthed(true);
        toast.success("Bem-vindo(a), professor(a)!");
      } else {
        toast.error("Senha incorreta");
      }
    } finally {
      setLoading(false);
      setPw("");
    }
  };

  const handleChangePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 4) {
      toast.error("A senha deve ter pelo menos 4 caracteres");
      return;
    }
    try {
      await setTeacherPassword(newPw);
      toast.success("Senha atualizada");
      setNewPw("");
      setShowSettings(false);
    } catch {
      toast.error("Erro ao atualizar senha");
    }
  };

  if (!authed) {
    return (
      <main className="min-h-screen leaf-bg flex items-center justify-center px-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-md bg-card rounded-3xl p-8 shadow-[var(--shadow-soft)] border border-border"
        >
          <div className="text-center mb-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center text-3xl mb-3">
              🎓
            </div>
            <h1 className="text-3xl font-extrabold">Painel do professor</h1>
            <p className="text-muted-foreground mt-2">Digite a senha para entrar.</p>
          </div>
          <Input
            type="password"
            autoFocus
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Senha"
            className="h-14 text-lg rounded-xl"
          />
          <Button
            type="submit"
            disabled={loading}
            className="btn-pop-amber mt-6 w-full h-14 text-lg font-bold rounded-2xl bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            Entrar
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

  return (
    <main className="min-h-screen leaf-bg px-4 py-6">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-extrabold">Painel do professor</h1>
            <p className="text-muted-foreground text-sm">{students.length} aluno(s) cadastrado(s)</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowSettings((s) => !s)}>
              ⚙️ Trocar senha
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                sessionStorage.removeItem("teacherAuthed");
                setAuthed(false);
                navigate({ to: "/" });
              }}
            >
              Sair
            </Button>
          </div>
        </header>

        {showSettings && (
          <form
            onSubmit={handleChangePw}
            className="bg-card rounded-2xl p-4 border border-border mb-6 flex gap-2 flex-wrap"
          >
            <Input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="Nova senha (mín 4 caracteres)"
              className="flex-1 min-w-[200px] h-11"
            />
            <Button type="submit" className="bg-primary">Salvar nova senha</Button>
          </form>
        )}

        <div className="grid lg:grid-cols-[300px,1fr] gap-6">
          {/* Students list */}
          <aside className="bg-card rounded-2xl p-3 border border-border h-fit">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground px-2 py-2">
              Alunos
            </h2>
            {students.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">Nenhum aluno ainda.</p>
            ) : (
              <ul className="space-y-1">
                {students.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => setSelected(s)}
                      className={cn(
                        "w-full text-left rounded-xl p-3 transition-colors",
                        selected?.id === s.id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-secondary",
                      )}
                    >
                      <div className="font-bold">{s.first_name}</div>
                      <div
                        className={cn(
                          "text-xs",
                          selected?.id === s.id ? "text-primary-foreground/80" : "text-muted-foreground",
                        )}
                      >
                        Nível {s.current_level} · melhor seq. {s.best_streak}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          {/* Detail */}
          <section>
            {!selected ? (
              <div className="bg-card rounded-2xl p-12 border border-border text-center text-muted-foreground">
                Selecione um aluno para ver o progresso.
              </div>
            ) : (
              <StudentDetail student={selected} stats={stats} />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function StudentDetail({
  student,
  stats,
}: {
  student: Student;
  stats: Awaited<ReturnType<typeof getStudentStats>> | null;
}) {
  const total = student.total_correct + student.total_wrong;
  const pct = total > 0 ? Math.round((student.total_correct / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl p-6 border border-border">
        <h2 className="text-2xl font-extrabold mb-4">{student.first_name}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card label="Nível" value={student.current_level} />
          <Card label="Maior sequência" value={student.best_streak} />
          <Card label="% acerto" value={`${pct}%`} />
          <Card label="Total respondido" value={total} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Card label="Acertos" value={student.total_correct} color="text-success" />
          <Card label="Erros" value={student.total_wrong} color="text-destructive" />
        </div>
      </div>

      <div className="bg-card rounded-2xl p-6 border border-border">
        <h3 className="text-lg font-bold mb-3">Tabuadas com mais erros</h3>
        {!stats || stats.tableStats.length === 0 ? (
          <p className="text-muted-foreground text-sm">Sem dados ainda.</p>
        ) : (
          <ul className="space-y-2">
            {stats.tableStats.map((t) => {
              const tot = t.correct + t.wrong;
              const errPct = tot > 0 ? Math.round((t.wrong / tot) * 100) : 0;
              return (
                <li key={t.table_num} className="flex items-center gap-3">
                  <div className="w-12 font-bold">×{t.table_num}</div>
                  <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-destructive"
                      style={{ width: `${errPct}%` }}
                    />
                  </div>
                  <div className="text-sm tabular-nums w-32 text-right text-muted-foreground">
                    {t.wrong} erro(s) / {tot}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="bg-card rounded-2xl p-6 border border-border">
        <h3 className="text-lg font-bold mb-3">Histórico de sessões</h3>
        {!stats || stats.sessions.length === 0 ? (
          <p className="text-muted-foreground text-sm">Sem sessões ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2">Quando</th>
                  <th className="py-2">Acertos</th>
                  <th className="py-2">Erros</th>
                  <th className="py-2">Nível</th>
                </tr>
              </thead>
              <tbody>
                {stats.sessions.map((s) => (
                  <tr key={s.id} className="border-b border-border/50">
                    <td className="py-2">
                      {new Date(s.started_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2 text-success font-semibold">{s.correct_count}</td>
                    <td className="py-2 text-destructive font-semibold">{s.wrong_count}</td>
                    <td className="py-2">
                      {s.level_at_start}
                      {s.level_at_end !== s.level_at_start && ` → ${s.level_at_end}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  color = "text-foreground",
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="bg-secondary/50 rounded-xl p-3">
      <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
        {label}
      </div>
      <div className={cn("text-2xl font-extrabold", color)}>{value}</div>
    </div>
  );
}
