// Floating editor panels (desktop) and bottom/side sheets (phones).
// Panels can be dragged anywhere inside the canvas both expanded and minimized, snap to the
// nearest edge or corner when released close to it, and can be closed.
import { useCallback, useEffect, useRef, useState } from "react";
import { GripHorizontal, Minus, PanelBottomOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PanelPosition {
  x: number;
  y: number;
}

interface FloatingPanelProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  open: boolean;
  minimized: boolean;
  mobile: boolean;
  position: PanelPosition;
  widthClassName?: string;
  onToggle: () => void;
  onMinimize: () => void;
  onClose?: () => void;
  onPositionChange: (position: PanelPosition) => void;
  children: React.ReactNode;
}

const MARGIN = 12;
const SNAP_DISTANCE = 40;
const DRAG_THRESHOLD = 4;

/** Keeps a position inside the element's container (the editor canvas), not the window. */
function clampToContainer(element: HTMLElement, position: PanelPosition): PanelPosition {
  const container = element.offsetParent as HTMLElement | null;
  const width = container?.clientWidth ?? window.innerWidth;
  const height = container?.clientHeight ?? window.innerHeight;
  const maxX = Math.max(MARGIN, width - element.offsetWidth - MARGIN);
  const maxY = Math.max(MARGIN, height - element.offsetHeight - MARGIN);
  return {
    x: Math.min(maxX, Math.max(MARGIN, position.x)),
    y: Math.min(maxY, Math.max(MARGIN, position.y)),
  };
}

/** Magnetic edges: released near a side or corner, the panel settles against it. */
function snapToEdges(element: HTMLElement, position: PanelPosition): PanelPosition {
  const clamped = clampToContainer(element, position);
  const container = element.offsetParent as HTMLElement | null;
  const maxX = (container?.clientWidth ?? window.innerWidth) - element.offsetWidth - MARGIN;
  const maxY = (container?.clientHeight ?? window.innerHeight) - element.offsetHeight - MARGIN;
  return {
    x:
      clamped.x - MARGIN < SNAP_DISTANCE
        ? MARGIN
        : maxX - clamped.x < SNAP_DISTANCE
          ? maxX
          : clamped.x,
    y:
      clamped.y - MARGIN < SNAP_DISTANCE
        ? MARGIN
        : maxY - clamped.y < SNAP_DISTANCE
          ? maxY
          : clamped.y,
  };
}

/**
 * Pointer-based dragging that works with mouse, pen and touch. While dragging, the element is
 * moved directly (once per animation frame) without touching React state: re-rendering the
 * editor on every pointer move made the panel stall and then jump on slower machines. The final
 * position is committed once, on release.
 */
function usePanelDrag(
  elementRef: React.RefObject<HTMLElement | null>,
  enabled: boolean,
  onPositionChange: (position: PanelPosition) => void,
) {
  const start = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);
  const latest = useRef<PanelPosition | null>(null);
  const frame = useRef<number | null>(null);
  const moved = useRef(false);
  const [dragging, setDragging] = useState(false);

  const paint = () => {
    frame.current = null;
    const element = elementRef.current;
    if (!element || !latest.current) return;
    element.style.left = `${latest.current.x}px`;
    element.style.top = `${latest.current.y}px`;
  };

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    const element = elementRef.current;
    if (!enabled || !element || event.button !== 0) return;
    start.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: element.offsetLeft,
      y: element.offsetTop,
    };
    moved.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const element = elementRef.current;
    if (!start.current || !element) return;
    const dx = event.clientX - start.current.pointerX;
    const dy = event.clientY - start.current.pointerY;
    if (!moved.current) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      moved.current = true;
      setDragging(true);
    }
    latest.current = clampToContainer(element, {
      x: start.current.x + dx,
      y: start.current.y + dy,
    });
    frame.current ??= requestAnimationFrame(paint);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLElement>) => {
    const element = elementRef.current;
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      paint();
    }
    if (start.current && moved.current && element) {
      const final = snapToEdges(element, { x: element.offsetLeft, y: element.offsetTop });
      element.style.left = `${final.x}px`;
      element.style.top = `${final.y}px`;
      onPositionChange(final);
    }
    start.current = null;
    latest.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return {
    dragging,
    wasDragged: () => moved.current,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      style: { touchAction: "none" as const },
    },
  };
}

