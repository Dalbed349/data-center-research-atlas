'use client';
import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';

export default function MapSection({ data, onNodeClick, mapYear, setMapYear }) {
    const containerRef = useRef(null);
    const [tooltipData, setTooltipData] = useState(null);

    useEffect(() => {
        if (!containerRef.current || !data) return;

        const container = d3.select(containerRef.current);
        container.selectAll("svg").remove(); // Clear previous map

        const bounds = containerRef.current.getBoundingClientRect();
        const width = bounds.width || 800;
        const height = 520;

        const svg = container.append("svg")
            .attr("width", '100%')
            .attr("height", height)
            .attr("viewBox", `0 0 ${width} ${height}`)
            .style("background-color", "transparent")
            .style("overflow", "visible");

        svg.append('rect')
            .attr('width', width)
            .attr('height', height)
            .attr('fill', 'transparent');

        const projection = d3.geoAlbersUsa()
            .translate([width / 2, height / 2])
            .scale(width * 1.1);

        const path = d3.geoPath().projection(projection);
        const zoomGroup = svg.append('g');

        function calculatePointColor(d) {
            return d.sqft ? d3.interpolateTurbo(Math.min(1, Math.log10(d.sqft + 1) / 6)) : '#73c0f4';
        }

        d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json").then(usData => {
            const states = topojson.feature(usData, usData.objects.states);

            zoomGroup.append("g")
                .selectAll("path")
                .data(states.features)
                .enter().append("path")
                .attr("d", path)
                .attr("fill", "var(--bg-card)")
                .attr("stroke", "var(--border-color)")
                .attr("stroke-width", 0.8);

            const usaPoints = data
                .filter(d => d.lat && d.lng)
                .map(d => ({
                    ...d,
                    coords: projection([d.lng, d.lat])
                }))
                .filter(d => d.coords);

            const pointRadius = d3.scaleSqrt()
                .domain(d3.extent(usaPoints, d => d.sqft || 0))
                .range([3, 10]);

            const circles = zoomGroup.append('g')
                .selectAll("circle")
                .data(usaPoints)
                .enter().append("circle")
                .attr("cx", d => d.coords[0])
                .attr("cy", d => d.coords[1])
                .attr("r", d => pointRadius(d.sqft || 0))
                .attr("fill", d => calculatePointColor(d))
                .attr("stroke", "#ffffff")
                .attr("stroke-width", 0.6)
                .style("opacity", 0.92)
                .style("cursor", "pointer");

            circles.on("mouseover", (event, d) => {
                const wrapper = containerRef.current.parentElement;
                const wrapperRect = wrapper.getBoundingClientRect();
                const x = event.clientX - wrapperRect.left;
                const y = event.clientY - wrapperRect.top;
                setTooltipData({
                    x: Math.min(Math.max(12, x + 14), wrapperRect.width - 280),
                    y: Math.min(Math.max(12, y + 14), wrapperRect.height - 140),
                    data: d
                });
            })
            .on("mousemove", (event) => {
                const wrapper = containerRef.current.parentElement;
                const wrapperRect = wrapper.getBoundingClientRect();
                const x = event.clientX - wrapperRect.left;
                const y = event.clientY - wrapperRect.top;
                setTooltipData(prev => prev ? {
                    ...prev,
                    x: Math.min(Math.max(12, x + 14), wrapperRect.width - 280),
                    y: Math.min(Math.max(12, y + 14), wrapperRect.height - 140)
                } : null);
            })
            .on("mouseout", () => {
                setTooltipData(null);
            })
            .on("click", (event, d) => {
                onNodeClick(d);
            });

            const zoom = d3.zoom()
                .scaleExtent([1, 8])
                .translateExtent([[0, 0], [width, height]])
                .on('zoom', (event) => {
                    zoomGroup.attr('transform', event.transform);
                });

            svg.call(zoom);
        }).catch(error => {
            console.error("Error loading US map data:", error);
        });
    }, [data, onNodeClick]);

    return (
        <section className="map-container glass-panel" id="map-visualization" style={{ position: 'relative' }}>
            <div className="card-glow"></div>
            <div className="panel-header" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h2>USA Data Center Atlas</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Interactive US map.</p>
                </div>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <div className="year-toggle" style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '4px', border: '1px solid var(--border-color)' }}>
                        <button 
                            onClick={() => setMapYear && setMapYear('2025')}
                            style={{ padding: '6px 16px', background: mapYear === '2025' ? 'var(--accent-cyan)' : 'transparent', color: mapYear === '2025' ? '#000' : 'var(--text-primary)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}
                        >
                            2025
                        </button>
                        <button 
                            onClick={() => setMapYear && setMapYear('2026')}
                            style={{ padding: '6px 16px', background: mapYear === '2026' ? 'var(--accent-cyan)' : 'transparent', color: mapYear === '2026' ? '#000' : 'var(--text-primary)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}
                        >
                            2026
                        </button>
                    </div>
                    <div className="source-badge" style={{ background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '12px' }}>
                        <strong style={{color: 'var(--accent-cyan)'}}>Map Source (Source 1):</strong> IM3 open-source US Atlas
                    </div>
                </div>
            </div>
            <div ref={containerRef} id="usa-map" style={{ width: '100%', height: '500px' }}></div>
            <div className="map-legend">
                <span><span className="legend-swatch" style={{ background: '#73c0f4' }}></span> Small footprint</span>
                <span><span className="legend-swatch" style={{ background: '#f5b547' }}></span> Medium footprint</span>
                <span><span className="legend-swatch" style={{ background: '#f04f2f' }}></span> Large footprint</span>
            </div>
            <div className="formal-citation" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px', textAlign: 'right', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                Citation: IM3 Open-source Data Center Atlas. Accessed May 2026.
            </div>
            {tooltipData && (
                <div 
                    className="tooltip" 
                    style={{ 
                        position: 'absolute', 
                        top: tooltipData.y - 120,
                        left: tooltipData.x - 20,
                        background: 'var(--bg-card-hover)', 
                        padding: '8px', 
                        borderRadius: 'var(--radius-sm)', 
                        border: '1px solid var(--border-color-hover)',
                        pointerEvents: 'none',
                        zIndex: 1000,
                        color: 'var(--text-primary)'
                    }}
                >
                    <strong>{tooltipData.data.name}</strong><br/>
                    Operator: {tooltipData.data.ownerName}<br/>
                    State: {tooltipData.data.state || 'N/A'}<br/>
                    Sqft: {tooltipData.data.sqft ? tooltipData.data.sqft.toLocaleString() : 'N/A'}
                </div>
            )}
        </section>
    );
}
