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
const FALLBACK_IMAGE = "https://media.istockphoto.com/id/1980276924/vector/no-photo-thumbnail-graphic-element-no-found-or-available-image-in-the-gallery-or-album-flat.jpg?s=612x612&w=0&k=20&c=ZBE3NqfzIeHGDPkyvulUw14SaWfDj2rZtyiKv3toItk=";
import { useConfirmDialog } from "../../../Components/ConfirmDialog/ConfirmDialog.jsx";

export default function ManageLost() {
    const [reports, setReports] = useState([]);
    const [filteredReports, setFilteredReports] = useState([]);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all"); // "all", "found", "notFound"
    const [selectedReport, setSelectedReport] = useState(null);
    const confirmDialog = useConfirmDialog();

    useEffect(() => {
        const db = getDatabase(app);
        const lostRef = ref(db, "lostItems");

        // Listen for real-time updates
        onValue(lostRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const reportList = Object.entries(data).map(([id, value]) => ({
                    id,
                    displayId: value.customId || id,
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
                    imageUrl: (value.imageUrl || value.image || "").trim()
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

    // --- Delete report ---
    const handleDelete = async (id) => {
        const confirmed = await confirmDialog({
            title: 'Delete lost report',
            message: 'Are you sure you want to delete this report?',
            confirmText: 'Delete',
            variant: 'danger'
        });
        if (!confirmed) return;

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
                    {/* <div className="cell">Status</div> */}
                    <div className="cell">Actions</div>
                </div>

                {filteredReports.length > 0 ? (
                    filteredReports.map((r) => (
                        <div className="row" key={r.id}>
                            <div className="cell" data-label="ID">{r.displayId || r.id}</div>
                            <div className="cell" data-label="Item Name">{r.name}</div>
                            <div className="cell" data-label="Reported By">{r.reportedBy}</div>
                            <div className="cell" data-label="Date Lost">{r.dateLost}</div>
                          {/*   <div className="cell" data-label="Status">{r.status}</div> */}
                            <div className="cell" data-label="Actions">
                                <button className="btn" onClick={() => setSelectedReport(r)}>
                                    View
                                </button>
                                
                               {/*  <button  className="btn-delete" onClick={() => handleDelete(r.id)}>
                                    Delete
                                </button> */}
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
                            {selectedReport.imageUrl && selectedReport.imageUrl.trim() ? (
                                <div className="mf-detail image-preview">
                                    <img
                                        src={selectedReport.imageUrl.trim()}
                                        alt={selectedReport.name || "Lost Item"}
                                        onError={(e) => {
                                            console.error('Image failed to load:', selectedReport.imageUrl);
                                            if (e.currentTarget.src !== FALLBACK_IMAGE) {
                                                e.currentTarget.src = FALLBACK_IMAGE;
                                            }
                                        }}
                                        onLoad={() => {
                                            console.log('Image loaded successfully:', selectedReport.imageUrl);
                                        }}
                                    />
                                    <small style={{ display: 'block', marginTop: '8px', color: '#666', fontSize: '12px' }}>
                                        Image URL: {selectedReport.imageUrl.trim()}
                                    </small>
                                </div>
                            ) : (
                                <div className="mf-detail image-preview">
                                    <img
                                        src={FALLBACK_IMAGE}
                                        alt="No image available"
                                    />
                                    <small style={{ display: 'block', marginTop: '8px', color: '#999', fontSize: '12px' }}>
                                        No image URL provided
                                    </small>
                                </div>
                            )}
                            <div className="mf-detail"><strong>ID:</strong> {selectedReport.displayId || selectedReport.id}</div>
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