export function FloatingPanel({
  id,
  title,
  icon,
  open,
  minimized,
  mobile,
  position,
  widthClassName = "w-[320px]",
  onToggle,
  onMinimize,
  onClose,
  onPositionChange,
  children,
}: FloatingPanelProps) {
  const elementRef = useRef<HTMLElement | null>(null);
  const setElement = useCallback((node: HTMLElement | null) => {
    elementRef.current = node;
  }, []);
  const { dragging, wasDragged, handleProps } = usePanelDrag(elementRef, !mobile, onPositionChange);

  // Keep the panel inside the canvas when it changes size (expand/minimize) or the window resizes.
  useEffect(() => {
    if (mobile || !open || dragging) return;
    const reclamp = () => {
      const element = elementRef.current;
      if (!element) return;
      const next = clampToContainer(element, position);
      if (Math.abs(next.x - position.x) > 1 || Math.abs(next.y - position.y) > 1) {
        onPositionChange(next);
      }
    };
    reclamp();
    window.addEventListener("resize", reclamp);
    return () => window.removeEventListener("resize", reclamp);
  }, [mobile, open, minimized, dragging, position, onPositionChange]);

  if (!open) return null;

  if (minimized) {
    if (mobile) return null;

    return (
      <div
        ref={setElement}
        data-panel-id={`${id}-tab`}
        className={cn(
          "group absolute z-20 inline-flex items-center rounded-full border border-border bg-card text-xs font-medium text-foreground shadow-[var(--shadow-soft)]",
          dragging ? "cursor-grabbing select-none" : "cursor-grab",
        )}
        style={{ left: position.x, top: position.y }}
      >
        <button
          type="button"
          {...handleProps}
          onClick={() => {
            if (!wasDragged()) onToggle();
          }}
          className="inline-flex items-center gap-2 rounded-full py-2 pl-2 pr-3 hover:bg-muted pointer-coarse:min-h-11"
          aria-label={`Expandir ${title} (arraste para mover)`}
          title="Clique para abrir · arraste para mover"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-primary">
            {icon}
          </span>
          <span>{title}</span>
          <PanelBottomOpen size={14} className="text-muted-foreground" />
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="mr-1 grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground pointer-coarse:h-11 pointer-coarse:w-11"
            aria-label={`Fechar ${title}`}
            title="Fechar (reabra em “Painéis”)"
          >
            <X size={13} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      ref={setElement}
      data-panel-id={id}
      className={cn(
        "z-20 overflow-hidden rounded-3xl border border-border bg-card text-card-foreground shadow-[var(--shadow-soft)]",
        mobile
          ? // Portrait: bottom sheet. Landscape phones (short screens): side sheet on the right.
            "fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] max-h-[72dvh] [@media(max-height:560px)]:inset-x-auto [@media(max-height:560px)]:bottom-3 [@media(max-height:560px)]:right-3 [@media(max-height:560px)]:top-3 [@media(max-height:560px)]:w-80 [@media(max-height:560px)]:max-h-none"
          : `absolute ${widthClassName}`,
        dragging && "select-none shadow-xl",
      )}
      style={mobile ? undefined : { left: position.x, top: position.y }}
    >
      <div
        {...(mobile ? {} : handleProps)}
        className={cn(
          "flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3",
          mobile ? "cursor-default" : dragging ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-2xl bg-primary/10 text-primary">
            {icon}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{title}</div>
            {!mobile && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <GripHorizontal size={12} /> Arraste para mover
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onMinimize}
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground pointer-coarse:h-11 pointer-coarse:w-11"
            title="Minimizar"
            aria-label={`Minimizar ${title}`}
          >
            <Minus size={14} />
          </button>
          {onClose && !mobile && (
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground pointer-coarse:h-11 pointer-coarse:w-11"
              title="Fechar (reabra em “Painéis”)"
              aria-label={`Fechar ${title}`}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div
        className={cn(
          "overflow-auto",
          mobile
            ? "max-h-[calc(72dvh-65px)] p-4 [@media(max-height:560px)]:max-h-[calc(100dvh-5.5rem)]"
            : "max-h-[65vh] p-4",
        )}
      >
        {children}
      </div>
    </div>
  );
}

interface PanelDockItemProps {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  minimized: boolean;
  onClick: () => void;
}

export function PanelDockItem({ label, icon, active, minimized, onClick }: PanelDockItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium shadow-[var(--shadow-soft)] transition pointer-coarse:min-h-11 pointer-coarse:min-w-11 justify-center",
        active
          ? "border-primary/40 bg-primary text-primary-foreground"
          : minimized
            ? "border-border/80 bg-card/95 text-foreground hover:bg-muted"
            : "border-border/80 bg-card/70 text-muted-foreground hover:text-foreground",
      )}
    >
      {active ? <PanelBottomOpen size={14} /> : icon}
      <span className="max-[430px]:sr-only">{label}</span>
    </button>
  );
}
