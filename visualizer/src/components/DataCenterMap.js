'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { mockDataCenters } from '../data/mockData';

const DataCenterMap = () => {
  const ref = useRef();
  const [viewMode, setViewMode] = useState('circles'); // 'circles' or 'heatmap'
  const [hoveredCounty, setHoveredCounty] = useState(null);
  const [countyData, setCountyData] = useState(null);
  const [us, setUs] = useState(null);

  // Filter to US data centers
  const usDataCenters = useMemo(() => {
    return mockDataCenters.filter(d => d.country === 'United States');
  }, []);

  // Aggregate data centers by county
  const countyAggregation = useMemo(() => {
    if (!countyData) return {};
    
    const aggregated = {};
    usDataCenters.forEach(dc => {
      // Find which county this data center belongs to using lat/lng
      let foundCounty = null;
      countyData.features.forEach(county => {
        const point = [dc.lng, dc.lat];
        if (d3.geoContains(county, point)) {
          foundCounty = county.id;
        }
      });
      
      if (foundCounty) {
        if (!aggregated[foundCounty]) {
          aggregated[foundCounty] = {
            countyId: foundCounty,
            centers: [],
            totalH100: 0,
            totalPower: 0,
            totalCost: 0
          };
        }
        aggregated[foundCounty].centers.push(dc);
        aggregated[foundCounty].totalH100 += dc.h100;
        aggregated[foundCounty].totalPower += dc.power;
        aggregated[foundCounty].totalCost += dc.cost;
      }
    });
    
    return aggregated;
  }, [usDataCenters, countyData]);

  useEffect(() => {
    // Load US counties data
    d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json').then(data => {
      const counties = topojson.feature(data, data.objects.counties);
      setCountyData(counties);
      setUs(data);
    }).catch(err => {
      console.error('Error loading county data:', err);
    });
  }, []);

  useEffect(() => {
    if (!ref.current || !us) return;
    
    const svg = d3.select(ref.current);
    const width = 960;
    const height = 600;

    svg.attr('width', width).attr('height', height);

    // Create projection - only include US data centers that have valid coordinates
    const validDataCenters = usDataCenters.filter(d => d.lng && d.lat && !isNaN(d.lng) && !isNaN(d.lat));
    
    if (validDataCenters.length === 0) {
      console.warn('No valid data centers found');
      return;
    }

    const projection = d3.geoAlbersUsa()
      .fitSize([width, height], { 
        type: 'FeatureCollection', 
        features: validDataCenters.map(d => ({ 
          type: 'Point', 
          coordinates: [d.lng, d.lat] 
        })) 
      });

    const path = d3.geoPath().projection(projection);

    // Clear previous content
    svg.selectAll('*').remove();

    // Draw background
    svg.append('rect').attr('width', width).attr('height', height).attr('fill', '#0f172a');

    if (viewMode === 'circles' && validDataCenters.length > 0) {
      // Original circle view
      // Draw US states background
      if (us) {
        try {
          const nation = topojson.feature(us, us.objects.nation);
          if (nation && nation.geometry && nation.geometry.coordinates) {
            svg.append('path')
              .attr('d', path(nation))
              .attr('fill', '#1e293b')
              .attr('stroke', '#334155');
          }
        } catch(e) {
          console.warn('Could not render nation boundary:', e);
        }
      }

      svg.selectAll('.data-center')
        .data(validDataCenters)
        .enter()
        .append('circle')
        .attr('class', 'data-center')
        .attr('cx', d => {
          const coords = projection([d.lng, d.lat]);
          return coords && !isNaN(coords[0]) ? coords[0] : 0;
        })
        .attr('cy', d => {
          const coords = projection([d.lng, d.lat]);
          return coords && !isNaN(coords[1]) ? coords[1] : 0;
        })
        .attr('r', 6)
        .attr('fill', '#00ffff')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.8)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
          d3.select(this).attr('r', 9).attr('fill', '#ff00ff').attr('opacity', 1);
        })
        .on('mouseout', function(event, d) {
          d3.select(this).attr('r', 6).attr('fill', '#00ffff').attr('opacity', 0.8);
        })
        .append('title')
        .text(d => `${d.name}\n${d.h100.toLocaleString()} H100s | ${d.power} MW | $${d.cost}B`);

    } else if (viewMode === 'heatmap' && us && countyData) {
      // Heatmap view
      try {
        const nation = topojson.feature(us, us.objects.nation);
        const counties = topojson.feature(us, us.objects.counties);

        // Draw nation boundary
        if (nation && nation.geometry && nation.geometry.coordinates) {
          svg.append('path')
            .attr('d', path(nation))
            .attr('fill', 'none')
            .attr('stroke', '#475569')
            .attr('stroke-width', 2);
        }

        // Calculate color scale based on power
        const powerValues = Object.values(countyAggregation).map(c => c.totalPower);
        const maxPower = Math.max(...powerValues, 1);
        const colorScale = d3.scaleLinear()
          .domain([0, maxPower])
          .range(['rgba(15, 23, 42, 0.3)', 'rgba(0, 255, 255, 0.8)']);

        // Draw counties
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
            return agg ? colorScale(agg.totalPower) : 'rgba(30, 41, 59, 0.5)';
          })
          .attr('stroke', '#334155')
          .attr('stroke-width', 0.5)
          .style('cursor', d => countyAggregation[d.id] ? 'pointer' : 'default')
          .on('mouseover', function(event, d) {
            const agg = countyAggregation[d.id];
            if (agg) {
              d3.select(this).attr('stroke', '#00ffff').attr('stroke-width', 2);
              setHoveredCounty(d.id);
            }
          })
          .on('mouseout', function(event, d) {
            d3.select(this).attr('stroke', '#334155').attr('stroke-width', 0.5);
            setHoveredCounty(null);
          });
      } catch(e) {
        console.error('Error rendering heatmap:', e);
      }
    }

  }, [viewMode, us, countyData, usDataCenters, countyAggregation]);

  const hoveredCountyData = hoveredCounty && countyAggregation[hoveredCounty] 
    ? countyAggregation[hoveredCounty].centers.sort((a, b) => b.power - a.power)
    : [];

  return (
    <div>
      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', alignItems: 'center' }}>
        <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '4px', border: '1px solid var(--border-color)' }}>
          <button
            onClick={() => setViewMode('circles')}
            style={{
              padding: '8px 16px',
              fontSize: '12px',
              background: viewMode === 'circles' ? 'var(--accent-cyan)' : 'transparent',
              color: viewMode === 'circles' ? '#000' : 'var(--text-primary)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'all 0.2s'
            }}
          >
            📍 Circle View
          </button>
          <button
            onClick={() => setViewMode('heatmap')}
            style={{
              padding: '8px 16px',
              fontSize: '12px',
              background: viewMode === 'heatmap' ? 'var(--accent-cyan)' : 'transparent',
              color: viewMode === 'heatmap' ? '#000' : 'var(--text-primary)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'all 0.2s'
            }}
          >
            🔥 County Heatmap
          </button>
        </div>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {usDataCenters.length} facilities • {Object.keys(countyAggregation).length} counties with data centers
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px' }}>
        <div className="map-container glass-panel" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <svg ref={ref}></svg>
        </div>

        {/* Hover Details Sidebar */}
        {viewMode === 'heatmap' && hoveredCountyData.length > 0 && (
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
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(0,255,255,0.1)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,255,255,0.2)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Total Power</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>{countyAggregation[hoveredCounty].totalPower} MW</div>
              </div>
              <div style={{ background: 'rgba(167,139,250,0.1)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(167,139,250,0.2)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Facilities</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--accent-violet)' }}>{hoveredCountyData.length}</div>
              </div>
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '10px' }}>
              Sorted by Power
            </div>
            
            {hoveredCountyData.map(dc => (
              <div key={dc.id} style={{ 
                background: 'rgba(0,0,0,0.3)', 
                padding: '10px', 
                marginBottom: '8px', 
                borderRadius: 'var(--radius-sm)',
                borderLeft: '3px solid var(--accent-cyan)'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {dc.name}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  <div>🔌 <strong>{dc.power}</strong> MW</div>
                  <div>💾 <strong>{(dc.h100 / 1000).toFixed(0)}K</strong> H100s</div>
                  <div>💰 <strong>${dc.cost}B</strong></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DataCenterMap;
