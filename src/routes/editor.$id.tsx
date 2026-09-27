import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/store/auth";
import { Header } from "@/components/Header";
import { MindMapEditor } from "@/components/MindMapEditor";
import { getMap, type MindMap } from "@/store/maps";
import { withNewerDraft } from "@/features/editor/draftBackup";
import { toast } from "sonner";
import {
  ArrowLeft,
  Brain,
  GitBranch,
  Network,
  Crosshair,
  Link2,
  Wand2,
  Undo2,
  Redo2,
  GraduationCap,
  Palette,
} from "lucide-react";
import { OnboardingTour } from "@/components/OnboardingTour";
import { ExportMenu } from "@/components/ExportMenu";
import { EditorMoreMenu } from "@/components/EditorMoreMenu";
import { PanelsMenu } from "@/components/PanelsMenu";
import { useThemePanel } from "@/features/editor/themeStore";
import { useEntitlements } from "@/features/subscriptions";
import { isOnboardingDone, resetOnboarding } from "@/lib/onboarding";

function AppearanceButton() {
  const open = useThemePanel((state) => state.open);
  return (
    <button
      onClick={() => useThemePanel.getState().toggle()}
      aria-pressed={open}
      className={`h-8 px-3 rounded-full text-sm flex items-center justify-center gap-1.5 pointer-coarse:min-h-11 pointer-coarse:min-w-11 ${open ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
      title="Aparência: temas, cores de balões e linhas"
      aria-label="Aparência"
    >
      <Palette size={14} /> <span className="hidden sm:inline">Aparência</span>
    </button>
  );
}

export const Route = createFileRoute("/editor/$id")({
  head: () => ({ meta: [{ title: "Editor - Mindora" }] }),
  component: EditorPage,
});

const MODE_LABEL: Record<string, string> = {
  study: "Estudo",
  brainstorm: "Brainstorm",
  project: "Projeto",
};

function EditorPage() {
  const { id } = useParams({ from: "/editor/$id" });
  const { user, initialized, init } = useAuth();
  const navigate = useNavigate();
  const [map, setMap] = useState<MindMap | null>(null);
  const [loadingMap, setLoadingMap] = useState(true);
  const [view, setView] = useState<"tree" | "graph">("graph");
  const orientation = "horizontal" as const;
  const [connectMode, setConnectMode] = useState(false);
  const [organizeSignal, setOrganizeSignal] = useState(0);
  const [undoSignal, setUndoSignal] = useState(0);
  const [redoSignal, setRedoSignal] = useState(0);
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });
  const [showTour, setShowTour] = useState(false);
  const tourScheduledRef = useRef(false);

  useEffect(() => {
    init();
  }, [init]);

  const hasEntitlements = useEntitlements((state) => state.entitlements !== null);
  const refreshEntitlements = useEntitlements((state) => state.refresh);
  useEffect(() => {
    if (user && !hasEntitlements) void refreshEntitlements();
  }, [user, hasEntitlements, refreshEntitlements]);

  const userId = user?.id;
  const userEmail = user?.email;
  const userRole = user?.role;
  const userAccessGranted = user?.accessGranted;

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!initialized) return;
      if (!userId || !userEmail) {
        navigate({ to: "/login" });
        return;
      }

      if (userRole !== "superadmin" && !userAccessGranted) {
        navigate({ to: "/activate" });
        return;
      }

      setLoadingMap(true);

      try {
        const loadedMap = await getMap(id, { id: userId, email: userEmail });
        if (!loadedMap) {
          navigate({ to: "/dashboard" });
          return;
        }

        if (!cancelled) {
          const { map: mapToOpen, restored } = withNewerDraft(loadedMap);
          if (restored)
            toast.info("Recuperamos alterações que ainda não tinham sido salvas no servidor.");
          setMap(mapToOpen);
          setView(loadedMap.mode === "study" ? "tree" : "graph");
        }
      } catch (error) {
        console.error("Falha ao carregar mapa", error);
        navigate({ to: "/dashboard" });
      } finally {
        if (!cancelled) setLoadingMap(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [id, initialized, userId, userEmail, userRole, userAccessGranted, navigate]);

  // Show tour on first visit — delayed so the editor is fully rendered
  useEffect(() => {
    if (!map || !userId || tourScheduledRef.current) return;
    tourScheduledRef.current = true;
    if (!isOnboardingDone(userId)) {
      const t = window.setTimeout(() => setShowTour(true), 1200);
      return () => window.clearTimeout(t);
    }
  }, [map, userId]);

  const handleShowTour = () => {
    if (userId) resetOnboarding(userId);
    setShowTour(true);
  };

  if (!initialized) return null;
  if (!user) return null;
  if (user.role !== "superadmin" && !user.accessGranted) return null;

  if (loadingMap || !map) {
    return (
      <div className="h-dvh flex flex-col">
        <Header>
          <div className="h-4 w-44 animate-pulse rounded-full bg-muted" />
        </Header>
        <div className="relative flex-1 overflow-hidden bg-background">
          {/* Dot-grid background matching ReactFlow */}
          <svg
            className="absolute inset-0 h-full w-full opacity-[0.18]"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="currentColor" className="text-foreground" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>
          {/* Centered loading indicator */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
            <div className="relative">
              <div className="absolute inset-0 animate-ping rounded-2xl bg-primary/20" />
              <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-[image:var(--gradient-hero)] text-primary-foreground shadow-xl">
                <Brain size={28} />
              </div>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <p className="text-sm font-medium text-foreground">Preparando seu mapa...</p>
              <p className="text-xs text-muted-foreground">Aguarde um instante</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh flex flex-col">
      <Header>
        <h1 className="min-w-0 truncate font-semibold">{map.title}</h1>
        {map.parentMapId && (
          <button
            onClick={() => navigate({ to: "/editor/$id", params: { id: map.parentMapId! } })}
            className="shrink-0 px-2 py-1.5 rounded-lg hover:bg-muted text-sm flex items-center gap-1.5 pointer-coarse:min-h-11"
            title="Voltar ao mapa anterior"
            aria-label="Voltar ao mapa anterior"
          >
            <ArrowLeft size={14} /> <span className="hidden md:inline">Voltar</span>
          </button>
        )}
        <span className="hidden 2xl:inline shrink-0 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
          {MODE_LABEL[map.mode] || "Brainstorm"}
        </span>

        {/* Wide screens: full toolbar. Labels collapse to icons below xl. */}
        <div className="ml-auto hidden lg:flex items-center gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => setView("tree")}
            className={`px-3 py-1.5 rounded-md text-sm flex items-center justify-center gap-1.5 transition pointer-coarse:min-h-11 pointer-coarse:min-w-11 ${view === "tree" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
            title="Visão em árvore"
          >
            <GitBranch size={14} /> <span className="hidden xl:inline">Árvore</span>
          </button>
          <button
            onClick={() => setView("graph")}
            className={`px-3 py-1.5 rounded-md text-sm flex items-center justify-center gap-1.5 transition pointer-coarse:min-h-11 pointer-coarse:min-w-11 ${view === "graph" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
            title="Visão em grafo"
          >
            <Network size={14} /> <span className="hidden xl:inline">Grafo</span>
          </button>
        </div>

        <button
          onClick={() => setConnectMode(!connectMode)}
          className={`hidden lg:flex px-3 py-1.5 rounded-lg text-sm items-center justify-center gap-1.5 transition-colors pointer-coarse:min-h-11 pointer-coarse:min-w-11 ${
            connectMode ? "bg-primary text-primary-foreground" : "hover:bg-muted"
          }`}
          title="Modo conexão (Esc para sair)"
        >
          <Link2 size={14} /> <span className="hidden xl:inline">Conectar</span>
        </button>

        <button
          onClick={() => setOrganizeSignal((signal) => signal + 1)}
          className="hidden lg:flex px-3 py-1.5 rounded-lg hover:bg-muted text-sm flex items-center justify-center gap-1.5 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
          title="Organizar automaticamente"
        >
          <Wand2 size={14} /> <span className="hidden xl:inline">Organizar</span>
        </button>

        <div className="ml-auto lg:ml-0 hidden lg:flex items-center gap-1">
          <ExportMenu />
          <button
            onClick={() => navigate({ to: "/review/$id", params: { id: map.id } })}
            className="px-3 py-1.5 rounded-lg hover:bg-muted text-sm flex items-center justify-center gap-1.5 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
            title="Revisar este mapa com cartões"
          >
            <GraduationCap size={14} /> <span className="hidden xl:inline">Revisar</span>
          </button>
          <PanelsMenu />
          <button
            onClick={() => window.dispatchEvent(new Event("mm-center"))}
            className="px-3 py-1.5 rounded-lg hover:bg-muted text-sm flex items-center justify-center gap-1.5 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
            title="Centralizar mapa"
            aria-label="Centralizar mapa"
          >
            <Crosshair size={14} />
          </button>
        </div>

        {/* Phones and portrait tablets: the rest lives in one touch-friendly menu. */}
        <div className="ml-auto lg:hidden">
          <EditorMoreMenu
            view={view}
            onViewChange={setView}
            connectMode={connectMode}
            onToggleConnect={() => setConnectMode(!connectMode)}
            onOrganize={() => setOrganizeSignal((signal) => signal + 1)}
            onReview={() => navigate({ to: "/review/$id", params: { id: map.id } })}
          />
        </div>
      </Header>
      <div className="flex-1 relative">
        {/* Quick actions float just under the top bar, so the bar itself stays uncluttered. */}
        <div
          role="toolbar"
          aria-label="Ações rápidas"
          className="absolute left-1/2 top-2 z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-border bg-card/95 p-1 text-card-foreground shadow-[var(--shadow-soft)] backdrop-blur"
        >
          <button
            onClick={() => setUndoSignal((signal) => signal + 1)}
            disabled={!history.canUndo}
            className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted pointer-coarse:h-11 pointer-coarse:w-11 disabled:opacity-40 disabled:pointer-events-none"
            title="Desfazer (Ctrl+Z)"
            aria-label="Desfazer"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={() => setRedoSignal((signal) => signal + 1)}
            disabled={!history.canRedo}
            className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted pointer-coarse:h-11 pointer-coarse:w-11 disabled:opacity-40 disabled:pointer-events-none"
            title="Refazer (Ctrl+Y)"
            aria-label="Refazer"
          >
            <Redo2 size={16} />
          </button>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          <AppearanceButton />
        </div>
        <MindMapEditor
          map={map}
          mode={view}
          orientation={orientation}
          connectMode={connectMode}
          setConnectMode={setConnectMode}
          organizeSignal={organizeSignal}
          undoSignal={undoSignal}
          redoSignal={redoSignal}
          onHistoryChange={setHistory}
          userId={user.id}
          onShowTour={handleShowTour}
        />
      </div>

      {showTour && userId && <OnboardingTour userId={userId} onDone={() => setShowTour(false)} />}
    </div>
  );
}
