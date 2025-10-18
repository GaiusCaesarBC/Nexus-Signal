import React from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import styled from 'styled-components';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// The fix is here: we've given the container a specific height.
const ChartContainer = styled.div`
    position: relative;
    width: 100%;
    height: 400px; // This controls the size of the chart.
`;

const StockChart = ({ data }) => {
    const chartData = {
        labels: data.map(d => d.date),
        datasets: [
            {
                label: 'Close Price',
                data: data.map(d => d.close),
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.2)',
                fill: true,
                tension: 0.1,
                pointRadius: 1, // Make points smaller for a cleaner look
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false, // This is crucial for the height property to work
        plugins: {
            legend: {
                position: 'top',
                labels: { color: '#ecf0f1' }
            },
            title: {
                display: true,
                text: '100-Day Price History',
                color: '#ecf0f1'
            },
        },
        scales: {
            x: {
                ticks: { 
                    color: '#bdc3c7',
                    maxTicksLimit: 10, // Avoid clutter on the x-axis
                },
                grid: { color: 'rgba(189, 195, 199, 0.2)' }
            },
            y: {
                ticks: { color: '#bdc3c7' },
                grid: { color: 'rgba(189, 195, 199, 0.2)' }
            },
        },
    };

    return (
        <ChartContainer>
            <Line options={options} data={chartData} />
        </ChartContainer>
    );
};

export default StockChart;

