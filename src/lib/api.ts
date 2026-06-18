// Data access layer wrapping Supabase queries for students/sessions/attempts.
// Sensitive operations (login, password set/reset, teacher auth) go through
// edge functions so password hashes and security answers never reach the
// browser.
import { supabase } from "@/integrations/supabase/client";

// Safe student columns readable by anon. Sensitive fields (password_hash,
// birth_year, favorite_color, favorite_subject) are server-only.
const SAFE_COLS =
  "id, first_name, username, current_level, best_streak, current_streak, total_correct, total_wrong, grade, class_name, shift, created_at, updated_at";

export interface Student {
  id: string;
  first_name: string;
  username: string | null;
  // Sensitive fields — not selected from the browser. Kept optional so the
  // type still compiles where callers pass through a Student object.
  birth_year?: number | null;
  favorite_color?: string | null;
  favorite_subject?: string | null;
  password_hash?: string | null;
  current_level: number;
  best_streak: number;
  current_streak: number;
  total_correct: number;
  total_wrong: number;
  grade: string | null;
  class_name: string | null;
  shift: string | null;
  created_at: string;
  updated_at: string;
}

// Listas fixas de opções para as perguntas de segurança.
export const FAVORITE_COLORS = [
  "vermelho", "azul", "verde", "amarelo", "rosa",
  "roxo", "laranja", "preto", "branco", "marrom",
] as const;

export const FAVORITE_SUBJECTS = [
  "Matemática", "Português", "Ciências", "História",
  "Geografia", "Artes", "Educação Física", "Inglês",
] as const;

export function validateFavoriteColor(c: string | null | undefined): string | null {
  if (!c || !FAVORITE_COLORS.includes(c.toLowerCase() as typeof FAVORITE_COLORS[number])) {
    return "Selecione sua cor preferida";
  }
  return null;
}

export function validateFavoriteSubject(s: string | null | undefined): string | null {
  if (!s || !(FAVORITE_SUBJECTS as readonly string[]).includes(s)) {
    return "Selecione seu componente curricular preferido";
  }
  return null;
}

const STOP_WORDS = new Set(["da", "de", "di", "do", "du", "das", "dos", "e"]);
export function buildUsernameBase(fullName: string): string {
  return fullName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w))
    .map((w) => w[0])
    .join("");
}

export function validateBirthYear(y: number | null | undefined): string | null {
  if (!y || !Number.isInteger(y)) return "Informe o ano de nascimento (4 dígitos)";
  const now = new Date().getFullYear();
  if (y < 1930 || y > now) return "Ano de nascimento inválido";
  return null;
}

export function validatePasswordStrength(pw: string): string | null {
  if (pw.length < 6) return "A senha deve ter pelo menos 6 caracteres";
  if (!/[A-Za-z]/.test(pw)) return "A senha precisa ter pelo menos uma letra";
  if (!/[0-9]/.test(pw)) return "A senha precisa ter pelo menos um número";
  return null;
}

// --- Edge function helpers --------------------------------------------------

async function callFn<T>(name: string, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body: payload });
  if (error) {
    // supabase.functions.invoke returns FunctionsHttpError on non-2xx without
    // surfacing the JSON body. Try to read the body so callers can match on
    // specific error codes (e.g. "already_has_password").
    let code: string | null = null;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.clone === "function") {
        const body = await ctx.clone().json().catch(() => null);
        if (body && typeof body.error === "string") code = body.error;
      }
    } catch {
      /* ignore */
    }
    throw new Error(code ?? error.message ?? "request_failed");
  }
  return data as T;
}

// --- Teacher auth -----------------------------------------------------------

const TEACHER_TOKEN_KEY = "teacherToken";

export function getTeacherToken(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(TEACHER_TOKEN_KEY);
}

export function clearTeacherToken() {
  sessionStorage.removeItem(TEACHER_TOKEN_KEY);
  sessionStorage.removeItem("teacherAuthed");
}

export async function teacherLogin(password: string): Promise<string | null> {
  try {
    const res = await callFn<{ token?: string; error?: string }>("teacher-auth", {
      action: "login",
      password,
    });
    if (res?.token) {
      sessionStorage.setItem(TEACHER_TOKEN_KEY, res.token);
      return res.token;
    }
    return null;
  } catch {
    return null;
  }
}

export async function teacherVerify(token: string): Promise<boolean> {
  try {
    const res = await callFn<{ ok?: boolean }>("teacher-auth", { action: "verify", token });
    return !!res?.ok;
  } catch {
    return false;
  }
}

export async function teacherChangePassword(currentPassword: string, newPassword: string): Promise<boolean> {
  const token = getTeacherToken();
  if (!token) return false;
  try {
    const res = await callFn<{ ok?: boolean; error?: string }>("teacher-auth", {
      action: "change_password",
      token,
      currentPassword,
      newPassword,
    });
    return !!res?.ok;
  } catch {
    return false;
  }
}

