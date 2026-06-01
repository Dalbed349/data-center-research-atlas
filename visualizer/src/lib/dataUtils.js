import Papa from 'papaparse';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';

export function parseTagWithConfidence(val) {
    if (!val || val.trim() === "") return { name: 'Unknown', confidence: '' };
    const parts = val.split('#');
    const name = parts[0].trim();
    const confidence = parts[1] ? parts[1].trim() : '';
    return { name, confidence };
}

export function parseMultipleTags(val) {
    if (!val || val.trim() === "") return [];
    return val.split(',').map(item => parseTagWithConfidence(item));
}

export function parseMarkdownLinks(text) {
    if (!text || text.trim() === "") return [];
    const lines = text.split('\n');
    const sources = [];
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/;
    
    for (let line of lines) {
        line = line.trim().replace(/^[-*]\s+/, '');
        if (!line) continue;
        const match = line.match(linkRegex);
        if (match) {
            sources.push({ text: match[1], url: match[2] });
        } else {
            sources.push({ text: line, url: null });
        }
    }
    return sources;
}

export async function fetchMapData(year = '2026') {
    const filename = year === '2025' 
        ? '/data/im3_open_source_data_center_atlas.csv'
        : '/data/im3_open_source_data_center_atlas_v2026.02.09.csv';
        
    const [csvResponse, countyTopology] = await Promise.all([
        fetch(filename),
        d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json")
    ]);

    const csvText = await csvResponse.text();
    const counties = topojson.feature(countyTopology, countyTopology.objects.counties);

    return new Promise((resolve) => {
        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const processed = results.data.map((d, index) => {
                    const sqft = parseFloat(d.sqft) || 0;
                    const lat = parseFloat(d.lat) || 0;
                    const lng = parseFloat(d.lon) || 0;
                    const ownerName = d.operator || d.name || 'Unknown';

                    // Determine county_id based on lat/lng using d3.geoContains
                    let facilityCountyId = d.county_id || '';
                    if (lat !== 0 && lng !== 0) {
                        for (const countyFeature of counties.features) {
                            if (d3.geoContains(countyFeature, [lng, lat])) {
                                facilityCountyId = countyFeature.id.toString().padStart(5, '0');
                                break;
                            }
                        }
                    }

                    return {
                        id: d.id || `dc-${index}`,
                        name: d.name || d.operator || 'Unnamed Data Center',
                        h100: 0,
                        power: 0,
                        cost: 0,
                        sqft,
                        ownerRaw: d.operator || '',
                        ownerName,
                        project: d.type || '',
                        country: 'United States',
                        state: d.state || '',
                        county: d.county || '',
                        county_id: facilityCountyId,
                        address: '',
                        lat,
                        lng
                    };
                }).filter(d => d.lat !== 0 && d.lng !== 0);
                
                resolve(processed);
            }
        });
    });
}

export async function fetchAnalyticsData() {
    const response = await fetch('/data/data_centers.csv');
    const csvText = await response.text();
    
    return new Promise((resolve) => {
        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const processed = results.data.map((d, index) => {
                    const h100 = parseFloat(d['Current H100 equivalents']) || 0;
                    const power = parseFloat(d['Current power (MW)']) || 0;
                    const cost = parseFloat(d['Current total capital cost (2025 USD billions)']) || 0;
                    const ownerParsed = parseTagWithConfidence(d['Owner']);
                    const usersParsed = parseMultipleTags(d['Users']);

                    return {
                        id: `dc-${index}`,
                        name: d['Name'] || 'Unnamed Data Center',
                        h100,
                        power,
                        cost,
                        ownerRaw: d['Owner'] || '',
                        ownerName: ownerParsed.name,
                        ownerConfidence: ownerParsed.confidence,
                        usersRaw: d['Users'] || '',
                        users: usersParsed,
                        notes: d['Notes'] || '',
                        sources: parseMarkdownLinks(d['Selected Sources']),
                        sourcesRaw: d['Selected Sources'] || '',
                        calcSheet: d['Calculations sheet'] || '',
                        project: d['Project'] || '',
                        investors: d['Investors'] || '',
                        construction: d['Construction companies'] || '',
                        energy: d['Energy companies'] || '',
                        country: d['Country'] || 'United States',
                        address: d['Address'] || '',
                        lat: parseFloat(d['Latitude']) || 0,
                        lng: parseFloat(d['Longitude']) || 0
                    };
                }).filter(d => d.name && d.name !== 'Unnamed Data Center');
                
                resolve(processed);
            }
        });
    });
}

export function formatH100(val) {
    if (val === 0) return 'TBD';
    if (val >= 1000000) return (val / 1000000).toFixed(2) + 'M';
    return Math.round(val).toLocaleString();
}

export function formatPower(val) {
    if (val === 0) return 'TBD';
    return Math.round(val).toLocaleString() + ' MW';
}

export function formatCost(val) {
    if (val === 0) return 'TBD';
    return '$' + val.toFixed(2) + 'B';
}
