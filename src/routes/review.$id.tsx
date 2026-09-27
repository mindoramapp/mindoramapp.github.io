import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { useRequireAppAccess } from "@/features/auth/useRequireAppAccess";
import { loadReviewStates, ReviewSession, type ReviewState } from "@/features/review";
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

  const userId = user?.id;
  const userEmail = user?.email;

  useEffect(() => {
    if (!userId || !userEmail) return;
    let cancelled = false;

    Promise.all([getMap(id, { id: userId, email: userEmail }), loadReviewStates(id)])
      .then(([map, states]) => {
        if (cancelled) return;
        if (!map) {
          navigate({ to: "/dashboard" });
          return;
        }
        setData({ map, states });
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
    <div className="flex min-h-screen flex-col bg-background">
      <Header>
        <h1 className="truncate font-semibold">{data ? data.map.title : "Revisão"}</h1>
      </Header>
      <main className="flex-1">
        {data ? (
          <ReviewSession map={data.map} userId={user.id} initialStates={data.states} />
        ) : (
          <div className="mx-auto mt-16 h-64 w-full max-w-lg animate-pulse rounded-3xl bg-muted" />
        )}
      </main>
    </div>
  );
}
