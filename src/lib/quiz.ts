// Quiz engine: generates questions and manages levels/streaks for the multiplication app.
// EJA-friendly. Levels add a new times-table progressively.

export type QuestionType = "choose_result" | "choose_operation" | "match_pairs";

export type Question =
  | {
      type: "choose_result";
      tableNum: number;
      multiplier: number;
      a: number;
      b: number;
      answer: number;
      options: number[];
    }
  | {
      type: "choose_operation";
      tableNum: number;
      multiplier: number;
      a: number;
      b: number;
      answer: number; // result shown
      options: { a: number; b: number; label: string }[];
      correctIndex: number;
    };

export interface LevelDef {
  level: number;
  tables: number[]; // which times-tables are in play
  streakRequired: number; // consecutive correct to advance
  newTable?: number; // the table newly introduced at this level
}

// Level 1: tables 2,3,4 → 12 streak
// Level 2: + 5 → 17
// Level 3: + 6 → 22
// Level 4: + 7 → 27
// Level 5: + 8 → 32
// Level 6: + 9 → 37 (final)
export const LEVELS: LevelDef[] = [
  { level: 1, tables: [2, 3, 4], streakRequired: 12 },
  { level: 2, tables: [2, 3, 4, 5], streakRequired: 17, newTable: 5 },
  { level: 3, tables: [2, 3, 4, 5, 6], streakRequired: 22, newTable: 6 },
  { level: 4, tables: [2, 3, 4, 5, 6, 7], streakRequired: 27, newTable: 7 },
  { level: 5, tables: [2, 3, 4, 5, 6, 7, 8], streakRequired: 32, newTable: 8 },
  { level: 6, tables: [2, 3, 4, 5, 6, 7, 8, 9], streakRequired: 37, newTable: 9 },
];

export const TIMER_SECONDS = 7;

function rand(n: number) {
  return Math.floor(Math.random() * n);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function uniqueDistractors(answer: number, count: number, max: number): number[] {
  const set = new Set<number>();
  while (set.size < count) {
    // Distractors close to the real answer for plausibility
    const delta = rand(6) + 1;
    const sign = Math.random() < 0.5 ? -1 : 1;
    let candidate = answer + sign * delta;
    if (candidate < 0 || candidate === answer) {
      candidate = Math.max(0, answer + (rand(max) % max));
    }
    if (candidate !== answer) set.add(candidate);
  }
  return [...set];
}

export function generateQuestion(level: LevelDef, prefer?: QuestionType): Question {
  const tableNum = level.tables[rand(level.tables.length)];
  const multiplier = rand(11); // 0..10 (full table including 0)
  const a = tableNum;
  const b = multiplier;
  const answer = a * b;

  // 30% association (choose_operation), else choose_result
  const type: QuestionType =
    prefer ?? (Math.random() < 0.3 ? "choose_operation" : "choose_result");

  if (type === "choose_operation") {
    // Show the result; pick the correct multiplication
    const distractors: { a: number; b: number }[] = [];
    const tries = new Set<string>([`${a}x${b}`]);
    while (distractors.length < 2) {
      const ta = level.tables[rand(level.tables.length)];
      const tb = rand(11);
      const key = `${ta}x${tb}`;
      if (!tries.has(key) && ta * tb !== answer) {
        tries.add(key);
        distractors.push({ a: ta, b: tb });
      }
    }
    const all = shuffle([{ a, b }, ...distractors]);
    const correctIndex = all.findIndex((o) => o.a === a && o.b === b);
    return {
      type: "choose_operation",
      tableNum,
      multiplier,
      a,
      b,
      answer,
      options: all.map((o) => ({ a: o.a, b: o.b, label: `${o.a} × ${o.b}` })),
      correctIndex,
    };
  }

  // choose_result
  const distractors = uniqueDistractors(answer, 2, 90);
  const options = shuffle([answer, ...distractors]);
  return {
    type: "choose_result",
    tableNum,
    multiplier,
    a,
    b,
    answer,
    options,
  };
}

export function getLevel(n: number): LevelDef {
  return LEVELS[Math.min(LEVELS.length - 1, Math.max(0, n - 1))];
}
