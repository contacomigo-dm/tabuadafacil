// Teacher authentication: login (bcrypt verify via pgcrypto), session token,
// password change, and student password reset (admin-only).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function b64urlEncode(s: string): string {
  return btoa(s).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
}
async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SERVICE_ROLE),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return b64urlEncode(String.fromCharCode(...new Uint8Array(sig)));
}
async function signToken(): Promise<string> {
  // 8h validity
  const payload = JSON.stringify({ role: "teacher", exp: Date.now() + 8 * 60 * 60 * 1000 });
  const body = b64urlEncode(payload);
  const sig = await hmac(body);
  return `${body}.${sig}`;
}
async function verifyToken(token: string | null | undefined): Promise<boolean> {
  if (!token) return false;
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;
  const expected = await hmac(body);
  if (expected !== sig) return false;
  try {
    const payload = JSON.parse(b64urlDecode(body));
    return payload?.role === "teacher" && typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

// Run a one-shot SQL via Postgres function fallback. We use RPC-less approach:
// PostgREST doesn't allow raw SQL, so we expose a security-definer function.
// To avoid a separate function, we use `from('teacher_settings')` with computed
// columns. For password verification, use a security-definer fn we create here.

async function verifyTeacherPassword(password: string): Promise<boolean> {
  // Use RPC to a security-definer function we set up below
  const { data, error } = await admin.rpc("verify_teacher_password", { p_password: password });
  if (error) {
    console.error("verify_teacher_password rpc error", error);
    return false;
  }
  return !!data;
}

async function changeTeacherPassword(currentPassword: string, newPassword: string): Promise<boolean> {
  const { data, error } = await admin.rpc("change_teacher_password", {
    p_current: currentPassword,
    p_new: newPassword,
  });
  if (error) {
    console.error("change_teacher_password rpc error", error);
    return false;
  }
  return !!data;
}

async function resetStudentPassword(studentId: string): Promise<void> {
  const { error } = await admin
    .from("students")
    .update({
      password_hash: null,
      username: null,
      birth_year: null,
      favorite_color: null,
      favorite_subject: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", studentId);
  if (error) throw error;
}

const STOP_WORDS = new Set(["da", "de", "di", "do", "du", "das", "dos", "e"]);
function buildUsernameBase(fullName: string): string {
  return fullName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w))
    .map((w) => w[0])
    .join("");
}

async function pickAvailableUsername(
  fullName: string,
  birthYear: number | null,
  excludeId?: string,
): Promise<string> {
  const base = buildUsernameBase(fullName) || "aluno";
  const root = `${base}${birthYear ? String(birthYear) : ""}`;
  for (let i = 1; i < 999; i++) {
    const candidate = i === 1 ? root : `${root}-${i}`;
    let q = admin.from("students").select("id").ilike("username", candidate);
    if (excludeId) q = q.neq("id", excludeId);
    const { data } = await q.maybeSingle();
    if (!data) return candidate;
  }
  return `${root}-${Date.now()}`;
}

async function bcryptHash(password: string): Promise<string> {
  const { data, error } = await admin.rpc("bcrypt_hash", { p_password: password });
  if (error || !data) throw new Error("hash failed");
  return data as string;
}

async function setStudentCredentials(args: {
  studentId: string;
  password: string;
  birthYear: number;
}): Promise<{ username: string }> {
  const { data: student, error: e1 } = await admin
    .from("students")
    .select("id, first_name")
    .eq("id", args.studentId)
    .maybeSingle();
  if (e1) throw e1;
  if (!student) throw new Error("not_found");
  const username = await pickAvailableUsername(student.first_name, args.birthYear, student.id);
  const hash = await bcryptHash(args.password);
  const { error } = await admin
    .from("students")
    .update({
      password_hash: hash,
      username,
      birth_year: args.birthYear,
      updated_at: new Date().toISOString(),
    })
    .eq("id", student.id);
  if (error) throw error;
  return { username };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const action = String(body.action ?? "");

  try {
    if (action === "login") {
      const password = String(body.password ?? "");
      if (!password) return json({ error: "missing password" }, 400);
      const ok = await verifyTeacherPassword(password);
      if (!ok) return json({ error: "invalid_password" }, 401);
      const token = await signToken();
      return json({ token });
    }

    if (action === "verify") {
      const token = String(body.token ?? "");
      return json({ ok: await verifyToken(token) });
    }

    if (action === "change_password") {
      const token = String(body.token ?? "");
      if (!(await verifyToken(token))) return json({ error: "unauthorized" }, 401);
      const current = String(body.currentPassword ?? "");
      const next = String(body.newPassword ?? "");
      if (next.length < 6) return json({ error: "weak_password" }, 400);
      const ok = await changeTeacherPassword(current, next);
      if (!ok) return json({ error: "invalid_current" }, 401);
      return json({ ok: true });
    }

    if (action === "reset_student") {
      const token = String(body.token ?? "");
      if (!(await verifyToken(token))) return json({ error: "unauthorized" }, 401);
      const studentId = String(body.studentId ?? "");
      if (!studentId) return json({ error: "missing studentId" }, 400);
      await resetStudentPassword(studentId);
      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "server_error" }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
