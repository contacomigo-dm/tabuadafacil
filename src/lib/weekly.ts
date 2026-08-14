// Desafio da Semana: gera problemas fixos por semana ISO (mesma sequência
// para todos os alunos naquela semana) e gerencia selo/streak por aluno.
import { supabase } from "@/integrations/supabase/client";

export interface WeeklyProblem {
  a: number;
  b: number;
  answer: number;
  options: number[]; // 3 opções
}

export interface WeeklyDivSetup {
  dividend: number;
  divisor: number;
  digits: number;
  label: string;
}

export interface WeeklyRecord {
  id: string;
  student_id: string;
  year: number;
  week: number;
  correct_count: number;
  wrong_count: number;
  total_questions: number;
  completed_at: string;
}

// Formatos aceitos de desafio concluído: o atual (15+3=18) e os antigos
// (20+5=25 e 20). Registros antigos continuam valendo como concluídos.
const ACCEPTED_WEEKLY_TOTALS = [18, 25, 20];

export function isWeeklyRecordComplete(
  record: WeeklyRecord | null | undefined,
): record is WeeklyRecord {
  return Boolean(
    record &&
      ACCEPTED_WEEKLY_TOTALS.includes(record.total_questions) &&
      record.correct_count + record.wrong_count === record.total_questions,
  );
}

// ISO week number (semana começa segunda-feira).
export function getISOWeek(d: Date = new Date()): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((+date - +yearStart) / 86400000 + 1) / 7);
  return { year: date.getUTCFullYear(), week };
}

// PRNG simples (mulberry32) com seed determinístico baseado em ano+semana.
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const WEEKLY_MULT_TOTAL = 15;
export const WEEKLY_DIV_TOTAL = 3;
export const WEEKLY_TOTAL = WEEKLY_MULT_TOTAL + WEEKLY_DIV_TOTAL;
export const WEEKLY_MULT_TIMER = 4; // segundos

