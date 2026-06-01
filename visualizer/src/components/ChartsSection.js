'use client';
import React, { useState } from 'react';
import { Bar, Doughnut, Bubble } from 'react-chartjs-2';
import { 
    Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement 
} from 'chart.js';
import { BarChart3 } from 'lucide-react';
import { formatH100, formatPower, formatCost } from '../lib/dataUtils';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement);

const chartStyles = {
    fontFamily: "'Outfit', -apple-system, sans-serif",
    gridColor: 'rgba(255, 255, 255, 0.05)',
    textColor: 'hsl(215, 20%, 65%)',
    titleColor: 'hsl(210, 40%, 98%)',
    tooltipBg: 'rgba(14, 21, 37, 0.95)',
    tooltipBorder: 'rgba(255, 255, 255, 0.1)'
};

export default function ChartsSection({ data }) {
    const [activeTab, setActiveTab] = useState('tab-compute');

    // Prepare Compute Leaders Data
    const topComputeData = [...data].sort((a, b) => b.h100 - a.h100).slice(0, 10);
    const computeLeadersData = {
        labels: topComputeData.map(d => d.name),
        datasets: [{
            label: 'H100 Equivalents',
            data: topComputeData.map(d => d.h100),
            backgroundColor: 'hsl(263, 90%, 51%)',
            borderRadius: 6,
            barThickness: 16
        }]
    };

    // Prepare Ownership Share Data
    const ownerCapacity = {};
    data.forEach(d => {
        const owner = d.ownerName || 'Unknown';
        ownerCapacity[owner] = (ownerCapacity[owner] || 0) + d.h100;
    });
    const sortedOwners = Object.entries(ownerCapacity).sort((a, b) => b[1] - a[1]);
    let ownerLabels = [];
    let ownerData = [];
    let otherSum = 0;
    sortedOwners.forEach(([owner, capacity], index) => {
        if (index < 5) {
            ownerLabels.push(owner);
            ownerData.push(capacity);
        } else {
            otherSum += capacity;
        }
    });
    if (otherSum > 0) {
        ownerLabels.push('Others');
        ownerData.push(otherSum);
    }
    const ownershipShareData = {
        labels: ownerLabels,
        datasets: [{
            data: ownerData,
            backgroundColor: [
                'hsl(190, 90%, 50%)', 'hsl(271, 91%, 65%)', 'hsl(32, 95%, 49%)',
                'hsl(142, 70%, 45%)', 'hsl(200, 95%, 45%)', 'rgba(255, 255, 255, 0.3)'
            ],
            borderWidth: 2,
            borderColor: '#0b0f19'
        }]
    };

    // Prepare Cost vs Power
    const bubbleDataList = data.filter(d => d.power > 0 && d.cost > 0).map(d => ({
        x: d.power, y: d.cost, r: 5 + Math.min(25, (d.h100 / 1000000) * 20),
        name: d.name, h100: d.h100
    }));
    const costVsPowerData = {
        datasets: [{
            label: 'Facilities',
            data: bubbleDataList,
            backgroundColor: 'rgba(6, 182, 212, 0.45)',
            borderColor: 'hsl(190, 90%, 50%)',
            hoverBackgroundColor: 'rgba(168, 85, 247, 0.65)'
        }]
    };

    // Prepare Geography Chart
    const countryCounts = {};
    data.forEach(d => {
        const country = d.country || 'Unknown';
        countryCounts[country] = (countryCounts[country] || 0) + 1;
    });
    const sortedGeography = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]);
    const geographyData = {
        labels: sortedGeography.map(([c]) => c),
        datasets: [{
            label: 'Monitored Facilities',
            data: sortedGeography.map(([_, count]) => count),
            backgroundColor: 'hsl(142, 70%, 45%)',
            borderRadius: 4,
            barThickness: 24
        }]
    };

    const commonOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: chartStyles.tooltipBg,
                borderColor: chartStyles.tooltipBorder,
                titleFont: { family: chartStyles.fontFamily },
                bodyFont: { family: chartStyles.fontFamily }
            }
        },
        scales: {
            x: { grid: { color: chartStyles.gridColor }, ticks: { color: chartStyles.textColor } },
            y: { grid: { color: chartStyles.gridColor }, ticks: { color: chartStyles.textColor } }
        }
    };

    return (
        <section className="analytics-section glass-panel">
            <div className="section-header">
                <div className="title-with-icon">
                    <BarChart3 className="header-icon" />
                    <h2>Infrastructure Analytics</h2>
                </div>
                <div className="chart-tabs">
                    <button className={`chart-tab ${activeTab === 'tab-compute' ? 'active' : ''}`} onClick={() => setActiveTab('tab-compute')}>Compute Leaders</button>
                    <button className={`chart-tab ${activeTab === 'tab-distribution' ? 'active' : ''}`} onClick={() => setActiveTab('tab-distribution')}>Ownership Share</button>
                    <button className={`chart-tab ${activeTab === 'tab-scatter' ? 'active' : ''}`} onClick={() => setActiveTab('tab-scatter')}>Cost vs Power</button>
                    <button className={`chart-tab ${activeTab === 'tab-geography' ? 'active' : ''}`} onClick={() => setActiveTab('tab-geography')}>Geographic Spread</button>
                </div>
            </div>
            
            <div className="chart-content-area" style={{ height: '350px', position: 'relative' }}>
                {activeTab === 'tab-compute' && <Bar data={computeLeadersData} options={{...commonOptions, indexAxis: 'y'}} />}
                {activeTab === 'tab-distribution' && <Doughnut data={ownershipShareData} options={{...commonOptions, plugins: { legend: { position: 'right', labels: { color: 'white' } } }, cutout: '65%', scales: { x: { display: false }, y: { display: false }}}} />}
                {activeTab === 'tab-scatter' && <Bubble data={costVsPowerData} options={{...commonOptions, scales: { x: { title: { display: true, text: 'Power Draw (MW)', color: 'white' } }, y: { title: { display: true, text: 'Cost ($B)', color: 'white' } }}}} />}
                {activeTab === 'tab-geography' && <Bar data={geographyData} options={{...commonOptions, scales: { x: { grid: { display: false } } }}} />}
            </div>
        </section>
    );
}
