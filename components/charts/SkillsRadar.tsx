// SkillsRadar - Radar chart for multi-dimensional skill visualization
// Uses Recharts for rich interactivity

import React from 'react';
import {
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
    Legend,
    ResponsiveContainer,
    Tooltip
} from 'recharts';

interface SkillDimension {
    skill: string;
    current: number;
    required: number;
    industry?: number;
}

interface SkillsRadarProps {
    data: SkillDimension[];
    height?: number;
    showIndustry?: boolean;
}

const SkillsRadar: React.FC<SkillsRadarProps> = ({
    data,
    height = 300,
    showIndustry = false
}) => {
    return (
        <ResponsiveContainer width="100%" height={height}>
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                <PolarGrid stroke="#334155" />

                <PolarAngleAxis
                    dataKey="skill"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                />

                <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    tickCount={5}
                />

                <Tooltip
                    contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#f1f5f9'
                    }}
                />

                {/* Required level (target) */}
                <Radar
                    name="Required"
                    dataKey="required"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.1}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                />

                {/* Current level */}
                <Radar
                    name="Current"
                    dataKey="current"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.3}
                    strokeWidth={2}
                />

                {/* Industry benchmark */}
                {showIndustry && (
                    <Radar
                        name="Industry Avg"
                        dataKey="industry"
                        stroke="#10b981"
                        fill="transparent"
                        strokeWidth={1}
                        strokeDasharray="3 3"
                    />
                )}

                <Legend
                    wrapperStyle={{ paddingTop: '10px' }}
                    formatter={(value) => <span style={{ color: '#94a3b8' }}>{value}</span>}
                />
            </RadarChart>
        </ResponsiveContainer>
    );
};

export default SkillsRadar;
