import type { Individual } from '@/models';
import { getDisplayName, getLifeYears } from '@/models/individual';
import { getNodeColor } from '@/visualization';

interface TreeNodeProps {
  individual: Individual;
  x: number;
  y: number;
  selected?: boolean;
  onClick?: () => void;
}

export function TreeNode({ individual, x, y, selected, onClick }: TreeNodeProps) {
  const width = 160;
  const height = 60;
  const color = getNodeColor(individual.sex);

  return (
    <g
      transform={`translate(${x - width / 2}, ${y - height / 2})`}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      <rect
        width={width}
        height={height}
        rx={8}
        fill="white"
        stroke={selected ? '#3b82f6' : color}
        strokeWidth={selected ? 3 : 2}
        className="shadow-md"
      />
      <rect
        x={0}
        y={0}
        width={4}
        height={height}
        rx={2}
        fill={color}
      />
      <text
        x={12}
        y={22}
        fontSize={12}
        fontWeight={600}
        fill="#1f2937"
        className="select-none"
      >
        {getDisplayName(individual).slice(0, 20)}
      </text>
      <text
        x={12}
        y={40}
        fontSize={10}
        fill="#6b7280"
        className="select-none"
      >
        {getLifeYears(individual)}
      </text>
    </g>
  );
}
