import { Link, useNavigate } from "@tanstack/react-router";
import { MotionConfig, motion } from "framer-motion";
import { isLiteMode } from "@/lib/performance";
import { InstallAppButton } from "@/features/pwa/InstallInvitation";
import { useEffect, useMemo, useRef, useState } from "react";
import "@fontsource/fraunces/latin-400.css";
import "@fontsource/fraunces/latin-600.css";
import { MindPortrait } from "./MindPortrait";
import {
  ArrowRight,
  ChevronRight,
  Download,
  FolderTree,
  GraduationCap,
  Layers3,
  Network,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/store/auth";

const sectionFade = {
  hidden: { opacity: 0, y: 36 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

const steps = [
  {
    title: "Escreva a ideia central",
    body: "Comece em branco ou por um modelo de estudo, brainstorm ou projeto.",
  },
  {
    title: "Puxe os ramos",
    body: "Tab cria um filho, Enter cria um irmão. No celular, um toque em “+ Filho”.",
  },
  {
    title: "Revise e compartilhe",
    body: "Estude o mapa com cartões de revisão ou exporte em imagem ou texto.",
  },
];

const features = [
  {
    icon: Network,
    title: "Árvore ou grafo",
    body: "Organização automática em árvore, ou posições livres com conexões entre ramos.",
  },
  {
    icon: GraduationCap,
    title: "Modo revisão",
    body: "Cada ramo vira um cartão de estudo, com revisão espaçada e o domínio do mapa em %.",
  },
  {
    icon: Layers3,
    title: "Submapas",
    body: "Aprofunde um tema num mapa próprio sem poluir o panorama principal.",
  },
  {
    icon: FolderTree,
    title: "Pastas e favoritos",
    body: "Separe mapas por assunto e deixe os mais usados a um clique.",
  },
  {
    icon: Download,
    title: "Exportação",
    body: "PNG, SVG, Markdown ou JSON para backup e para levar a outra conta.",
  },
  {
    icon: Smartphone,
    title: "No celular também",
    body: "Instale como app, edite com toque e continue de onde parou. Tudo é salvo sozinho.",
  },
];

const scrollToId = (id: string) => {
  if (typeof document === "undefined") return;
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
};

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      variants={sectionFade}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground backdrop-blur">
      <Sparkles size={12} />
      {children}
    </span>
  );
}

/** Where a signed-in visitor continues: their maps, or the invite screen if not activated yet. */
function useAppDestination() {
  const user = useAuth((state) => state.user);
  if (!user) return null;
  return user.role === "superadmin" || user.accessGranted ? "/dashboard" : "/activate";
}

export function LandingPage() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const appDestination = useAppDestination();
  const [lite] = useState(isLiteMode);
  const heroRef = useRef<HTMLElement>(null);

  // Dusk to night: the hero (sky, stars and the visor) darkens as it scrolls away.
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const night = Math.min(1, Math.max(0, window.scrollY / (hero.offsetHeight * 0.85)));
      hero.style.setProperty("--night", night.toFixed(3));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const navItems = useMemo(
    () => [
      { label: "Como funciona", id: "como-funciona" },
      { label: "Recursos", id: "recursos" },
    ],
    [],
  );

  return (
    <MotionConfig reducedMotion={lite ? "always" : "user"}>
      <div className="min-h-dvh overflow-x-hidden bg-background text-foreground">
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <img
            src={`${import.meta.env.BASE_URL}hero-network-bg.jpg`}
            alt=""
            aria-hidden="true"
            className={`fixed inset-0 h-full w-full object-cover transition-opacity duration-700 ${
              theme === "dark" ? "opacity-15" : "opacity-[0.12] invert hue-rotate-180"
            } blur-[1px]`}
          />
          <div className="landing-orb left-[-18%] top-[2%] h-[26rem] w-[26rem] text-primary/25" />
          <div className="landing-orb right-[-16%] top-[20%] h-[28rem] w-[28rem] text-cyan-400/15" />
          <div className="landing-orb bottom-[-16%] left-[18%] h-[30rem] w-[30rem] text-emerald-400/15" />
          <div className="landing-grid absolute inset-0 opacity-60" />
        </div>

        <header className="sticky top-0 z-50 border-b border-border/60 bg-background/72 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => scrollToId("top")}
              className="flex items-center gap-3 text-left"
              aria-label="Mindora — início"
            >
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[image:var(--gradient-hero)] text-primary-foreground shadow-[var(--shadow-soft)]">
                <Network size={20} />
              </span>
              {/* Narrow phones keep only the logo so every header action fits. */}
              <div className="hidden min-[420px]:block">
                <div className="text-base font-semibold tracking-tight">Mindora</div>
                <div className="hidden text-xs text-muted-foreground sm:block">
                  Mapas mentais para estudar e planejar
                </div>
              </div>
            </button>

            <nav className="hidden items-center gap-6 lg:flex">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToId(item.id)}
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground pointer-coarse:py-3"
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <InstallAppButton />
              <ThemeToggle />
              {appDestination ? (
                <Link
                  to={appDestination}
                  className="inline-flex items-center gap-2 rounded-full bg-[image:var(--gradient-hero)] px-4 py-2 text-sm font-semibold pointer-coarse:min-h-11 text-primary-foreground shadow-[var(--shadow-soft)] transition-opacity hover:opacity-95"
                >
                  Meus mapas
                  <ChevronRight size={16} />
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="hidden rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted sm:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
                  >
                    Entrar
                  </Link>
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-2 rounded-full bg-[image:var(--gradient-hero)] px-4 py-2 text-sm font-semibold pointer-coarse:min-h-11 text-primary-foreground shadow-[var(--shadow-soft)] transition-opacity hover:opacity-95"
                  >
                    Criar conta
                    <ChevronRight size={16} />
                  </Link>
                </>
              )}
            </div>
          </div>
        </header>

        <main id="top">
          <section ref={heroRef} className="hero-dusk relative isolate overflow-hidden">
            <div
              className="hero-stars pointer-events-none absolute inset-0 -z-10"
              aria-hidden="true"
            />
            <div
              className="hero-fade pointer-events-none absolute inset-x-0 bottom-0 z-20 h-28"
              aria-hidden="true"
            />

            <div className="relative z-10 mx-auto grid min-h-[calc(100svh-4.75rem)] max-w-7xl items-center gap-6 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:gap-10 lg:px-8 lg:py-16">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
                className="order-2 max-w-2xl lg:order-1"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#C9D6FF]/80">
                  Mapas mentais · revisão espaçada
                </p>
                <h1 className="font-display-serif mt-5 text-5xl font-semibold leading-[1.02] text-balance sm:text-6xl lg:text-7xl">
                  Ideias que você <span className="dusk-accent">não esquece</span>.
                </h1>
                <p className="mt-6 max-w-xl text-base leading-7 text-[#C9D6FF] sm:text-lg">
                  Monte o mapa mental do conteúdo em minutos e revise com cartões que voltam na hora
                  certa. No computador ou no celular, grátis para começar.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    to={appDestination ?? "/register"}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFA27A] px-6 py-3 text-sm font-semibold text-[#141a3a] shadow-[0_18px_40px_-18px_rgba(255,162,122,0.8)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#ffb391] pointer-coarse:min-h-11"
                  >
                    {appDestination ? "Abrir meus mapas" : "Começar grátis"}
                    <ArrowRight size={16} />
                  </Link>
                  <button
                    type="button"
                    onClick={() => scrollToId("como-funciona")}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 pointer-coarse:min-h-11"
                  >
                    Como funciona
                    <ChevronRight size={16} />
                  </button>
                </div>
                {!appDestination && (
                  <p className="mt-5 text-sm text-[#C9D6FF]/80">
                    Já tem conta?{" "}
                    <Link
                      to="/login"
                      className="font-medium text-white underline-offset-4 hover:underline"
                    >
                      Entrar
                    </Link>
                  </p>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.12, duration: 0.9 }}
                className="order-1 mx-auto w-full max-w-[230px] sm:max-w-[340px] lg:order-2 lg:max-w-[560px]"
              >
                <MindPortrait />
              </motion.div>
            </div>
          </section>

          <section id="como-funciona" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <Reveal className="mx-auto max-w-3xl text-center">
              <SectionLabel>Como funciona</SectionLabel>
              <h2 className="font-display-serif mt-5 text-3xl font-semibold sm:text-5xl">
                Do primeiro balão ao mapa pronto em{" "}
                <span className="title-accent">três passos</span>.
              </h2>
            </Reveal>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {steps.map((step, index) => (
                <Reveal key={step.title} delay={index * 0.06}>
                  <div className="landing-panel h-full rounded-[28px] p-6">
                    <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary">
                      {index + 1}
                    </span>
                    <h3 className="mt-5 text-xl font-semibold">{step.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">{step.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          <section id="recursos" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <Reveal className="mx-auto max-w-3xl text-center">
              <SectionLabel>Recursos</SectionLabel>
              <h2 className="font-display-serif mt-5 text-3xl font-semibold sm:text-5xl">
                O essencial à vista, o resto <span className="title-accent">a um clique</span>.
              </h2>
            </Reveal>
            <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <Reveal key={feature.title} delay={index * 0.05}>
                    <div className="landing-panel h-full rounded-[28px] p-6">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Icon size={20} />
                      </div>
                      <h3 className="mt-5 text-xl font-semibold">{feature.title}</h3>
                      <p className="mt-3 text-sm leading-7 text-muted-foreground">{feature.body}</p>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
            <Reveal>
              <div className="landing-panel relative overflow-hidden rounded-[36px] p-8 sm:p-10 lg:p-14">
                <img
                  src={`${import.meta.env.BASE_URL}cta-constellation-bg.jpg`}
                  alt=""
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                    theme === "dark" ? "opacity-35" : "opacity-25 invert hue-rotate-180"
                  }`}
                />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(124,92,255,0.22),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(34,211,238,0.18),transparent_28%)]" />
                <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div>
                    <SectionLabel>Pronto para começar</SectionLabel>
                    <h2 className="font-display-serif mt-5 max-w-3xl text-3xl font-semibold sm:text-5xl">
                      Crie sua conta e monte o primeiro mapa{" "}
                      <span className="title-accent">hoje</span>.
                    </h2>
                    <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                      É grátis para começar, no plano Free. Crie a conta, confirme o e-mail e
                      pronto: você já monta o primeiro mapa.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                    <Link
                      to={appDestination ?? "/register"}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-[image:var(--gradient-hero)] px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] transition-opacity hover:opacity-95"
                    >
                      {appDestination ? "Abrir meus mapas" : "Criar conta"}
                      <ArrowRight size={16} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => navigate({ to: "/login" })}
                      className="inline-flex items-center justify-center rounded-full border border-border/70 bg-background/60 px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-card"
                    >
                      Já tenho conta
                    </button>
                  </div>
                </div>
              </div>
            </Reveal>
          </section>
        </main>

        <footer className="border-t border-border/60 bg-background/80 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[image:var(--gradient-hero)] text-primary-foreground">
                <Network size={18} />
              </span>
              <div>
                <div className="text-sm font-semibold">Mindora</div>
                <div className="text-xs text-muted-foreground">
                  Mapas mentais para estudar e planejar
                </div>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}
