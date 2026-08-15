// CapabilityHeatmap - Bar chart for capability gap visualization
// Uses Recharts for rich interactivity

import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell,
    ReferenceLine
} from 'recharts';

interface CapabilityData {
    department: string;
    current: number;
    required: number;
    gap: number;
}

interface CapabilityHeatmapProps {
    data: CapabilityData[];
    height?: number;
}

const getGapColor = (gap: number): string => {
    if (gap >= 0) return '#10b981'; // Surplus (green)
    if (gap > -20) return '#f59e0b'; // Small gap (yellow)
    return '#ef4444'; // Critical gap (red)
};

const CapabilityHeatmap: React.FC<CapabilityHeatmapProps> = ({
    data,
    height = 300
}) => {
    return (
        <ResponsiveContainer width="100%" height={height}>
            <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 20, right: 30, left: 80, bottom: 5 }}
            >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />

                <XAxis
                    type="number"
                    domain={[-50, 50]}
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}%`}
                />

                <YAxis
                    type="category"
                    dataKey="department"
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    width={75}
                />

                <Tooltip
                    contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#f1f5f9'
                    }}
                    formatter={(value: number) => [
                        `${value > 0 ? '+' : ''}${value}%`,
                        value >= 0 ? 'Surplus' : 'Gap'
                    ]}
                />

                <ReferenceLine x={0} stroke="#64748b" strokeWidth={2} />

                <Bar dataKey="gap" name="Capability Gap" radius={[0, 4, 4, 0]}>
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getGapColor(entry.gap)} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
};

export default CapabilityHeatmap;
