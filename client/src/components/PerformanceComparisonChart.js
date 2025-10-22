import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import styled from 'styled-components';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Styled container for the chart
const ChartContainer = styled.div`
    position: relative;
    width: 100%;
    height: 400px; // Adjust height as needed
`;

// Placeholder data generation (Replace with real data later)
const generatePlaceholderData = () => {
    const labels = ['Jan 2022', 'Jul 2022', 'Jan 2023', 'Jul 2023', 'Jan 2024', 'Jul 2024', 'Dec 2024'];
    const strategyData = [100, 115, 130, 155, 180, 210, 227]; // Example growth for AI strategy
    const sp500Data = [100, 105, 115, 135, 150, 170, 185];    // Example growth for S&P 500
    return { labels, strategyData, sp500Data };
};

const PerformanceComparisonChart = () => {
    const { labels, strategyData, sp500Data } = generatePlaceholderData();

    const chartData = {
        labels: labels,
        datasets: [
            {
                label: 'Nexus Signal AI Strategy (Simulated)',
                data: strategyData,
                borderColor: '#3498db', // Blue for strategy
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                fill: false,
                tension: 0.1,
                pointRadius: 2,
            },
            {
                label: 'S&P 500 Index',
                data: sp500Data,
                borderColor: '#95a5a6', // Gray for S&P 500
                backgroundColor: 'rgba(149, 165, 166, 0.1)',
                fill: false,
                tension: 0.1,
                pointRadius: 2,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: { color: '#ecf0f1' }
            },
            title: {
                display: false, // Title is handled by the parent page component
            },
            tooltip: {
                mode: 'index',
                intersect: false,
            },
        },
        scales: {
            x: {
                ticks: {
                    color: '#bdc3c7',
                },
                grid: { color: 'rgba(189, 195, 199, 0.1)' }
            },
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                title: {
                  display: true,
                  text: 'Portfolio Value (Indexed to 100)',
                  color: '#bdc3c7'
                },
                ticks: { color: '#bdc3c7' },
                grid: { color: 'rgba(189, 195, 199, 0.2)' }
            },
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        }
    };

    return (
        <ChartContainer>
            <Line options={options} data={chartData} />
        </ChartContainer>
    );
};

export default PerformanceComparisonChart;

