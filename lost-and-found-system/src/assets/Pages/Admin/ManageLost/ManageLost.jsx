import React, { useEffect, useState } from "react";
import "./manage-lost.css";
import {app,auth} from "../../../../firebase.js";
import {
    getDatabase,
    ref,
    onValue,
    update,
    remove,
    push,
} from "firebase/database";
import { logAction } from "../../../../utils/logAction";

export default function ManageLost() {
    const [reports, setReports] = useState([]);
    const [filteredReports, setFilteredReports] = useState([]);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all"); // "all", "found", "notFound"
    const [selectedReport, setSelectedReport] = useState(null);

    useEffect(() => {
        const db = getDatabase(app);
        const lostRef = ref(db, "lostItems");

        // Listen for real-time updates
        onValue(lostRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const reportList = Object.entries(data).map(([id, value]) => ({
                    id,
                    name: value.item || "Unnamed Item",
                    reportedBy: `${value.first || "Unknown"} ${value.last || ""}`.trim(),
                    dateLost: value.date || "N/A",
                    status: value.status || "Open",
                    location: value.location || "Unknown",
                    brand: value.brand || "N/A",
                    contact: value.phone || "N/A",
                    email: value.email || "N/A",
                    time: value.time || "N/A",
                    primary: value.primary || "N/A",
                    secondary: value.secondary || "N/A",
                    additional: value.additional || "N/A",
                    first: value.first || "",
                    last: value.last || "",
                }));
                setReports(reportList);
                setFilteredReports(reportList);
            } else {
                setReports([]);
                setFilteredReports([]);
            }
        });
    }, []);

    // --- Handle search and status filter ---
    useEffect(() => {
        let filtered = reports;

        // Apply status filter
        if (statusFilter === "found") {
            filtered = filtered.filter((r) => r.status === "Found");
        } else if (statusFilter === "notFound") {
            filtered = filtered.filter((r) => r.status !== "Found");
        }

        // Apply search filter
        if (search.trim()) {
            const lower = search.toLowerCase();
            filtered = filtered.filter(
                (r) =>
                    r.name.toLowerCase().includes(lower) ||
                    r.reportedBy.toLowerCase().includes(lower)
            );
        }

        setFilteredReports(filtered);
    }, [search, statusFilter, reports]);

    // --- Mark as Found ---
    /* const handleMarkAsFound = async (report) => {
        if (!window.confirm(`Mark "${report.name}" as found and add it to Found Items?`)) return;

        const db = getDatabase(app);
        const itemRef = ref(db, `lostItems/${report.id}`);

        try {
            // Update lost item status
            await update(itemRef, { status: "Found" });

            // Create found item with owner details
            const foundRef = ref(db, 'foundItems');
            const foundItemData = {
                name: report.name,
                description: report.additional || `${report.brand !== "N/A" ? report.brand + " " : ""}${report.primary !== "N/A" ? report.primary : ""} ${report.secondary !== "N/A" ? report.secondary : ""}`.trim() || '',
                image: '',
                location: report.location,
                dateFound: new Date().toISOString().slice(0, 10),
                status: 'Pending',
                ownerName: `${report.first} ${report.last}`.trim(),
                ownerContact: report.contact,
                ownerEmail: report.email,
                lostItemId: report.id
            };

            await push(foundRef, foundItemData);
            await logAction('Marked lost item as found', report.name, `Owner: ${foundItemData.ownerName}, Location: ${report.location}`);
            alert("Item marked as Found and added to Found Items with owner details!");
        } catch (error) {
            console.error("Error marking as found:", error);
            alert("Failed to update. Please try again.");
        }
    }; */

    // --- Delete report ---
    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this report?")) return;

        const db = getDatabase(app);
        const itemRef = ref(db, `lostItems/${id}`);
        const report = reports.find(r => r.id === id);

        try {
            await remove(itemRef);
            await logAction('Deleted lost report', report?.name || 'Unknown Item', `Report ID: ${id}`);
            alert("Report deleted successfully!");
        } catch (error) {
            console.error("Error deleting report:", error);
            alert("Failed to delete. Please try again.");
        }
    };

    // --- Close popup ---
    const handleClosePopup = () => setSelectedReport(null);

    return (
        <div className="admin-page">
            <h2>Manage Lost Reports</h2>

            {/* Toolbar */}
            <div className="toolbar">
                <input
                    className="search"
                    placeholder="Search by item or reporter"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                
            </div>

            {/* Reports Table */}
            <div className="table-card">
                <div className="row header">
                    <div className="cell">ID</div>
                    <div className="cell">Item Name</div>
                    <div className="cell">Reported By</div>
                    <div className="cell">Date Lost</div>
                    <div className="cell">Status</div>
                    <div className="cell">Actions</div>
                </div>

                {filteredReports.length > 0 ? (
                    filteredReports.map((r) => (
                        <div className="row" key={r.id}>
                            <div className="cell" data-label="ID">{r.id}</div>
                            <div className="cell" data-label="Item Name">{r.name}</div>
                            <div className="cell" data-label="Reported By">{r.reportedBy}</div>
                            <div className="cell" data-label="Date Lost">{r.dateLost}</div>
                            <div className="cell" data-label="Status">{r.status}</div>
                            <div className="cell" data-label="Actions">
                                <button className="btn" onClick={() => setSelectedReport(r)}>
                                    View
                                </button>
                                
                                <button  className="btn-delete" onClick={() => handleDelete(r.id)}>
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="row">
                        <div className="cell center-grid">
                            No lost reports found.
                        </div>
                    </div>
                )}
            </div>

            {/* Popup for "View" */}
            {selectedReport && (
                <div className="mf-modal" onClick={handleClosePopup}>
                    <div className="mf-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="mf-modal-header">
                            <h3>Lost Item Details</h3>
                            <button className="mf-close" onClick={handleClosePopup}>×</button>
                        </div>
                        <div className="mf-modal-body">
                            <div className="mf-detail"><strong>ID:</strong> {selectedReport.id}</div>
                            <div className="mf-detail"><strong>Item Name:</strong> {selectedReport.name}</div>
                            <div className="mf-detail"><strong>Reported By:</strong> {selectedReport.reportedBy}</div>
                            <div className="mf-detail"><strong>Location Lost:</strong> {selectedReport.location}</div>
                            <div className="mf-detail"><strong>Date Lost:</strong> {selectedReport.dateLost}</div>
                            {selectedReport.time !== "N/A" && (
                                <div className="mf-detail"><strong>Time Lost:</strong> {selectedReport.time}</div>
                            )}
                            <div className="mf-detail"><strong>Brand:</strong> {selectedReport.brand}</div>
                            {selectedReport.primary !== "N/A" && (
                                <div className="mf-detail"><strong>Primary Colour:</strong> {selectedReport.primary}</div>
                            )}
                            {selectedReport.secondary !== "N/A" && (
                                <div className="mf-detail"><strong>Secondary Colour:</strong> {selectedReport.secondary}</div>
                            )}
                            {selectedReport.additional && selectedReport.additional !== "N/A" && (
                                <div className="mf-detail"><strong>Additional Information:</strong> {selectedReport.additional}</div>
                            )}
                            <div className="mf-detail"><strong>Contact:</strong> {selectedReport.contact}</div>
                            {selectedReport.email !== "N/A" && (
                                <div className="mf-detail"><strong>Email:</strong> {selectedReport.email}</div>
                            )}
                            <div className="mf-detail"><strong>Status:</strong> {selectedReport.status}</div>
                        </div>
                        <div className="mf-modal-actions">
                            <button className="btn-secondary" onClick={handleClosePopup}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
