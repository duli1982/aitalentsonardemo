// ForecastChart - Interactive line chart for demand forecasting
// Uses Recharts for rich interactivity

import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Area,
    ComposedChart
} from 'recharts';

interface ForecastDataPoint {
    month: string;
    baseline: number;
    optimistic?: number;
    pessimistic?: number;
    actual?: number;
}

interface ForecastChartProps {
    data: ForecastDataPoint[];
    showScenarios?: boolean;
    height?: number;
}

const ForecastChart: React.FC<ForecastChartProps> = ({
    data,
    showScenarios = true,
    height = 300
}) => {
    return (
        <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <defs>
                    <linearGradient id="colorBaseline" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorOptimistic" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />

                <XAxis
                    dataKey="month"
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                />

                <YAxis
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    label={{
                        value: 'Headcount',
                        angle: -90,
                        position: 'insideLeft',
                        fill: '#64748b'
                    }}
                />

                <Tooltip
                    contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#f1f5f9'
                    }}
                    labelStyle={{ color: '#94a3b8' }}
                />

                <Legend
                    wrapperStyle={{ paddingTop: '10px' }}
                    formatter={(value) => <span style={{ color: '#94a3b8' }}>{value}</span>}
                />

                {/* Confidence band between optimistic and pessimistic */}
                {showScenarios && (
                    <>
                        <Area
                            type="monotone"
                            dataKey="optimistic"
                            stroke="#10b981"
                            strokeWidth={1}
                            strokeDasharray="5 5"
                            fill="url(#colorOptimistic)"
                            name="Optimistic"
                        />
                        <Area
                            type="monotone"
                            dataKey="pessimistic"
                            stroke="#f59e0b"
                            strokeWidth={1}
                            strokeDasharray="5 5"
                            fill="transparent"
                            name="Pessimistic"
                        />
                    </>
                )}

                {/* Main baseline */}
                <Area
                    type="monotone"
                    dataKey="baseline"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#colorBaseline)"
                    name="Baseline Forecast"
                />

                {/* Actual line if available */}
                <Line
                    type="monotone"
                    dataKey="actual"
                    stroke="#8b5cf6"
                    strokeWidth={3}
                    dot={{ fill: '#8b5cf6', r: 4 }}
                    name="Actual"
                />
            </ComposedChart>
        </ResponsiveContainer>
    );
};

export default ForecastChart;
