import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export default function MapDiffSection({ data2025, data2026 }) {
    const [expandedStates, setExpandedStates] = useState(new Set());

    const toggleState = (stateName) => {
        const newSet = new Set(expandedStates);
        if (newSet.has(stateName)) newSet.delete(stateName);
        else newSet.add(stateName);
        setExpandedStates(newSet);
    };

    const diffData = useMemo(() => {
        if (!data2025.length || !data2026.length) return null;

        // Create a set of 2025 IDs (normalized to integers to handle zero-padding differences)
        const ids2025 = new Set(data2025.map(d => parseInt(d.id, 10)));
        const newAdditions = data2026.filter(d => !ids2025.has(parseInt(d.id, 10)));
        
        // Create a set of 2026 IDs (normalized to integers to handle zero-padding differences)
        const ids2026 = new Set(data2026.map(d => parseInt(d.id, 10)));
        const removals = data2025.filter(d => !ids2026.has(parseInt(d.id, 10)));

        // Find renamed facilities (Same ID, different name)
        const renamed = [];
        const map2025 = new Map(data2025.map(d => [parseInt(d.id, 10), d]));
        data2026.forEach(d26 => {
            const id = parseInt(d26.id, 10);
            const d25 = map2025.get(id);
            if (d25 && d25.name !== d26.name) {
                renamed.push({
                    id: d26.id,
                    oldName: d25.name,
                    newName: d26.name,
                    state: d26.state,
                    county: d26.county,
                    county_id: d26.county_id
                });
            }
        });

        // Aggregate by state
        const stateMap = {};
        let totalSqft = 0;

        const getOrCreateState = (st) => {
            if (!stateMap[st]) {
                stateMap[st] = { state: st, added: 0, removed: 0, renamed: 0, sqft: 0, counties: {} };
            }
            return stateMap[st];
        };

        const getOrCreateCounty = (stateObj, countyName, countyId) => {
            const key = `${countyName || 'Unknown'}-${countyId || '000'}`;
            if (!stateObj.counties[key]) {
                stateObj.counties[key] = { name: countyName || 'Unknown', code: countyId || 'N/A', added: 0, removed: 0, renamed: 0, sqft: 0 };
            }
            return stateObj.counties[key];
        };

        newAdditions.forEach(d => {
            const stateObj = getOrCreateState(d.state || 'Unknown');
            const countyObj = getOrCreateCounty(stateObj, d.county, d.county_id || d.countyId);
            
            stateObj.added += 1;
            countyObj.added += 1;
            
            const sqft = parseFloat(d.sqft) || 0;
            stateObj.sqft += sqft;
            countyObj.sqft += sqft;
            totalSqft += sqft;
        });

        removals.forEach(d => {
            const stateObj = getOrCreateState(d.state || 'Unknown');
            const countyObj = getOrCreateCounty(stateObj, d.county, d.county_id || d.countyId);
            
            stateObj.removed += 1;
            countyObj.removed += 1;
        });

        renamed.forEach(d => {
            const stateObj = getOrCreateState(d.state || 'Unknown');
            const countyObj = getOrCreateCounty(stateObj, d.county, d.county_id || d.countyId);
            
            stateObj.renamed += 1;
            countyObj.renamed += 1;
        });

        const stateAggregates = Object.values(stateMap).map(st => ({
            ...st,
            countyList: Object.values(st.counties).sort((a, b) => (b.sqft || 0) - (a.sqft || 0))
        })).sort((a, b) => (b.sqft || 0) - (a.sqft || 0));

        return {
            newAdditions,
            removals,
            renamed,
            stateAggregates,
            totalNew: newAdditions.length,
            totalRemoved: removals.length,
            totalRenamed: renamed.length,
            totalSqft,
            topState: stateAggregates.length > 0 ? [...stateAggregates].sort((a, b) => (b.sqft || 0) - (a.sqft || 0))[0] : null,
            netChange: newAdditions.length - removals.length
        };
    }, [data2025, data2026]);

    if (!diffData || (diffData.totalNew === 0 && diffData.totalRemoved === 0)) {
        return null; // Don't render if no diff is available
    }

    return (
        <section className="glass-panel" style={{ marginTop: '20px', padding: '20px' }}>
            <div className="card-glow"></div>
            <div className="panel-header" style={{ marginBottom: '20px' }}>
                <h2>2025 - 2026 Atlas Delta Analysis</h2>
                <p style={{ color: 'var(--text-muted)' }}>Analysis of newly tracked and discontinued infrastructure in the 2026 dataset.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', marginBottom: '30px' }}>
                <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ marginBottom: '15px', color: 'var(--accent-emerald)' }}>Key Takeaways</h3>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                        <li>
                            <span style={{ color: 'var(--accent-emerald)', fontWeight: 'bold' }}>Growth:</span> 
                            {' '}A net increase of <strong>{diffData.netChange}</strong> facilities (<strong>{diffData.totalNew}</strong> additions vs <strong>{diffData.totalRemoved}</strong> removals).
                        </li>
                        <li>
                            <span style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>Footprint:</span> 
                            {' '}<strong>{(diffData.totalSqft / 1000000).toFixed(2)}M</strong> sqft of new data center space was mapped this year.
                        </li>
                        {diffData.topState && (
                            <li>
                                <span style={{ color: 'var(--accent-amber)', fontWeight: 'bold' }}>Leader:</span> 
                                {' '}<strong>{diffData.topState.state}</strong> saw the largest expansion with <strong>{(diffData.topState.sqft / 1000000).toFixed(2)}M</strong> sqft added across <strong>{diffData.topState.added}</strong> sites.
                            </li>
                        )}
                        {diffData.totalRenamed > 0 && (
                            <li>
                                <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>Updates:</span> 
                                {' '}<strong>{diffData.totalRenamed}</strong> facilities underwent identity or operator name changes since 2025.
                            </li>
                        )}
                        <li style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '5px', fontSize: '12px', color: 'var(--text-muted)' }}>
                            * Analysis is now granular to the County level using FIPS-compatible <code>county_id</code> codes.
                        </li>
                    </ul>
                </div>

                <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '400px' }}>
                    <h3 style={{ padding: '15px 20px', margin: 0, borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)' }}>State-by-State Changes</h3>
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card-hover)', zIndex: 1 }}>
                                <tr>
                                    <th style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-color)' }}>State</th>
                                    <th style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-color)' }}>Added</th>
                                    <th style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-color)' }}>Removed</th>
                                    <th style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-color)' }}>Renamed</th>
                                    <th style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-color)' }}>Added Sqft</th>
                                </tr>
                            </thead>
                            <tbody>
                                {diffData.stateAggregates.map(row => (
                                    <React.Fragment key={row.state}>
                                        <tr 
                                            onClick={() => toggleState(row.state)}
                                            style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', background: expandedStates.has(row.state) ? 'rgba(255,255,255,0.03)' : 'transparent' }}
                                            className="hover-row"
                                        >
                                            <td style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {expandedStates.has(row.state) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                {row.state}
                                            </td>
                                            <td style={{ padding: '10px 20px', color: 'var(--accent-emerald)' }}>+{row.added || 0}</td>
                                            <td style={{ padding: '10px 20px', color: '#ff4d4d' }}>-{row.removed || 0}</td>
                                            <td style={{ padding: '10px 20px', color: '#60a5fa' }}>{row.renamed || 0}</td>
                                            <td style={{ padding: '10px 20px' }}>{row.sqft ? row.sqft.toLocaleString() : '0'}</td>
                                        </tr>
                                        {expandedStates.has(row.state) && row.countyList.map(county => (
                                            <tr key={`${row.state}-${county.name}-${county.code}`} style={{ background: 'rgba(0,0,0,0.2)', fontSize: '12px' }}>
                                                <td style={{ padding: '8px 20px 8px 45px', color: 'var(--text-muted)' }}>
                                                    {county.name} <span style={{ opacity: 0.5 }}>({county.code})</span>
                                                </td>
                                                <td style={{ padding: '8px 20px', color: 'var(--accent-emerald)', opacity: 0.8 }}>+{county.added || 0}</td>
                                                <td style={{ padding: '8px 20px', color: '#ff4d4d', opacity: 0.8 }}>-{county.removed || 0}</td>
                                                <td style={{ padding: '8px 20px', color: '#60a5fa', opacity: 0.8 }}>{county.renamed || 0}</td>
                                                <td style={{ padding: '8px 20px', opacity: 0.8 }}>{county.sqft ? county.sqft.toLocaleString() : '0'}</td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)' }}>
                    <h3 style={{ margin: 0 }}>Newly Added Facilities (Raw)</h3>
                    <span style={{ fontSize: '12px', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-emerald)', padding: '4px 10px', borderRadius: '12px' }}>
                        {diffData.totalNew} Added
                    </span>
                </div>
                <div style={{ overflowX: 'auto', maxHeight: '300px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                        <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card-hover)', zIndex: 1 }}>
                            <tr>
                                <th style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>Name / Operator</th>
                                <th style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>State</th>
                                <th style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>County</th>
                                <th style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>Type</th>
                                <th style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>Sqft</th>
                            </tr>
                        </thead>
                        <tbody>
                            {diffData.newAdditions.map((d, idx) => (
                                <tr key={`${d.id}-${idx}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '8px 20px' }}><strong>{d.name}</strong></td>
                                    <td style={{ padding: '8px 20px' }}>{d.state}</td>
                                    <td style={{ padding: '8px 20px' }}>{d.county} <span style={{opacity: 0.5, fontSize: '11px'}}>({d.county_id})</span></td>
                                    <td style={{ padding: '8px 20px', textTransform: 'capitalize' }}>{d.project || '-'}</td>
                                    <td style={{ padding: '8px 20px' }}>{d.sqft ? d.sqft.toLocaleString() : '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {diffData.totalRemoved > 0 && (
                <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', overflow: 'hidden', marginTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', borderBottom: '1px solid var(--border-color)', background: 'rgba(220, 38, 38, 0.1)' }}>
                        <h3 style={{ margin: 0 }}>Facilities Removed / Discontinued (Raw)</h3>
                        <span style={{ fontSize: '12px', background: 'rgba(220, 38, 38, 0.2)', color: '#ff4d4d', padding: '4px 10px', borderRadius: '12px' }}>
                            {diffData.totalRemoved} Removed
                        </span>
                    </div>
                    <div style={{ overflowX: 'auto', maxHeight: '300px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card-hover)', zIndex: 1 }}>
                                <tr>
                                    <th style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>Name / Operator</th>
                                    <th style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>State</th>
                                    <th style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>County</th>
                                    <th style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>Type</th>
                                    <th style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>Sqft</th>
                                </tr>
                            </thead>
                            <tbody>
                                {diffData.removals.map((d, idx) => (
                                    <tr key={`${d.id}-${idx}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '8px 20px' }}><strong>{d.name}</strong></td>
                                        <td style={{ padding: '8px 20px' }}>{d.state}</td>
                                        <td style={{ padding: '8px 20px' }}>{d.county} <span style={{opacity: 0.5, fontSize: '11px'}}>({d.county_id})</span></td>
                                        <td style={{ padding: '8px 20px', textTransform: 'capitalize' }}>{d.project || '-'}</td>
                                        <td style={{ padding: '8px 20px' }}>{d.sqft ? d.sqft.toLocaleString() : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {diffData.totalRenamed > 0 && (
                <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', overflow: 'hidden', marginTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', borderBottom: '1px solid var(--border-color)', background: 'rgba(59, 130, 246, 0.1)' }}>
                        <h3 style={{ margin: 0 }}>Renamed Facilities / Identity Updates</h3>
                        <span style={{ fontSize: '12px', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '4px 10px', borderRadius: '12px' }}>
                            {diffData.totalRenamed} Updates
                        </span>
                    </div>
                    <div style={{ overflowX: 'auto', maxHeight: '300px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card-hover)', zIndex: 1 }}>
                                <tr>
                                    <th style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>2025 Name</th>
                                    <th style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>2026 Name (Current)</th>
                                    <th style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>State</th>
                                    <th style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>County</th>
                                </tr>
                            </thead>
                            <tbody>
                                {diffData.renamed.map((d, idx) => (
                                    <tr key={`${d.id}-${idx}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '8px 20px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>{d.oldName}</td>
                                        <td style={{ padding: '8px 20px' }}><strong>{d.newName}</strong></td>
                                        <td style={{ padding: '8px 20px' }}>{d.state}</td>
                                        <td style={{ padding: '8px 20px' }}>{d.county} <span style={{opacity: 0.5, fontSize: '11px'}}>({d.county_id})</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </section>
    );
}
