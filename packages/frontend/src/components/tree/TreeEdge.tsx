interface TreeEdgeProps {
  d: string;
}

export function TreeEdge({ d }: TreeEdgeProps) {
  return (
    <path
      d={d}
      fill="none"
      stroke="#9ca3af"
      strokeWidth={2}
      strokeLinecap="round"
    />
  );
}
