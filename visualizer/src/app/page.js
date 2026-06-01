'use client';
import React, { useEffect, useState } from 'react';
import { Cpu, Server, Zap, DollarSign, Database, SlidersHorizontal, RotateCcw, Search, Layers, X, MapPin, FileText, Link as LinkIcon, ShieldCheck, Network, TrendingUp, AlertTriangle } from 'lucide-react';
import { fetchMapData, fetchAnalyticsData, formatH100, formatPower, formatCost } from '../lib/dataUtils';
import MapSection from '../components/MapSection';
import MapDiffSection from '../components/MapDiffSection';
import ChartsSection from '../components/ChartsSection';
import TimelineSheetViewer from '../components/TimelineSheetViewer';
import dynamic from 'next/dynamic';

const ProjectedMapSection = dynamic(() => import('../components/ProjectedMapSection'), {
    ssr: false,
    loading: () => <div className="glass-panel" style={{ height: '500px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Loading interactive map...</div>
});

export default function Home() {
    const [mapData2025, setMapData2025] = useState([]);
    const [mapData2026, setMapData2026] = useState([]);
    const [analyticsData, setAnalyticsData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({ search: '', owner: 'all', country: 'all', sort: 'h100-desc' });
    const [selectedNode, setSelectedNode] = useState(null);
    const [mapYear, setMapYear] = useState('2026');

    useEffect(() => {
        Promise.all([fetchMapData('2025'), fetchMapData('2026'), fetchAnalyticsData()])
            .then(([map25, map26, analyticsDataset]) => {
                setMapData2025(map25);
                setMapData2026(map26);
                setAnalyticsData(analyticsDataset);
                setFilteredData(analyticsDataset);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setError(true);
                setLoading(false);
            });
    }, []);

    useEffect(() => {
        let result = analyticsData;

        if (filters.owner !== 'all') result = result.filter(d => d.ownerName === filters.owner);
        if (filters.country !== 'all') result = result.filter(d => d.country === filters.country);
        if (filters.search) {
            const q = filters.search.toLowerCase();
            result = result.filter(d => 
                d.name.toLowerCase().includes(q) || 
                d.notes.toLowerCase().includes(q) || 
                d.ownerName.toLowerCase().includes(q) || 
                d.country.toLowerCase().includes(q)
            );
        }

        if (filters.sort === 'h100-desc') result = [...result].sort((a, b) => b.h100 - a.h100);
        else if (filters.sort === 'power-desc') result = [...result].sort((a, b) => b.power - a.power);
        else if (filters.sort === 'cost-desc') result = [...result].sort((a, b) => b.cost - a.cost);
        else if (filters.sort === 'name-asc') result = [...result].sort((a, b) => a.name.localeCompare(b.name));

        setFilteredData(result);
    }, [filters, analyticsData]);

    const totalH100 = filteredData.reduce((acc, d) => acc + d.h100, 0);
    const totalPower = filteredData.reduce((acc, d) => acc + d.power, 0);
    const totalCost = filteredData.reduce((acc, d) => acc + d.cost, 0);

    const owners = Array.from(new Set(analyticsData.map(d => d.ownerName).filter(o => o && o !== 'Unknown'))).sort();
    const countries = Array.from(new Set(analyticsData.map(d => d.country).filter(c => c))).sort();

    return (
        <>
            <div className="ambient-glow glow-1"></div>
            <div className="ambient-glow glow-2"></div>
            <div className="ambient-glow glow-3"></div>

            <div className="app-container">
                <header className="app-header compact-header" style={{ padding: '15px 20px' }}>
                    <div className="header-left">
                        <div className="logo-area">
                            <div className="logo-icon"><Cpu size={24} /></div>
                            <div>
                                <h1 style={{fontSize: '1.2rem', marginBottom: 0}}>Data Center Intelligence Dashboard</h1>
                            </div>
                        </div>
                    </div>
                    <div className="header-right">
                        <span className="status-indicator">
                            <span className="pulse-dot"></span>
                            <span>{loading ? 'Loading...' : `Synced: ${analyticsData.length} Analytics Rows`}</span>
                        </span>
                    </div>
                </header>

                <MapSection data={mapYear === '2025' ? mapData2025 : mapData2026} onNodeClick={setSelectedNode} mapYear={mapYear} setMapYear={setMapYear} />
                
                <MapDiffSection data2025={mapData2025} data2026={mapData2026} />
                
                <ProjectedMapSection />

                <section className="source-citations glass-panel" style={{ marginTop: '40px', marginBottom: '20px' }}>
                    <div className="logo-area" style={{ marginBottom: '20px' }}>
                        <div className="logo-icon"><Cpu /></div>
                        <div>
                            <h2 style={{fontSize: '1.8rem', margin: 0}}>AI Data Center <span className="gradient-text">Intelligence</span></h2>
                            <p className="subtitle" style={{marginTop: '5px'}}>Global Infrastructure Research Tracker</p>
                        </div>
                    </div>
                    
                    <div className="source-note">
                        <strong>Analytics & Explore source (Source 2):</strong> Original `data_centers.csv` research dataset, powering dashboard analytics, filters, and cards.
                    </div>
                    <div className="formal-citation" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                        Citation: Original research dataset (data_centers.csv). Compiled by project contributors. Accessed May 2026.
                    </div>
                </section>

                <section className="stats-grid">
                    <div className="stats-card glass-panel">
                        <div className="card-glow"></div>
                        <div className="stat-icon icon-violet"><Server /></div>
                        <div className="stat-info">
                            <p className="stat-label">Total Compute Capacity</p>
                            <h3 className="stat-value">{formatH100(totalH100)}</h3>
                            <p className="stat-subtext">H100 GPU Equivalents</p>
                        </div>
                    </div>
                    <div className="stats-card glass-panel">
                        <div className="card-glow"></div>
                        <div className="stat-icon icon-amber"><Zap /></div>
                        <div className="stat-info">
                            <p className="stat-label">Aggregated Power Draw</p>
                            <h3 className="stat-value">{Math.round(totalPower).toLocaleString()} MW</h3>
                            <p className="stat-subtext">Megawatts (MW)</p>
                        </div>
                    </div>
                    <div className="stats-card glass-panel">
                        <div className="card-glow"></div>
                        <div className="stat-icon icon-emerald"><DollarSign /></div>
                        <div className="stat-info">
                            <p className="stat-label">Estimated Capital Cost</p>
                            <h3 className="stat-value">${totalCost.toFixed(2)}B</h3>
                            <p className="stat-subtext">2025 USD Billions</p>
                        </div>
                    </div>
                    <div className="stats-card glass-panel">
                        <div className="card-glow"></div>
                        <div className="stat-icon icon-cyan"><Database /></div>
                        <div className="stat-info">
                            <p className="stat-label">Monitored Facilities</p>
                            <h3 className="stat-value">{filteredData.length}</h3>
                            <p className="stat-subtext">Active Research Profiles</p>
                        </div>
                    </div>
                </section>

                <main className="dashboard-grid">
                    <ChartsSection data={filteredData} />

                    <section className="controls-section glass-panel">
                        <div className="controls-header">
                            <div className="title-with-icon"><SlidersHorizontal className="header-icon" /><h2>Explore & Filter</h2></div>
                            <button className="btn btn-secondary btn-sm" onClick={() => setFilters({ search: '', owner: 'all', country: 'all', sort: 'h100-desc' })}>
                                <RotateCcw size={16} /> Reset
                            </button>
                        </div>
                        <div className="controls-grid">
                            <div className="control-group">
                                <label>Search Facilities</label>
                                <div className="search-wrapper">
                                    <Search className="search-icon" size={16} />
                                    <input type="text" placeholder="Search..." value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} />
                                </div>
                            </div>
                            <div className="control-group">
                                <label>Filter by Owner</label>
                                <div className="select-wrapper">
                                    <select value={filters.owner} onChange={e => setFilters({...filters, owner: e.target.value})}>
                                        <option value="all">All Owners</option>
                                        {owners.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="control-group">
                                <label>Filter by Country</label>
                                <div className="select-wrapper">
                                    <select value={filters.country} onChange={e => setFilters({...filters, country: e.target.value})}>
                                        <option value="all">All Countries</option>
                                        {countries.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="control-group">
                                <label>Sort Infrastructure</label>
                                <div className="select-wrapper">
                                    <select value={filters.sort} onChange={e => setFilters({...filters, sort: e.target.value})}>
                                        <option value="h100-desc">Compute Capacity</option>
                                        <option value="power-desc">Power Capacity</option>
                                        <option value="cost-desc">Capital Cost</option>
                                        <option value="name-asc">Facility Name (A-Z)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="cards-section">
                        <div className="section-title-bar">
                            <div className="title-with-icon"><Layers className="header-icon animate-pulse" /><h2>Monitored Research Nodes</h2><span className="count-badge">{filteredData.length} of {analyticsData.length}</span></div>
                        </div>
                        <div className="cards-grid">
                            {loading ? <div className="loading-state"><div className="spinner"></div><p>Processing data...</p></div> : 
                             filteredData.length === 0 ? <div className="empty-state"><h3>No Nodes Found</h3></div> :
                             filteredData.map((d, idx) => (
                                <div key={`${d.id}-${idx}`} className={`datacenter-card ${d.h100 > 500000 ? 'h100-tier-1' : d.h100 > 200000 ? 'h100-tier-2' : 'h100-tier-3'}`} onClick={() => setSelectedNode(d)}>
                                    <div className="card-top">
                                        <div className="card-location"><MapPin size={14} /> {d.country}</div>
                                        <h3>{d.name}</h3>
                                        <div className="card-badges">
                                            <span className="badge badge-owner">{d.ownerName}</span>
                                            {d.users.slice(0,2).map((u, i) => <span key={i} className="badge badge-user">{u.name}</span>)}
                                        </div>
                                    </div>
                                    <div className="card-metrics">
                                        <div className="metric-box"><span className="metric-label">Compute</span><span className="metric-value val-violet">{formatH100(d.h100)}</span></div>
                                        <div className="metric-box"><span className="metric-label">Power</span><span className="metric-value val-amber">{formatPower(d.power)}</span></div>
                                        <div className="metric-box"><span className="metric-label">Cost</span><span className="metric-value val-emerald">{formatCost(d.cost)}</span></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </main>
            </div>

            {selectedNode && (
                <div className="modal-backdrop active" onClick={(e) => { if (e.target.className.includes('modal-backdrop')) setSelectedNode(null); }}>
                    <div className="modal-card glass-panel animate-zoom">
                        <div className="modal-glow"></div>
                        <button className="modal-close-btn" onClick={() => setSelectedNode(null)}><X /></button>
                        
                        <div className="modal-header-area">
                            <div className="modal-title-row">
                                <span className="modal-location-badge"><MapPin size={16} /> <span>{selectedNode.country}</span></span>
                                <h2>{selectedNode.name}</h2>
                            </div>
                            <div className="modal-quick-stats">
                                <div className="quick-stat-pill val-violet"><Server /><div><span className="pill-title">H100 Equivalents</span><span className="pill-value">{formatH100(selectedNode.h100)}</span></div></div>
                                <div className="quick-stat-pill val-amber"><Zap /><div><span className="pill-title">Power Capacity</span><span className="pill-value">{formatPower(selectedNode.power)}</span></div></div>
                                <div className="quick-stat-pill val-emerald"><DollarSign /><div><span className="pill-title">Capital Investment</span><span className="pill-value">{formatCost(selectedNode.cost)}</span></div></div>
                            </div>
                        </div>

                        <div className="modal-body-area">
                            <div className="modal-main-column">
                                <div className="modal-card-block"><h3><FileText /> Technical Notes & Intelligence</h3><p className="modal-notes">{selectedNode.notes || '-'}</p></div>
                                <div className="modal-card-block"><h3><LinkIcon /> Selected Sources</h3>
                                    <ul className="sources-list">
                                        {selectedNode.sources.length > 0 ? selectedNode.sources.map((src, i) => (
                                            <li key={i}>{src.url ? <a href={src.url} target="_blank">{src.text}</a> : src.text}</li>
                                        )) : <li>No public sources cited.</li>}
                                    </ul>
                                </div>
                                <TimelineSheetViewer sheetUrl={selectedNode.calcSheet} />
                            </div>
                            <div className="modal-sidebar-column">
                                <div className="modal-card-block"><h3><ShieldCheck /> Ownership & Users</h3>
                                    <div className="metadata-row"><span className="meta-title">Owner</span><span className="meta-val tag-badge badge-owner-main">{selectedNode.ownerName || 'Not Specified'}</span></div>
                                    <div className="metadata-row"><span className="meta-title">Tenant/Users</span><div className="tag-cloud">
                                        {selectedNode.users.map((u, i) => <span key={i} className="tag-badge">{u.name}</span>)}
                                    </div></div>
                                </div>
                                <div className="modal-card-block"><h3><Network /> Infrastructure Partners</h3>
                                    <div className="metadata-row"><span className="meta-title">Investors</span><span className="meta-val">{selectedNode.investors || 'Not Disclosed'}</span></div>
                                    <div className="metadata-row"><span className="meta-title">Construction</span><span className="meta-val">{selectedNode.construction || 'Not Disclosed'}</span></div>
                                    <div className="metadata-row"><span className="meta-title">Energy Utility</span><span className="meta-val">{selectedNode.energy || 'Not Disclosed'}</span></div>
                                    <div className="metadata-row"><span className="meta-title">Physical Address</span><span className="meta-val highlight">{selectedNode.address || 'Address Unspecified'}</span></div>
                                </div>
                                {selectedNode.calcSheet && selectedNode.calcSheet.startsWith('http') && (
                                    <div className="modal-cta-area"><a href={selectedNode.calcSheet} target="_blank" className="btn btn-primary btn-block"><TrendingUp /> Open Calculations Model</a></div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
