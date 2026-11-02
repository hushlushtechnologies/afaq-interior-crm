import type { DemoChartPoint } from '@/types/demo-crm';

const barColors = ['fill-chart-1', 'fill-chart-2', 'fill-chart-3', 'fill-chart-4', 'fill-chart-5'];

export function MiniBarChart({ label, data }: { label: string; data: readonly DemoChartPoint[] }) {
  const maximum = Math.max(1, ...data.map((item) => item.value));

  return (
    <figure aria-label={label}>
      <figcaption className="sr-only">{label}</figcaption>

      <ul className="space-y-4">
        {data.map((item, index) => (
          <li
            key={item.label}
            className="grid grid-cols-[7rem_minmax(0,1fr)_auto] items-center gap-3"
          >
            <span className="text-xs leading-relaxed text-muted-foreground">{item.label}</span>

            <svg
              viewBox="0 0 100 12"
              preserveAspectRatio="none"
              aria-hidden="true"
              className="h-3 w-full overflow-visible"
            >
              <rect x={0} y={0} width={100} height={12} rx={6} className="fill-muted" />
              <rect
                x={0}
                y={0}
                width={(item.value / maximum) * 100}
                height={12}
                rx={6}
                className={barColors[index % barColors.length]}
              />
            </svg>

            <span className="min-w-5 text-right text-sm font-semibold tabular-nums">
              {item.value}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export function MiniLineChart({ label, data }: { label: string; data: readonly DemoChartPoint[] }) {
  const maximum = Math.max(1, ...data.map((item) => item.value));

  const points = data.map((item, index) => ({
    x: data.length > 1 ? 12 + (index / (data.length - 1)) * 396 : 210,
    y: 124 - (item.value / maximum) * 104,
  }));

  const polyline = points.map((point) => point.x + ',' + point.y).join(' ');

  return (
    <figure aria-label={label}>
      <figcaption className="sr-only">{label}</figcaption>

      <svg viewBox="0 0 420 140" aria-hidden="true" className="h-40 w-full">
        {[20, 72, 124].map((y) => (
          <line
            key={y}
            x1={12}
            x2={408}
            y1={y}
            y2={y}
            className="stroke-border"
            strokeWidth={1}
            strokeDasharray="4 5"
          />
        ))}

        <polyline
          points={polyline}
          className="fill-none stroke-primary"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((point, index) => (
          <circle
            key={data[index].label}
            cx={point.x}
            cy={point.y}
            r={4}
            className="fill-card stroke-primary"
            strokeWidth={2}
          />
        ))}
      </svg>

      <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {data.map((item) => (
          <li key={item.label} className="space-y-1">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="text-sm font-semibold tabular-nums">{item.value}</p>
          </li>
        ))}
      </ul>
    </figure>
  );
}
