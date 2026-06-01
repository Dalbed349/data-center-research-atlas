'use client';
import React, { useEffect, useState } from 'react';
import * as d3 from 'd3';
import { MapContainer, TileLayer, Polygon, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export default function ProjectedMapSection() {
    const [alabamaGeoJSON, setAlabamaGeoJSON] = useState([]);
    const [isMounted, setIsMounted] = useState(false);

    // Prevent Next.js SSR from crashing due to Leaflet's window dependency
    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        // ESRI:102003 inverse math setup
        const esriMath = d3.geoConicEqualArea()
            .parallels([29.5, 45.5])
            .rotate([96, 0])
            .center([0, 37.5])
            .scale(6370997); // Earth radius in meters

        d3.json('/data/projected_moderate.geojson').then(geoData => {
            if (!geoData || !geoData.features) return;

            // Extract just Alabama from our GeoJSON dataset
            // We must convert D3's [Lon, Lat] into Leaflet's [Lat, Lon]
            const parsedFeatures = geoData.features
                .filter(f => f.properties.region === 'alabama')
                .map(f => {
                    let leafletCoords = [];
                    if (f.geometry && f.geometry.type === 'Polygon') {
                        leafletCoords = f.geometry.coordinates.map(ring => 
                            ring.map(coord => {
                                const lonLat = esriMath.invert([coord[0], -coord[1]]);
                                // Leaflet requires [Latitude, Longitude]
                                return lonLat ? [lonLat[1], lonLat[0]] : [0,0];
                            })
                        );
                    }
                    return { ...f, leafletCoords };
                }).filter(f => f.leafletCoords.length > 0);

            setAlabamaGeoJSON(parsedFeatures);
        }).catch(error => {
            console.error("Error loading projected map data:", error);
        });

    }, []);

    if (!isMounted) return null;

    return (
        <section className="map-container glass-panel" style={{ position: 'relative', marginTop: '40px', minHeight: '600px' }}>
            <div className="card-glow"></div>
            <div className="panel-header" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h2>Projected Data Centers: Alabama Focus</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Moderate Growth Scenario (50% Market Gravity) — Esri Satellite View</p>
                </div>
            </div>
            
            <div style={{ width: '100%', height: '500px', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                <MapContainer 
                    center={[33.5, -86.8]} 
                    zoom={7} 
                    style={{ height: '100%', width: '100%', background: '#0f172a' }}
                    scrollWheelZoom={true}
                >
                    {/* Esri World Imagery (ArcGIS Satellite) */}
                    <TileLayer
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                    />
                    
                    {/* Optional: Add a labels overlay so users can see city names over the satellite */}
                    <TileLayer
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                        attribution=""
                    />

                    {alabamaGeoJSON.map((d, idx) => (
                        <Polygon 
                            key={`${d.properties.id}-${idx}`} 
                            positions={d.leafletCoords} 
                            pathOptions={{ 
                                color: 'var(--accent-cyan)', 
                                fillColor: 'var(--accent-violet)',
                                fillOpacity: 0.6,
                                weight: 2 
                            }}
                        >
                            <Popup className="custom-leaflet-popup">
                                <div style={{ color: '#333' }}>
                                    <strong style={{ textTransform: 'capitalize', fontSize: '14px', display: 'block', marginBottom: '8px' }}>
                                        Region: {d.properties.region}
                                    </strong>
                                    <div style={{ display: 'grid', gap: '4px', fontSize: '12px' }}>
                                        <span><strong>Campus Size:</strong> {(d.properties.campus_size_square_ft / 1000000).toFixed(2)}M sqft</span>
                                        <span><strong>IT Power:</strong> {d.properties.data_center_it_power_mw} MW</span>
                                        <span><strong>Est. Cost:</strong> ${d.properties.total_cost_million_usd}M</span>
                                    </div>
                                </div>
                            </Popup>
                        </Polygon>
                    ))}
                </MapContainer>
            </div>
            
            <div className="formal-citation" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px', textAlign: 'right', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                Citation: Mongird, K., Burleyson, C., Akdemir, K. Z., Thurber, T., Vernon, C., & Rice, J. (2025). IM3 Projected US Data Center Locations (Version v1) [Data set]. MSD-LIVE Data Repository. https://doi.org/10.57931/2571680
            </div>
        </section>
    );
}
