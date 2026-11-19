// Landing hero art: a student wearing a visor whose lenses show a mind map, with a cloud leaving
// past the glasses (photo with a transparent background). Small lights keep escaping from that
// cloud, the photo dims a little as the sky turns to night (--night, set by the landing on
// scroll), and the jacket melts into the page instead of ending on a straight cut.
import portrait from "@/assets/landing/estudante-visor.webp";

// Positions in the photo's own pixels (768 × 1024): where the cloud leaves the lenses.
const ESCAPES = [
  { x: 150, y: 420, delay: 0, color: "#FFA27A", r: 5 },
  { x: 142, y: 440, delay: 1.8, color: "#5EA8FF", r: 4 },
  { x: 156, y: 458, delay: 3.6, color: "#00B1C4", r: 4.5 },
  { x: 146, y: 430, delay: 5.4, color: "#C9D6FF", r: 3.5 },
  { x: 152, y: 450, delay: 7.2, color: "#FFA27A", r: 3.8 },
];

export function MindPortrait({ className = "" }: { className?: string }) {
  return (
    <div className={`mind-portrait relative ${className}`}>
      <img
        src={portrait}
        width={768}
        height={1024}
        alt="Estudante com óculos futuristas; nas lentes aparece um mapa de ideias conectadas, e uma nuvem sai pela lateral dos óculos."
        fetchPriority="high"
        decoding="async"
        draggable={false}
        className="mind-portrait__photo block h-auto w-full select-none"
      />
      <svg
        viewBox="0 0 768 1024"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <filter id="mp-glow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {ESCAPES.map((escape, i) => (
          <circle
            key={i}
            className="mind-visor__escape"
            cx={escape.x}
            cy={escape.y}
            r={escape.r}
            fill={escape.color}
            filter="url(#mp-glow)"
            style={{ animationDelay: `${escape.delay}s` }}
          />
        ))}
      </svg>
    </div>
  );
}
