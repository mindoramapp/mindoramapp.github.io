import { Moon, SunMedium } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

export function ThemeToggle({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { theme, toggle } = useTheme();
  const label = theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={[
        "group inline-flex items-center gap-2 pointer-coarse:min-h-11 pointer-coarse:min-w-11 rounded-full border border-border/70 bg-card/80 text-foreground backdrop-blur transition duration-300 hover:border-primary/40 hover:bg-card",
        // Non-compact shows its label from sm up and stays icon-only on phones.
        compact
          ? "h-10 w-10 justify-center"
          : "h-10 w-10 justify-center sm:h-auto sm:w-auto sm:px-3 sm:py-2",
        className,
      ].join(" ")}
    >
      <span className="relative grid h-5 w-5 place-items-center overflow-hidden">
        <SunMedium
          size={16}
          className={`absolute transition duration-300 ${theme === "dark" ? "rotate-0 scale-100" : "-rotate-90 scale-0"}`}
        />
        <Moon
          size={16}
          className={`absolute transition duration-300 ${theme === "light" ? "rotate-0 scale-100" : "rotate-90 scale-0"}`}
        />
      </span>
      {!compact && (
        <span className="hidden text-sm font-medium sm:inline">
          {theme === "dark" ? "Tema claro" : "Tema escuro"}
        </span>
      )}
    </button>
  );
}
