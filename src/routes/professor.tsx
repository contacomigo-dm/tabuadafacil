import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { teacherLogin, teacherVerify, teacherChangePassword, teacherResetStudentPassword, getTeacherToken, clearTeacherToken, listStudents, getStudentStats, deleteStudent, getOverallRanking, createStudentsRoster, type Student, type TableStat, type RankingEntry } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { listWeeklyRecords, listWeeklyRecordsForWeek, getISOWeek, computeStreak, type WeeklyRecord } from "@/lib/weekly";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

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
  const [weeklyRecords, setWeeklyRecords] = useState<WeeklyRecord[] | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [turmaFilter, setTurmaFilter] = useState<string>("__all__");

  const selectStudent = (s: Student) => {
    setSelected(s);
    if (typeof window !== "undefined") {
      requestAnimationFrame(() => {
        document.getElementById("student-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  const turmaKeyOf = (s: { grade: string | null; class_name: string | null }) =>
    s.class_name?.trim() ? `${s.grade ?? ""} ${s.class_name}`.trim() : (s.grade ?? "Sem turma");

  const allTurmas = useMemo(() => {
    const set = new Set<string>();
    for (const s of students) set.add(turmaKeyOf(s));
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [students]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (turmaFilter !== "__all__" && turmaKeyOf(s) !== turmaFilter) return false;
      if (q && !s.first_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [students, search, turmaFilter]);

  // Verifica token salvo do professor com o servidor.
  useEffect(() => {
    const token = getTeacherToken();
    if (!token) return;
    teacherVerify(token).then((ok) => {
      if (ok) setAuthed(true);
      else clearTeacherToken();
    });
  }, []);

  useEffect(() => {
    if (!authed) return;
    listStudents().then(setStudents).catch(() => toast.error("Erro ao carregar alunos"));
  }, [authed]);

  useEffect(() => {
    if (!selected) {
      setStats(null);
      setWeeklyRecords(null);
      return;
    }
    getStudentStats(selected.id).then(setStats).catch(() => {});
    listWeeklyRecords(selected.id).then(setWeeklyRecords).catch(() => {});
  }, [selected]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = await teacherLogin(pw);
      if (token) {
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
    if (currentPw.length === 0) {
      toast.error("Digite a senha atual");
      return;
    }
    if (newPw.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }
    try {
      const ok = await teacherChangePassword(currentPw, newPw);
      if (ok) {
        toast.success("Senha atualizada");
        setNewPw("");
        setCurrentPw("");
        setShowSettings(false);
      } else {
        toast.error("Senha atual incorreta");
      }
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
            <div className="mt-3 text-xs text-muted-foreground bg-muted/40 rounded-xl p-3 border border-border">
              <p className="font-semibold text-foreground">Acesso restrito a professores já cadastrados.</p>
              <p className="mt-1">
                Quer ter acesso? Entre em contato com o administrador:{" "}
                <a href="mailto:contato@mathyraversus.com.br" className="text-primary underline hover:text-primary/80">
                  contato@mathyraversus.com.br
                </a>
              </p>
            </div>
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
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              placeholder="Senha atual"
              className="flex-1 min-w-[200px] h-11"
              autoComplete="current-password"
            />
            <Input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="Nova senha (mín 6 caracteres)"
              className="flex-1 min-w-[200px] h-11"
              autoComplete="new-password"
            />
            <Button type="submit" className="bg-primary">Salvar nova senha</Button>
          </form>
        )}

        <RankingGeral students={students} onSelectStudent={(id) => {
          const st = students.find((x) => x.id === id);
          if (st) selectStudent(st);
        }} />

        <AtividadePorData
          students={students}
          onSelectStudent={(id) => {
            const st = students.find((x) => x.id === id);
            if (st) selectStudent(st);
          }}
        />

        <RosterManager
          onCreated={async () => {
            const fresh = await listStudents();
            setStudents(fresh);
          }}
        />




        <div className="grid lg:grid-cols-[300px,1fr] gap-6">
          {/* Students list */}
          <aside className="bg-card rounded-2xl p-3 border border-border h-fit">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground px-2 py-2">
              Alunos
            </h2>
            {students.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">Nenhum aluno ainda.</p>
            ) : (
              <>
                <div className="px-1 pb-2 space-y-2">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="🔎 Buscar por nome..."
                    className="h-9"
                  />
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setTurmaFilter("__all__")}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-semibold border transition",
                        turmaFilter === "__all__" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary",
                      )}
                    >
                      Todas
                    </button>
                    {allTurmas.map((t) => (
                      <button
                        key={t}
                        onClick={() => setTurmaFilter(t)}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-semibold border transition",
                          turmaFilter === t ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary",
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground px-1">
                    {filteredStudents.length} de {students.length} aluno(s)
                  </p>
                </div>
                {filteredStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4">Nenhum aluno encontrado.</p>
                ) : (
                  (() => {
                    const groups = new Map<string, Student[]>();
                    for (const s of filteredStudents) {
                      const key = turmaKeyOf(s);
                      const arr = groups.get(key) ?? [];
                      arr.push(s);
                      groups.set(key, arr);
                    }
                    const ordered = [...groups.entries()].sort(([a], [b]) => {
                      if (a === "Sem turma") return 1;
                      if (b === "Sem turma") return -1;
                      return a.localeCompare(b, "pt-BR");
                    });
                    return (
                      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                        {ordered.map(([turma, alunos]) => (
                          <div key={turma}>
                            <div className="px-2 py-1 text-xs font-bold uppercase tracking-wider text-river flex items-center justify-between sticky top-0 bg-card">
                              <span>Turma {turma}</span>
                              <span className="text-muted-foreground font-semibold">{alunos.length}</span>
                            </div>
                            <ul className="space-y-1">
                              {alunos.map((s) => (
                                <li key={s.id} className="group relative">
                                  <button
                                    onClick={() => selectStudent(s)}
                                    className={cn(
                                      "w-full text-left rounded-xl p-3 pr-24 transition-colors",
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
                                      {[s.grade, s.shift].filter(Boolean).join(" · ") || `Nível ${s.current_level}`}
                                    </div>
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={`Resetar senha de ${s.first_name}`}
                                    title="Resetar senha"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (!confirm(`Resetar a senha de "${s.first_name}"? O aluno precisará cadastrar uma nova senha (e um novo LOGIN com o ano de nascimento) no próximo acesso.`)) return;
                                      try {
                                        const ok = await teacherResetStudentPassword(s.id);
                                        if (!ok) {
                                          toast.error("Sessão expirada. Faça login novamente.");
                                          clearTeacherToken();
                                          setAuthed(false);
                                          return;
                                        }
                                        setStudents((prev) =>
                                          prev.map((x) =>
                                            x.id === s.id
                                              ? { ...x, password_hash: null, username: null, birth_year: null }
                                              : x,
                                          ),
                                        );
                                        toast.success("Senha resetada");
                                      } catch {
                                        toast.error("Erro ao resetar senha");
                                      }
                                    }}
                                    className={cn(
                                      "absolute right-12 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-sm transition",
                                      selected?.id === s.id
                                        ? "text-primary-foreground/80 hover:bg-primary-foreground/20"
                                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                                    )}
                                  >
                                    🔄
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={`Excluir ${s.first_name}`}
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (!confirm(`Excluir o aluno "${s.first_name}" e todo o seu histórico? Esta ação não pode ser desfeita.`)) return;
                                      try {
                                        await deleteStudent(s.id);
                                        setStudents((prev) => prev.filter((x) => x.id !== s.id));
                                        if (selected?.id === s.id) setSelected(null);
                                        toast.success("Aluno excluído");
                                      } catch {
                                        toast.error("Erro ao excluir aluno");
                                      }
                                    }}
                                    className={cn(
                                      "absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-sm transition",
                                      selected?.id === s.id
                                        ? "text-primary-foreground/80 hover:bg-primary-foreground/20"
                                        : "text-muted-foreground hover:bg-destructive hover:text-destructive-foreground",
                                    )}
                                  >
                                    🗑️
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    );
                  })()
                )}
              </>
            )}
          </aside>

          {/* Detail */}
          <section id="student-detail" className="scroll-mt-4">
            {!selected ? (
              <div className="bg-card rounded-2xl p-12 border border-border text-center text-muted-foreground">
                Selecione um aluno para ver o progresso.
              </div>
            ) : (
              <StudentDetail student={selected} stats={stats} weeklyRecords={weeklyRecords} />
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
  weeklyRecords,
}: {
  student: Student;
  stats: Awaited<ReturnType<typeof getStudentStats>> | null;
  weeklyRecords?: WeeklyRecord[] | null;
}) {
  const total = student.total_correct + student.total_wrong;
  const pct = total > 0 ? Math.round((student.total_correct / total) * 100) : 0;
  const { year, week } = getISOWeek();
  const currentWeekRecord = weeklyRecords?.find((r) => r.year === year && r.week === week);
  const streak = weeklyRecords ? computeStreak(weeklyRecords) : 0;

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl p-6 border border-border">
        <h2 className="text-2xl font-extrabold">{student.first_name}</h2>
        {(student.grade || student.class_name || student.shift) && (
          <p className="text-sm text-muted-foreground mb-4">
            {[student.grade && `Série ${student.grade}`, student.class_name && `Turma ${student.class_name}`, student.shift].filter(Boolean).join(" · ")}
          </p>
        )}
        {!student.grade && !student.class_name && !student.shift && <div className="mb-4" />}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card label="Nível atual" value={student.current_level} />
          <Card label="Maior sequência" value={student.best_streak} />
          <Card label="% acerto geral" value={`${pct}%`} />
          <Card label="Total respondido" value={total} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Card label="Acertos (geral)" value={student.total_correct} color="text-success" />
          <Card label="Erros (geral)" value={student.total_wrong} color="text-warning" />
        </div>
      </div>

      {/* Desafio da Semana */}
      <div className="bg-card rounded-2xl p-6 border border-border">
        <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
          <span>🏆</span> Desafio da Semana
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card
            label={`Semana ${week} de ${year}`}
            value={currentWeekRecord ? `✅ ${currentWeekRecord.correct_count}/${currentWeekRecord.total_questions}` : "⏳ Não feito"}
            color={currentWeekRecord ? "text-success" : "text-muted-foreground"}
          />
          <Card label="Streak (semanas)" value={streak} color="text-primary" />
          <Card label="Selos conquistados" value={weeklyRecords?.length ?? 0} color="text-accent" />
        </div>
        {weeklyRecords && weeklyRecords.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Histórico de selos
            </h4>
            <div className="flex flex-wrap gap-2">
              {weeklyRecords.slice(0, 12).map((r) => (
                <span
                  key={r.id}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold",
                    r.year === year && r.week === week
                      ? "bg-success/15 border-success/30 text-success"
                      : "bg-accent/20 border-accent/40 text-foreground"
                  )}
                >
                  ⭐ S{r.week}/{r.year} · {r.correct_count}/{r.total_questions}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <Tabs defaultValue="multiplication" className="w-full">
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="multiplication">✖️ Multiplicação</TabsTrigger>
          <TabsTrigger value="division">➗ Divisão</TabsTrigger>
        </TabsList>
        <TabsContent value="multiplication" className="space-y-4 mt-4">
          <ActivityPanel
            label="multiplicação"
            data={stats?.multiplication ?? null}
            tableLabelPrefix="×"
          />
        </TabsContent>
        <TabsContent value="division" className="space-y-4 mt-4">
          <ActivityPanel
            label="divisão"
            data={stats?.division ?? null}
            tableLabelPrefix="÷"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface ActivityData {
  tableStats: TableStat[];
  sessions: Array<{
    id: string;
    started_at: string;
    correct_count: number;
    wrong_count: number;
    level_at_start: number;
    level_at_end: number;
  }>;
  totalCorrect: number;
  totalWrong: number;
}

function ActivityPanel({
  label,
  data,
  tableLabelPrefix,
}: {
  label: string;
  data: ActivityData | null;
  tableLabelPrefix: string;
}) {
  const monthly = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { key: string; label: string; acertos: number; erros: number; sessoes: number; contas: number }>();
    for (const s of data.sessions) {
      const d = new Date(s.started_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const lbl = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      const row = map.get(key) ?? { key, label: lbl, acertos: 0, erros: 0, sessoes: 0, contas: 0 };
      row.acertos += s.correct_count;
      row.erros += s.wrong_count;
      row.sessoes += 1;
      row.contas += s.correct_count + s.wrong_count;
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [data]);

  const totalResp = (data?.totalCorrect ?? 0) + (data?.totalWrong ?? 0);
  const pct = totalResp > 0 ? Math.round(((data?.totalCorrect ?? 0) / totalResp) * 100) : 0;

  return (
    <>
      <div className="bg-card rounded-2xl p-6 border border-border">
        <h3 className="text-lg font-bold mb-3">Resumo da {label}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card label="Acertos" value={data?.totalCorrect ?? 0} color="text-success" />
          <Card label="Erros" value={data?.totalWrong ?? 0} color="text-warning" />
          <Card label="% acerto" value={`${pct}%`} />
          <Card label="Sessões" value={data?.sessions.length ?? 0} />
        </div>
      </div>

      <div className="bg-card rounded-2xl p-6 border border-border">
        <h3 className="text-lg font-bold mb-1">Evolução mês a mês — {label}</h3>
        <p className="text-xs text-muted-foreground mb-3">Acertos, erros e total de contas feitas por mês.</p>
        {monthly.length === 0 ? (
          <p className="text-muted-foreground text-sm">Sem dados ainda.</p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthly} margin={{ top: 10, right: 20, left: 0, bottom: 0 }} barCategoryGap="30%" barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} padding={{ left: 30, right: 30 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} width={36} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="acertos" name="Acertos" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} />
                <Bar dataKey="erros" name="Erros" fill="hsl(var(--warning))" radius={[6, 6, 0, 0]} />
                <Line type="monotone" dataKey="contas" name="Contas feitas" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-card rounded-2xl p-6 border border-border">
        <h3 className="text-lg font-bold mb-3">Tabuadas com mais erros — {label}</h3>
        {!data || data.tableStats.length === 0 ? (
          <p className="text-muted-foreground text-sm">Sem dados ainda.</p>
        ) : (
          <ul className="space-y-2">
            {data.tableStats.map((t) => {
              const tot = t.correct + t.wrong;
              const errPct = tot > 0 ? Math.round((t.wrong / tot) * 100) : 0;
              return (
                <li key={t.table_num} className="flex items-center gap-3">
                  <div className="w-12 font-bold">{tableLabelPrefix}{t.table_num}</div>
                  <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-warning" style={{ width: `${errPct}%` }} />
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
        <h3 className="text-lg font-bold mb-3">Histórico de sessões — {label}</h3>
        {!data || data.sessions.length === 0 ? (
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
                {data.sessions.map((s) => (
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
                    <td className="py-2 text-warning font-semibold">{s.wrong_count}</td>
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
    </>
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
function AtividadePorData({
  students,
  onSelectStudent,
}: {
  students: Student[];
  onSelectStudent?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState<string>(today);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Array<{
    student_id: string;
    first_name: string;
    turma: string;
    sessions: number;
    correct: number;
    wrong: number;
    activities: Set<string>;
  }> | null>(null);

  const buscar = async () => {
    if (!date) return;
    setLoading(true);
    try {
      const start = new Date(`${date}T00:00:00`);
      const end = new Date(`${date}T23:59:59.999`);
      const { data, error } = await supabase
        .from("sessions")
        .select("student_id, correct_count, wrong_count, activity, started_at")
        .gte("started_at", start.toISOString())
        .lte("started_at", end.toISOString());
      if (error) throw error;
      const byId = new Map(students.map((s) => [s.id, s]));
      const agg = new Map<string, {
        student_id: string;
        first_name: string;
        turma: string;
        sessions: number;
        correct: number;
        wrong: number;
        activities: Set<string>;
      }>();
      for (const r of data ?? []) {
        const st = byId.get(r.student_id);
        if (!st) continue;
        const turma = st.class_name?.trim()
          ? `${st.grade ?? ""} ${st.class_name}`.trim()
          : (st.grade ?? "Sem turma");
        const row = agg.get(r.student_id) ?? {
          student_id: r.student_id,
          first_name: st.first_name,
          turma,
          sessions: 0,
          correct: 0,
          wrong: 0,
          activities: new Set<string>(),
        };
        row.sessions += 1;
        row.correct += r.correct_count ?? 0;
        row.wrong += r.wrong_count ?? 0;
        row.activities.add(r.activity ?? "multiplication");
        agg.set(r.student_id, row);
      }
      setRows([...agg.values()].sort((a, b) => b.correct + b.wrong - (a.correct + a.wrong)));
    } catch {
      toast.error("Erro ao buscar atividade");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border mb-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-4"
      >
        <span className="text-lg font-extrabold flex items-center gap-2">📅 Atividade por data</span>
        <span className="text-sm text-muted-foreground">{open ? "Ocultar ▲" : "Mostrar ▼"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Veja quais alunos praticaram num determinado dia.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Data</label>
              <Input
                type="date"
                value={date}
                max={today}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 w-44"
              />
            </div>
            <Button onClick={buscar} disabled={loading || !date} className="bg-primary h-10">
              {loading ? "Buscando..." : "Buscar"}
            </Button>
            <Button
              variant="outline"
              onClick={() => { setDate(today); setRows(null); }}
              className="h-10"
            >
              Limpar
            </Button>
          </div>
          {rows === null ? (
            <p className="text-sm text-muted-foreground">Escolha uma data e clique em Buscar.</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum aluno praticou nesta data.</p>
          ) : (
            <div className="overflow-x-auto">
              <p className="text-xs text-muted-foreground mb-2">
                {rows.length} aluno(s) praticaram em{" "}
                {new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR")}
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2">Aluno</th>
                    <th className="py-2">Turma</th>
                    <th className="py-2">Atividade</th>
                    <th className="py-2 text-right">Sessões</th>
                    <th className="py-2 text-right">Acertos</th>
                    <th className="py-2 text-right">Erros</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.student_id} className="border-b border-border/50">
                      <td className="py-2 font-bold">
                        {onSelectStudent ? (
                          <button
                            type="button"
                            onClick={() => onSelectStudent(r.student_id)}
                            className="text-primary hover:underline text-left"
                          >
                            {r.first_name}
                          </button>
                        ) : (
                          r.first_name
                        )}
                      </td>
                      <td className="py-2 text-muted-foreground">{r.turma}</td>
                      <td className="py-2 text-muted-foreground">
                        {[...r.activities]
                          .map((a) => (a === "division" ? "➗" : "✖️"))
                          .join(" ")}
                      </td>
                      <td className="py-2 text-right tabular-nums">{r.sessions}</td>
                      <td className="py-2 text-right text-success font-semibold">{r.correct}</td>
                      <td className="py-2 text-right text-warning font-semibold">{r.wrong}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function RankingGeral({ students, onSelectStudent }: { students: Student[]; onSelectStudent?: (id: string) => void }) {
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("__all__");

  useEffect(() => {
    getOverallRanking().then(setRanking).catch(() => {});
  }, [students.length]);

  const turmas = useMemo(() => {
    const set = new Set<string>();
    for (const s of students) {
      const key = s.class_name?.trim() ? `${s.grade ?? ""} ${s.class_name}`.trim() : (s.grade ?? "Sem turma");
      set.add(key);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [students]);

  const filtered = useMemo(() => {
    if (filter === "__all__") return ranking;
    return ranking.filter((r) => {
      const key = r.class_name?.trim() ? `${r.grade ?? ""} ${r.class_name}`.trim() : (r.grade ?? "Sem turma");
      return key === filter;
    });
  }, [ranking, filter]);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="bg-card rounded-2xl border border-border mb-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-4"
      >
        <span className="text-lg font-extrabold flex items-center gap-2">🏆 Ranking geral</span>
        <span className="text-sm text-muted-foreground">{open ? "Ocultar ▲" : "Mostrar ▼"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4">
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={() => setFilter("__all__")}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-semibold border transition",
                filter === "__all__" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary",
              )}
            >
              Todas as turmas
            </button>
            {turmas.map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm font-semibold border transition",
                  filter === t ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary",
                )}
              >
                {t}
              </button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground p-2">Sem dados de desempenho ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 w-12">#</th>
                    <th className="py-2">Aluno</th>
                    <th className="py-2">Turma</th>
                    <th className="py-2 text-right">Acertos</th>
                    <th className="py-2 text-right">Erros</th>
                    <th className="py-2 text-right">% acerto</th>
                    <th className="py-2 text-right">Dias ativos</th>
                    <th className="py-2 text-right">Pontos</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="py-2 text-lg">{medals[i] ?? <span className="text-muted-foreground font-bold">{i + 1}</span>}</td>
                      <td className="py-2 font-bold">
                        {onSelectStudent ? (
                          <button
                            type="button"
                            onClick={() => onSelectStudent(r.id)}
                            className="text-primary hover:underline text-left"
                          >
                            {r.first_name}
                          </button>
                        ) : (
                          r.first_name
                        )}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {r.class_name?.trim() ? `${r.grade ?? ""} ${r.class_name}`.trim() : (r.grade ?? "—")}
                      </td>
                      <td className="py-2 text-right text-success font-semibold">{r.total_correct}</td>
                      <td className="py-2 text-right text-warning font-semibold">{r.total_wrong}</td>
                      <td className="py-2 text-right tabular-nums">{r.accuracy}%</td>
                      <td className="py-2 text-right tabular-nums">{r.active_days}</td>
                      <td className="py-2 text-right font-bold text-primary tabular-nums">{r.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const ROSTER_GRADES = ["1ª", "2ª", "3ª", "1º EJA"];
const ROSTER_CLASSES = ["A", "B", "C", "D"];
const ROSTER_SHIFTS = ["Manhã", "Tarde", "Noite"];
const isRosterEja = (g: string) => g.includes("EJA");

function RosterManager({ onCreated }: { onCreated: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [grade, setGrade] = useState("");
  const [className, setClassName] = useState("");
  const [shift, setShift] = useState("");
  const [bulk, setBulk] = useState("");
  const [single, setSingle] = useState("");
  const [saving, setSaving] = useState(false);

  const eja = isRosterEja(grade);
  const enrollmentValid = !!grade && (eja || (!!className && !!shift));

  const parseNames = (raw: string) =>
    raw
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

  const submit = async (names: string[]) => {
    if (!enrollmentValid) return toast.error("Selecione série/turma/turno");
    if (names.length === 0) return toast.error("Adicione pelo menos um nome");
    setSaving(true);
    try {
      const res = await createStudentsRoster(names, {
        grade,
        class_name: eja ? null : className,
        shift: eja ? null : shift,
      });
      if (res.created > 0) toast.success(`${res.created} aluno(s) cadastrado(s)`);
      if (res.skipped.length > 0)
        toast.info(`${res.skipped.length} já existia(m): ${res.skipped.slice(0, 5).join(", ")}${res.skipped.length > 5 ? "…" : ""}`);
      setBulk("");
      setSingle("");
      await onCreated();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao cadastrar alunos");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border mb-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-4"
      >
        <span className="text-lg font-extrabold flex items-center gap-2">📝 Cadastrar alunos</span>
        <span className="text-sm text-muted-foreground">{open ? "Ocultar ▲" : "Mostrar ▼"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Série</label>
              <div className="flex flex-wrap gap-1.5">
                {ROSTER_GRADES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => { setGrade(g); if (isRosterEja(g)) { setClassName(""); setShift(""); } }}
                    className={cn("px-3 py-1.5 rounded-lg border text-sm font-semibold transition", grade === g ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary")}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            {!eja && (
              <>
                <div>
                  <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Turma</label>
                  <div className="flex flex-wrap gap-1.5">
                    {ROSTER_CLASSES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setClassName(c)}
                        className={cn("w-10 h-9 rounded-lg border text-sm font-semibold transition", className === c ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary")}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Turno</label>
                  <div className="flex flex-wrap gap-1.5">
                    {ROSTER_SHIFTS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setShift(s)}
                        className={cn("px-3 py-1.5 rounded-lg border text-sm font-semibold transition", shift === s ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary")}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">
              Colar lista (um nome por linha, ou separados por vírgula)
            </label>
            <textarea
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              placeholder={"Ana Silva\nBruno Costa\nCarla Souza"}
              className="w-full min-h-[140px] rounded-xl border border-border bg-background p-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <Button
              type="button"
              disabled={saving}
              onClick={() => submit(parseNames(bulk))}
              className="mt-2 bg-primary"
            >
              {saving ? "Salvando..." : `Cadastrar ${parseNames(bulk).length} aluno(s)`}
            </Button>
          </div>

          <div className="border-t border-border pt-3">
            <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">
              Cadastrar individual
            </label>
            <div className="flex gap-2 flex-wrap">
              <Input
                value={single}
                onChange={(e) => setSingle(e.target.value)}
                placeholder="Nome do aluno"
                className="flex-1 min-w-[200px]"
                maxLength={60}
              />
              <Button
                type="button"
                disabled={saving || !single.trim()}
                onClick={() => submit([single.trim()])}
                className="bg-primary"
              >
                Adicionar
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Os alunos cadastrados aqui aparecerão para selecionar o próprio nome no primeiro acesso e então criarem a senha (letras + números, sem diferenciar maiúsculas).
          </p>
        </div>
      )}
    </div>
  );
}

