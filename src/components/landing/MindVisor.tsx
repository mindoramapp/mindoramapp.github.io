// Landing hero art: a line-drawn bust with a visor across the eyes, where a constellation of
// connected ideas (a mind map) drifts by forever, and a few ideas escape past the face.
// Seamless loop: the strip is one tile drawn twice side by side and slides by exactly one tile
// width, so the restart is invisible; links that cross the tile's right edge land on the copy.
// The visor darkens with the page's --night variable (set by the landing on scroll).

const TILE = 600; // strip tile width, in SVG units
// Inside the face (the head spans x 180–420 at eye level): an opening, not goggles.
const VISOR = { x: 198, y: 166, w: 204, h: 70 };
const COLORS = ["#5EA8FF", "#00B1C4", "#FFA27A", "#C9D6FF"];

/** Small deterministic PRNG, so the constellation is the same on every visit and render. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Idea = { x: number; y: number; r: number; color: string; pill: boolean };

const random = mulberry32(20261119);
const IDEAS: Idea[] = Array.from({ length: 22 }, (_, i) => ({
  x: 12 + i * 26.5 + random() * 10,
  y: VISOR.y + 12 + random() * (VISOR.h - 24),
  r: 2.2 + random() * 3.4,
  color: COLORS[Math.floor(random() * COLORS.length)],
  pill: i % 4 === 1,
}));
// Each idea links to the next and, now and then, to the one after (a web, not a line). The
// last ones wrap to the first ideas of the next copy, shifted by one tile.
const LINKS: [Idea, { x: number; y: number }][] = IDEAS.flatMap((idea, i) => {
  const at = (j: number) => {
    const target = IDEAS[j % IDEAS.length];
    return { x: target.x + (j >= IDEAS.length ? TILE : 0), y: target.y };
  };
  const links: [Idea, { x: number; y: number }][] = [[idea, at(i + 1)]];
  if (i % 3 === 0) links.push([idea, at(i + 2)]);
  return links;
});
const STARS = Array.from({ length: 22 }, () => ({
  x: random() * TILE,
  y: VISOR.y + random() * VISOR.h,
  r: 0.4 + random() * 0.8,
}));
const ESCAPES = [
  { y: 186, delay: 0, color: "#FFA27A", r: 4 },
  { y: 204, delay: 1.8, color: "#5EA8FF", r: 3 },
  { y: 222, delay: 3.6, color: "#00B1C4", r: 3.5 },
  { y: 196, delay: 5.4, color: "#C9D6FF", r: 2.5 },
  { y: 212, delay: 7.2, color: "#FFA27A", r: 2.8 },
];
// Classical curls on top of the head, in thin strokes.
const HAIR = [
  "M194 156 C196 112 228 76 270 68",
  "M210 146 C218 110 248 88 288 84",
  "M232 132 C246 106 276 96 312 100",
  "M300 70 C346 68 388 98 404 146",
  "M316 90 C352 92 382 116 394 150",
  "M262 92 C270 80 286 78 292 88 C296 96 286 102 280 96",
  "M330 104 C340 94 356 96 358 108 C360 118 348 120 344 112",
  "M226 112 C232 100 246 100 248 110 C250 118 240 122 236 116",
  "M368 128 C378 120 390 126 388 136",
];

function Tile({ offset }: { offset: number }) {
  return (
    <g transform={`translate(${offset} 0)`}>
      {STARS.map((star, i) => (
        <circle key={`s${i}`} cx={star.x} cy={star.y} r={star.r} fill="#E8EEFF" opacity={0.5} />
      ))}
      {LINKS.map(([from, to], i) => (
        <line
          key={`l${i}`}
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke="#9FC3FF"
          strokeOpacity={0.45}
          strokeWidth={1}
        />
      ))}
      {IDEAS.map((idea, i) =>
        idea.pill ? (
          <rect
            key={`i${i}`}
            x={idea.x - 11}
            y={idea.y - 4.5}
            width={22}
            height={9}
            rx={4.5}
            fill={idea.color}
            filter="url(#mv-glow)"
          />
        ) : (
          <circle
            key={`i${i}`}
            cx={idea.x}
            cy={idea.y}
            r={idea.r}
            fill={idea.color}
            filter="url(#mv-glow)"
          />
        ),
      )}
    </g>
  );
}

export function MindVisor({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 600 640"
      className={`mind-visor ${className}`}
      role="img"
      aria-label="Ilustração: um busto com uma janela no lugar dos olhos, por onde passa sem parar um mapa de ideias conectadas; algumas ideias escapam pela lateral do rosto."
    >
      <defs>
        <linearGradient id="mv-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#24356F" />
          <stop offset="0.55" stopColor="#131D45" />
          <stop offset="1" stopColor="#0A1029" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="mv-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFA27A" />
          <stop offset="0.5" stopColor="#C9D6FF" />
          <stop offset="1" stopColor="#00B1C4" />
        </linearGradient>
        <linearGradient id="mv-line" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFC3A6" stopOpacity="0.9" />
          <stop offset="0.6" stopColor="#9FC3FF" stopOpacity="0.55" />
          <stop offset="1" stopColor="#9FC3FF" stopOpacity="0" />
        </linearGradient>
        {/* Horizontally uniform sky: identical on both tiles, so it never shows the seam. */}
        <linearGradient id="mv-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#14205A" />
          <stop offset="0.6" stopColor="#3B3C8F" />
          <stop offset="1" stopColor="#E7898A" />
        </linearGradient>
        <radialGradient id="mv-leak">
          <stop offset="0" stopColor="#FFA27A" stopOpacity="0.35" />
          <stop offset="1" stopColor="#FFA27A" stopOpacity="0" />
        </radialGradient>
        <clipPath id="mv-window">
          <rect x={VISOR.x} y={VISOR.y} width={VISOR.w} height={VISOR.h} rx={VISOR.h / 2} />
        </clipPath>
        <filter id="mv-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Bust: shoulders, neck and head, line-drawn with a soft fill. */}
      <path
        d="M250 410 C200 428 122 440 84 478 C52 510 42 560 38 640 L562 640 C558 560 548 510 516 478 C478 440 400 428 350 410 Z"
        fill="url(#mv-body)"
      />
      <path
        d="M38 640 C42 560 52 510 84 478 C122 440 200 428 250 410 M350 410 C400 428 478 440 516 478 C548 510 558 560 562 640"
        fill="none"
        stroke="url(#mv-line)"
        strokeWidth={1.6}
      />
      {/* Neck: filled shape plus its two sides only, so no line shows under the chin. */}
      <path
        d="M262 330 C262 368 258 392 250 412 L350 412 C342 392 338 368 338 330 Z"
        fill="#16214D"
      />
      <path
        d="M262 336 C262 368 258 392 250 412 M338 336 C338 368 342 392 350 412"
        fill="none"
        stroke="url(#mv-line)"
        strokeWidth={1.4}
      />
      <path
        d="M300 56 C372 56 420 110 420 190 C420 252 398 302 360 332 C342 346 322 354 300 354 C278 354 258 346 240 332 C202 302 180 252 180 190 C180 110 228 56 300 56 Z"
        fill="url(#mv-body)"
        stroke="url(#mv-line)"
        strokeWidth={1.8}
      />
      {HAIR.map((d, i) => (
        <path
          key={`h${i}`}
          d={d}
          fill="none"
          stroke="#C9D6FF"
          strokeOpacity={0.32}
          strokeWidth={1.3}
          strokeLinecap="round"
        />
      ))}
      <path
        d="M304 242 C306 258 310 270 312 278 C306 283 298 284 292 281"
        fill="none"
        stroke="#9FC3FF"
        strokeOpacity={0.45}
        strokeWidth={1.3}
        strokeLinecap="round"
      />
      <path
        d="M284 304 C292 300 298 301 300 303 C302 301 308 300 316 304 C308 310 292 310 284 304 Z"
        fill="#9FC3FF"
        fillOpacity={0.12}
        stroke="#9FC3FF"
        strokeOpacity={0.4}
        strokeWidth={1.1}
      />

      {/* Visor: the drifting mind map, clipped to the band across the eyes. */}
      <g clipPath="url(#mv-window)">
        <rect x={0} y={VISOR.y} width={TILE * 2} height={VISOR.h} fill="url(#mv-sky)" />
        <g className="mind-visor__strip">
          <Tile offset={0} />
          <Tile offset={TILE} />
        </g>
        <rect
          className="mind-visor__night"
          x={0}
          y={VISOR.y}
          width={TILE}
          height={VISOR.h}
          fill="#070B22"
        />
      </g>
      <rect
        x={VISOR.x}
        y={VISOR.y}
        width={VISOR.w}
        height={VISOR.h}
        rx={VISOR.h / 2}
        fill="none"
        stroke="url(#mv-rim)"
        strokeOpacity={0.7}
        strokeWidth={1.4}
      />
      {/* A warm glow where the ideas leave the face. */}
      <ellipse cx={VISOR.x - 4} cy={VISOR.y + VISOR.h / 2} rx={46} ry={30} fill="url(#mv-leak)" />

      {/* Ideas escaping past the left side of the face, like clouds out of the reference. */}
      {ESCAPES.map((escape, i) => (
        <circle
          key={`e${i}`}
          className="mind-visor__escape"
          cx={VISOR.x + 6}
          cy={escape.y}
          r={escape.r}
          fill={escape.color}
          filter="url(#mv-glow)"
          style={{ animationDelay: `${escape.delay}s` }}
        />
      ))}
    </svg>
  );
}
