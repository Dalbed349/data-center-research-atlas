'use client';
import React, { useMemo } from 'react';

export default function MapDiffSection({ data2025, data2026 }) {
    const diffData = useMemo(() => {
        if (!data2025.length || !data2026.length) return null;

        // Create a set of 2025 IDs (normalized to integers to handle zero-padding differences)
        const ids2025 = new Set(data2025.map(d => parseInt(d.id, 10)));

        // Find items in 2026 that aren't in 2025
        const newAdditions = data2026.filter(d => !ids2025.has(parseInt(d.id, 10)));

        // Aggregate by state
        const stateMap = {};
        let totalSqft = 0;

        newAdditions.forEach(d => {
            const st = d.state || 'Unknown';
            if (!stateMap[st]) {
                stateMap[st] = { state: st, count: 0, sqft: 0 };
            }
            stateMap[st].count += 1;
            const sqft = d.sqft || 0;
            stateMap[st].sqft += sqft;
            totalSqft += sqft;
        });

        const stateAggregates = Object.values(stateMap).sort((a, b) => b.sqft - a.sqft);

        return {
            newAdditions,
            stateAggregates,
            totalNew: newAdditions.length,
            totalSqft,
            topState: stateAggregates.length > 0 ? stateAggregates[0] : null
        };
    }, [data2025, data2026]);

    if (!diffData || diffData.totalNew === 0) {
        return null; // Don't render if no diff is available
    }

    return (
        <section className="glass-panel" style={{ marginTop: '20px', padding: '20px' }}>
            <div className="card-glow"></div>
            <div className="panel-header" style={{ marginBottom: '20px' }}>
                <h2>2025 - 2026 Atlas Additions</h2>
                <p style={{ color: 'var(--text-muted)' }}>Analysis of newly tracked infrastructure in the 2026 dataset.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', marginBottom: '30px' }}>
                <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ marginBottom: '15px', color: 'var(--accent-emerald)' }}>Key Takeaways</h3>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <li><strong>{diffData.totalNew}</strong> new facilities added to the Atlas.</li>
                        <li><strong>{(diffData.totalSqft / 1000000).toFixed(2)}M</strong> sqft of newly mapped data center space.</li>
                        {diffData.topState && (
                            <li>
                                <strong>{diffData.topState.state}</strong> led the expansion with <strong>{diffData.topState.count}</strong> new facilities ({(diffData.topState.sqft / 1000000).toFixed(2)}M sqft).
                            </li>
                        )}
                        <li>This represents a significant leap in tracked footprint year-over-year.</li>
                    </ul>
                </div>

                <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '250px' }}>
                    <h3 style={{ padding: '15px 20px', margin: 0, borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)' }}>State Aggregate</h3>
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card-hover)', zIndex: 1 }}>
                                <tr>
                                    <th style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-color)' }}>State</th>
                                    <th style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-color)' }}>New Facilities</th>
                                    <th style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-color)' }}>Total Added Sqft</th>
                                </tr>
                            </thead>
                            <tbody>
                                {diffData.stateAggregates.map(row => (
                                    <tr key={row.state} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '10px 20px' }}>{row.state}</td>
                                        <td style={{ padding: '10px 20px' }}>{row.count}</td>
                                        <td style={{ padding: '10px 20px' }}>{row.sqft ? row.sqft.toLocaleString() : 'N/A'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                <h3 style={{ padding: '15px 20px', margin: 0, borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)' }}>Newly Added Facilities (Raw)</h3>
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
                                    <td style={{ padding: '8px 20px' }}>{d.county}</td>
                                    <td style={{ padding: '8px 20px', textTransform: 'capitalize' }}>{d.project || '-'}</td>
                                    <td style={{ padding: '8px 20px' }}>{d.sqft ? d.sqft.toLocaleString() : '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}
