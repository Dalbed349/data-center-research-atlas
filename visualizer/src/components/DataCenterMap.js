'use client';

import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { mockDataCenters } from '../data/mockData';

const DataCenterMap = () => {
  const ref = useRef();

  useEffect(() => {
    const svg = d3.select(ref.current);
    const width = 960;
    const height = 600;

    svg.attr('width', width).attr('height', height);

    const projection = d3.geoMercator()
      .scale(150)
      .translate([width / 2, height / 1.5]);

    const path = d3.geoPath().projection(projection);

    // Load and draw the world map
    d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(world => {
        const countries = topojson.feature(world, world.objects.countries);
        svg.append('g')
            .selectAll('path')
            .data(countries.features)
            .enter().append('path')
            .attr('d', path)
            .attr('fill', '#333')
            .attr('stroke', '#666');

        // Draw data center locations
        svg.selectAll('.data-center')
            .data(mockDataCenters)
            .enter().append('circle')
            .attr('class', 'data-center')
            .attr('cx', d => projection([d.lng, d.lat])[0])
            .attr('cy', d => projection([d.lng, d.lat])[1])
            .attr('r', 5)
            .attr('fill', 'red')
            .append('title')
            .text(d => d.name);
    });

  }, []);

  return (
    <div className="map-container">
        <svg ref={ref}></svg>
    </div>
  );
};

export default DataCenterMap;