export async function teacherResetStudentPassword(studentId: string): Promise<boolean> {
  const token = getTeacherToken();
  if (!token) return false;
  try {
    const res = await callFn<{ ok?: boolean }>("teacher-auth", {
      action: "reset_student",
      token,
      studentId,
    });
    return !!res?.ok;
  } catch {
    return false;
  }
}

/** Teacher-set student credentials: returns the assigned username. */
export async function teacherSetStudentCredentials(args: {
  studentId: string;
  username: string;
  password: string;
}): Promise<string> {
  const token = getTeacherToken();
  if (!token) throw new Error("no_token");
  const res = await callFn<{ username?: string; error?: string }>("teacher-auth", {
    action: "set_student_credentials",
    token,
    ...args,
  });
  if (!res?.username) throw new Error(res?.error ?? "set_credentials_failed");
  return res.username;
}

export interface CredentialEntry {
  id: string;
  first_name: string;
  grade: string | null;
  class_name: string | null;
  shift: string | null;
  username: string;
  password: string;
}

export async function teacherListCredentials(): Promise<CredentialEntry[]> {
  const token = getTeacherToken();
  if (!token) return [];
  try {
    const res = await callFn<{ list?: CredentialEntry[] }>("teacher-auth", {
      action: "list_credentials",
      token,
    });
    return res?.list ?? [];
  } catch {
    return [];
  }
}

export async function getStudentById(id: string): Promise<Student | null> {
  const { data } = await supabase
    .from("students")
    .select(SAFE_COLS)
    .eq("id", id)
    .maybeSingle();
  return (data as Student | null) ?? null;
}

// --- Student auth -----------------------------------------------------------


/** Server-side login: returns the safe student record on success, null otherwise. */
export async function studentLogin(username: string, password: string): Promise<Student | null> {
  try {
    const res = await callFn<{ student?: Student; error?: string }>("student-auth", {
      action: "login",
      username,
      password,
    });
    return res?.student ?? null;
  } catch {
    return null;
  }
}

/** First-time password set for an enrolled student. */
export async function studentSetPasswordFirstTime(args: {
  firstName: string;
  grade: string | null;
  className: string | null;
  shift: string | null;
  password: string;
  birthYear: number;
  favoriteColor: string;
  favoriteSubject: string;
}): Promise<string> {
  const res = await callFn<{ username?: string; error?: string }>("student-auth", {
    action: "set_password_first_time",
    ...args,
  });
  if (!res?.username) throw new Error(res?.error ?? "set_password_failed");
  return res.username;
}

/** Forgot-password flow: verifies security answers server-side. */
export async function studentResetWithSecurity(args: {
  firstName: string;
  grade: string | null;
  className: string | null;
  shift: string | null;
  newPassword: string;
  birthYear: number;
  favoriteColor: string;
  favoriteSubject: string;
}): Promise<string> {
  const res = await callFn<{ username?: string; error?: string }>("student-auth", {
    action: "reset_password_with_security",
    ...args,
  });
  if (!res?.username) throw new Error(res?.error ?? "reset_failed");
  return res.username;
}

export async function createVisitor(
  fullName: string,
  password: string,
  birthYear: number,
  favoriteColor: string,
  favoriteSubject: string,
): Promise<{ student: Student; username: string }> {
  const res = await callFn<{ student?: Student; username?: string; error?: string }>("student-auth", {
    action: "create_visitor",
    fullName, password, birthYear, favoriteColor, favoriteSubject,
  });
  if (!res?.student || !res.username) throw new Error(res?.error ?? "create_visitor_failed");
  return { student: res.student, username: res.username };
}

// --- Other data access (safe columns only) ---------------------------------

export async function findStudentByUsername(username: string): Promise<Student | null> {
  const u = username.trim();
  if (!u) return null;
  const { data } = await supabase
    .from("students")
    .select(SAFE_COLS)
    .ilike("username", u)
    .maybeSingle();
  return (data as Student | null) ?? null;
}

export async function findStudentByName(firstName: string): Promise<Student | null> {
  const name = firstName.trim();
  const { data } = await supabase
    .from("students")
    .select(SAFE_COLS)
    .ilike("first_name", name)
    .maybeSingle();
  return (data as Student | null) ?? null;
}

export async function getSchoolCode(): Promise<string> {
  const { data } = await supabase.from("school_info").select("school_code").maybeSingle();
  return (data?.school_code as string) ?? "15059260";
}

