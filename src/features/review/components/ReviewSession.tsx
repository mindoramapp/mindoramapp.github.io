// Review session: shows each branch, lets the learner try to recall its sub-topics, reveals them
// and records how well they remembered. Keyboard: Espaço/Enter revela, 1/2/3 avaliam.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Eye, GraduationCap, RotateCcw, StickyNote } from "lucide-react";
import { reportActionError } from "@/lib/feedback";
import type { MindMap } from "@/store/maps";
import { saveReviewState } from "../api";
import { buildCards, type ReviewCard } from "../cards";
import { formatDue, formatInterval } from "../format";
import { buildSession, schedule, summarize, type Grade, type ReviewState } from "../scheduler";

interface Props {
  map: MindMap;
  userId: string;
  initialStates: Map<string, ReviewState>;
}

const GRADES: { grade: Grade; key: string; label: string; className: string }[] = [
  {
    grade: "again",
    key: "1",
    label: "Não lembrei",
    className: "border-destructive/40 text-destructive hover:bg-destructive/10",
  },
  {
    grade: "hard",
    key: "2",
    label: "Com dificuldade",
    className: "border-border text-foreground hover:bg-muted",
  },
  {
    grade: "good",
    key: "3",
    label: "Lembrei",
    className: "border-primary/40 text-primary hover:bg-primary/10",
  },
];

type Phase = "intro" | "reviewing" | "done";

