// Temas visuais amazônicos. Cada tema troca um conjunto de tokens de cor
// (via [data-theme="..."] em styles.css) e expõe um banner ilustrado.
import { supabase } from "@/integrations/supabase/client";
import florestaBanner from "@/assets/theme-floresta.jpg";
import rioBanner from "@/assets/theme-rio.jpg";
import indigenaBanner from "@/assets/theme-indigena.jpg";
import ribeirinhoBanner from "@/assets/theme-ribeirinho.jpg";

export const THEMES = ["floresta", "rio", "indigena", "ribeirinho"] as const;
export type ThemeId = (typeof THEMES)[number];

export const THEME_META: Record<ThemeId, {
  label: string;
  emoji: string;
  description: string;
  banner: string;
}> = {
  floresta: {
    label: "Floresta",
    emoji: "🌳",
    description: "Verdes da mata e a onça-pintada.",
    banner: florestaBanner,
  },
  rio: {
    label: "Rio",
    emoji: "🐬",
    description: "Águas do rio Amazonas e o boto-cor-de-rosa.",
    banner: rioBanner,
  },
  indigena: {
    label: "Indígena / Quilombola",
    emoji: "🪶",
    description: "Grafismos terracota e tradições dos povos.",
    banner: indigenaBanner,
  },
  ribeirinho: {
    label: "Ribeirinho",
    emoji: "🛶",
    description: "Palafitas, canoa e o pôr-do-sol no rio.",
    banner: ribeirinhoBanner,
  },
};

const STORAGE_KEY = "studentTheme";

export function isTheme(v: unknown): v is ThemeId {
  return typeof v === "string" && (THEMES as readonly string[]).includes(v);
}

export function getActiveTheme(): ThemeId {
  if (typeof window === "undefined") return "floresta";
  const v = sessionStorage.getItem(STORAGE_KEY);
  return isTheme(v) ? v : "floresta";
}

export function applyTheme(theme: ThemeId) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  try {
    sessionStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

export async function loadStudentTheme(studentId: string): Promise<ThemeId> {
  const { data } = await supabase
    .from("students")
    .select("theme")
    .eq("id", studentId)
    .single();
  const t = (data as { theme?: string } | null)?.theme;
  return isTheme(t) ? t : "floresta";
}

export async function saveStudentTheme(studentId: string, theme: ThemeId): Promise<void> {
  await supabase.from("students").update({ theme }).eq("id", studentId);
  applyTheme(theme);
}
