import { useEffect, useState } from "react";

// Ajuste de tamanho de fonte global. Como o Tailwind usa rem,
// alterar o font-size do <html> escala todas as medidas tipográficas.
const SIZES = [
  { key: "sm", label: "A−", px: 14 },
  { key: "md", label: "A", px: 16 },
  { key: "lg", label: "A+", px: 19 },
  { key: "xl", label: "A++", px: 22 },
] as const;

type SizeKey = (typeof SIZES)[number]["key"];
const STORAGE_KEY = "tabuada:font-size";

function applySize(key: SizeKey) {
  const entry = SIZES.find((s) => s.key === key) ?? SIZES[1];
  document.documentElement.style.fontSize = `${entry.px}px`;
}

export function initFontSize() {
  try {
    const stored = (localStorage.getItem(STORAGE_KEY) as SizeKey | null) ?? "md";
    applySize(stored);
  } catch {
    // ignore
  }
}

export default function FontSizeControl() {
  const [current, setCurrent] = useState<SizeKey>("md");

  useEffect(() => {
    try {
      const stored = (localStorage.getItem(STORAGE_KEY) as SizeKey | null) ?? "md";
      setCurrent(stored);
      applySize(stored);
    } catch {
      // ignore
    }
  }, []);

  const change = (key: SizeKey) => {
    setCurrent(key);
    applySize(key);
    try {
      localStorage.setItem(STORAGE_KEY, key);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="fixed top-2 right-2 z-50 flex items-center gap-1 rounded-full border border-border bg-card/90 px-2 py-1 shadow-soft backdrop-blur"
      role="group"
      aria-label="Tamanho do texto"
      style={{ fontSize: "16px" }}
    >
      {SIZES.map((s) => (
        <button
          key={s.key}
          type="button"
          onClick={() => change(s.key)}
          className={
            "rounded-full px-2 py-0.5 leading-none transition-colors " +
            (current === s.key
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted")
          }
          style={{
            fontSize: s.key === "sm" ? 12 : s.key === "md" ? 14 : s.key === "lg" ? 16 : 18,
          }}
          aria-pressed={current === s.key}
          title={`Tamanho ${s.label}`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
