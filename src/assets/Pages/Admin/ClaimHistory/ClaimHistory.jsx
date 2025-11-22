import React, { useState, useEffect } from 'react';
import './claim-history.css';
import {app,auth} from '../../../../firebase.js';
import { getDatabase, ref, onValue, update } from 'firebase/database';
import { logAction } from '../../../../utils/logAction';
import { useConfirmDialog } from '../../../Components/ConfirmDialog/ConfirmDialog.jsx';

function ClaimHistory() {
	const [claims, setClaims] = useState([]);
	const [selectedClaim, setSelectedClaim] = useState(null);
	const [searchQuery, setSearchQuery] = useState('');
	const confirmDialog = useConfirmDialog();

	// Load claimed items from Firebase
	useEffect(() => {
		const db = getDatabase(app);
		const foundRef = ref(db, 'foundItems');

		onValue(foundRef, (snapshot) => {
			const data = snapshot.val();
			if (data) {
				const claimedItems = Object.entries(data)
					.filter(([id, value]) => value.status === 'Claimed' && value.ownerName)
					.map(([id, value]) => ({
						id,
						displayId: value.customId || id,
						item: value.name || '',
						image: value.image || '',
						claimedBy: value.ownerName || 'Unknown',
						date: value.dateClaimed || new Date().toISOString().slice(0, 10),
						admin: 'Admin', // You can add admin tracking later
						contact: value.ownerContact || '',
						email: value.ownerEmail || '',
						location: value.location || '',
						dateFound: value.dateFound || '',
						timeFound: value.timeFound || '',
						description: value.description || '',
						brand: value.brand || '',
						primaryColor: value.primaryColor || '',
						secondaryColor: value.secondaryColor || '',
						additionalInfo: value.additionalInfo || '',
					}))
					.sort((a, b) => {
						// Sort by date, newest first. If no date, put at end
						const dateA = a.date ? new Date(a.date) : new Date(0);
						const dateB = b.date ? new Date(b.date) : new Date(0);
						return dateB - dateA;
					});
				setClaims(claimedItems);
			} else {
				setClaims([]);
			}
		});
	}, []);

	// Filter claims based on search
	const filteredClaims = claims.filter(claim => {
		const query = searchQuery.toLowerCase();
		return (
			claim.item.toLowerCase().includes(query) ||
			(claim.displayId || claim.id || '').toLowerCase().includes(query) ||
			claim.claimedBy.toLowerCase().includes(query) ||
			claim.location.toLowerCase().includes(query)
		);
	});

	// Revert claim status
	const handleRevert = async (claim) => {
		const confirmed = await confirmDialog({
			title: 'Revert claim',
			message: `Revert "${claim.item}" claim status? This will change it back to Unclaimed.`,
			confirmText: 'Revert',
			variant: 'danger'
		});
		if (!confirmed) return;

		const db = getDatabase(app);
		const itemRef = ref(db, `foundItems/${claim.id}`);

		try {
			await update(itemRef, {
				status: 'Unclaimed',
				ownerName: '',
				ownerContact: ''
			});
			await logAction('Reverted claim', claim.item, `Previously claimed by: ${claim.claimedBy}`);
			alert('Claim status reverted successfully!');
		} catch (error) {
			console.error('Error reverting claim:', error);
			alert('Failed to revert. Please try again.');
		}
	};

	return (
		<div className="admin-page">
			<h2>Claim History</h2>

			{/* Search bar */}
			<div className="toolbar">
				<input
					className="search"
					placeholder="Search by item name, claimed by, or location"
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
				/>
				{/* <button className="btn" onClick={() => setSearchQuery('')}>
					Clear
				</button> */}
			</div>

			<div className="table-card">
				<table>
					<thead>
						<tr>
							<th>ID</th>
							<th>Item Name</th>
							<th>Claimed By</th>
							<th>Date Claimed</th>
							<th>Processed By</th>
							<th>Action</th>
						</tr>
					</thead>
					<tbody>
						{filteredClaims.length > 0 ? (
							filteredClaims.map((c) => (
								<tr key={c.id}>
									<td data-label="ID" className="id-cell">{c.displayId || c.id}</td>
									<td data-label="Item Name">{c.item}</td>
									<td data-label="Claimed By">{c.claimedBy}</td>
									<td data-label="Date Claimed">{c.date}</td>
									<td data-label="Processed By">{c.admin}</td>
									<td data-label="Action">
										<button className="btn" onClick={() => setSelectedClaim(c)}>View</button>
									
									</td>
									<td><button className="btn" onClick={() => handleRevert(c)}>Revert Action</button>	</td>
								</tr>
							))
						) : (
							<tr>
								<td colSpan="6" className="empty-table-cell">
									{searchQuery ? 'No claims found matching your search.' : 'No claimed items yet.'}
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>

			{/* View Details Modal */}
			{selectedClaim && (
				<div className="mf-modal" onClick={() => setSelectedClaim(null)}>
					<div className="mf-modal-content" onClick={(e) => e.stopPropagation()}>
						<div className="mf-modal-header">
							<h3>Claim Details</h3>
							<button className="mf-close" onClick={() => setSelectedClaim(null)}>×</button>
						</div>
						<div className="mf-modal-body">
							{selectedClaim.image && (
								<div className="mf-image-container">
									<img src={selectedClaim.image} alt={selectedClaim.item} className="mf-image" />
								</div>
							)}
							<div className="mf-detail"><strong>ID:</strong> {selectedClaim.displayId || selectedClaim.id}</div>
							<div className="mf-detail"><strong>Item Name:</strong> {selectedClaim.item}</div>
							<div className="mf-detail"><strong>Description:</strong> {selectedClaim.description || '—'}</div>
							<div className="mf-detail"><strong>Claimed By:</strong> {selectedClaim.claimedBy}</div>
							<div className="mf-detail"><strong>Contact:</strong> {selectedClaim.contact}</div>
							{selectedClaim.email && (
								<div className="mf-detail"><strong>Email:</strong> {selectedClaim.email}</div>
							)}
							<div className="mf-detail"><strong>Location Found:</strong> {selectedClaim.location}</div>
							<div className="mf-detail"><strong>Date Found:</strong> {selectedClaim.dateFound}</div>
							{selectedClaim.timeFound && (
								<div className="mf-detail"><strong>Time Found:</strong> {selectedClaim.timeFound}</div>
							)}
							{selectedClaim.brand && (
								<div className="mf-detail"><strong>Brand:</strong> {selectedClaim.brand}</div>
							)}
							{selectedClaim.primaryColor && (
								<div className="mf-detail"><strong>Primary Color:</strong> {selectedClaim.primaryColor}</div>
							)}
							{selectedClaim.secondaryColor && (
								<div className="mf-detail"><strong>Secondary Color:</strong> {selectedClaim.secondaryColor}</div>
							)}
							{selectedClaim.additionalInfo && (
								<div className="mf-detail"><strong>Additional Info:</strong> {selectedClaim.additionalInfo}</div>
							)}
							<div className="mf-detail"><strong>Date Claimed:</strong> {selectedClaim.date}</div>
						</div>
						<div className="mf-modal-actions">
							<button className="btn-secondary" onClick={() => setSelectedClaim(null)}>Close</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

export default ClaimHistory;


