import React, { useEffect, useRef, memo } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import styled from 'styled-components';

const ChartContainer = styled.div`
    height: 400px;
    width: 100%;
    border-radius: 8px;
    overflow: hidden;
`;

const RealTimeChart = ({ data }) => {
    const chartContainerRef = useRef();

    useEffect(() => {
        if (!chartContainerRef.current || !data || data.length === 0) {
            return;
        }

        const handleResize = () => {
            chart.applyOptions({ width: chartContainerRef.current.clientWidth });
        };

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#34495e' }, // Darker background for the chart
                textColor: 'rgba(236, 240, 241, 0.9)',
            },
            grid: {
                vertLines: { color: 'rgba(44, 62, 80, 0.5)' },
                horzLines: { color: 'rgba(44, 62, 80, 0.5)' },
            },
            width: chartContainerRef.current.clientWidth,
            height: 400,
            timeScale: {
                borderColor: '#4a627a',
            },
            rightPriceScale: {
                borderColor: '#4a627a',
            },
        });

        const candlestickSeries = chart.addCandlestickSeries({
            upColor: '#2ecc71',
            downColor: '#e74c3c',
            borderDownColor: '#e74c3c',
            borderUpColor: '#2ecc71',
            wickDownColor: '#e74c3c',
            wickUpColor: '#2ecc71',
        });

        candlestickSeries.setData(data);
        chart.timeScale().fitContent();

        window.addEventListener('resize', handleResize);

        // Cleanup function: This is crucial. It removes the old chart before creating a new one.
        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [data]); // This effect will re-run whenever the 'data' prop changes.

    return <ChartContainer ref={chartContainerRef} />;
};

export default memo(RealTimeChart);
