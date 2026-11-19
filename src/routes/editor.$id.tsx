import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/store/auth";
import { Header } from "@/components/Header";
import { MindMapEditor, type SaveStatus } from "@/components/MindMapEditor";
import { getMap, type MindMap } from "@/store/maps";
import { withNewerDraft } from "@/features/editor/draftBackup";
import { toast } from "sonner";
import {
  ArrowLeft,
  Brain,
  Check,
  CloudOff,
  GitBranch,
  Loader2,
  Network,
  Link2,
  Wand2,
  Undo2,
  Redo2,
  GraduationCap,
  Palette,
  Search,
} from "lucide-react";
import { OnboardingTour } from "@/components/OnboardingTour";
import { EditorMoreMenu } from "@/components/EditorMoreMenu";
import { useThemePanel } from "@/features/editor/themeStore";
import { useEntitlements } from "@/features/subscriptions";
import { isOnboardingDone, resetOnboarding } from "@/lib/onboarding";

function AppearanceButton() {
  const open = useThemePanel((state) => state.open);
  return (
    <button
      onClick={() => useThemePanel.getState().toggle()}
      aria-pressed={open}
      className={`h-8 px-2.5 shrink-0 rounded-full text-sm flex items-center justify-center gap-1.5 pointer-coarse:min-h-11 pointer-coarse:min-w-11 ${open ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
      title="Aparência: temas, cores de balões e linhas"
      aria-label="Aparência"
    >
      <Palette size={14} /> <span className="hidden lg:inline">Aparência</span>
    </button>
  );
}

/** Map title in the header; click to rename (Enter saves, Esc cancels). */
function MapTitle({ title, onRename }: { title: string; onRename: (title: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== title) onRename(next);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        maxLength={120}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") setEditing(false);
        }}
        aria-label="Nome do mapa"
        className="min-w-0 max-w-xs flex-1 rounded-lg border border-border bg-background px-2 py-1 font-semibold outline-none focus:ring-2 focus:ring-ring"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(title);
        setEditing(true);
      }}
      className="min-w-0 truncate rounded-lg px-1.5 py-1 text-left font-semibold hover:bg-muted pointer-coarse:min-h-11"
      title="Renomear mapa"
    >
      {title}
    </button>
  );
}

/** Tells whether the latest change already reached the server. */
function SaveIndicator({ status }: { status: SaveStatus }) {
  const content = {
    saving: { icon: <Loader2 size={14} className="animate-spin" />, label: "Salvando…" },
    saved: { icon: <Check size={14} />, label: "Salvo" },
    local: { icon: <CloudOff size={14} />, label: "Sem conexão: guardado neste aparelho" },
  }[status];
  return (
    <span
      role="status"
      title={content.label}
      className={`flex shrink-0 items-center gap-1 text-xs ${status === "local" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}
    >
      {content.icon}
      <span className={status === "local" ? "hidden md:inline" : "hidden sm:inline"}>
        {content.label}
      </span>
    </span>
  );
}

export const Route = createFileRoute("/editor/$id")({
  head: () => ({ meta: [{ title: "Editor - Mindora" }] }),
  component: EditorPage,
});

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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
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

  const toolButton = (active = false) =>
    `h-8 px-2.5 rounded-full text-sm flex items-center justify-center gap-1.5 transition-colors pointer-coarse:min-h-11 pointer-coarse:min-w-11 ${
      active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
    }`;

  return (
    <div className="h-dvh flex flex-col">
      <Header>
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
        <MapTitle title={map.title} onRename={(title) => setMap({ ...map, title })} />
        <SaveIndicator status={saveStatus} />

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button
            onClick={() => navigate({ to: "/review/$id", params: { id: map.id } })}
            className="h-9 px-3 rounded-lg bg-primary/10 text-primary hover:bg-primary/15 text-sm font-medium flex items-center justify-center gap-1.5 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
            title="Estudar este mapa com cartões de revisão"
          >
            <GraduationCap size={16} /> <span className="hidden sm:inline">Revisar</span>
          </button>
          <EditorMoreMenu />
        </div>
      </Header>
      <div className="flex-1 relative">
        {/* The editing tools, in one bar floating just under the header on every screen size. */}
        <div
          role="toolbar"
          aria-label="Ferramentas do mapa"
          className="absolute left-1/2 top-2 z-30 flex max-w-[calc(100%-16px)] -translate-x-1/2 items-center gap-0.5 overflow-x-auto rounded-full border border-border bg-card/95 p-1 text-card-foreground shadow-[var(--shadow-soft)] backdrop-blur"
        >
          <button
            onClick={() => setUndoSignal((signal) => signal + 1)}
            disabled={!history.canUndo}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-muted pointer-coarse:h-11 pointer-coarse:w-11 disabled:opacity-40 disabled:pointer-events-none"
            title="Desfazer (Ctrl+Z)"
            aria-label="Desfazer"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={() => setRedoSignal((signal) => signal + 1)}
            disabled={!history.canRedo}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-muted pointer-coarse:h-11 pointer-coarse:w-11 disabled:opacity-40 disabled:pointer-events-none"
            title="Refazer (Ctrl+Shift+Z)"
            aria-label="Refazer"
          >
            <Redo2 size={16} />
          </button>
          <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />
          <div
            className="flex shrink-0 items-center rounded-full bg-muted p-0.5"
            role="group"
            aria-label="Visão"
          >
            {(
              [
                [
                  "tree",
                  "Árvore",
                  "Visão em árvore: organizada automaticamente",
                  <GitBranch key="t" size={14} />,
                ],
                [
                  "graph",
                  "Grafo",
                  "Visão em grafo: posições livres",
                  <Network key="g" size={14} />,
                ],
              ] as const
            ).map(([value, label, hint, icon]) => (
              <button
                key={value}
                onClick={() => setView(value)}
                aria-pressed={view === value}
                className={`h-7 px-2.5 rounded-full text-sm flex items-center justify-center gap-1.5 transition pointer-coarse:min-h-10 pointer-coarse:min-w-10 ${view === value ? "bg-card shadow-sm" : "text-muted-foreground"}`}
                title={hint}
                aria-label={label}
              >
                {icon} <span className="hidden md:inline">{label}</span>
              </button>
            ))}
          </div>
          <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />
          <button
            onClick={() => setConnectMode(!connectMode)}
            aria-pressed={connectMode}
            className={toolButton(connectMode)}
            title="Ligar duas ideias com uma linha (Esc para sair)"
            aria-label="Conectar"
          >
            <Link2 size={14} /> <span className="hidden lg:inline">Conectar</span>
          </button>
          <button
            onClick={() => setOrganizeSignal((signal) => signal + 1)}
            className={toolButton()}
            title="Organizar automaticamente"
            aria-label="Organizar"
          >
            <Wand2 size={14} /> <span className="hidden lg:inline">Organizar</span>
          </button>
          <AppearanceButton />
          <button
            onClick={() => window.dispatchEvent(new Event("mm-search"))}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-muted pointer-coarse:h-11 pointer-coarse:w-11"
            title="Buscar no mapa (Ctrl+F)"
            aria-label="Buscar no mapa"
          >
            <Search size={15} />
          </button>
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
          onSaveStatusChange={setSaveStatus}
          userId={user.id}
          onShowTour={handleShowTour}
        />
      </div>

      {showTour && userId && <OnboardingTour userId={userId} onDone={() => setShowTour(false)} />}
    </div>
  );
}
