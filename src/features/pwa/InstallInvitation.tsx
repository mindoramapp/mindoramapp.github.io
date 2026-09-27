// First-visit invitation to install Mindora as an app, plus the reusable "Instalar app" button.
// Non-blocking: a card at the bottom (phones) or bottom-right (desktop) that never covers the
// editor, remembers "Agora não" for three weeks and adapts to iOS, which has no install dialog.
import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Download, Maximize2, Share, SquarePlus, WifiOff, X, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  rememberInvitationDismissed,
  useInstallPrompt,
  wasInvitationDismissedRecently,
} from "./installPrompt";

const SHOW_AFTER_MS = 3000;
const ENTRY_SCREENS = ["/", "/login", "/register", "/dashboard"];

const BENEFITS = [
  { icon: <Zap size={15} />, text: "Abre direto da tela inicial, em um toque" },
  { icon: <Maximize2 size={15} />, text: "Tela cheia, sem barras do navegador" },
  { icon: <WifiOff size={15} />, text: "Carrega rápido, mesmo com internet fraca" },
];

export function InstallInvitation() {
  const mode = useInstallPrompt((state) => state.mode);
  const installed = useInstallPrompt((state) => state.installed);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [visible, setVisible] = useState(false);
  const [iosSteps, setIosSteps] = useState(false);

  // Opened on demand by the "Instalar app" buttons.
  useEffect(() => {
    const open = () => {
      setIosSteps(useInstallPrompt.getState().mode === "ios");
      setVisible(true);
    };
    window.addEventListener("mindora:install-invite", open);
    return () => window.removeEventListener("mindora:install-invite", open);
  }, []);

  // Automatic invitation: first visits, entry screens only, once per three weeks.
  useEffect(() => {
    if (!mode || installed || visible || wasInvitationDismissedRecently()) return;
    if (!ENTRY_SCREENS.includes(pathname)) return;
    const timer = window.setTimeout(() => {
      setIosSteps(mode === "ios");
      setVisible(true);
    }, SHOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [mode, installed, visible, pathname]);

  if (!visible || installed) return null;

  const dismiss = () => {
    rememberInvitationDismissed();
    setVisible(false);
  };

  const install = async () => {
    if (mode === "ios") {
      setIosSteps(true);
      return;
    }
    const outcome = await useInstallPrompt.getState().install();
    if (outcome === "accepted") {
      toast.success("Mindora instalado! Procure o ícone na sua tela inicial.");
      setVisible(false);
    } else if (outcome === "dismissed") {
      dismiss();
    } else {
      toast.message("Para instalar, use o menu do navegador → “Instalar Mindora”.");
    }
  };

  return (
    <div
      role="dialog"
      aria-labelledby="install-title"
      aria-describedby="install-description"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[60] mx-auto max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[380px]"
    >
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-[0_24px_70px_-20px_oklch(0.3_0.08_255/0.45)]">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[radial-gradient(closest-side,oklch(0.68_0.15_205/0.28),transparent)]"
        />
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground pointer-coarse:h-11 pointer-coarse:w-11"
          aria-label="Fechar convite"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-3 pr-8">
          <img
            src={`${import.meta.env.BASE_URL}icon-192.png`}
            alt=""
            className="h-14 w-14 shrink-0 rounded-2xl shadow-md"
          />
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-primary">
              App gratuito
            </p>
            <h2 id="install-title" className="text-lg font-semibold leading-tight">
              Leve o Mindora com você
            </h2>
          </div>
        </div>

        {iosSteps ? (
          <div id="install-description" className="mt-4 space-y-3 text-sm">
            <p className="text-muted-foreground">
              No iPhone e iPad, a instalação é feita pelo Safari:
            </p>
            <ol className="space-y-2">
              <li className="flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-2.5">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  1
                </span>
                <span>
                  Toque em <Share size={15} className="inline align-[-2px] text-primary" />{" "}
                  <strong>Compartilhar</strong>
                </span>
              </li>
              <li className="flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-2.5">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  2
                </span>
                <span>
                  Escolha <SquarePlus size={15} className="inline align-[-2px] text-primary" />{" "}
                  <strong>Adicionar à Tela de Início</strong>
                </span>
              </li>
            </ol>
            <button
              type="button"
              onClick={dismiss}
              className="mt-1 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-border text-sm font-medium hover:bg-muted"
            >
              Entendi
            </button>
          </div>
        ) : (
          <>
            <p id="install-description" className="mt-3 text-sm text-muted-foreground">
              Instale o app e abra seus mapas direto da tela inicial.
            </p>
            <ul className="mt-3 space-y-2">
              {BENEFITS.map((benefit) => (
                <li key={benefit.text} className="flex items-center gap-2.5 text-sm">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    {benefit.icon}
                  </span>
                  {benefit.text}
                </li>
              ))}
            </ul>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={dismiss}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                Agora não
              </button>
              <button
                type="button"
                onClick={install}
                className="inline-flex min-h-11 flex-[1.4] items-center justify-center gap-2 rounded-xl bg-[image:var(--gradient-hero)] text-sm font-semibold text-primary-foreground shadow-md transition-opacity hover:opacity-95"
              >
                <Download size={16} /> Instalar app
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Opens the invitation (native dialog on Chrome/Edge/Android, steps on iOS). Hidden when not installable. */
export function InstallAppButton({ className = "" }: { className?: string }) {
  const mode = useInstallPrompt((state) => state.mode);
  const installed = useInstallPrompt((state) => state.installed);
  if (!mode || installed) return null;

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("mindora:install-invite"))}
      className={`inline-flex h-10 w-10 items-center justify-center gap-2 rounded-full border border-border bg-card text-sm font-medium text-foreground transition-colors hover:bg-muted sm:h-auto sm:w-auto sm:px-3 sm:py-2 pointer-coarse:min-h-11 pointer-coarse:min-w-11 ${className}`}
      aria-label="Instalar app"
      title="Instalar o Mindora como app"
    >
      <Download size={16} /> <span className="hidden sm:inline">Instalar app</span>
    </button>
  );
}
