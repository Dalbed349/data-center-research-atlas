'use client';
import React, { useEffect, useState } from 'react';
import Papa from 'papaparse';

function getGoogleSheetId(url) {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
}

function buildCsvUrl(sheetId, sheetName) {
    return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
}

function findTitle(row) {
    const titleKeys = ['event', 'title', 'activity', 'description'];
    for (const key of titleKeys) {
        const matchKey = Object.keys(row).find(col => col.toLowerCase() === key);
        if (matchKey && row[matchKey]) {
            return row[matchKey];
        }
    }
    return Object.values(row).find(value => value && value.toString().trim()) || 'Timeline item';
}

function getRowSubtitle(row) {
    const dateKeys = ['date', 'day', 'time', 'timestamp'];
    for (const key of dateKeys) {
        const matchKey = Object.keys(row).find(col => col.toLowerCase().includes(key));
        if (matchKey && row[matchKey]) {
            return `${matchKey}: ${row[matchKey]}`;
        }
    }
    return null;
}

export default function TimelineSheetViewer({ sheetUrl }) {
    const [sheetRows, setSheetRows] = useState([]);
    const [headers, setHeaders] = useState([]);
    const [loadingSheet, setLoadingSheet] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!sheetUrl) return;

        const sheetId = getGoogleSheetId(sheetUrl);
        if (!sheetId) {
            setError('Could not parse the spreadsheet ID from the link.');
            return;
        }

        const candidateSheets = ['Timeline', 'timeline', 'Sheet1'];
        let loaded = false;

        setLoadingSheet(true);
        setError(null);
        setSheetRows([]);
        setHeaders([]);

        const tryNext = async (index) => {
            if (index >= candidateSheets.length) {
                if (!loaded) {
                    setError('Unable to load timeline sheet. The spreadsheet may not be publicly shared or may not contain a Timeline tab.');
                    setLoadingSheet(false);
                }
                return;
            }

            const csvUrl = buildCsvUrl(sheetId, candidateSheets[index]);
            try {
                const response = await fetch(csvUrl);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                const text = await response.text();
                Papa.parse(text, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        if (results.data.length === 0) {
                            tryNext(index + 1);
                            return;
                        }
                        loaded = true;
                        setHeaders(results.meta.fields || []);
                        setSheetRows(results.data);
                        setLoadingSheet(false);
                    },
                    error: () => {
                        tryNext(index + 1);
                    }
                });
            } catch (err) {
                tryNext(index + 1);
            }
        };

        tryNext(0);
    }, [sheetUrl]);

    if (!sheetUrl) {
        return null;
    }

    return (
        <div className="sheet-timeline-panel">
            <div className="sheet-timeline-header">
                <h3>Timeline Sheet Preview</h3>
                <p>This timeline view attempts to render the spreadsheet’s timeline page directly in the dashboard. It also includes every column from the sheet.</p>
            </div>

            {loadingSheet && <div className="sheet-timeline-status">Loading timeline data…</div>}
            {error && <div className="sheet-timeline-error">{error}</div>}

            {!loadingSheet && !error && sheetRows.length > 0 && (
                <div className="sheet-timeline-content">
                    <div className="timeline-list">
                        {sheetRows.map((row, index) => (
                            <div key={index} className="timeline-item">
                                <div className="timeline-item-marker"></div>
                                <div className="timeline-item-body">
                                    <div className="timeline-item-head">
                                        <span className="timeline-item-title">{findTitle(row)}</span>
                                        {getRowSubtitle(row) && <span className="timeline-item-subtitle">{getRowSubtitle(row)}</span>}
                                    </div>
                                    <div className="timeline-item-grid">
                                        {headers.map((header) => (
                                            <div key={header} className="timeline-field">
                                                <span className="timeline-field-key">{header}</span>
                                                <span className="timeline-field-value">{row[header] || '-'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="sheet-timeline-table-wrapper">
                        <table className="sheet-timeline-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    {headers.map(header => <th key={header}>{header}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {sheetRows.map((row, index) => (
                                    <tr key={index}>
                                        <td>{index + 1}</td>
                                        {headers.map(header => <td key={header}>{row[header] || '-'}</td>)}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
