import { cn } from "@/lib/utils";

interface ProgressCircleProps {
  progress: number;
  size?: number;
  stroke?: number;
  label?: string;
  className?: string;
}

export function ProgressCircle({ progress, size = 40, stroke = 4, label, className }: ProgressCircleProps) {
  const clamped = Math.min(100, Math.max(0, progress));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          className="text-muted"
          stroke="currentColor"
          fill="transparent"
          opacity={0.15}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          className="text-primary transition-all duration-200 ease-out"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
        />
      </svg>
      <span className="absolute text-[11px] font-medium text-foreground">{clamped.toFixed(0)}%</span>
      {label ? <span className="sr-only">{label}</span> : null}
    </div>
  );
}
