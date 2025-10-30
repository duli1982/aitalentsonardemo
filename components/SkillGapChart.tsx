import React, { useState, useMemo } from 'react';

interface SkillPoint {
  skill: string;
  candidateProficiency: number;
  rationale: string;
}

interface SkillGapChartProps {
  analysis: SkillPoint[];
  jobSkills: string[];
}

interface Tooltip {
  x: number;
  y: number;
  content: string;
  skill: string;
}

const SkillGapChart: React.FC<SkillGapChartProps> = ({ analysis, jobSkills }) => {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  const chartData = useMemo(() => {
    // Fix: Explicitly type the Map to prevent `unknown` type inference on its values.
    const dataMap: Map<string, SkillPoint> = new Map(analysis.map(item => [item.skill.toLowerCase(), item]));
    return jobSkills
      .map(skill => {
        const analysisItem = dataMap.get(skill.toLowerCase());
        return {
          skill,
          candidateProficiency: analysisItem ? analysisItem.candidateProficiency : 0,
          rationale: analysisItem ? analysisItem.rationale : "Skill not mentioned in profile."
        };
      })
      .slice(0, 8); // Limit to 8 skills for readability
  }, [analysis, jobSkills]);

  const size = 320;
  const levels = 4;
  const margin = 55;
  const radius = (size - margin * 2) / 2;
  const centerX = size / 2;
  const centerY = size / 2;
  const numAxes = chartData.length;
  const angleSlice = (Math.PI * 2) / numAxes;

  if (numAxes < 3) {
    return (
        <div className="text-center text-gray-400 p-4 w-full bg-slate-900/30 rounded-lg">
            A skill comparison chart requires at least 3 skills for the job.
        </div>
    );
  }

  const getPoint = (angle: number, value: number) => {
    const x = centerX + radius * (value / 100) * Math.cos(angle - Math.PI / 2);
    const y = centerY + radius * (value / 100) * Math.sin(angle - Math.PI / 2);
    return { x, y };
  };

  const gridLevels = Array.from({ length: levels }, (_, i) => {
    const levelRadius = radius * ((i + 1) / levels);
    const points = Array.from({ length: numAxes }, (_, j) => {
      const angle = j * angleSlice;
      const x = centerX + levelRadius * Math.cos(angle - Math.PI / 2);
      const y = centerY + levelRadius * Math.sin(angle - Math.PI / 2);
      return `${x},${y}`;
    }).join(' ');
    return <polygon key={i} points={points} className="fill-slate-700/40 stroke-slate-600" strokeWidth="1" />;
  });

  const axes = chartData.map((item, i) => {
    const angle = i * angleSlice;
    const endPoint = getPoint(angle, 100);
    const labelPoint = getPoint(angle, 115);
    return (
      <g key={item.skill}>
        <line x1={centerX} y1={centerY} x2={endPoint.x} y2={endPoint.y} className="stroke-slate-600" strokeWidth="1" />
        <text
          x={labelPoint.x}
          y={labelPoint.y}
          dy="0.35em"
          textAnchor={labelPoint.x > centerX ? "start" : labelPoint.x < centerX ? "end" : "middle"}
          className="text-xs fill-sky-300 font-medium"
        >
          {item.skill}
        </text>
      </g>
    );
  });
  
  const candidateDataPoints = chartData.map((item, i) => {
      const angle = i * angleSlice;
      const point = getPoint(angle, item.candidateProficiency);
      return `${point.x},${point.y}`;
  }).join(' ');
  
  const candidateDataCircles = chartData.map((item, i) => {
      const angle = i * angleSlice;
      const point = getPoint(angle, item.candidateProficiency);
      return (
          <circle 
              key={item.skill}
              cx={point.x}
              cy={point.y}
              r="5"
              className="fill-purple-400 stroke-slate-800 cursor-pointer"
              strokeWidth="2"
              onMouseEnter={() => setTooltip({ x: point.x, y: point.y, content: item.rationale, skill: item.skill })}
              onMouseLeave={() => setTooltip(null)}
          />
      );
  });

  return (
    <div className="relative w-full max-w-[320px] h-[320px]">
        <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%">
            <g>{gridLevels}</g>
            <g>{axes}</g>
            <polygon points={candidateDataPoints} className="fill-purple-500/30 stroke-purple-400" strokeWidth="2" />
            <g>{candidateDataCircles}</g>
        </svg>
        {tooltip && (
            <div 
                className="absolute bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-xs text-gray-200 shadow-lg pointer-events-none transition-opacity duration-200 max-w-xs z-10"
                style={{
                    left: tooltip.x,
                    top: tooltip.y,
                    transform: `translate(${tooltip.x > size/2 ? '-105%' : '5%'}, ${tooltip.y > size/2 ? '-105%' : '5%'})`
                }}
            >
              <p className="font-bold text-purple-300 mb-1">{tooltip.skill}</p>
              <p>{tooltip.content}</p>
            </div>
        )}
    </div>
  );
};

export default SkillGapChart;