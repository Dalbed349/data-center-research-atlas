'use client';
import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';

// Cache US topology to avoid repeated CDN requests
let cachedUsTopology = null;
let cachedCountyTopology = null;

export default function MapSection({ data, onNodeClick, mapYear, setMapYear }) {
    const containerRef = useRef(null);
    const [tooltipData, setTooltipData] = useState(null);
    const [svgElement, setSvgElement] = useState(null);
    const [mapStyle, setMapStyle] = useState('circles');

    // Precalculate USA points with coordinates and county IDs
    const usaPoints = useMemo(() => {
        if (!data) return [];
        const projection = d3.geoAlbersUsa()
            .translate([400, 260]) // Default middle for precalculation
            .scale(880);
        
        return data
            .filter(d => d.lat && d.lng)
            .map(d => ({
                ...d,
                coords: projection([d.lng, d.lat])
            }))
            .filter(d => d.coords);
    }, [data]);

    // Precalculate county aggregation using county_id for speed
    const countyStats = useMemo(() => {
        if (!data || mapStyle !== 'heatmap' || !cachedCountyTopology) return { aggregation: {}, max: 1 };
        
        const counties = topojson.feature(cachedCountyTopology, cachedCountyTopology.objects.counties);
        const aggregation = {};

        data.forEach(d => {
            // Use the pre-calculated county_id
            const facilityCountyId = d.county_id;
            if (facilityCountyId) {
                if (!aggregation[facilityCountyId]) {
                    // Find the feature for the county once
                    const countyFeature = counties.features.find(f => f.id.toString().padStart(5, '0') === facilityCountyId);
                    aggregation[facilityCountyId] = { count: 0, facilities: [], feature: countyFeature };
                }
                aggregation[facilityCountyId].count++;
                aggregation[facilityCountyId].facilities.push(d);
            }
        });

        const max = Math.max(...Object.values(aggregation).map(a => a.count || 0), 1);
        return { aggregation, max };
    }, [data, mapStyle, cachedCountyTopology]);

    // Load US topology and county topology once and cache
    useEffect(() => {
        Promise.all([
            !cachedUsTopology ? d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json") : Promise.resolve(cachedUsTopology),
            !cachedCountyTopology ? d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json") : Promise.resolve(cachedCountyTopology)
        ])
        .then(([usData, countyData]) => {
            if (usData) cachedUsTopology = usData;
            if (countyData) cachedCountyTopology = countyData;
            setCountyDataReady(true);
        })
        .catch(error => {
            console.error("Error loading map data:", error);
        });
    }, []);

    useEffect(() => {
        if (!containerRef.current || !data || !cachedUsTopology) return;

        const container = d3.select(containerRef.current);
        container.selectAll("svg").remove();

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

        const states = topojson.feature(cachedUsTopology, cachedUsTopology.objects.states);

        zoomGroup.append("g")
            .selectAll("path")
            .data(states.features)
            .enter().append("path")
            .attr("d", path)
            .attr("fill", "var(--bg-card)")
            .attr("stroke", "var(--border-color)")
            .attr("stroke-width", 0.8);

        // Re-calculate coords for the current projection size
        const currentPoints = usaPoints.map(p => ({
            ...p,
            coords: projection([p.lng, p.lat])
        })).filter(p => p.coords);

        if (mapStyle === 'circles') {
            // CIRCLES VIEW
            function calculatePointColor(d) {
                return d.sqft ? d3.interpolateTurbo(Math.min(1, Math.log10(d.sqft + 1) / 6)) : '#73c0f4';
            }

            const pointRadius = d3.scaleSqrt()
                .domain(d3.extent(currentPoints, d => d.sqft || 0))
                .range([3, 10]);

            const circles = zoomGroup.append('g')
                .selectAll("circle")
                .data(currentPoints)
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
        } else if (mapStyle === 'heatmap' && cachedCountyTopology) {
            // Optimized COUNTY HEATMAP VIEW
            const counties = topojson.feature(cachedCountyTopology, cachedCountyTopology.objects.counties);
            const { aggregation, max } = countyStats;

            const colorScale = d3.scaleLinear()
                .domain([0, max / 3, max / 1.5, max])
                .range(['rgba(30, 41, 59, 0.3)', 'rgba(15, 150, 200, 0.4)', 'rgba(0, 255, 255, 0.6)', 'rgba(255, 0, 255, 0.8)']);

            const countyGlyphs = zoomGroup.append('g')
                .selectAll("path")
                .data(counties.features)
                .enter().append("path")
                .attr("d", path)
                .attr("fill", county => {
                    const agg = aggregation[county.id.toString().padStart(5, '0')];
                    return agg ? colorScale(agg.count) : 'rgba(30, 41, 59, 0.3)';
                })
                .attr("stroke", "#334155")
                .attr("stroke-width", 0.5)
                .style("cursor", d => aggregation[d.id.toString().padStart(5, '0')] ? "pointer" : "default");

            countyGlyphs.on("mouseover", (event, county) => {
                const agg = aggregation[county.id.toString().padStart(5, '0')];
                if (!agg) return;
                
                const wrapper = containerRef.current.parentElement;
                const wrapperRect = wrapper.getBoundingClientRect();
                const x = event.clientX - wrapperRect.left;
                const y = event.clientY - wrapperRect.top;
                
                setTooltipData({
                    x: Math.min(Math.max(12, x + 14), wrapperRect.width - 280),
                    y: Math.min(Math.max(12, y + 14), wrapperRect.height - 140),
                    data: { 
                        name: `County ${county.id}`, 
                        ownerName: `${agg.count} Facilit${agg.count === 1 ? 'y' : 'ies'}`,
                        county: `Density: ${((agg.count / max) * 100).toFixed(0)}%`
                    }
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
            });
        }

        const zoom = d3.zoom()
            .scaleExtent([1, 8])
            .translateExtent([[0, 0], [width, height]])
            .on('zoom', (event) => {
                zoomGroup.attr('transform', event.transform);
            });

        svg.call(zoom);
    }, [data, onNodeClick, mapStyle, usaPoints, countyStats, cachedUsTopology, cachedCountyTopology]);

    return (
        <section className="map-container glass-panel" id="map-visualization" style={{ position: 'relative' }}>
            <div className="card-glow"></div>
            <div className="panel-header" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h2>USA Data Center Atlas</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Interactive US map.</p>
                </div>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <div className="style-toggle" style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '4px', border: '1px solid var(--border-color)' }}>
                        <button 
                            onClick={() => setMapStyle('circles')}
                            style={{ padding: '6px 14px', background: mapStyle === 'circles' ? 'var(--accent-magenta)' : 'transparent', color: mapStyle === 'circles' ? '#fff' : 'var(--text-primary)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s', fontSize: '12px' }}
                        >
                            Circles
                        </button>
                        <button 
                            onClick={() => setMapStyle('heatmap')}
                            style={{ padding: '6px 14px', background: mapStyle === 'heatmap' ? 'var(--accent-magenta)' : 'transparent', color: mapStyle === 'heatmap' ? '#fff' : 'var(--text-primary)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s', fontSize: '12px' }}
                        >
                            Heatmap
                        </button>
                    </div>
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
                {mapStyle === 'circles' ? (
                    <>
                        <span><span className="legend-swatch" style={{ background: '#73c0f4' }}></span> Small footprint</span>
                        <span><span className="legend-swatch" style={{ background: '#f5b547' }}></span> Medium footprint</span>
                        <span><span className="legend-swatch" style={{ background: '#f04f2f' }}></span> Large footprint</span>
                    </>
                ) : (
                    <>
                        <span><span className="legend-swatch" style={{ background: 'rgba(15, 150, 200, 0.4)' }}></span> Low density</span>
                        <span><span className="legend-swatch" style={{ background: 'rgba(0, 255, 255, 0.6)' }}></span> Medium density</span>
                        <span><span className="legend-swatch" style={{ background: 'rgba(255, 0, 255, 0.8)' }}></span> High density</span>
                    </>
                )}
            </div>
            <div className="formal-citation" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px', textAlign: 'right', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                Citation: IM3 Open-source Data Center Atlas. Accessed May 2026.
            </div>
            {tooltipData && (
                <div 
                    className="tooltip glass-panel" 
                    style={{ 
                        position: 'absolute', 
                        top: tooltipData.y - 10,
                        left: tooltipData.x + 15,
                        background: 'rgba(15, 23, 42, 0.95)', 
                        padding: '12px', 
                        borderRadius: 'var(--radius-md)', 
                        border: '1px solid var(--accent-cyan)',
                        pointerEvents: 'none',
                        zIndex: 1000,
                        color: 'var(--text-primary)',
                        minWidth: '220px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
                        backdropFilter: 'blur(8px)'
                    }}
                >
                    <div style={{ borderBottom: '1px solid var(--border-color)', marginBottom: '8px', pb: '5px' }}>
                        <strong style={{ fontSize: '14px', color: 'var(--accent-cyan)' }}>{tooltipData.data.name}</strong>
                    </div>
                    <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div><span style={{ color: 'var(--text-muted)' }}>Operator:</span> <strong>{tooltipData.data.ownerName}</strong></div>
                        <div><span style={{ color: 'var(--text-muted)' }}>Geography:</span> {tooltipData.data.county || 'Unknown'}, {tooltipData.data.state}</div>
                        <div><span style={{ color: 'var(--text-muted)' }}>FIPS Code:</span> <code style={{ color: 'var(--accent-amber)' }}>{tooltipData.data.county_id || 'N/A'}</code></div>
                        <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Footprint:</span> <strong>{tooltipData.data.sqft ? tooltipData.data.sqft.toLocaleString() : '0'}</strong> sqft
                        </div>
                        <div><span style={{ color: 'var(--text-muted)' }}>Class:</span> <span style={{ textTransform: 'capitalize' }}>{tooltipData.data.project || 'Unknown'}</span></div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                            Internal ID: {tooltipData.data.id}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
