import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tabuada Amazônica — App de matemática para EJA" },
      {
        name: "description",
        content:
          "Pratique a tabuada do 2 ao 9 com níveis, sequências e timer. App gamificado para Educação de Jovens e Adultos.",
      },
      { property: "og:title", content: "Tabuada Amazônica — App de matemática para EJA" },
      {
        property: "og:description",
        content: "Aprenda a tabuada com níveis e sequências, no estilo Duolingo, com tema amazônico.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="min-h-screen leaf-bg flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl text-center">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/60 backdrop-blur px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
          <span aria-hidden>🌿</span> EJA · Matemática
        </div>
        <h1 className="mt-4 text-5xl sm:text-6xl font-extrabold tracking-tight text-foreground">
          Tabuada <span className="text-primary">Amazônica</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-md mx-auto">
          Aprenda a tabuada do <strong className="text-foreground">2 ao 9</strong> em níveis. Acertos
          em sequência fazem você avançar.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Link to="/aluno" className="block">
            <Button
              size="lg"
              className="btn-pop w-full h-20 text-xl font-bold rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <span className="mr-2 text-2xl" aria-hidden>👤</span> Sou aluno
            </Button>
          </Link>
          <Link to="/professor" className="block">
            <Button
              size="lg"
              variant="secondary"
              className="btn-pop-amber w-full h-20 text-xl font-bold rounded-2xl bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              <span className="mr-2 text-2xl" aria-hidden>🎓</span> Sou professor
            </Button>
          </Link>
        </div>

        <p className="mt-10 text-sm text-muted-foreground">
          🦜 Cada questão tem <strong>5 segundos</strong>. Boa sorte na floresta dos números!
        </p>
      </div>
    </main>
  );
}