export function ReviewSession({ map, userId, initialStates }: Props) {
  const cards = useMemo(() => buildCards(map.nodes, map.edges), [map.nodes, map.edges]);
  const [states, setStates] = useState(initialStates);
  const [phase, setPhase] = useState<Phase>("intro");
  const [queue, setQueue] = useState<ReviewCard[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [requeued, setRequeued] = useState<Set<string>>(new Set());
  const [tally, setTally] = useState<Record<Grade, number>>({ again: 0, hard: 0, good: 0 });

  const now = new Date();
  const summary = summarize(cards, states, now);
  const pending = buildSession(cards, states, now);
  const current = queue[index];

  const start = useCallback(
    (everything = false) => {
      const session = buildSession(cards, states, new Date(), { everything });
      if (session.length === 0) return;
      setQueue(session);
      setIndex(0);
      setRevealed(false);
      setRequeued(new Set());
      setTally({ again: 0, hard: 0, good: 0 });
      setPhase("reviewing");
    },
    [cards, states],
  );

  const grade = useCallback(
    (value: Grade) => {
      if (!current || !revealed) return;
      const next = schedule(states.get(current.nodeId), value, new Date());
      setStates((previous) => new Map(previous).set(current.nodeId, next));
      setTally((previous) => ({ ...previous, [value]: previous[value] + 1 }));
      saveReviewState(userId, map.id, current.nodeId, next).catch((error) =>
        reportActionError(error, "Não foi possível salvar seu progresso. Continue revisando."),
      );

      // Forgotten cards come back once at the end of the session for another try.
      let nextQueue = queue;
      if (value === "again" && !requeued.has(current.nodeId)) {
        nextQueue = [...queue, current];
        setQueue(nextQueue);
        setRequeued((previous) => new Set(previous).add(current.nodeId));
      }

      if (index + 1 >= nextQueue.length) {
        setPhase("done");
      } else {
        setIndex(index + 1);
        setRevealed(false);
      }
    },
    [current, revealed, states, userId, map.id, queue, requeued, index],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (phase === "intro" && event.key === "Enter" && pending.length > 0) {
        event.preventDefault();
        start();
      } else if (
        phase === "reviewing" &&
        !revealed &&
        (event.key === " " || event.key === "Enter")
      ) {
        event.preventDefault();
        setRevealed(true);
      } else if (phase === "reviewing" && revealed) {
        const match = GRADES.find((option) => option.key === event.key);
        if (match) {
          event.preventDefault();
          grade(match.grade);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, revealed, pending.length, start, grade]);

  const backToMap = (
    <Link
      to="/editor/$id"
      params={{ id: map.id }}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted"
    >
      <ArrowLeft size={16} /> Voltar ao mapa
    </Link>
  );

  if (cards.length === 0) {
    return (
      <Panel>
        <GraduationCap className="mx-auto text-muted-foreground" size={36} />
        <h1 className="mt-4 text-xl font-semibold">Ainda não há o que revisar</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cada tópico que tem subtópicos vira um cartão de revisão. Adicione alguns ramos ao mapa e
          volte aqui.
        </p>
        <div className="mt-6 flex justify-center">{backToMap}</div>
      </Panel>
    );
  }

  if (phase === "intro") {
    return (
      <Panel>
        <GraduationCap className="mx-auto text-primary" size={36} />
        <h1 className="mt-4 text-xl font-semibold">Revisar “{map.title}”</h1>
        <MasteryBar mastered={summary.mastered} total={summary.total} />
        {pending.length > 0 ? (
          <>
            <p className="mt-4 text-sm text-muted-foreground">
              {pending.length} {pending.length === 1 ? "cartão" : "cartões"} para agora
              {summary.unseen > 0 && ` · ${summary.unseen} nunca revisados`}
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              {backToMap}
              <button type="button" onClick={() => start()} className={PRIMARY_BUTTON}>
                Começar revisão
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-4 text-sm text-muted-foreground">
              Tudo em dia!
              {summary.nextDueAt && ` Próxima revisão ${formatDue(summary.nextDueAt, now)}.`}
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              {backToMap}
              <button type="button" onClick={() => start(true)} className={SECONDARY_BUTTON}>
                <RotateCcw size={16} /> Revisar tudo mesmo assim
              </button>
            </div>
          </>
        )}
      </Panel>
    );
  }

  if (phase === "done") {
    return (
      <Panel>
        <CheckCircle2 className="mx-auto text-primary" size={36} />
        <h1 className="mt-4 text-xl font-semibold">Revisão concluída</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Lembrou {tally.good} · com dificuldade {tally.hard} · não lembrou {tally.again}
        </p>
        <MasteryBar mastered={summary.mastered} total={summary.total} />
        {summary.nextDueAt && (
          <p className="mt-3 text-sm text-muted-foreground">
            Próxima revisão {formatDue(summary.nextDueAt, now)}.
          </p>
        )}
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          {backToMap}
          <button type="button" onClick={() => start(true)} className={SECONDARY_BUTTON}>
            <RotateCcw size={16} /> Revisar novamente
          </button>
        </div>
      </Panel>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
        <span>
          Cartão {index + 1} de {queue.length}
        </span>
        <Link to="/editor/$id" params={{ id: map.id }} className="hover:text-foreground">
          Sair da revisão
        </Link>
      </div>
      <div
        className="h-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Progresso da revisão"
        aria-valuemin={0}
        aria-valuemax={queue.length}
        aria-valuenow={index}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${(index / queue.length) * 100}%` }}
        />
      </div>

      <section
        aria-live="polite"
        className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] sm:p-8"
      >
        {current.path.length > 0 && (
          <p className="text-xs text-muted-foreground">{current.path.join(" › ")}</p>
        )}
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{current.prompt}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Quais são os {current.answers.length}{" "}
          {current.answers.length === 1 ? "subtópico" : "subtópicos"}? Tente lembrar antes de
          revelar.
        </p>

        {revealed ? (
          <ul className="mt-6 space-y-2">
            {current.answers.map((answer, position) => (
              <li
                key={`${answer}-${position}`}
                className="rounded-xl bg-muted/60 px-4 py-2.5 text-sm text-foreground"
              >
                {answer}
              </li>
            ))}
          </ul>
        ) : null}
        {revealed && current.note && (
          <div className="mt-4 rounded-xl border border-border bg-background px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <StickyNote size={12} /> Suas anotações
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{current.note}</p>
          </div>
        )}
        {revealed ? null : (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className={`${PRIMARY_BUTTON} mt-6 w-full`}
          >
            <Eye size={16} /> Mostrar resposta
            <kbd className="ml-1 rounded bg-primary-foreground/20 px-1.5 text-xs">Espaço</kbd>
          </button>
        )}
      </section>

      {revealed && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label="Como foi?">
          {GRADES.map((option) => (
            <button
              key={option.grade}
              type="button"
              onClick={() => grade(option.grade)}
              className={`flex flex-col items-center rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${option.className}`}
            >
              <span>
                {option.label}{" "}
                <kbd className="ml-1 rounded bg-muted px-1.5 text-xs text-muted-foreground">
                  {option.key}
                </kbd>
              </span>
              <span className="mt-0.5 text-xs font-normal text-muted-foreground">
                volta em{" "}
                {formatInterval(
                  schedule(states.get(current.nodeId), option.grade, now).intervalDays || 10 / 1440,
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const PRIMARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90";
const SECONDARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted";

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-12">
      <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-soft)]">
        {children}
      </div>
    </div>
  );
}

function MasteryBar({ mastered, total }: { mastered: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((mastered / total) * 100);
  return (
    <div className="mx-auto mt-5 max-w-xs text-left">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Domínio do mapa</span>
        <span className="font-medium text-foreground">{percent}%</span>
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Domínio do mapa"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {mastered} de {total} {total === 1 ? "ramo dominado" : "ramos dominados"}
      </p>
      {mastered < total && (
        <p className="mt-1 text-xs text-muted-foreground">
          Um ramo conta como dominado depois de ser lembrado em revisões de dias diferentes.
        </p>
      )}
    </div>
  );
}
