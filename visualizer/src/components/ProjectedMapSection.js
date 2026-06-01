'use client';
import React, { useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import proj4 from 'proj4';
import * as turf from '@turf/turf';
import { MapContainer, TileLayer, Polygon, Popup, Tooltip, useMap, MultiPolygon } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// ESRI:102003 (USA_Contiguous_Albers_Equal_Area_Conic) definition
proj4.defs("ESRI:102003","+proj=aea +lat_0=37.5 +lon_0=-96 +lat_1=29.5 +lat_2=45.5 +x_0=0 +y_0=0 +datum=NAD83 +units=m +no_defs");

// Helper component to handle map movement
function RecenterMap({ bounds }) {
    const map = useMap();
    useEffect(() => {
        if (bounds && bounds.length > 0) {
            map.fitBounds(bounds, { padding: [20, 20] });
        }
    }, [bounds, map]);
    return null;
}

export default function ProjectedMapSection() {
    const [allFeatures, setAllFeatures] = useState([]);
    const [isMounted, setIsMounted] = useState(false);
    const [growth, setGrowth] = useState('moderate_growth');
    const [gravity, setGravity] = useState('50');
    const [mapStyle, setMapStyle] = useState('satellite');
    const [selectedRegion, setSelectedRegion] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Prevent Next.js SSR from crashing due to Leaflet's window dependency
    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        const filePath = `/data/projected/${growth}/${growth}_${gravity}_market_gravity.geojson`;

        d3.json(filePath).then(geoData => {
            if (!geoData || !geoData.features) return;

            const parsedFeatures = geoData.features.map(f => {
                let leafletCoords = [];
                let centroid = null;

                if (f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')) {
                    // Convert all coordinates to WGS84
                    const rings = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
                    
                    leafletCoords = rings.map(polygon => 
                        polygon.map(ring => 
                            ring.map(coord => {
                                const lonLat = proj4("ESRI:102003", "WGS84", [coord[0], coord[1]]);
                                return lonLat ? [lonLat[1], lonLat[0]] : [0,0]; // Leaflet wants [Lat, Lon]
                            })
                        )
                    );

                    // Flatten for centroid/distance math (using original projected coordinates for accurate distance)
                    const firstRing = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
                    const sum = firstRing.reduce((acc, curr) => [acc[0] + curr[0], acc[1] + curr[1]], [0, 0]);
                    centroid = [sum[0] / firstRing.length, sum[1] / firstRing.length];
                }
                return { ...f, leafletCoords, centroid };
            }).filter(f => f.leafletCoords.length > 0);

            setAllFeatures(parsedFeatures);
        }).catch(error => {
            console.error("Error loading projected map data:", error);
            setAllFeatures([]);
        });

    }, [growth, gravity]);

    const regions = useMemo(() => {
        const uniqueRegions = [...new Set(allFeatures.map(f => f.properties.region))].sort();
        return ['all', ...uniqueRegions];
    }, [allFeatures]);

    const filteredFeatures = useMemo(() => {
        let features = selectedRegion === 'all' 
            ? allFeatures 
            : allFeatures.filter(f => f.properties.region === selectedRegion);
        
        // Calculate distance to nearest projected data center cluster within the current set
        // (Note: For 'all', this is compute intensive but acceptable for ~few hundred points)
        return features.map(f => {
            let minDistance = Infinity;
            features.forEach(other => {
                if (f.properties.id === other.properties.id) return;
                const dx = f.centroid[0] - other.centroid[0];
                const dy = f.centroid[1] - other.centroid[1];
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < minDistance) minDistance = dist;
            });
            return { ...f, nearestClusterDist: minDistance };
        });
    }, [allFeatures, selectedRegion]);

    const bounds = useMemo(() => {
        if (filteredFeatures.length === 0) return null;
        let lats = [], lngs = [];
        filteredFeatures.forEach(f => {
            f.leafletCoords.forEach(polygon => {
                polygon.forEach(ring => {
                    ring.forEach(coord => {
                        if (coord && !isNaN(coord[0]) && !isNaN(coord[1])) {
                            lats.push(coord[0]);
                            lngs.push(coord[1]);
                        }
                    });
                });
            });
        });
        if (lats.length === 0 || lngs.length === 0) return null;
        return [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]];
    }, [filteredFeatures]);

    const tableData = useMemo(() => {
        if (!filteredFeatures || filteredFeatures.length === 0) return [];
        
        let data = [];
        if (selectedRegion === 'all') {
            // Aggregate by region
            const regionMap = {};
            filteredFeatures.forEach(f => {
                const r = f.properties.region;
                if (!regionMap[r]) {
                    regionMap[r] = {
                        id: r,
                        name: r,
                        count: 0,
                        sqft: 0,
                        power: 0,
                        cost: 0
                    };
                }
                regionMap[r].count += 1;
                regionMap[r].sqft += (f.properties.campus_size_square_ft || 0);
                regionMap[r].power += (f.properties.data_center_it_power_mw || 0);
                regionMap[r].cost += (f.properties.total_cost_million_usd || 0);
            });
            data = Object.values(regionMap);
        } else {
            // List individual clusters
            data = filteredFeatures.map(f => ({
                id: f.properties.id,
                name: `Cluster #${f.properties.id}`,
                sqft: f.properties.campus_size_square_ft || 0,
                power: f.properties.data_center_it_power_mw || 0,
                cost: f.properties.total_cost_million_usd || 0,
                nearestDist: f.nearestClusterDist === Infinity ? null : f.nearestClusterDist
            }));
        }

        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            data = data.filter(d => d.name.toLowerCase().includes(q));
        }

        // Sort by power descending by default
        data.sort((a, b) => b.power - a.power);

        return data;
    }, [filteredFeatures, selectedRegion, searchTerm]);

    const overallStats = useMemo(() => {
        return filteredFeatures.reduce((acc, f) => {
            acc.sqft += (f.properties.campus_size_square_ft || 0);
            acc.power += (f.properties.data_center_it_power_mw || 0);
            acc.cost += (f.properties.total_cost_million_usd || 0);
            acc.count += 1;
            return acc;
        }, { sqft: 0, power: 0, cost: 0, count: 0 });
    }, [filteredFeatures]);

    if (!isMounted) return null;

    const scenarios = [
        { id: 'low_growth', label: '3.71% Growth' },
        { id: 'moderate_growth', label: '5% Growth' },
        { id: 'high_growth', label: '10% Growth' },
        { id: 'higher_growth', label: '15% Growth' }
    ];

    const gravities = ['0', '25', '50', '75', '100'];

    return (
        <section className="map-container" style={{ position: 'relative', marginTop: '40px' }}>
            {/* Informational Section */}
            <div className="glass-panel" style={{ padding: '30px', marginBottom: '30px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', color: 'var(--accent-cyan)' }}>The Big Picture: What is this dataset?</h2>
                
                <p style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                    Researchers are trying to predict <em>where</em> new data centers will be built in the US between now and 2035. They want to map this out because data centers consume massive amounts of electricity and water. By forecasting where they will pop up, planners can figure out if the local power grids and water supplies can actually handle the strain.
                </p>

                <p style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                    To make these predictions, their model (the CERF model) tests different hypothetical futures, or "scenarios," based on two main variables:
                </p>

                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: 'var(--radius-md)', marginBottom: '20px', borderLeft: '3px solid var(--accent-violet)' }}>
                    <div style={{ marginBottom: '15px' }}>
                        <strong style={{ color: 'var(--accent-cyan)', fontSize: '15px', display: 'block', marginBottom: '8px' }}>1. Electricity Demand Growth Scenarios</strong>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>How fast the industry grows, ranging from a modest <strong style={{ color: 'var(--accent-cyan)' }}>3.71%</strong> to a massive <strong style={{ color: 'var(--accent-violet)' }}>15%</strong> growth in electricity demand every year.</p>
                    </div>
                    <div>
                        <strong style={{ color: 'var(--accent-cyan)', fontSize: '15px', display: 'block', marginBottom: '8px' }}>2. Market Gravity Weighting</strong>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>How the siting decisions balance between proximity to users (markets) versus locational cost optimization. This is controlled through five simulated gravity weights: <strong>0%, 25%, 50%, 75%, and 100%</strong>.</p>
                    </div>
                </div>

                <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: 'var(--accent-violet)' }}>What is "Market Gravity"?</h3>
                <p style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                    In real estate, there is always a tug-of-war between prime location and cheap costs. <strong>Market Gravity</strong> is simply the term this algorithm uses to decide who wins that tug-of-war. It measures how strongly a new data center is "pulled" toward major population centers (markets) versus how strongly it prioritizes saving money (locational cost). The dataset runs simulations using five different percentage weights to see how the map changes:
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div style={{ background: 'rgba(0,255,255,0.05)', padding: '15px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0,255,255,0.2)' }}>
                        <strong style={{ color: 'var(--accent-cyan)', display: 'block', marginBottom: '8px', fontSize: '13px' }}>0% Market Gravity</strong>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>"The Penny-Pincher Scenario"</div>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>Proximity to people matters <strong>0%</strong>. Locational cost matters <strong>100%</strong>. The algorithm places data centers wherever it is cheapest to operate—seeking cheap electricity, low taxes, and regions with effective evaporative cooling. Centers land in remote, cooler, or drier areas.</p>
                    </div>

                    <div style={{ background: 'rgba(167,139,250,0.05)', padding: '15px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(167,139,250,0.2)' }}>
                        <strong style={{ color: 'var(--accent-violet)', display: 'block', marginBottom: '8px', fontSize: '13px' }}>100% Market Gravity</strong>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>"The Need for Speed Scenario"</div>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>Proximity to people matters <strong>100%</strong>. Locational cost matters <strong>0%</strong>. The algorithm places data centers right next to major tech hubs and dense population centers to minimize latency. It completely ignores operational costs and taxes.</p>
                    </div>
                </div>

                <div style={{ background: 'rgba(100,200,255,0.05)', padding: '15px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(100,200,255,0.2)', marginTop: '20px' }}>
                    <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '8px', fontSize: '13px' }}>25%, 50%, and 75% Market Gravity — The "Compromises"</strong>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>These simulate more realistic middle grounds. For example, at 25% Market Gravity, the algorithm factors in being <em>somewhat</em> close to users, but places a much heavier weight (75%) on keeping costs down. Adjust the slider below to explore all five scenarios and see how data center siting preferences shift as you move between pure cost optimization and market-driven proximity.</p>
                </div>
            </div>

            {/* Map Section */}
            <div className="glass-panel" style={{ position: 'relative', minHeight: '600px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                <div className="card-glow"></div>
                <div className="panel-header" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
                <div style={{ flex: '1 1 300px' }}>
                    <h2>Projected Infrastructure: {selectedRegion === 'all' ? 'National' : selectedRegion.toUpperCase().replace('_', ' ')} Analysis</h2>
                    <p style={{ color: 'var(--text-muted)' }}>High-fidelity spatial projections for AI infrastructure expansion.</p>
                    <div style={{ marginTop: '10px', fontSize: '12px', display: 'flex', gap: '20px' }}>
                        <span><strong style={{color: 'var(--accent-cyan)'}}>Style:</strong> {mapStyle === 'satellite' ? 'Satellite Imagery' : 'Minimal Dark'}</span>
                        <span><strong style={{color: 'var(--accent-violet)'}}>Polygons:</strong> Projected Facility Footprints</span>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>REGION:</span>
                        <select 
                            value={selectedRegion} 
                            onChange={(e) => setSelectedRegion(e.target.value)}
                            style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '5px 10px', fontSize: '12px', outline: 'none' }}
                        >
                            {regions.map(r => (
                                <option key={r} value={r}>
                                    {r === 'all' ? 'NATIONAL (ALL STATES)' : r.toUpperCase().replace('_', ' ')}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>SCENARIO:</span>
                        <div className="year-toggle" style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '4px', border: '1px solid var(--border-color)' }}>
                            {scenarios.map(s => (
                                <button 
                                    key={s.id}
                                    onClick={() => setGrowth(s.id)}
                                    style={{ padding: '6px 12px', fontSize: '12px', background: growth === s.id ? 'var(--accent-violet)' : 'transparent', color: growth === s.id ? '#fff' : 'var(--text-primary)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>GRAVITY:</span>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input 
                                type="range" 
                                min="0" 
                                max="4" 
                                step="1" 
                                value={gravities.indexOf(gravity)}
                                onChange={(e) => setGravity(gravities[e.target.value])}
                                style={{ flex: 1, cursor: 'pointer', accentColor: 'var(--accent-cyan)' }}
                            />
                            <span style={{ minWidth: '40px', fontSize: '12px', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>{gravity}%</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>BASEMAP:</span>
                        <div className="year-toggle" style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '4px', border: '1px solid var(--border-color)' }}>
                            <button 
                                onClick={() => setMapStyle('satellite')}
                                style={{ padding: '6px 12px', fontSize: '12px', background: mapStyle === 'satellite' ? 'var(--accent-cyan)' : 'transparent', color: mapStyle === 'satellite' ? '#000' : 'var(--text-primary)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}
                            >
                                Satellite
                            </button>
                            <button 
                                onClick={() => setMapStyle('dark')}
                                style={{ padding: '6px 12px', fontSize: '12px', background: mapStyle === 'dark' ? 'var(--accent-cyan)' : 'transparent', color: mapStyle === 'dark' ? '#000' : 'var(--text-primary)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}
                            >
                                Unicolor
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div style={{ width: '100%', height: '550px', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                <MapContainer 
                    center={[33.5, -86.8]} 
                    zoom={7} 
                    style={{ height: '100%', width: '100%', background: '#0f172a' }}
                    scrollWheelZoom={true}
                >
                    <RecenterMap bounds={bounds} />
                    {mapStyle === 'satellite' ? (
                        <>
                            <TileLayer
                                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                            />
                            <TileLayer
                                url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                                attribution=""
                            />
                        </>
                    ) : (
                        <TileLayer
                            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                        />
                    )}

                    {filteredFeatures.map((d, idx) => (
                        <Polygon 
                            key={`${growth}-${gravity}-${selectedRegion}-${d.properties.id}-${idx}`} 
                            positions={d.leafletCoords} 
                            pathOptions={{ 
                                color: 'var(--accent-cyan)', 
                                fillColor: 'var(--accent-violet)',
                                fillOpacity: 0.6,
                                weight: 2 
                            }}
                        >
                            <Tooltip sticky>
                                <div style={{ fontSize: '12px', fontWeight: '600' }}>
                                    {d.properties.region.toUpperCase().replace('_', ' ')} Cluster #{d.properties.id}
                                </div>
                                <div style={{ fontSize: '11px', color: '#333' }}>
                                    {(d.properties.campus_size_square_ft / 1000000).toFixed(2)}M sqft | {d.properties.data_center_it_power_mw} MW
                                </div>
                                <div style={{ fontSize: '10px', color: '#666', borderTop: '1px solid rgba(0,0,0,0.1)', marginTop: '4px', paddingTop: '2px' }}>
                                    Nearest Cluster: {d.nearestClusterDist === Infinity ? 'N/A' : `${(d.nearestClusterDist / 1000).toFixed(2)} km`}
                                </div>
                            </Tooltip>
                            <Popup className="custom-leaflet-popup">
                                <div style={{ minWidth: '240px', padding: '5px' }}>
                                    <div style={{ borderBottom: '1px solid #eee', marginBottom: '10px', paddingBottom: '5px' }}>
                                        <strong style={{ textTransform: 'capitalize', fontSize: '16px', color: '#1e293b', display: 'block' }}>
                                            {d.properties.region.replace('_', ' ')} Projection
                                        </strong>
                                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                                            {growth.split('_')[0].toUpperCase()} Scenario ({gravity}% Gravity)
                                        </span>
                                    </div>
                                    

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <div>
                                            <label style={{ fontSize: '10px', color: '#94a3b8', display: 'block', textTransform: 'uppercase', fontWeight: 'bold' }}>Infrastructure</label>
                                            <div style={{ fontSize: '13px', color: '#1e293b' }}>
                                                <strong>{d.properties.data_center_it_power_mw}</strong> <small>MW IT Power</small>
                                            </div>
                                            <div style={{ fontSize: '13px', color: '#1e293b' }}>
                                                <strong>{(d.properties.campus_size_square_ft / 1000000).toFixed(2)}</strong> <small>M Sqft</small>
                                            </div>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '10px', color: '#94a3b8', display: 'block', textTransform: 'uppercase', fontWeight: 'bold' }}>Economics</label>
                                            <div style={{ fontSize: '13px', color: '#1e293b' }}>
                                                <strong>${d.properties.total_cost_million_usd}</strong> <small>M Est. Cost</small>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                                        <label style={{ fontSize: '10px', color: '#94a3b8', display: 'block', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px' }}>Proximity Analysis</label>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                            <span>Nearest Cluster:</span>
                                            <span style={{ fontWeight: '500', color: '#334155' }}>
                                                {d.nearestClusterDist === Infinity ? 'N/A' : `${(d.nearestClusterDist / 1000).toFixed(2)} km`}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                            <span>Land Use:</span>
                                            <span style={{ fontWeight: '500', color: '#334155' }}>{d.properties.land_use_type}</span>
                                        </div>
                                    </div>

                                    <div style={{ marginTop: '10px', fontSize: '10px', color: '#94a3b8', textAlign: 'right' }}>
                                        Grid ID: {d.properties.grid_id}
                                    </div>
                                </div>
                            </Popup>
                        </Polygon>
                    ))}
                </MapContainer>
            </div>
            </div>

            {/* Summary Statistics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '30px' }}>
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '15px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '8px' }}>Total Clusters</div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>{overallStats.count}</div>
                </div>
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '15px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '8px' }}>Total IT Power</div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--accent-violet)' }}>{overallStats.power.toLocaleString()}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>MW</div>
                </div>
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '15px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '8px' }}>Total Campus</div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>{(overallStats.sqft / 1000000).toFixed(2)}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>Million Sqft</div>
                </div>
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '15px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '8px' }}>Est. Total Cost</div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--accent-violet)' }}>${overallStats.cost.toLocaleString()}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>Million USD</div>
                </div>
            </div>

            {/* Table Controls */}
            <div style={{ marginTop: '30px', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                    type="text"
                    placeholder={selectedRegion === 'all' ? 'Search regions...' : 'Search clusters...'}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ flex: 1, minWidth: '200px', padding: '8px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}
                />
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    <strong>{tableData.length}</strong> {selectedRegion === 'all' ? 'Regions' : 'Clusters'} found
                </div>
            </div>

            {/* Statistics Table */}
            <div style={{ marginTop: '20px', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid var(--border-color)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                            <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>
                                {selectedRegion === 'all' ? 'Region' : 'Cluster'}
                            </th>
                            <th style={{ padding: '12px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>
                                {selectedRegion === 'all' ? 'Count' : 'Power (MW)'}
                            </th>
                            <th style={{ padding: '12px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>
                                Campus (M Sqft)
                            </th>
                            <th style={{ padding: '12px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>
                                Avg Power per Sqft (W/sqft)
                            </th>
                            <th style={{ padding: '12px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>
                                Est. Cost (M USD)
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {tableData.map((row, idx) => {
                            const powerDensity = row.sqft > 0 ? ((row.power * 1000000) / row.sqft).toFixed(2) : 0;
                            return (
                                <tr 
                                    key={row.id} 
                                    style={{ 
                                        borderBottom: '1px solid var(--border-color)',
                                        backgroundColor: idx % 2 === 0 ? 'rgba(0,0,0,0.1)' : 'transparent',
                                        transition: 'background-color 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,255,255,0.1)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? 'rgba(0,0,0,0.1)' : 'transparent'}
                                >
                                    <td style={{ padding: '12px', color: 'var(--text-primary)', fontWeight: '500' }}>
                                        {row.name.toUpperCase().replace('_', ' ')}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'right', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>
                                        {selectedRegion === 'all' ? row.count : row.power.toLocaleString()}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                                        {row.sqft > 0 ? (row.sqft / 1000000).toFixed(2) : '0.00'}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'right', color: 'var(--accent-violet)' }}>
                                        {powerDensity}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: '500' }}>
                                        ${row.cost.toLocaleString()}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            
            <div className="formal-citation" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '30px', textAlign: 'right', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                Citation: Mongird, K., Burleyson, C., Akdemir, K. Z., Thurber, T., Vernon, C., & Rice, J. (2025). IM3 Projected US Data Center Locations (Version v1) [Data set]. MSD-LIVE Data Repository. https://doi.org/10.57931/2571680
            </div>
        </section>
    );
}
