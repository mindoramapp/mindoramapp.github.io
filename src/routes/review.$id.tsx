import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { useRequireAppAccess } from "@/features/auth/useRequireAppAccess";
import { canReviewMap, loadReviewStates, ReviewSession, type ReviewState } from "@/features/review";
import { getMap, type MindMap } from "@/store/maps";

export const Route = createFileRoute("/review/$id")({
  head: () => ({ meta: [{ title: "Revisão - Mindora" }] }),
  component: ReviewPage,
});

function ReviewPage() {
  const { id } = useParams({ from: "/review/$id" });
  const user = useRequireAppAccess();
  const navigate = useNavigate();
  const [data, setData] = useState<{ map: MindMap; states: Map<string, ReviewState> } | null>(null);
  const [blocked, setBlocked] = useState(false);

  const userId = user?.id;
  const userEmail = user?.email;

  useEffect(() => {
    if (!userId || !userEmail) return;
    let cancelled = false;

    Promise.all([
      getMap(id, { id: userId, email: userEmail }),
      canReviewMap(id),
      loadReviewStates(id),
    ])
      .then(([map, allowed, states]) => {
        if (cancelled) return;
        if (!map) {
          navigate({ to: "/dashboard" });
          return;
        }
        if (!allowed) setBlocked(true);
        else setData({ map, states });
      })
      .catch((error) => {
        console.error("Falha ao carregar revisão", error);
        toast.error("Não foi possível abrir a revisão agora.");
        navigate({ to: "/editor/$id", params: { id } });
      });

    return () => {
      cancelled = true;
    };
  }, [id, userId, userEmail, navigate]);

  if (!user) return null;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Header>
        <h1 className="truncate font-semibold">{data ? data.map.title : "Revisão"}</h1>
      </Header>
      <main className="flex-1">
        {blocked ? (
          <div className="mx-auto mt-16 w-full max-w-lg rounded-3xl border border-border bg-card p-8 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
              <GraduationCap size={26} />
            </span>
            <h2 className="mt-4 text-xl font-semibold">Revisão disponível em 1 mapa no Free</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Você já está revisando outro mapa. Com o plano Estudante você revisa todos os seus
              mapas, e o progresso deste fica guardado.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link
                to="/plans"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
              >
                Ver planos
              </Link>
              <Link
                to="/editor/$id"
                params={{ id }}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-5 text-sm hover:bg-muted"
              >
                Voltar ao mapa
              </Link>
            </div>
          </div>
        ) : data ? (
          <ReviewSession map={data.map} userId={user.id} initialStates={data.states} />
        ) : (
          <div className="mx-auto mt-16 h-64 w-full max-w-lg animate-pulse rounded-3xl bg-muted" />
        )}
      </main>
    </div>
  );
}