// Gera 20 problemas de multiplicação (tabuadas 2 a 9, mult. 0 a 10), 3 opções.
export function generateWeeklyProblems(year: number, week: number): WeeklyProblem[] {
  const seed = year * 100 + week;
  const rnd = mulberry32(seed);
  const rint = (n: number) => Math.floor(rnd() * n);

  const problems: WeeklyProblem[] = [];
  const seen = new Set<string>();
  let safety = 0;
  while (problems.length < WEEKLY_MULT_TOTAL && safety++ < 5000) {
    const a = 2 + rint(8); // 2..9
    const b = rint(11); // 0..10
    const key = `${a}x${b}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const answer = a * b;
    const opts = new Set<number>([answer]);
    while (opts.size < 3) {
      const delta = (rint(6) + 1) * (rnd() < 0.5 ? -1 : 1);
      const cand = Math.max(0, answer + delta);
      if (cand !== answer) opts.add(cand);
    }
    const options = [...opts];
    for (let i = options.length - 1; i > 0; i--) {
      const j = rint(i + 1);
      [options[i], options[j]] = [options[j], options[i]];
    }
    problems.push({ a, b, answer, options });
  }
  return problems;
}

// Gera 5 contas de divisão longa (mesmo formato da aba Divisão),
// dificuldade crescente: 3, 3, 4, 4, 5 algarismos no dividendo.
export function generateWeeklyDivSetups(year: number, week: number): WeeklyDivSetup[] {
  const seed = year * 100 + week + 7777;
  const rnd = mulberry32(seed);
  const rint = (n: number) => Math.floor(rnd() * n);
  const digitsSeq: number[] = [3, 4, 5];
  const out: WeeklyDivSetup[] = [];
  for (const digits of digitsSeq) {
    let dividend = 0;
    let divisor = 0;
    let tries = 0;
    while (tries++ < 200) {
      divisor = 2 + rint(8); // 2..9
      const min = Math.pow(10, digits - 1);
      const max = Math.pow(10, digits) - 1;
      dividend = min + Math.floor(rnd() * (max - min + 1));
      // garantir que a conta não seja trivial
      if (Math.floor(dividend / divisor) >= 10) break;
    }
    out.push({
      dividend,
      divisor,
      digits,
      label: `${digits} algarismos`,
    });
  }
  return out;
}

export async function getWeeklyRecord(
  studentId: string,
  year: number,
  week: number,
): Promise<WeeklyRecord | null> {
  const { data } = await supabase
    .from("weekly_challenges")
    .select("*")
    .eq("student_id", studentId)
    .eq("year", year)
    .eq("week", week)
    .maybeSingle();
  return (data as WeeklyRecord | null) ?? null;
}

// Busca paginada: o backend limita a 1000 linhas por requisição, o que
// truncava o extrato por período e escondia semanas já concluídas.
const PAGE_SIZE = 1000;

async function fetchAllPages(
  build: () => ReturnType<typeof supabase.from>["select"] extends never ? never : any,
): Promise<WeeklyRecord[]> {
  const all: WeeklyRecord[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await build().range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as WeeklyRecord[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return all;
}

export async function listWeeklyRecordsForWeek(year: number, week: number): Promise<WeeklyRecord[]> {
  return fetchAllPages(() =>
    supabase
      .from("weekly_challenges")
      .select("*")
      .eq("year", year)
      .eq("week", week)
      .order("student_id", { ascending: true }),
  );
}

export async function listWeeklyRecordsForPeriod(
  year: number,
  startWeek: number,
  endWeek: number,
): Promise<WeeklyRecord[]> {
  const from = Math.min(startWeek, endWeek);
  const to = Math.max(startWeek, endWeek);
  return fetchAllPages(() =>
    supabase
      .from("weekly_challenges")
      .select("*")
      .eq("year", year)
      .gte("week", from)
      .lte("week", to)
      .order("week", { ascending: true })
      .order("student_id", { ascending: true }),
  );
}

export async function listWeeklyRecords(studentId: string): Promise<WeeklyRecord[]> {
  const { data } = await supabase
    .from("weekly_challenges")
    .select("*")
    .eq("student_id", studentId)
    .order("year", { ascending: false })
    .order("week", { ascending: false });
  return (data ?? []) as WeeklyRecord[];
}

export async function saveWeeklyRecord(
  studentId: string,
  year: number,
  week: number,
  correct: number,
  wrong: number,
): Promise<void> {
  if (correct + wrong !== WEEKLY_TOTAL) {
    throw new Error(
      `O desafio só pode ser concluído após as ${WEEKLY_MULT_TOTAL} multiplicações e ${WEEKLY_DIV_TOTAL} divisões.`,
    );
  }
  const { error } = await supabase.from("weekly_challenges").upsert(
    {
      student_id: studentId,
      year,
      week,
      correct_count: correct,
      wrong_count: wrong,
      total_questions: WEEKLY_TOTAL,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "student_id,year,week" },
  );
  if (error) throw error;
}

// Calcula sequência de semanas consecutivas concluídas.
export function computeStreak(records: WeeklyRecord[]): number {
  const completed = records.filter(isWeeklyRecordComplete);
  if (completed.length === 0) return 0;
  const set = new Set(completed.map((r) => `${r.year}-${r.week}`));
  const cur = getISOWeek();
  let { year, week } = cur;
  if (!set.has(`${year}-${week}`)) {
    const prev = prevWeek(year, week);
    year = prev.year;
    week = prev.week;
  }
  let streak = 0;
  while (set.has(`${year}-${week}`)) {
    streak++;
    const p = prevWeek(year, week);
    year = p.year;
    week = p.week;
  }
  return streak;
}

function prevWeek(year: number, week: number): { year: number; week: number } {
  if (week > 1) return { year, week: week - 1 };
  return { year: year - 1, week: weeksInYear(year - 1) };
}

function weeksInYear(year: number): number {
  const d = new Date(Date.UTC(year, 11, 28));
  return getISOWeek(d).week;
}
