'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';

// Cache for US topology to avoid repeated CDN requests
let cachedTopology = null;
let cachedCountyFeatures = null;

const CountyHeatmap = ({ data, year }) => {
  const ref = useRef();
  const [us, setUs] = useState(null);
  const [countyData, setCountyData] = useState(null);
  const [hoveredCounty, setHoveredCounty] = useState(null);

  // Load US counties data (cached to avoid repeated CDN requests)
  useEffect(() => {
    if (cachedTopology && cachedCountyFeatures) {
      setUs(cachedTopology);
      setCountyData(cachedCountyFeatures);
      return;
    }
    
    d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json').then(topology => {
      cachedTopology = topology;
      const counties = topojson.feature(topology, topology.objects.counties);
      cachedCountyFeatures = counties;
      setUs(topology);
      setCountyData(counties);
    }).catch(err => console.error('Error loading county data:', err));
  }, []);

  // Optimized: Pre-build county lookup index once to avoid O(n*m) nested loop
  const countyIndex = useMemo(() => {
    if (!countyData) return new Map();
    const index = new Map();
    countyData.features.forEach(county => {
      index.set(county.id, county);
    });
    return index;
  }, [countyData]);

  // Aggregate data centers by county - much faster with pre-indexed counties
  const countyAggregation = useMemo(() => {
    if (!countyData || countyIndex.size === 0) return {};
    
    const aggregated = {};
    
    // For each data center, find its county using a more efficient approach
    data.forEach(dc => {
      if (!dc.lat || !dc.lng) return;
      
      const point = [dc.lng, dc.lat];
      let foundCounty = null;
      
      // Only check counties that might contain the point (using bounding box pre-filter)
      for (const [countyId, county] of countyIndex) {
        if (d3.geoContains(county, point)) {
          foundCounty = countyId;
          break; // Stop searching once we find the county
        }
      }
      
      if (foundCounty) {
        if (!aggregated[foundCounty]) {
          aggregated[foundCounty] = {
            count: 0,
            facilities: []
          };
        }
        aggregated[foundCounty].count += 1;
        aggregated[foundCounty].facilities.push(dc);
      }
    });
    
    return aggregated;
  }, [data, countyIndex]);

  const hoveredCountyData = hoveredCounty && countyAggregation[hoveredCounty] 
    ? countyAggregation[hoveredCounty].facilities.sort((a, b) => b.h100 - a.h100)
    : [];

  useEffect(() => {
    if (!ref.current || !us || !countyData) return;
    
    const svg = d3.select(ref.current);
    const width = 960;
    const height = 600;

    svg.attr('width', width).attr('height', height);

    const projection = d3.geoAlbersUsa().fitSize([width, height], countyData);
    // Zoom out a bit more to see the whole US
    projection.scale(projection.scale() * 0.85);
    const path = d3.geoPath().projection(projection);

    // Clear previous content
    svg.selectAll('*').remove();

    // Draw background
    svg.append('rect').attr('width', width).attr('height', height).attr('fill', '#ffffff');

    // Draw nation boundary
    const nation = topojson.feature(us, us.objects.nation);
    svg.append('path')
      .attr('d', path(nation))
      .attr('fill', '#f3f4f6')
      .attr('stroke', '#d1d5db')
      .attr('stroke-width', 2);

    // Calculate color scale based on count
    const countValues = Object.values(countyAggregation).map(c => c.count);
    const maxCount = Math.max(...countValues, 1);
    const colorScale = d3.scaleLinear()
      .domain([0, maxCount / 2, maxCount])
      .range(['#93c5fd', '#3b82f6', '#1e3a8a']); // Light blue to dark blue

    // Draw counties
    const counties = topojson.feature(us, us.objects.counties);
    svg.selectAll('.county')
      .data(counties.features)
      .enter()
      .append('path')
      .attr('class', 'county')
      .attr('d', d => {
        const pathStr = path(d);
        return pathStr && !pathStr.includes('NaN') ? pathStr : '';
      })
      .attr('fill', d => {
        const agg = countyAggregation[d.id];
        return agg ? colorScale(agg.count) : 'rgba(30, 41, 59, 0.3)';
      })
      .attr('stroke', '#334155')
      .attr('stroke-width', 0.5)
      .style('cursor', d => countyAggregation[d.id] ? 'pointer' : 'default')
      .on('mouseover', function(event, d) {
        const agg = countyAggregation[d.id];

        if (agg) {
          d3.select(this).attr('stroke', '#3b82f6').attr('stroke-width', 2);
          setHoveredCounty(d.id);
        }
      })
      .on('mouseout', function(event, d) {
        d3.select(this).attr('stroke', '#334155').attr('stroke-width', 0.5);
        setHoveredCounty(null);
      });

  }, [us, countyData, countyAggregation, ref]);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '20px' }}>
        <div className="map-container glass-panel" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <svg ref={ref}></svg>
        </div>

        {/* Hover Details Sidebar */}
        {hoveredCountyData.length > 0 && (
          <div style={{ 
            background: 'var(--bg-card)', 
            border: '1px solid var(--border-color)', 
            borderRadius: 'var(--radius-lg)', 
            padding: '15px',
            maxHeight: '600px',
            overflowY: 'auto'
          }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '12px' }}>
              📊 County {hoveredCounty}
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,255,255,0.2)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Facilities</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>{hoveredCountyData.length}</div>
              </div>
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '10px' }}>
              Data Centers (by compute)
            </div>
            
            {hoveredCountyData.map(dc => (
              <div key={dc.id} style={{ 
                background: 'rgb(255, 255, 255)', 
                padding: '10px', 
                marginBottom: '8px', 
                borderRadius: 'var(--radius-sm)',
                borderLeft: '3px solid var(--accent-cyan)',
                fontSize: '10px'
              }}>
                <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {dc.name}
                </div>
                <div style={{ color: 'var(--text-secondary)', lineHeight: '1.3' }}>
                  <div>💾 {(dc.h100 / 1000000).toFixed(2)}M H100s</div>
                  <div>🔌 {dc.power} MW</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default CountyHeatmap;