export async function listStudentsByEnrollment(
  grade: string,
  className: string | null,
  shift: string | null,
): Promise<Student[]> {
  let q = supabase.from("students").select(SAFE_COLS).eq("grade", grade);
  if (className) q = q.eq("class_name", className);
  else q = q.is("class_name", null);
  if (shift) q = q.eq("shift", shift);
  else q = q.is("shift", null);
  const { data, error } = await q.order("first_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Student[];
}

export async function createStudentsRoster(
  names: string[],
  enrollment: StudentEnrollment,
): Promise<{ created: number; skipped: string[] }> {
  const clean = Array.from(
    new Set(
      names
        .map((n) => n.trim().replace(/\s+/g, " "))
        .filter((n) => n.length > 0 && n.length <= 60),
    ),
  );
  if (clean.length === 0) return { created: 0, skipped: [] };

  const existing = await listStudentsByEnrollment(
    enrollment.grade ?? "",
    enrollment.class_name ?? null,
    enrollment.shift ?? null,
  );
  const existingSet = new Set(existing.map((s) => s.first_name.toLowerCase()));

  const toInsert = clean.filter((n) => !existingSet.has(n.toLowerCase()));
  const skipped = clean.filter((n) => existingSet.has(n.toLowerCase()));

  if (toInsert.length > 0) {
    const rows = toInsert.map((first_name) => ({ first_name, ...enrollment }));
    const { error } = await supabase.from("students").insert(rows);
    if (error) throw error;
  }
  return { created: toInsert.length, skipped };
}

export interface SecurityAnswers {
  birthYear: number;
  favoriteColor: string;
  favoriteSubject: string;
}

export interface StudentEnrollment {
  grade?: string | null;
  class_name?: string | null;
  shift?: string | null;
}

export async function findOrCreateStudent(
  firstName: string,
  enrollment?: StudentEnrollment,
): Promise<Student> {
  const name = firstName.trim();
  const { data: existing } = await supabase
    .from("students")
    .select(SAFE_COLS)
    .ilike("first_name", name)
    .maybeSingle();
  if (existing) {
    const existingStudent = existing as Student;
    if (enrollment && (enrollment.grade || enrollment.class_name || enrollment.shift)) {
      const patch: { grade?: string; class_name?: string; shift?: string } = {};
      if (enrollment.grade && enrollment.grade !== existingStudent.grade) patch.grade = enrollment.grade;
      if (enrollment.class_name && enrollment.class_name !== existingStudent.class_name) patch.class_name = enrollment.class_name;
      if (enrollment.shift && enrollment.shift !== existingStudent.shift) patch.shift = enrollment.shift;
      if (Object.keys(patch).length > 0) {
        const { data: updated } = await supabase
          .from("students")
          .update(patch)
          .eq("id", existingStudent.id)
          .select(SAFE_COLS)
          .single();
        if (updated) return updated as Student;
      }
    }
    return existingStudent;
  }

  const { data, error } = await supabase
    .from("students")
    .insert({ first_name: name, ...(enrollment ?? {}) })
    .select(SAFE_COLS)
    .single();
  if (error) throw error;
  return data as Student;
}

export async function deleteStudent(id: string) {
  await supabase.from("attempts").delete().eq("student_id", id);
  await supabase.from("sessions").delete().eq("student_id", id);
  const { error } = await supabase.from("students").delete().eq("id", id);
  if (error) throw error;
}

export async function updateStudent(id: string, patch: Partial<Student>) {
  const { error } = await supabase
    .from("students")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function logAttempt(args: {
  studentId: string;
  tableNum: number;
  multiplier: number;
  correct: boolean;
  questionType: string;
}) {
  await supabase.from("attempts").insert({
    student_id: args.studentId,
    table_num: args.tableNum,
    multiplier: args.multiplier,
    correct: args.correct,
    question_type: args.questionType,
  });
}

export type Activity = "multiplication" | "division";

export async function startSession(
  studentId: string,
  level: number,
  activity: Activity = "multiplication",
) {
  const { data, error } = await supabase
    .from("sessions")
    .insert({ student_id: studentId, level_at_start: level, level_at_end: level, activity })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateSession(
  id: string,
  patch: { correct_count?: number; wrong_count?: number; level_at_end?: number; ended_at?: string },
) {
  await supabase.from("sessions").update(patch).eq("id", id);
}

export async function listStudents(): Promise<Student[]> {
  const { data, error } = await supabase
    .from("students")
    .select(SAFE_COLS)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Student[];
}

export interface RankingEntry {
  id: string;
  first_name: string;
  class_name: string | null;
  grade: string | null;
  total_correct: number;
  total_wrong: number;
  accuracy: number;
  active_days: number;
  score: number;
}

const RANK_WEIGHTS = { correct: 0.45, answered: 0.25, frequency: 0.30 };

async function rankStudentsWeighted(rows: Student[]): Promise<RankingEntry[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const { data: sessions } = await supabase
    .from("sessions")
    .select("student_id, started_at")
    .in("student_id", ids);

  const daysByStudent = new Map<string, Set<string>>();
  for (const s of sessions ?? []) {
    const day = (s.started_at as string).slice(0, 10);
    if (!daysByStudent.has(s.student_id)) daysByStudent.set(s.student_id, new Set());
    daysByStudent.get(s.student_id)!.add(day);
  }

  const base = rows.map((s) => {
    const answered = s.total_correct + s.total_wrong;
    const accuracy = answered > 0 ? (s.total_correct / answered) * 100 : 0;
    return {
      id: s.id,
      first_name: s.first_name,
      class_name: s.class_name,
      grade: s.grade,
      total_correct: s.total_correct,
      total_wrong: s.total_wrong,
      answered,
      accuracy,
      activeDays: daysByStudent.get(s.id)?.size ?? 0,
    };
  }).filter((e) => e.answered > 0);

  if (base.length === 0) return [];

  const maxCorrect = Math.max(...base.map((b) => b.total_correct), 1);
  const maxAnswered = Math.max(...base.map((b) => b.answered), 1);
  const maxDays = Math.max(...base.map((b) => b.activeDays), 1);

  return base
    .map((b) => {
      const raw =
        RANK_WEIGHTS.correct * (b.total_correct / maxCorrect) +
        RANK_WEIGHTS.answered * (b.answered / maxAnswered) +
        RANK_WEIGHTS.frequency * (b.activeDays / maxDays);
      const accuracyBonus = 0.85 + (b.accuracy / 100) * 0.15;
      return {
        id: b.id,
        first_name: b.first_name,
        class_name: b.class_name,
        grade: b.grade,
        total_correct: b.total_correct,
        total_wrong: b.total_wrong,
        accuracy: Math.round(b.accuracy),
        active_days: b.activeDays,
        score: Math.round(raw * accuracyBonus * 1000),
      };
    })
    .sort((a, b) => b.score - a.score);
}

export async function getClassRanking(className: string | null, grade: string | null): Promise<RankingEntry[]> {
  let q = supabase.from("students").select(SAFE_COLS);
  if (className) q = q.eq("class_name", className);
  else q = q.is("class_name", null);
  if (grade) q = q.eq("grade", grade);
  const { data } = await q;
  return rankStudentsWeighted(((data ?? []) as Student[]));
}

export async function getOverallRanking(): Promise<RankingEntry[]> {
  const { data } = await supabase.from("students").select(SAFE_COLS);
  return rankStudentsWeighted(((data ?? []) as Student[]));
}

export interface TableStat {
  table_num: number;
  correct: number;
  wrong: number;
}

const MULT_TYPES = ["choose_result", "choose_operation"];

export async function getStudentStats(studentId: string) {
  const { data: attempts } = await supabase
    .from("attempts")
    .select("table_num, correct, question_type")
    .eq("student_id", studentId);

  const buildTableStats = (rows: typeof attempts) => {
    const map = new Map<number, TableStat>();
    for (const a of rows ?? []) {
      const s = map.get(a.table_num) ?? { table_num: a.table_num, correct: 0, wrong: 0 };
      if (a.correct) s.correct++;
      else s.wrong++;
      map.set(a.table_num, s);
    }
    return [...map.values()].sort((x, y) => y.wrong - x.wrong);
  };

  const multAttempts = (attempts ?? []).filter((a) => MULT_TYPES.includes(a.question_type));
  const divAttempts = (attempts ?? []).filter((a) => a.question_type === "division");

  const tableStatsMult = buildTableStats(multAttempts);
  const tableStatsDiv = buildTableStats(divAttempts);

  const { data: sessions } = await supabase
    .from("sessions")
    .select("*")
    .eq("student_id", studentId)
    .order("started_at", { ascending: false })
    .limit(50);

  const all = sessions ?? [];
  const sessionsMult = all.filter((s) => (s.activity ?? "multiplication") === "multiplication");
  const sessionsDiv = all.filter((s) => s.activity === "division");

  const sumCorrect = (rows: typeof all) => rows.reduce((acc, s) => acc + (s.correct_count ?? 0), 0);
  const sumWrong = (rows: typeof all) => rows.reduce((acc, s) => acc + (s.wrong_count ?? 0), 0);

  return {
    tableStats: tableStatsMult,
    sessions: all,
    multiplication: {
      tableStats: tableStatsMult,
      sessions: sessionsMult,
      totalCorrect: sumCorrect(sessionsMult),
      totalWrong: sumWrong(sessionsMult),
    },
    division: {
      tableStats: tableStatsDiv,
      sessions: sessionsDiv,
      totalCorrect: sumCorrect(sessionsDiv),
      totalWrong: sumWrong(sessionsDiv),
    },
  };
}
