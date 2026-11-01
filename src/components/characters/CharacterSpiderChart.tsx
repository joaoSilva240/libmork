import { normalizeAttributeMap } from "@/lib/engine/attributes";
import type { AttributeMap } from "@/lib/engine/attributes";

type CharacterSpiderChartProps = {
  attributes: Partial<AttributeMap>;
  size?: number;
  className?: string;
};

const AXES = [
  ["FOR", "forca"],
  ["DES", "destreza"],
  ["VIG", "vigor"],
  ["INT", "inteligencia"],
  ["EMP", "empatia"],
  ["SOR", "sorte"],
] as const;

const CENTER = 50;
const RADIUS = 40;
const MAX_ATTRIBUTE = 20;

function point(index: number, radius: number): string {
  const angle = -Math.PI / 2 + (index * Math.PI) / 3;
  return `${CENTER + Math.cos(angle) * radius},${CENTER + Math.sin(angle) * radius}`;
}

function polygonPoints(radius: number): string {
  return AXES.map((_, index) => point(index, radius)).join(" ");
}

export function CharacterSpiderChart({ attributes, size = 90, className = "" }: CharacterSpiderChartProps) {
  const normalized = normalizeAttributeMap(attributes);
  const values = AXES.map(([, attribute]) => normalized[attribute]);
  const characterPoints = values
    .map((value, index) => point(index, (Math.min(value, MAX_ATTRIBUTE) / MAX_ATTRIBUTE) * RADIUS))
    .join(" ");

  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label="Gráfico de atributos do personagem"
      className={`pointer-events-none ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      <defs>
        <linearGradient id="character-spider-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c084fc" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#7e22ce" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      {[0.33, 0.66, 1].map((scale) => (
        <polygon
          key={scale}
          points={polygonPoints(RADIUS * scale)}
          fill="none"
          stroke="rgba(192, 132, 252, 0.45)"
          strokeWidth="1"
        />
      ))}
      {AXES.map(([label], index) => {
        const [x2, y2] = point(index, RADIUS).split(",");
        return (
          <line
            key={label}
            x1={CENTER}
            y1={CENTER}
            x2={x2}
            y2={y2}
            stroke="rgba(192, 132, 252, 0.55)"
            strokeWidth="1"
          />
        );
      })}
      <polygon
        points={characterPoints}
        fill="url(#character-spider-gradient)"
        stroke="#e9d5ff"
        strokeWidth="2"
      />
      {AXES.map(([label], index) => {
        const [dotX, dotY] = point(
          index,
          (Math.min(values[index], MAX_ATTRIBUTE) / MAX_ATTRIBUTE) * RADIUS
        ).split(",");
        return (
          <circle
            key={label}
            cx={dotX}
            cy={dotY}
            r="2"
            fill="#ffffff"
          />
        );
      })}
    </svg>
  );
}
