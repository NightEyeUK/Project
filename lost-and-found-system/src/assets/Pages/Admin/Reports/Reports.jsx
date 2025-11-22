import React, { useState, useEffect } from 'react';
import './reports.css';
import {app,auth}  from '../../../../firebase.js';
import { getDatabase, ref, onValue } from 'firebase/database';

export default function Reports() {
    const [logs, setLogs] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const db = getDatabase(app);
        const logsRef = ref(db, 'actionLogs');

        onValue(logsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const logsList = Object.entries(data)
                    .map(([id, value]) => ({
                        id,
                        timestamp: value.timestamp || '',
                        // Prefer new performedBy fields, fallback to legacy
                        user: value.performedBy || value.user || value.admin || 'Unknown User',
                        userEmail: value.performedByEmail || value.userEmail || '',
                        userRole: value.performedByRole || value.userRole || 'User',
                        action: value.action || '',
                        item: value.item || '',
                        details: value.details || ''
                    }))
                    .sort((a, b) => {
                        // Sort by timestamp, newest first
                        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                        return timeB - timeA;
                    });
                setLogs(logsList);
            } else {
                setLogs([]);
            }
        });
    }, []);

    // Format timestamp for display
    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'N/A';
        try {
            const date = new Date(timestamp);
            return date.toLocaleString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch {
            return timestamp;
        }
    };

    // Filter logs
    const filteredLogs = logs.filter(log => {
        const query = searchQuery.toLowerCase();
        return (
            log.action.toLowerCase().includes(query) ||
            log.item.toLowerCase().includes(query) ||
            log.user.toLowerCase().includes(query) ||
            (log.userEmail || '').toLowerCase().includes(query) ||
            (log.details || '').toLowerCase().includes(query) ||
            (log.userRole || '').toLowerCase().includes(query) ||
            (log.timestamp ? new Date(log.timestamp).toLocaleDateString().toLowerCase() : '').includes(query)
        );
    });

    
    const exportToCSV = () => {
    // 1. Write the column titles
    const headers = "Timestamp,Performed By,User Email,User Role,Action Performed,Affected Item,Details";

    
    const rows = filteredLogs.map(log => {
        return [
            formatTimestamp(log.timestamp),
            log.user,
            log.userEmail || "",
            log.userRole || "User",
            log.action,
            log.item,
            log.details || ""
        ].join(",");
    });

    const csv = [headers, ...rows].join("\n");

    // 4. Create a file from the CSV text
    const blob = new Blob([csv], { type: "text/csv" });

    
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "reportngLostandFoundsTo.csv";

   
    a.click();

    
    URL.revokeObjectURL(url);
};



    return (
        <div className="admin-page">
            <h2>Reports</h2>
            <div className="toolbar toolbar-flex">
                <input
                    className="search"
                    placeholder="Search by action, item, or user"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button className="btn-primary" onClick={exportToCSV}>Export to CSV</button>
            </div>
            <div className="table-card">
                <table>
                    <thead>
                        <tr>
                            <th>Timestamp</th>
                            <th>Performed By</th>
                            <th>User Email</th>
                            <th>User Role</th>
                            <th>Action Performed</th>
                            <th>Affected Item</th>
                            <th>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredLogs.length > 0 ? (
                            filteredLogs.map((l) => (
                                <tr key={l.id}>
                                    <td>{formatTimestamp(l.timestamp)}</td>
                                    <td>{l.user}</td>
                                    <td>{l.userEmail || '—'}</td>
                                    <td>{l.userRole || 'User'}</td>
                                    <td>{l.action}</td>
                                    <td>{l.item}</td>
                                    <td>{l.details || '—'}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="7" className="empty-table-cell">
                                    {searchQuery ? 'No logs found matching your search.' : 'No action logs yet.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}



