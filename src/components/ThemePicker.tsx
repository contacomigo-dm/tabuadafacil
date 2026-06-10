import { useState } from "react";
import { THEMES, THEME_META, type ThemeId, saveStudentTheme, getActiveTheme } from "@/lib/theme";
import { toast } from "sonner";

interface Props {
  studentId: string;
  onChange?: (theme: ThemeId) => void;
}

export default function ThemePicker({ studentId, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<ThemeId>(getActiveTheme());
  const [saving, setSaving] = useState<ThemeId | null>(null);

  const pick = async (t: ThemeId) => {
    if (t === current || saving) return;
    setSaving(t);
    try {
      await saveStudentTheme(studentId, t);
      setCurrent(t);
      onChange?.(t);
      toast.success(`Tema ${THEME_META[t].label} aplicado!`);
    } catch {
      toast.error("Não foi possível salvar o tema");
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 backdrop-blur px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary transition"
      >
        <span aria-hidden>{THEME_META[current].emoji}</span>
        Tema: {THEME_META[current].label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-card rounded-3xl border border-border max-w-2xl w-full p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-extrabold text-foreground">Escolha seu tema</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Fechar ✕
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {THEMES.map((t) => {
                const meta = THEME_META[t];
                const isActive = t === current;
                const isLoading = saving === t;
                return (
                  <button
                    key={t}
                    onClick={() => pick(t)}
                    disabled={!!saving}
                    className={`group text-left rounded-2xl overflow-hidden border-2 transition ${
                      isActive ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/60"
                    } ${isLoading ? "opacity-60" : ""}`}
                  >
                    <div className="aspect-[3/1] overflow-hidden bg-secondary">
                      <img
                        src={meta.banner}
                        alt={meta.label}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <div className="p-3">
                      <div className="flex items-center gap-2 font-extrabold text-foreground">
                        <span>{meta.emoji}</span>
                        {meta.label}
                        {isActive && (
                          <span className="ml-auto text-xs font-semibold text-primary">
                            ✓ atual
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{meta.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
