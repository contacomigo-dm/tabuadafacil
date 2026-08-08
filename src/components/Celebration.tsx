import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

// Comemoração infantil: chuva de confete + mascote amazônico saltitante + frase divertida.
// Puramente visual e não interativo (pointer-events-none), para não atrapalhar os botões.

const MASCOTS = ["🦜", "🐢", "🐬", "🐒", "🦋", "🐸", "🦥", "🐆"];
const PHRASES = [
  "Uhuuul! Você mandou muito bem!",
  "Boa! O boto-cor-de-rosa está dando pulos!",
  "Show! A floresta inteira está aplaudindo 👏",
  "Arrasou! Isso foi de outro mundo 🚀",
  "Que craque! A onça ficou impressionada 🐆",
  "Isso aí! O papagaio está gritando seu nome 🦜",
];
const CONFETTI_EMOJIS = ["🎉", "⭐", "🎊", "🌟", "🍃", "💥", "🏆", "✨"];

type Props = {
  /** Frase opcional; se ausente, sorteia uma. */
  message?: string;
  /** Quantidade de confetes. */
  pieces?: number;
  className?: string;
};

export function Celebration({ message, pieces = 28, className }: Props) {
  const [visible, setVisible] = useState(true);

  const confetti = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 1.6,
        duration: 2.6 + Math.random() * 2.2,
        size: 16 + Math.random() * 20,
        emoji: CONFETTI_EMOJIS[Math.floor(Math.random() * CONFETTI_EMOJIS.length)],
      })),
    [pieces],
  );

  const mascot = useMemo(() => MASCOTS[Math.floor(Math.random() * MASCOTS.length)], []);
  const phrase = useMemo(
    () => message ?? PHRASES[Math.floor(Math.random() * PHRASES.length)],
    [message],
  );

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 6000);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {visible && (
        <div
          aria-hidden
          className={cn("pointer-events-none fixed inset-0 z-[60] overflow-hidden", className)}
        >
          {confetti.map((c) => (
            <span
              key={c.id}
              className="absolute top-[-10%] animate-confetti-fall"
              style={{
                left: `${c.left}%`,
                fontSize: `${c.size}px`,
                animationDelay: `${c.delay}s`,
                animationDuration: `${c.duration}s`,
              }}
            >
              {c.emoji}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col items-center gap-2" role="status" aria-live="polite">
        <div className="text-6xl animate-mascot-bounce" aria-hidden>
          {mascot}
        </div>
        <p className="text-base sm:text-lg font-extrabold text-primary animate-fade-in">
          {phrase}
        </p>
      </div>
    </>
  );
}

export default Celebration;
