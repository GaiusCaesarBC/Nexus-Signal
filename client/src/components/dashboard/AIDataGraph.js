// client/src/components/dashboard/AIDataGraph.js
import React from 'react';
import styled from 'styled-components';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart2 } from 'lucide-react';

const GraphContainer = styled.div`
    background: linear-gradient(135deg, #1e293b 0%, #2c3e50 100%);
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(0, 173, 237, 0.2);
    height: 400px; /* Keep the fixed height for the outer container */
    display: flex;
    flex-direction: column; /* This is crucial for flex-grow to work */

    h3 {
        font-size: 1.6rem;
        color: #f8fafc;
        margin-bottom: 1.5rem;
        display: flex;
        align-items: center;
        gap: 0.8rem;
    }
`;

// ChartWrapper is where the magic happens for ResponsiveContainer
const ChartWrapper = styled.div`
    flex-grow: 1; /* This ensures it takes all available vertical space */
    width: 100%; /* Take full width of parent */
    /* Add a min-height to ensure ResponsiveContainer always has a starting height */
    min-height: 0; /* Important for flex items to shrink correctly if needed, but still respects flex-grow */
`;

const AIDataGraph = ({ data }) => {
    return (
        <GraphContainer>
            <h3><BarChart2 size={24} color="#e0e0e0" /> AI Trend Prediction (Mock Data)</h3>
            <ChartWrapper>
                {/* ResponsiveContainer takes width and height as 100% of its parent */}
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={data}
                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#00adef" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#00adef" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="name" stroke="#64748b" />
                        <YAxis stroke="#64748b" />
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#1e293b',
                                border: '1px solid #00adef',
                                borderRadius: '8px',
                                color: '#e0e0e0'
                            }}
                            itemStyle={{ color: '#00adef' }}
                        />
                        <Area type="monotone" dataKey="value" stroke="#00adef" fillOpacity={1} fill="url(#colorUv)" />
                    </AreaChart>
                </ResponsiveContainer>
            </ChartWrapper>
        </GraphContainer>
    );
};

export default AIDataGraph;