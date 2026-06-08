// Desafio da Semana: gera problemas fixos por semana ISO (mesma sequência
// para todos os alunos naquela semana) e gerencia selo/streak por aluno.
import { supabase } from "@/integrations/supabase/client";

export interface WeeklyProblem {
  a: number;
  b: number;
  answer: number;
  options: number[]; // 3 opções
}

export interface WeeklyDivProblem {
  dividend: number;
  divisor: number;
  quotient: number;
  remainder: number;
  options: number[]; // 3 opções para o quociente
  level: 1 | 2 | 3;
  levelLabel: string;
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

export const WEEKLY_MULT_TOTAL = 10;
export const WEEKLY_DIV_TOTAL = 9; // 3 por nível
export const WEEKLY_TOTAL = WEEKLY_MULT_TOTAL + WEEKLY_DIV_TOTAL;
export const WEEKLY_MULT_TIMER = 4; // segundos

// Gera 10 problemas de multiplicação (tabuadas 2 a 9, mult. 0 a 10), 3 opções.
export function generateWeeklyProblems(year: number, week: number): WeeklyProblem[] {
  const seed = year * 100 + week;
  const rnd = mulberry32(seed);
  const rint = (n: number) => Math.floor(rnd() * n);

  const problems: WeeklyProblem[] = [];
  const seen = new Set<string>();
  while (problems.length < WEEKLY_MULT_TOTAL) {
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

// Gera 9 problemas de divisão (3 por nível) determinísticos pela semana.
// Nível 1: 3 algarismos no dividendo, divisor 2..9
// Nível 2: 4 algarismos no dividendo, divisor 2..9
// Nível 3: quociente contém 0 (intermediário)
export function generateWeeklyDivProblems(year: number, week: number): WeeklyDivProblem[] {
  const seed = year * 100 + week + 7777;
  const rnd = mulberry32(seed);
  const rint = (n: number) => Math.floor(rnd() * n);

  const out: WeeklyDivProblem[] = [];

  const mkOptions = (q: number): number[] => {
    const opts = new Set<number>([q]);
    while (opts.size < 3) {
      const delta = (rint(5) + 1) * (rnd() < 0.5 ? -1 : 1);
      const cand = Math.max(0, q + delta);
      if (cand !== q) opts.add(cand);
    }
    const arr = [...opts];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = rint(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const makeLevel = (level: 1 | 2 | 3, label: string) => {
    let tries = 0;
    while (tries++ < 300) {
      const divisor = 2 + rint(8);
      let dividend = 0;
      if (level === 1) {
        dividend = 100 + rint(900);
      } else if (level === 2) {
        dividend = 1000 + rint(9000);
      } else {
        // Quociente com 0 em posição interna
        const total = 3 + rint(2); // 3 ou 4 dígitos
        let qStr = String(1 + rint(9));
        const zeroPos = 1 + rint(total - 2);
        for (let i = 1; i < total; i++) {
          qStr += i === zeroPos ? "0" : String(rint(10));
        }
        const q = parseInt(qStr, 10);
        dividend = q * divisor + rint(divisor);
      }
      const quotient = Math.floor(dividend / divisor);
      const remainder = dividend - quotient * divisor;
      if (level === 3 && !String(quotient).includes("0")) continue;
      if (quotient < 1) continue;
      out.push({
        dividend,
        divisor,
        quotient,
        remainder,
        options: mkOptions(quotient),
        level,
        levelLabel: label,
      });
      return;
    }
  };

  for (let i = 0; i < 3; i++) makeLevel(1, "3 algarismos");
  for (let i = 0; i < 3; i++) makeLevel(2, "4 algarismos");
  for (let i = 0; i < 3; i++) makeLevel(3, "com 0 no quociente");
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
  if (records.length === 0) return 0;
  const set = new Set(records.map((r) => `${r.year}-${r.week}`));
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
