import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { LandingPage } from "@/components/landing/LandingPage";
import { useAuth } from "@/store/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MindoraMap - Transforme pensamentos em conexoes inteligentes" },
      {
        name: "description",
        content:
          "MindoraMap e a plataforma moderna de mapas mentais inteligentes para organizar ideias, acelerar brainstorming e conectar conhecimento com clareza visual.",
      },
    ],
  }),
  component: Index,
});

// Signed-in visitors can see the landing page too; its CTAs switch to "Ir para o painel".
function Index() {
  const init = useAuth((state) => state.init);

  useEffect(() => {
    void init();
  }, [init]);

  return <LandingPage />;
}
