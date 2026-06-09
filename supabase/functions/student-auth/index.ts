// Student authentication: login, password set, security-question reset, and
// student/visitor creation with hashing. Uses pgcrypto bcrypt; keeps backward
// compatibility with the legacy client-side SHA-256(tabuada:name:password) hash.
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

// Legacy SHA-256 hash for backward compatibility with old accounts.
async function legacyHash(name: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(
    `tabuada:${name.trim().toLowerCase()}:${password.toLowerCase()}`,
  );
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function bcryptHash(password: string): Promise<string> {
  const { data, error } = await admin.rpc("bcrypt_hash", { p_password: password });
  if (error || !data) throw new Error("hash failed");
  return data as string;
}

async function verifyHash(password: string, name: string, storedHash: string): Promise<boolean> {
  // bcrypt hash starts with $2
  if (storedHash.startsWith("$2")) {
    const { data, error } = await admin.rpc("verify_bcrypt", { p_password: password, p_hash: storedHash });
    if (error) return false;
    return !!data;
  }
  const legacy = await legacyHash(name, password);
  return legacy === storedHash;
}

function safeStudent(row: Record<string, unknown>) {
  const {
    password_hash: _h,
    birth_year: _y,
    favorite_color: _c,
    favorite_subject: _s,
    ...safe
  } = row;
  return safe;
}

// Stricter security-answer normalization
function normColor(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const action = String(body.action ?? "");

  try {
    if (action === "login") {
      const username = String(body.username ?? "").trim();
      const password = String(body.password ?? "");
      if (!username || !password) return json({ error: "missing_fields" }, 400);
      const { data: student } = await admin
        .from("students")
        .select("*")
        .ilike("username", username)
        .maybeSingle();
      if (!student || !student.password_hash) return json({ error: "invalid_credentials" }, 401);
      const ok = await verifyHash(password, student.first_name, student.password_hash);
      if (!ok) return json({ error: "invalid_credentials" }, 401);
      // Opportunistically upgrade legacy hash to bcrypt
      if (!student.password_hash.startsWith("$2")) {
        try {
          const newHash = await bcryptHash(password);
          await admin.from("students").update({ password_hash: newHash }).eq("id", student.id);
        } catch (e) {
          console.warn("upgrade hash failed", e);
        }
      }
      return json({ student: safeStudent(student) });
    }

    if (action === "set_password_first_time") {
      // Used for students who never set a password yet OR are visitor signups.
      // Looks up by name+enrollment server-side.
      const firstName = String(body.firstName ?? "").trim();
      const grade = body.grade == null ? null : String(body.grade);
      const className = body.className == null ? null : String(body.className);
      const shift = body.shift == null ? null : String(body.shift);
      const password = String(body.password ?? "");
      const birthYear = Number(body.birthYear);
      const favoriteColor = String(body.favoriteColor ?? "");
      const favoriteSubject = String(body.favoriteSubject ?? "");
      if (!firstName || password.length < 6 || !Number.isInteger(birthYear) || !favoriteColor || !favoriteSubject)
        return json({ error: "invalid_input" }, 400);

      let q = admin.from("students").select("*").ilike("first_name", firstName);
      if (grade) q = q.eq("grade", grade); else q = q.is("grade", null);
      if (className) q = q.eq("class_name", className); else q = q.is("class_name", null);
      if (shift) q = q.eq("shift", shift); else q = q.is("shift", null);
      const { data: student } = await q.maybeSingle();
      if (!student) return json({ error: "not_found" }, 404);
      if (student.password_hash)
        return json({ error: "already_has_password" }, 409);

      const username = await pickAvailableUsername(student.first_name, birthYear, student.id);
      const hash = await bcryptHash(password);
      const { error } = await admin
        .from("students")
        .update({
          password_hash: hash,
          username,
          birth_year: birthYear,
          favorite_color: normColor(favoriteColor),
          favorite_subject: favoriteSubject,
          updated_at: new Date().toISOString(),
        })
        .eq("id", student.id);
      if (error) throw error;
      return json({ username, studentId: student.id });
    }

    if (action === "reset_password_with_security") {
      // Forgot-password flow: verify the 3 security answers against the
      // stored values (which are no longer publicly readable), then set new pwd.
      const firstName = String(body.firstName ?? "").trim();
      const grade = body.grade == null ? null : String(body.grade);
      const className = body.className == null ? null : String(body.className);
      const shift = body.shift == null ? null : String(body.shift);
      const newPassword = String(body.newPassword ?? "");
      const birthYear = Number(body.birthYear);
      const favoriteColor = String(body.favoriteColor ?? "");
      const favoriteSubject = String(body.favoriteSubject ?? "");
      if (!firstName || newPassword.length < 6 || !Number.isInteger(birthYear))
        return json({ error: "invalid_input" }, 400);

      let q = admin.from("students").select("*").ilike("first_name", firstName);
      if (grade) q = q.eq("grade", grade); else q = q.is("grade", null);
      if (className) q = q.eq("class_name", className); else q = q.is("class_name", null);
      if (shift) q = q.eq("shift", shift); else q = q.is("shift", null);
      const { data: student } = await q.maybeSingle();
      if (!student) return json({ error: "not_found" }, 404);

      // Require ALL three security values to be set and to match. Legacy
      // accounts without color/subject CANNOT use this flow — teacher must reset.
      if (!student.birth_year || !student.favorite_color || !student.favorite_subject)
        return json({ error: "no_security_answers" }, 403);
      const yrOk = student.birth_year === birthYear;
      const colorOk = student.favorite_color === normColor(favoriteColor);
      const subjOk = student.favorite_subject === favoriteSubject;
      if (!yrOk || !colorOk || !subjOk) return json({ error: "wrong_answers" }, 401);

      const username = student.username ?? (await pickAvailableUsername(student.first_name, birthYear, student.id));
      const hash = await bcryptHash(newPassword);
      const { error } = await admin
        .from("students")
        .update({
          password_hash: hash,
          username,
          birth_year: birthYear,
          updated_at: new Date().toISOString(),
        })
        .eq("id", student.id);
      if (error) throw error;
      return json({ username, studentId: student.id });
    }

    if (action === "create_visitor") {
      const fullName = String(body.fullName ?? "").trim().replace(/\s+/g, " ");
      const password = String(body.password ?? "");
      const birthYear = Number(body.birthYear);
      const favoriteColor = String(body.favoriteColor ?? "");
      const favoriteSubject = String(body.favoriteSubject ?? "");
      if (fullName.length < 2 || password.length < 6 || !Number.isInteger(birthYear) || !favoriteColor || !favoriteSubject)
        return json({ error: "invalid_input" }, 400);

      const username = await pickAvailableUsername(fullName, birthYear);
      const hash = await bcryptHash(password);
      const { data: row, error } = await admin
        .from("students")
        .insert({
          first_name: fullName,
          password_hash: hash,
          username,
          birth_year: birthYear,
          favorite_color: normColor(favoriteColor),
          favorite_subject: favoriteSubject,
          grade: "Visitante",
          class_name: null,
          shift: null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return json({ student: safeStudent(row as Record<string, unknown>), username });
    }

    if (action === "create_student_with_password") {
      // Teacher-only path: requires teacher token.
      const token = String(body.token ?? "");
      const validToken = await verifyTeacherToken(token);
      if (!validToken) return json({ error: "unauthorized" }, 401);
      const firstName = String(body.firstName ?? "").trim();
      const password = String(body.password ?? "");
      const grade = body.grade == null ? null : String(body.grade);
      const className = body.className == null ? null : String(body.className);
      const shift = body.shift == null ? null : String(body.shift);
      if (!firstName || password.length < 6) return json({ error: "invalid_input" }, 400);
      const hash = await bcryptHash(password);
      const { data: row, error } = await admin
        .from("students")
        .insert({ first_name: firstName, password_hash: hash, grade, class_name: className, shift })
        .select("*")
        .single();
      if (error) throw error;
      return json({ student: safeStudent(row as Record<string, unknown>) });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "server_error" }, 500);
  }
});

async function verifyTeacherToken(token: string): Promise<boolean> {
  if (!token) return false;
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SERVICE_ROLE),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expectedBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(expectedBuf)))
    .replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  if (expected !== sig) return false;
  try {
    const padded = body + (body.length % 4 === 0 ? "" : "=".repeat(4 - (body.length % 4)));
    const json = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json);
    return payload?.role === "teacher" && typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
