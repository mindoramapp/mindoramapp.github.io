import { Link } from "@tanstack/react-router";
import { MotionConfig, motion } from "framer-motion";
import { isLiteMode } from "@/lib/performance";
import { InstallAppButton } from "@/features/pwa/InstallInvitation";
import { useEffect, useMemo, useRef, useState } from "react";
import "@fontsource/fraunces/latin-400.css";
import "@fontsource/fraunces/latin-600.css";
import { MindPortrait } from "./MindPortrait";
import passo1 from "@/assets/landing/passo1-novo-mapa.webp";
import passo2 from "@/assets/landing/passo2-ramos.webp";
import passo3 from "@/assets/landing/passo3-revisao.webp";
import vitrineComputador from "@/assets/landing/vitrine-computador.webp";
import vitrineCelular from "@/assets/landing/vitrine-celular.webp";
// Mood images generated with Gemini from the prompts in divulgacao/referencias/PROMPTS_GEMINI.md.
import revisaoEstudante from "@/assets/landing/revisao-estudante.webp";
import ceuNoturno from "@/assets/landing/ceu-noturno.webp";
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

// Real screenshots of the app (demo account), taken by divulgacao/ferramentas/capturar_telas.mjs.
const steps = [
  {
    title: "Escreva a ideia central",
    body: "Comece em branco ou por um modelo de estudo, brainstorm ou projeto.",
    image: passo1,
    alt: "Diálogo Novo mapa do Mindora com o nome Revolução Francesa e o modelo Estudo escolhido.",
  },
  {
    title: "Puxe os ramos",
    body: "Tab cria um filho, Enter cria um irmão. No celular, um toque em “+ Filho”.",
    image: passo2,
    alt: "Mapa Fotossíntese com os ramos O que é, Onde acontece e Fases, e Fases com dois sub-ramos.",
  },
  {
    title: "Revise e compartilhe",
    body: "Estude o mapa com cartões de revisão ou exporte em imagem ou texto.",
    image: passo3,
    alt: "Cartão de revisão Fotossíntese mostrando os cinco subtópicos e os botões Não lembrei, Com dificuldade e Lembrei.",
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

          {/* Showcase: the real app on a laptop and on a phone (demo account screenshots). */}
          <section id="vitrine" className="mx-auto max-w-6xl px-4 pb-6 pt-16 sm:px-6 lg:px-8">
            <Reveal className="mx-auto max-w-3xl text-center">
              <SectionLabel>O app de verdade</SectionLabel>
              <h2 className="font-display-serif mt-5 text-3xl font-semibold sm:text-5xl">
                Seu conteúdo, <span className="title-accent">em um mapa só</span>.
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
                Fotossíntese inteira numa tela: no computador para montar, no celular para revisar.
              </p>
            </Reveal>
            <Reveal delay={0.08} className="relative mx-auto mt-12 max-w-5xl pb-10 sm:pb-16">
              <div className="rounded-[22px] border border-border/70 bg-[#0b0f19] p-2 shadow-[var(--shadow-soft)] sm:p-3">
                <img
                  src={vitrineComputador}
                  alt="Editor do Mindora no computador com o mapa Fotossíntese (Enem) organizado em árvore: O que é, Onde acontece, Fases, Equação e Fatores."
                  width={1600}
                  height={1000}
                  loading="lazy"
                  decoding="async"
                  className="block w-full rounded-[14px]"
                />
              </div>
              {/* Laptop base. */}
              <div className="mx-auto h-3 w-[104%] -translate-x-[2%] rounded-b-[18px] bg-gradient-to-b from-[#2a3350] to-[#121726] sm:h-4" />
              <div className="absolute -bottom-2 right-2 w-[24%] min-w-[96px] max-w-[210px] rounded-[26px] border border-border/70 bg-[#0b0f19] p-1.5 shadow-[0_30px_60px_-20px_rgba(6,9,15,0.7)] sm:right-6 sm:rounded-[34px] sm:p-2">
                <img
                  src={vitrineCelular}
                  alt="O mesmo mapa no celular, com a barra de ferramentas e o botão + Filho."
                  width={600}
                  height={1298}
                  loading="lazy"
                  decoding="async"
                  className="block w-full rounded-[20px] sm:rounded-[26px]"
                />
              </div>
            </Reveal>
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
                  <div className="landing-panel h-full overflow-hidden rounded-[28px]">
                    <img
                      src={step.image}
                      alt={step.alt}
                      width={960}
                      height={600}
                      loading="lazy"
                      decoding="async"
                      className="aspect-[16/10] w-full border-b border-border/60 object-cover object-left-top"
                    />
                    <div className="p-6">
                      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary">
                        {index + 1}
                      </span>
                      <h3 className="mt-5 text-xl font-semibold">{step.title}</h3>
                      <p className="mt-3 text-sm leading-7 text-muted-foreground">{step.body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* The differentiator, in the hero's art direction: review mode. */}
          <section id="modo-revisao" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <Reveal>
              <div className="relative isolate overflow-hidden rounded-[32px] border border-white/10 bg-[#0B1230] text-[#F3F5FF] shadow-[var(--shadow-soft)] lg:min-h-[540px]">
                <img
                  src={revisaoEstudante}
                  alt="A estudante de óculos olha para o celular, de onde sobem cartões de estudo luminosos ligados por linhas de luz."
                  width={1024}
                  height={576}
                  loading="lazy"
                  decoding="async"
                  className="block h-56 w-full object-cover object-[72%_center] sm:h-80 lg:absolute lg:inset-0 lg:-z-10 lg:h-full"
                />
                <div className="pointer-events-none absolute inset-0 -z-10 hidden bg-[linear-gradient(90deg,#0B1230_0%,rgba(11,18,48,0.94)_32%,rgba(11,18,48,0.35)_58%,transparent_78%)] lg:block" />
                <div className="relative p-8 sm:p-10 lg:max-w-[50%] lg:py-20 lg:pl-14">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#C9D6FF]/80">
                    Modo Revisão
                  </p>
                  <h2 className="font-display-serif mt-4 text-3xl font-semibold sm:text-5xl">
                    Seu mapa vira <span className="dusk-accent">cartão de revisão</span>.
                  </h2>
                  <ul className="mt-6 space-y-3 text-sm leading-6 text-[#C9D6FF] sm:text-base">
                    {[
                      "Cada ramo do mapa vira um cartão, sem você digitar nada de novo.",
                      "Espaço mostra a resposta; 1, 2 ou 3 dizem o quanto você lembrou.",
                      "O app marca a próxima revisão e mostra o quanto do mapa você já domina.",
                    ].map((item) => (
                      <li key={item} className="flex gap-3">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FFA27A]" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={appDestination ?? "/register"}
                    className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#FFA27A] px-6 py-3 text-sm font-semibold text-[#141a3a] transition hover:bg-[#ffb391] pointer-coarse:min-h-11"
                  >
                    {appDestination ? "Revisar meus mapas" : "Experimentar grátis"}
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </Reveal>
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
        </main>

        {/* Night falls at the end of the page: the call to action and the footer under the moon. */}
        <footer className="relative isolate overflow-hidden text-[#F3F5FF]">
          <img
            src={ceuNoturno}
            alt=""
            aria-hidden="true"
            width={1024}
            height={439}
            loading="lazy"
            decoding="async"
            className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover object-[60%_bottom]"
          />
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,var(--color-background)_0%,rgba(6,9,15,0.15)_30%,transparent_60%,rgba(6,9,15,0.55)_100%)]" />
          <div className="mx-auto max-w-7xl px-4 pb-8 pt-40 sm:px-6 sm:pt-48 lg:px-8">
            <Reveal className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#C9D6FF]/80">
                Pronto para começar
              </p>
              <h2 className="font-display-serif mt-4 text-3xl font-semibold sm:text-5xl">
                Crie sua conta e monte o primeiro mapa <span className="dusk-accent">hoje</span>.
              </h2>
              <p className="mt-4 text-base leading-7 text-[#C9D6FF]">
                É grátis para começar, no plano Free. Crie a conta, confirme o e-mail e pronto: você
                já monta o primeiro mapa.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to={appDestination ?? "/register"}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFA27A] px-6 py-3 text-sm font-semibold text-[#141a3a] transition hover:bg-[#ffb391] pointer-coarse:min-h-11"
                >
                  {appDestination ? "Abrir meus mapas" : "Criar conta grátis"}
                  <ArrowRight size={16} />
                </Link>
                {!appDestination && (
                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 pointer-coarse:min-h-11"
                  >
                    Já tenho conta
                  </Link>
                )}
              </div>
            </Reveal>

            <div className="mt-24 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between sm:mt-32">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[image:var(--gradient-hero)] text-primary-foreground">
                  <Network size={18} />
                </span>
                <div>
                  <div className="text-sm font-semibold">Mindora</div>
                  <div className="text-xs text-[#C9D6FF]/80">
                    Mapas mentais para estudar e planejar
                  </div>
                </div>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}
