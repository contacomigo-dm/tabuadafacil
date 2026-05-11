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
      <div className="w-full max-w-3xl text-center">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/60 backdrop-blur px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
          <span aria-hidden>🌿</span> EJA · Matemática
        </div>
        <h1 className="mt-4 text-5xl sm:text-6xl font-extrabold tracking-tight text-foreground">
          Matemática <span className="text-primary">Amazônica</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
          Faça seu login e escolha entre Tabuada da multiplicação ou Divisão longa.
        </p>

        <div className="mt-10 max-w-sm mx-auto">
          <Link to="/aluno" className="block">
            <div className="btn-pop bg-card border border-border rounded-3xl p-6 text-center hover:border-primary transition">
              <div className="text-4xl mb-2">👤</div>
              <div className="text-xl font-extrabold text-foreground">Entrar como aluno</div>
              <div className="text-sm text-muted-foreground mt-1">
                Depois você escolhe Tabuada ✖️ ou Divisão ➗.
              </div>
            </div>
          </Link>
        </div>

        <div className="mt-10">
          <Link to="/professor" className="block max-w-sm mx-auto">
            <Button
              size="lg"
              variant="secondary"
              className="btn-pop-amber w-full h-14 text-base font-bold rounded-2xl bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              <span className="mr-2" aria-hidden>🎓</span> Sou professor
            </Button>
          </Link>
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          🦜 Boa sorte na floresta dos números!
        </p>
      </div>
    </main>
  );
}
