// Data access layer wrapping Supabase queries for students/sessions/attempts.
import { supabase } from "@/integrations/supabase/client";

export interface Student {
  id: string;
  first_name: string;
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
    .select("*")
    .ilike("first_name", name)
    .maybeSingle();
  if (existing) {
    // Update enrollment info if provided and changed
    if (enrollment && (enrollment.grade || enrollment.class_name || enrollment.shift)) {
      const patch: { grade?: string; class_name?: string; shift?: string } = {};
      if (enrollment.grade && enrollment.grade !== existing.grade) patch.grade = enrollment.grade;
      if (enrollment.class_name && enrollment.class_name !== existing.class_name) patch.class_name = enrollment.class_name;
      if (enrollment.shift && enrollment.shift !== existing.shift) patch.shift = enrollment.shift;
      if (Object.keys(patch).length > 0) {
        const { data: updated } = await supabase
          .from("students")
          .update(patch)
          .eq("id", existing.id)
          .select("*")
          .single();
        if (updated) return updated as Student;
      }
    }
    return existing as Student;
  }

  const { data, error } = await supabase
    .from("students")
    .insert({ first_name: name, ...(enrollment ?? {}) })
    .select("*")
    .single();
  if (error) throw error;
  return data as Student;
}

export async function deleteStudent(id: string) {
  // Remove dependentes primeiro para evitar órfãos
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

export async function startSession(studentId: string, level: number) {
  const { data, error } = await supabase
    .from("sessions")
    .insert({ student_id: studentId, level_at_start: level, level_at_end: level })
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

export async function getTeacherPassword(): Promise<string> {
  const { data } = await supabase.from("teacher_settings").select("password").eq("id", 1).single();
  return (data?.password as string) ?? "140799";
}

export async function setTeacherPassword(newPassword: string) {
  const { error } = await supabase
    .from("teacher_settings")
    .update({ password: newPassword, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw error;
}

export async function listStudents(): Promise<Student[]> {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Student[];
}

export interface TableStat {
  table_num: number;
  correct: number;
  wrong: number;
}

export async function getStudentStats(studentId: string) {
  const { data: attempts } = await supabase
    .from("attempts")
    .select("table_num, correct")
    .eq("student_id", studentId);

  const map = new Map<number, TableStat>();
  for (const a of attempts ?? []) {
    const s = map.get(a.table_num) ?? { table_num: a.table_num, correct: 0, wrong: 0 };
    if (a.correct) s.correct++;
    else s.wrong++;
    map.set(a.table_num, s);
  }
  const tableStats = [...map.values()].sort((x, y) => y.wrong - x.wrong);

  const { data: sessions } = await supabase
    .from("sessions")
    .select("*")
    .eq("student_id", studentId)
    .order("started_at", { ascending: false })
    .limit(20);

  return { tableStats, sessions: sessions ?? [] };
}
