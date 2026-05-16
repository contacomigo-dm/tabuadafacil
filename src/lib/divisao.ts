// Engine for guided long-division ("conta armada") by a 1-digit divisor.
// Walks through every micro-step: pick quotient digit, verify multiplication,
// subtract, and bring down the next digit. Tracks dica-progressivo on errors.

export type StepKind = "quotient" | "subtract";

export interface DivisionStep {
  kind: StepKind;
  // Index of the digit (0-based, left to right) that this step relates to in the dividend.
  digitIndex: number;
  // The "current chunk" the student must divide (e.g. when bringing down 1 after 3, chunk = 31).
  chunk: number;
  // Correct quotient digit for this chunk
  correctQuotient: number;
  // What chunk - (correctQuotient * divisor) equals (the remainder/subtraction result)
  correctRemainder: number;
}

export interface DivisionPlan {
  dividend: number;
  divisor: number;
  dividendDigits: number[]; // each digit
  steps: DivisionStep[];
  finalQuotient: number;
  finalRemainder: number;
}

/** Build a step-by-step plan for dividend / divisor (divisor 2..9). */
export function buildPlan(dividend: number, divisor: number): DivisionPlan {
  if (divisor < 2 || divisor > 9) throw new Error("Divisor must be 1 digit (2..9)");
  if (dividend < 0) throw new Error("Dividend must be >= 0");

  const digits = String(dividend).split("").map(Number);
  const steps: DivisionStep[] = [];
  let chunk = 0;
  let started = false; // we only emit steps once chunk >= divisor for the first time
  let quotientStr = "";

  for (let i = 0; i < digits.length; i++) {
    chunk = chunk * 10 + digits[i];
    if (!started && chunk < divisor) {
      // Leading zeros are not normally written; skip emitting a step
      // but if this is the only digit, we still must emit one (e.g. 3 / 6 = 0 r 3)
      if (i === digits.length - 1) {
        const q = 0;
        const r = chunk;
        steps.push({
          kind: "quotient",
          digitIndex: i,
          chunk,
          correctQuotient: q,
          correctRemainder: r,
        });
        quotientStr += String(q);
        chunk = r;
        started = true;
      }
      continue;
    }
    started = true;
    const q = Math.floor(chunk / divisor);
    const r = chunk - q * divisor;
    steps.push({
      kind: "quotient",
      digitIndex: i,
      chunk,
      correctQuotient: q,
      correctRemainder: r,
    });
    quotientStr += String(q);
    chunk = r;
  }

  return {
    dividend,
    divisor,
    dividendDigits: digits,
    steps,
    finalQuotient: Number(quotientStr || "0"),
    finalRemainder: chunk,
  };
}

/** Generate a random dividend with N digits (no leading zero). */
export function randomDividend(numDigits: number): number {
  if (numDigits < 1) numDigits = 1;
  const min = numDigits === 1 ? 0 : Math.pow(10, numDigits - 1);
  const max = Math.pow(10, numDigits) - 1;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomDivisor(): number {
  return 2 + Math.floor(Math.random() * 8); // 2..9
}

export interface DivisionLevel {
  level: number;
  digits: number; // dividend digits
  problemsToAdvance: number;
  label: string;
}

export const DIVISION_LEVELS: DivisionLevel[] = [
  { level: 1, digits: 2, problemsToAdvance: 3, label: "Iniciante (2 algarismos)" },
  { level: 2, digits: 3, problemsToAdvance: 3, label: "Intermediário (3 algarismos)" },
  { level: 3, digits: 4, problemsToAdvance: 3, label: "Avançado (4 algarismos)" },
  { level: 4, digits: 5, problemsToAdvance: 3, label: "Mestre (5 algarismos)" },
];

export function getDivisionLevel(n: number): DivisionLevel {
  return DIVISION_LEVELS[Math.min(DIVISION_LEVELS.length - 1, Math.max(0, n - 1))];
}

/** Quantos níveis o aluno já desbloqueou (localStorage por aluno). */
export function getDivisionUnlockedLevel(studentId: string | null): number {
  if (typeof window === "undefined" || !studentId) return 1;
  const raw = window.localStorage.getItem(`divUnlockedLevel:${studentId}`);
  const n = raw ? parseInt(raw, 10) : 1;
  return Number.isFinite(n) && n >= 1 ? Math.min(n, DIVISION_LEVELS.length) : 1;
}

export function setDivisionUnlockedLevel(studentId: string | null, level: number) {
  if (typeof window === "undefined" || !studentId) return;
  const current = getDivisionUnlockedLevel(studentId);
  const next = Math.max(current, Math.min(level, DIVISION_LEVELS.length));
  window.localStorage.setItem(`divUnlockedLevel:${studentId}`, String(next));
}

/** Produce a friendly hint based on the chunk and divisor. */
export function quotientHint(chunk: number, divisor: number, attempt: number): string {
  const correct = Math.floor(chunk / divisor);
  if (attempt === 1) {
    // Soft hint: range
    if (correct === 0) {
      return `Lembre: ${chunk} é menor que ${divisor}, então cabe 0 vez.`;
    }
    return `Pense: quantas vezes o ${divisor} cabe em ${chunk}? Tente um número entre ${Math.max(0, correct - 1)} e ${correct + 1}.`;
  }
  // Stronger hint on 2nd error: show the answer
  return `A resposta é ${correct}, porque ${correct} × ${divisor} = ${correct * divisor} (e ${correct + 1} × ${divisor} = ${(correct + 1) * divisor} já passa de ${chunk}).`;
}

export function remainderHint(chunk: number, q: number, divisor: number, attempt: number): string {
  const product = q * divisor;
  const correct = chunk - product;
  if (attempt === 1) {
    return `Faça a subtração: ${chunk} − ${product} = ?`;
  }
  return `A resposta é ${correct}: ${chunk} − ${product} = ${correct}.`;
}
