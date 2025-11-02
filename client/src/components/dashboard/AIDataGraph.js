// client/src/components/dashboard/AIDataGraph.js - REFINED
import React from 'react';
import styled, { keyframes } from 'styled-components'; // Import keyframes if pulseGlow is used
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart2 } from 'lucide-react';
import Loader from '../Loader'; // Import the Loader component

// Keyframes for error message, if not already global
const pulseGlow = keyframes`
    0% { box-shadow: 0 0 5px rgba(255, 107, 107, 0.4); }
    50% { box-shadow: 0 0 20px rgba(255, 107, 107, 0.8); }
    100% { box-shadow: 0 0 5px rgba(255, 107, 107, 0.4); }
`;

const GraphContainer = styled.div`
    background: linear-gradient(135deg, #1e293b 0%, #2c3e50 100%);
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(0, 173, 237, 0.2);
    height: 400px;
    display: flex;
    flex-direction: column;
    position: relative; /* Needed for absolute positioning of loader */

    h3 {
        font-size: 1.6rem;
        color: #f8fafc;
        margin-bottom: 1.5rem;
        display: flex;
        align-items: center;
        gap: 0.8rem;
    }

    /* Keep this for "No data available" message, but make it distinct */
    .no-data-message {
        color: #94a3b8;
        text-align: center;
        margin-top: auto; /* Push to bottom if space allows */
        margin-bottom: auto; /* Center vertically */
        font-size: 1.1rem;
        flex-grow: 1; /* Allow it to take up space for centering */
        display: flex;
        align-items: center;
        justify-content: center;
    }
`;

const ChartWrapper = styled.div`
    flex-grow: 1;
    width: 100%;
    min-height: 0; /* Important for flex items to shrink correctly if needed */
`;

const StyledLoader = styled(Loader)`
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10;
`;

const ErrorMessage = styled.p`
    color: #ff6b6b;
    margin-top: auto; /* Push to bottom if space allows */
    margin-bottom: auto; /* Center vertically */
    font-size: 1.1rem;
    font-weight: bold;
    text-align: center;
    animation: ${pulseGlow} 1.5s infinite alternate;
    flex-grow: 1; /* Allow it to take up space for centering */
    display: flex;
    align-items: center;
    justify-content: center;
`;


const AIDataGraph = ({ data, loading, error }) => {
    return (
        <GraphContainer>
            <h3><BarChart2 size={24} color="#00adef" /> AI Trend Prediction (Mock Data)</h3> {/* Changed icon color */}

            {/* Conditional rendering for loading, error, or no data */}
            {loading && <StyledLoader />} {/* Use the styled Loader */}
            {error && <ErrorMessage>Error: {error}</ErrorMessage>} {/* Use the styled ErrorMessage */}
            {!loading && !error && (!data || data.length === 0) && (
                <p className="no-data-message">No AI trend data available.</p>
            )}

            {!loading && !error && data && data.length > 0 && (
                <ChartWrapper>
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
                            <XAxis dataKey="date" stroke="#64748b" />
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
                                formatter={(value) => `$${value.toFixed(2)}`}
                                labelFormatter={(label) => `Date: ${label}`}
                            />
                            <Area type="monotone" dataKey="value" stroke="#00adef" fillOpacity={1} fill="url(#colorUv)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartWrapper>
            )}
        </GraphContainer>
    );
};

export default AIDataGraph;