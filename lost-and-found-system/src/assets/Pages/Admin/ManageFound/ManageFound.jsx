import React, { useMemo, useState, useEffect } from 'react';
import './manage-found.css';
import { app, auth } from '../../../../firebase.js';
import { getDatabase, ref, onValue, push, update, remove } from 'firebase/database';
import { logAction } from '../../../../utils/logAction';
import FoundCard from '../../../Components/FoundCard/FoundCard.jsx';

export default function ManageFound() {
    const [items, setItems] = useState([]);
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selected, setSelected] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newItem, setNewItem] = useState({
        name: '',
        description: '',
        image: '',
        location: '',
        dateFound: new Date().toISOString().slice(0, 10),
        timeFound: '',
        brand: '',
        primaryColor: '',
        secondaryColor: '',
        additionalInfo: '',
        reporterFirstName: '',
        reporterLastName: '',
        reporterPhone: '',
        reporterEmail: '',
        status: 'Unclaimed'
    });
    const [claimer, setClaimer] = useState({ name: '', contact: '' });
    const [validation, setValidation] = useState({ method: '', notes: '' });
    const [isEditing, setIsEditing] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [error, setError] = useState('');
    const [errorContext, setErrorContext] = useState(''); // 'add', 'edit', 'claim', 'global'
    const [success, setSuccess] = useState('');

    // Simple validators
    function isValidUrl(value) {
        if (!value) return true;
        try {
            const u = new URL(value);
            return u.protocol === 'http:' || u.protocol === 'https:';
        } catch (_) {
            return false;
        }
    }

    function isValidEmail(value) {
        if (!value) return true;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    function isValidPhone(value) {
        if (!value) return true;
        return /^[0-9+()\-\s]{7,20}$/.test(value);
    }

    // Regex-based validators for domain fields
    function isAlphaSpace(value) {
        if (!value) return true;
        return /^[A-Za-z\s\-'.]{2,60}$/.test(value);
    }

    function isItemName(value) {
        if (!value) return true;
        return /^[A-Za-z0-9\s\-'.&,()]{2,100}$/.test(value);
    }

    function isLocation(value) {
        if (!value) return true;
        return /^[A-Za-z0-9\s\-'.&,()]{2,120}$/.test(value);
    }

    function isBrand(value) {
        if (!value) return true;
        return /^[A-Za-z0-9\s\-'.&]{2,60}$/.test(value);
    }

    function isColor(value) {
        if (!value) return true;
        return /^[A-Za-z\s\-]{3,40}$/.test(value);
    }

    function isValidTime(value) {
        if (!value) return true;
        return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
    }

    function isPastOrToday(dateStr) {
        if (!dateStr) return true;
        const todayStr = new Date().toISOString().slice(0, 10);
        return dateStr <= todayStr;
    }

    // Build a flattened search index string for a found item
    function buildSearchIndex(item) {
        const reporterName = `${item.reporterFirstName || ''} ${item.reporterLastName || ''}`.trim();
        const parts = [
            item.id,
            item.name,
            item.description,
            item.location,
            item.brand,
            item.primaryColor,
            item.secondaryColor,
            item.additionalInfo,
            item.dateFound,
            item.timeFound,
            reporterName,
            item.reporterPhone,
            item.reporterEmail,
            item.status,
            item.ownerName,
            item.ownerContact,
        ].filter(Boolean);
        return parts.join(' ').toLowerCase();
    }

    function matchesFieldFilter(item, field, valueLc) {
        switch (field) {
            case 'status':
                return (item.status || '').toLowerCase().includes(valueLc);
            case 'brand':
                return (item.brand || '').toLowerCase().includes(valueLc);
            case 'color':
                return (item.primaryColor || '').toLowerCase().includes(valueLc) || (item.secondaryColor || '').toLowerCase().includes(valueLc);
            case 'location':
                return (item.location || '').toLowerCase().includes(valueLc);
            case 'name':
                return (item.name || '').toLowerCase().includes(valueLc);
            case 'desc':
            case 'description':
                return (item.description || '').toLowerCase().includes(valueLc) || (item.additionalInfo || '').toLowerCase().includes(valueLc);
            case 'reporter':
                return (`${item.reporterFirstName || ''} ${item.reporterLastName || ''}`.toLowerCase().includes(valueLc));
            case 'phone':
                return (item.reporterPhone || '').toLowerCase().includes(valueLc) || (item.ownerContact || '').toLowerCase().includes(valueLc);
            case 'email':
                return (item.reporterEmail || '').toLowerCase().includes(valueLc);
            case 'owner':
                return (item.ownerName || '').toLowerCase().includes(valueLc);
            case 'id':
                return (item.id || '').toLowerCase().includes(valueLc);
            case 'date':
                return (item.dateFound || '').toLowerCase().includes(valueLc);
            case 'time':
                return (item.timeFound || '').toLowerCase().includes(valueLc);
            default:
                return false;
        }
    }

    function validateNewItemFields(values) {
        const errs = [];
        // Required presence
        if (!values.name?.trim()) errs.push('Item Name is required.');
        if (!values.location?.trim()) errs.push('Location is required.');
        if (!values.dateFound?.trim()) errs.push('Date Found is required.');
        if (!values.timeFound?.trim()) errs.push('Time Found is required.');
        if (!values.brand?.trim()) errs.push('Brand is required.');
        if (!values.primaryColor?.trim()) errs.push('Primary Color is required.');
        if (!values.description?.trim()) errs.push('Description is required.');
        if (!values.reporterFirstName?.trim()) errs.push('Reporter First Name is required.');
        if (!values.reporterLastName?.trim()) errs.push('Reporter Last Name is required.');
        if (!values.reporterPhone?.trim()) errs.push('Reporter Phone is required.');
        if (!values.reporterEmail?.trim()) errs.push('Reporter Email is required.');

        // Logical constraints
        if (!isPastOrToday(values.dateFound)) errs.push('Date Found cannot be in the future.');
        if (!isValidUrl(values.image)) errs.push('Image URL must be http(s).');
        if (!isValidEmail(values.reporterEmail)) errs.push('Reporter Email is invalid.');
        if (!isValidPhone(values.reporterPhone)) errs.push('Reporter Phone is invalid.');
        if (!isItemName(values.name)) errs.push('Item Name contains invalid characters.');
        if (!isLocation(values.location)) errs.push('Location contains invalid characters.');
        if (!isBrand(values.brand)) errs.push('Brand contains invalid characters.');
        if (!isColor(values.primaryColor)) errs.push('Primary Color contains invalid characters.');
        if (values.secondaryColor && !isColor(values.secondaryColor)) errs.push('Secondary Color contains invalid characters.');
        if (!isAlphaSpace(values.reporterFirstName)) errs.push('Reporter First Name contains invalid characters.');
        if (!isAlphaSpace(values.reporterLastName)) errs.push('Reporter Last Name contains invalid characters.');
        if (!isValidTime(values.timeFound)) errs.push('Time Found must be HH:MM (24-hour).');
        if (values.status === 'Claimed') errs.push('Cannot add item as Claimed directly. Use claim process later.');
        return errs;
    }

    function validateEditItemFields(values, currentSelected) {
        const errs = [];
        // Required presence
        if (!values.name?.trim()) errs.push('Item Name is required.');
        if (!values.location?.trim()) errs.push('Location is required.');
        if (!values.dateFound?.trim()) errs.push('Date Found is required.');
        if (!values.timeFound?.trim()) errs.push('Time Found is required.');
        if (!values.brand?.trim()) errs.push('Brand is required.');
        if (!values.primaryColor?.trim()) errs.push('Primary Color is required.');
        if (!values.description?.trim()) errs.push('Description is required.');
        if (!values.reporterFirstName?.trim()) errs.push('Reporter First Name is required.');
        if (!values.reporterLastName?.trim()) errs.push('Reporter Last Name is required.');
        if (!values.reporterPhone?.trim()) errs.push('Reporter Phone is required.');
        if (!values.reporterEmail?.trim()) errs.push('Reporter Email is required.');

        // Logical constraints
        if (!isPastOrToday(values.dateFound)) errs.push('Date Found cannot be in the future.');
        if (!isValidUrl(values.image)) errs.push('Image URL must be http(s).');
        if (!isValidEmail(values.reporterEmail)) errs.push('Reporter Email is invalid.');
        if (!isValidPhone(values.reporterPhone)) errs.push('Reporter Phone is invalid.');
        if (!isItemName(values.name)) errs.push('Item Name contains invalid characters.');
        if (!isLocation(values.location)) errs.push('Location contains invalid characters.');
        if (!isBrand(values.brand)) errs.push('Brand contains invalid characters.');
        if (!isColor(values.primaryColor)) errs.push('Primary Color contains invalid characters.');
        if (values.secondaryColor && !isColor(values.secondaryColor)) errs.push('Secondary Color contains invalid characters.');
        if (!isAlphaSpace(values.reporterFirstName)) errs.push('Reporter First Name contains invalid characters.');
        if (!isAlphaSpace(values.reporterLastName)) errs.push('Reporter Last Name contains invalid characters.');
        if (!isValidTime(values.timeFound)) errs.push('Time Found must be HH:MM (24-hour).');

        // Business rule: Do not allow setting Unclaimed when claimer data exists
        const hasClaimer = !!(currentSelected?.ownerName || currentSelected?.ownerContact);
        if (values.status === 'Unclaimed' && hasClaimer) {
            errs.push('Cannot set status to Unclaimed while claimer info exists. Remove claim first.');
        }
        return errs;
    }

    // Load items from Firebase
    useEffect(() => {
        const db = getDatabase(app);
        const foundRef = ref(db, 'foundItems');

        onValue(foundRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const itemsList = Object.entries(data).map(([id, value]) => ({
                    id,
                    name: value.name || value.item || '',
                    description: value.description || value.additional || '',
                    image: value.image || value.imageUrl || '',
                    location: value.location || '',
                    dateFound: value.dateFound || value.date || '',
                    timeFound: value.timeFound || value.time || '',
                    brand: value.brand || '',
                    primaryColor: value.primaryColor || value.primary || '',
                    secondaryColor: value.secondaryColor || value.secondary || '',
                    additionalInfo: value.additionalInfo || value.additional || '',
                    reporterFirstName: value.reporterFirstName || value.first || '',
                    reporterLastName: value.reporterLastName || value.last || '',
                    reporterPhone: value.reporterPhone || value.phone || '',
                    reporterEmail: value.reporterEmail || value.email || '',
                    status: value.status || 'Unclaimed',
                    ownerName: value.ownerName || '',
                    ownerContact: value.ownerContact || '',
                    ownerEmail: value.ownerEmail || '',
                    validation: value.validation || null,
                    lostItemId: value.lostItemId || null,
                    dateClaimed: value.dateClaimed || null,
                    submittedAt: value.submittedAt || null
                }));
                setItems(itemsList);
            } else {
                setItems([]);
            }
        });
    }, []);

    const filtered = useMemo(() => {
        let filteredItems = items;

        if (statusFilter !== 'all') {
            filteredItems = filteredItems.filter(it => it.status === statusFilter);
        }

        const q = query.trim().toLowerCase();
        if (q) {
            const tokens = q.split(/\s+/).filter(Boolean);
            filteredItems = filteredItems.filter((it) => {
                const index = buildSearchIndex(it);
                return tokens.every((tok) => {
                    // Fielded search: field:value
                    const kv = tok.split(':');
                    if (kv.length === 2 && kv[0] && kv[1]) {
                        return matchesFieldFilter(it, kv[0], kv[1]);
                    }
                    // Fallback: token appears anywhere
                    return index.includes(tok);
                });
            });
        }

        return filteredItems;
    }, [items, query, statusFilter]);

    function showError(message, context = 'global') {
        setError(message);
        setErrorContext(context);
        setTimeout(() => {
            setError('');
            setErrorContext('');
        }, 5000);
    }

    function showSuccess(message) {
        setSuccess(message);
        setTimeout(() => setSuccess(''), 3000);
    }

    async function addNewItem() {
        const errs = validateNewItemFields(newItem);
        if (errs.length) {
            // Join with a unique delimiter so UI can split and render nicely
            showError(errs.join('||'), 'add');
            return;
        }

        if (!window.confirm('Are you sure you want to add this found item?')) {
            return;
        }

        const db = getDatabase(app);
        const foundRef = ref(db, 'foundItems');

        try {
            await push(foundRef, {
                name: newItem.name,
                description: newItem.description || '',
                image: newItem.image || '',
                location: newItem.location,
                dateFound: newItem.dateFound,
                timeFound: newItem.timeFound || '',
                brand: newItem.brand || '',
                primaryColor: newItem.primaryColor || '',
                secondaryColor: newItem.secondaryColor || '',
                additionalInfo: newItem.additionalInfo || '',
                reporterFirstName: newItem.reporterFirstName || '',
                reporterLastName: newItem.reporterLastName || '',
                reporterPhone: newItem.reporterPhone || '',
                reporterEmail: newItem.reporterEmail || '',
                status: newItem.status || 'Unclaimed',
                ownerName: '',
                ownerContact: '',
                ownerEmail: '',
                submittedAt: new Date().toISOString()
            });
            await logAction('Added found item', newItem.name, `Location: ${newItem.location}, Status: ${newItem.status || 'Unclaimed'}`);
            setNewItem({
                name: '',
                description: '',
                image: '',
                location: '',
                dateFound: new Date().toISOString().slice(0, 10),
                timeFound: '',
                brand: '',
                primaryColor: '',
                secondaryColor: '',
                additionalInfo: '',
                reporterFirstName: '',
                reporterLastName: '',
                reporterPhone: '',
                reporterEmail: '',
                status: 'Unclaimed'
            });
            setShowAddForm(false);
            showSuccess('Item added successfully!');
        } catch (error) {
            console.error('Error adding item:', error);
            showError('Failed to add item. Please try again.', 'add');
        }
    }

    async function validateClaim(item) {
        if (!validation.method) {
            showError('Please select a validation method.', 'claim');
            return;
        }

        if (!window.confirm(`Are you sure you want to validate this claim using "${validation.method}"?`)) {
            return;
        }

        const db = getDatabase(app);
        const itemRef = ref(db, `foundItems/${item.id}`);
        const details = {
            method: validation.method,
            notes: validation.notes || '',
            date: new Date().toISOString().slice(0, 10)
        };

        try {
            await update(itemRef, {
                status: 'Validated',
                validation: details
            });
            await logAction('Validated claim', item.name, `Method: ${details.method}, Notes: ${details.notes || 'None'}`);
            setSelected(prev => prev ? { ...prev, status: 'Validated', validation: details } : null);
            setValidation({ method: '', notes: '' });
            showSuccess('Claim validated successfully!');
        } catch (error) {
            console.error('Error validating claim:', error);
            showError('Failed to validate. Please try again.', 'claim');
        }
    }

    async function markAsClaimed(item) {
        if (!claimer.name || !claimer.contact) {
            showError('Please provide claimer name and contact.', 'claim');
            return;
        }

        if (!window.confirm(`Mark this item as claimed by ${claimer.name}?`)) {
            return;
        }

        const db = getDatabase(app);
        const itemRef = ref(db, `foundItems/${item.id}`);
        const dateClaimed = new Date().toISOString().slice(0, 10);

        try {
            await update(itemRef, {
                status: 'Claimed',
                ownerName: claimer.name,
                ownerContact: claimer.contact,
                dateClaimed: dateClaimed
            });
            await logAction('Marked as claimed', item.name, `Claimed by: ${claimer.name}, Contact: ${claimer.contact}`);
            setSelected(null);
            setClaimer({ name: '', contact: '' });
            showSuccess('Item marked as claimed!');
        } catch (error) {
            console.error('Error marking as claimed:', error);
            showError('Failed to update. Please try again.', 'claim');
        }
    }

    async function handleDelete(item) {
        if (!window.confirm(`Are you sure you want to delete "${item.name}"? This action cannot be undone.`)) {
            return;
        }

        const db = getDatabase(app);
        const itemRef = ref(db, `foundItems/${item.id}`);

        try {
            await remove(itemRef);
            await logAction('Deleted found item', item.name, `Location: ${item.location}`);
            setSelected(null);
            showSuccess('Item deleted successfully!');
        } catch (error) {
            console.error('Error deleting item:', error);
            showError('Failed to delete. Please try again.', 'global');
        }
    }

    function startEdit(item) {
        setEditItem({ ...item });
        setIsEditing(true);
        setSelected(item);
    }

    async function saveEdit() {
        const errs = validateEditItemFields(editItem, selected);
        if (errs.length) {
            showError(errs.join('||'), 'edit');
            return;
        }

        if (!window.confirm('Save changes to this item?')) {
            return;
        }

        const db = getDatabase(app);
        const itemRef = ref(db, `foundItems/${editItem.id}`);

        const updateData = {
            name: editItem.name,
            description: editItem.description || '',
            image: editItem.image || '',
            location: editItem.location,
            dateFound: editItem.dateFound,
            timeFound: editItem.timeFound || '',
            brand: editItem.brand || '',
            primaryColor: editItem.primaryColor || '',
            secondaryColor: editItem.secondaryColor || '',
            additionalInfo: editItem.additionalInfo || '',
            reporterFirstName: editItem.reporterFirstName || '',
            reporterLastName: editItem.reporterLastName || '',
            reporterPhone: editItem.reporterPhone || '',
            reporterEmail: editItem.reporterEmail || '',
            status: editItem.status
        };

        // If switching to Unclaimed after passing validation (i.e., no claimer exists), also ensure claim fields are cleared
        if (editItem.status === 'Unclaimed') {
            updateData.ownerName = '';
            updateData.ownerContact = '';
            updateData.ownerEmail = '';
            updateData.dateClaimed = null;
        }

        try {
            await update(itemRef, updateData);
            await logAction('Edited found item', editItem.name, `Updated: ${Object.keys(updateData).join(', ')}`);
            setIsEditing(false);
            setEditItem(null);
            setSelected(null);
            showSuccess('Item updated successfully!');
        } catch (error) {
            console.error('Error updating item:', error);
            showError('Failed to update. Please try again.', 'edit');
        }
    }

    function cancelEdit() {
        if (isEditing && window.confirm('Discard unsaved changes?')) {
            setIsEditing(false);
            setEditItem(null);
            setSelected(null);
        } else if (!isEditing) {
            setIsEditing(false);
            setEditItem(null);
            setSelected(null);
        }
    }

    function handleSelect(item) {
        setSelected(item);
        setIsEditing(false);
        setEditItem(null);
        setClaimer({ name: item.ownerName || '', contact: item.ownerContact || '' });
        setValidation({ method: '', notes: '' });
    }

    const today = new Date().toISOString().split("T")[0];

    return (
        <div className="admin-page">
            <div className="header-row">
                <h2>Manage Found Items</h2>
                <button className="btn-primary" onClick={() => setShowAddForm(!showAddForm)}>{showAddForm ? 'Cancel' : '+ Add New Item'}</button>
            </div>

            {error && errorContext === 'global' && (
                <div className="alert alert-error">
                    {error}
                </div>
            )}
            {success && (
                <div className="alert alert-success">
                    {success}
                </div>
            )}

            {showAddForm && (
                <div className="mf-modal">
                    <div className="mf-add-form">
                        <div className="withX">
                            <h3>Add New Found Item</h3>
                            <button className="mf-close" onClick={() => setShowAddForm(!showAddForm)}>×</button>
                        </div>
                        
                        {error && errorContext === 'add' && (
                            <div className="alert alert-error">
                                <ul>
                                    {error.split('||').filter(Boolean).map((msg, idx) => (
                                        <li key={idx}>{msg}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="mf-form-grid">
                            <div className="mf-form-field">
                                <label>Item Name *</label>
                                <input value={newItem.name} onChange={(e) => setNewItem(v => ({ ...v, name: e.target.value }))} placeholder="e.g., Black Wallet" />
                            </div>
                            <div className="mf-form-field">
                                <label>Location Found *</label>
                                <input value={newItem.location} onChange={(e) => setNewItem(v => ({ ...v, location: e.target.value }))} placeholder="e.g., Library, Cafeteria" />
                            </div>
                            <div className="mf-form-field">
                                <label>Date Found</label>
                                <input type="date" max={today} value={newItem.dateFound} onChange={(e) => setNewItem(v => ({ ...v, dateFound: e.target.value }))} />
                            </div>
                            <div className="mf-form-field">
                                <label>Time Found</label>
                                <input type="time" value={newItem.timeFound} onChange={(e) => setNewItem(v => ({ ...v, timeFound: e.target.value }))} />
                            </div>
                            <div className="mf-form-field">
                                <label>Brand</label>
                                <input value={newItem.brand} onChange={(e) => setNewItem(v => ({ ...v, brand: e.target.value }))} placeholder="e.g., Samsung, Nike" />
                            </div>
                            <div className="mf-form-field">
                                <label>Primary Color</label>
                                <input value={newItem.primaryColor} onChange={(e) => setNewItem(v => ({ ...v, primaryColor: e.target.value }))} placeholder="e.g., Black, Red" />
                            </div>
                            <div className="mf-form-field">
                                <label>Secondary Color</label>
                                <input value={newItem.secondaryColor} onChange={(e) => setNewItem(v => ({ ...v, secondaryColor: e.target.value }))} placeholder="Optional" />
                            </div>
                            <div className="mf-form-field">
                                <label>Status</label>
                                <select value={newItem.status} onChange={(e) => setNewItem(v => ({ ...v, status: e.target.value }))}>
                                    <option>Unclaimed</option>
                                    <option>Claimed</option>
                                </select>
                            </div>
                            <div className="mf-form-field full-width">
                                <label>Description</label>
                                <textarea value={newItem.description} onChange={(e) => setNewItem(v => ({ ...v, description: e.target.value }))} placeholder="Describe the item" rows="2" />
                            </div>
                            <div className="mf-form-field full-width">
                                <label>Additional Information</label>
                                <textarea value={newItem.additionalInfo} onChange={(e) => setNewItem(v => ({ ...v, additionalInfo: e.target.value }))} placeholder="Any other details" rows="2" />
                            </div>
                            <div className="mf-form-field full-width">
                                <label>Image URL (optional)</label>
                                <input type="url" value={newItem.image} onChange={(e) => setNewItem(v => ({ ...v, image: e.target.value }))} placeholder="https://example.com/image.jpg" />
                            </div>
                            <h4 className="reporter-section-header">Reporter Information</h4>
                            <div className="mf-form-field">
                                <label>First Name</label>
                                <input value={newItem.reporterFirstName} onChange={(e) => setNewItem(v => ({ ...v, reporterFirstName: e.target.value }))} />
                            </div>
                            <div className="mf-form-field">
                                <label>Last Name</label>
                                <input value={newItem.reporterLastName} onChange={(e) => setNewItem(v => ({ ...v, reporterLastName: e.target.value }))} />
                            </div>
                            <div className="mf-form-field">
                                <label>Phone</label>
                                <input type="tel" value={newItem.reporterPhone} onChange={(e) => setNewItem(v => ({ ...v, reporterPhone: e.target.value }))} placeholder="+639..." />
                            </div>
                            <div className="mf-form-field">
                                <label>Email</label>
                                <input type="email" value={newItem.reporterEmail} onChange={(e) => setNewItem(v => ({ ...v, reporterEmail: e.target.value }))} />
                            </div>
                        </div>
                        <button className="btn-primary" onClick={addNewItem}>Add Item</button>
                    </div>
                </div>
            )}

            <div className="mf-toolbar">
                <input className="mf-search" placeholder="Search items, location, or brand" value={query} onChange={(e) => setQuery(e.target.value)} />
                <select
                    className="status-filter"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="all">All Status</option>
                    <option value="Unclaimed">Unclaimed</option>
                    <option value="Claimed">Claimed</option>
                </select>
                <button className="btn-secondary" onClick={() => {
                    setQuery('');
                    setStatusFilter('all');
                }}>
                    Clear All
                </button>
            </div>

            <div className="mf-cards">
                {filtered.map((it) => (
                    <FoundCard key={it.id} item={it} onSelect={handleSelect} />
                ))}
                {!filtered.length && <div className="mf-empty">No items found.</div>}
            </div>

            {selected && (
                <div className="mf-modal" onClick={() => {
                    if (!isEditing) {
                        setSelected(null);
                        setClaimer({ name: '', contact: '' });
                        setValidation({ method: '', notes: '' });
                    }
                }}>
                    <div className="mf-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="mf-modal-header">
                            <h3>{isEditing ? 'Edit Item' : 'Item Details'}</h3>
                            <button className="mf-close" onClick={() => {
                                if (isEditing) {
                                    cancelEdit();
                                } else {
                                    setSelected(null);
                                    setClaimer({ name: '', contact: '' });
                                    setValidation({ method: '', notes: '' });
                                }
                            }}>×</button>
                        </div>
                        <div className="mf-modal-body">
                            {error && (errorContext === 'edit' || errorContext === 'claim') && (
                                <div className="alert alert-error">
                                    {errorContext === 'edit' ? (
                                        <ul>
                                            {error.split('||').filter(Boolean).map((msg, idx) => (
                                                <li key={idx}>{msg}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        error
                                    )}
                                </div>
                            )}

                            {isEditing ? (
                                <div className="mf-form-grid">
                                    <div className="mf-form-field">
                                        <label>Item Name *</label>
                                        <input value={editItem.name} onChange={(e) => setEditItem(v => ({ ...v, name: e.target.value }))} />
                                    </div>
                                    <div className="mf-form-field">
                                        <label>Location *</label>
                                        <input value={editItem.location} onChange={(e) => setEditItem(v => ({ ...v, location: e.target.value }))} />
                                    </div>
                                    <div className="mf-form-field">
                                        <label>Date Found</label>
                                        <input type="date" max={today} value={editItem.dateFound} onChange={(e) => setEditItem(v => ({ ...v, dateFound: e.target.value }))} />
                                    </div>
                                    <div className="mf-form-field">
                                        <label>Time Found</label>
                                        <input type="time" value={editItem.timeFound || ''} onChange={(e) => setEditItem(v => ({ ...v, timeFound: e.target.value }))} />
                                    </div>
                                    <div className="mf-form-field">
                                        <label>Brand</label>
                                        <input value={editItem.brand || ''} onChange={(e) => setEditItem(v => ({ ...v, brand: e.target.value }))} />
                                    </div>
                                    <div className="mf-form-field">
                                        <label>Primary Color</label>
                                        <input value={editItem.primaryColor || ''} onChange={(e) => setEditItem(v => ({ ...v, primaryColor: e.target.value }))} />
                                    </div>
                                    <div className="mf-form-field">
                                        <label>Secondary Color</label>
                                        <input value={editItem.secondaryColor || ''} onChange={(e) => setEditItem(v => ({ ...v, secondaryColor: e.target.value }))} />
                                    </div>
                                    <div className="mf-form-field">
                                        <label>Status</label>
                                        <select value={editItem.status} onChange={(e) => setEditItem(v => ({ ...v, status: e.target.value }))}>
                                            <option>Unclaimed</option>
                                            <option>Claimed</option>
                                        </select>
                                    </div>
                                    <div className="mf-form-field full-width">
                                        <label>Description</label>
                                        <textarea value={editItem.description || ''} onChange={(e) => setEditItem(v => ({ ...v, description: e.target.value }))} rows="2" />
                                    </div>
                                    <div className="mf-form-field full-width">
                                        <label>Additional Info</label>
                                        <textarea value={editItem.additionalInfo || ''} onChange={(e) => setEditItem(v => ({ ...v, additionalInfo: e.target.value }))} rows="2" />
                                    </div>
                                    <div className="mf-form-field full-width">
                                        <label>Image URL</label>
                                        <input type="url" value={editItem.image || ''} onChange={(e) => setEditItem(v => ({ ...v, image: e.target.value }))} />
                                    </div>
                                    <h4 className="reporter-section-header">Reporter Information</h4>
                                    <div className="mf-form-field">
                                        <label>First Name</label>
                                        <input value={editItem.reporterFirstName || ''} onChange={(e) => setEditItem(v => ({ ...v, reporterFirstName: e.target.value }))} />
                                    </div>
                                    <div className="mf-form-field">
                                        <label>Last Name</label>
                                        <input value={editItem.reporterLastName || ''} onChange={(e) => setEditItem(v => ({ ...v, reporterLastName: e.target.value }))} />
                                    </div>
                                    <div className="mf-form-field">
                                        <label>Phone</label>
                                        <input type="tel" value={editItem.reporterPhone || ''} onChange={(e) => setEditItem(v => ({ ...v, reporterPhone: e.target.value }))} />
                                    </div>
                                    <div className="mf-form-field">
                                        <label>Email</label>
                                        <input type="email" value={editItem.reporterEmail || ''} onChange={(e) => setEditItem(v => ({ ...v, reporterEmail: e.target.value }))} />
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="mf-section">
                                        <h4>Item Information</h4>
                                        {selected.image && (
                                            <div className="mf-image-container">
                                                <img
                                                    src={selected.image}
                                                    alt={selected.name}
                                                    className="mf-image"
                                                    onError={(e) => {
                                                        e.target.style.display = 'none';
                                                        e.target.nextSibling.style.display = 'block';
                                                    }}
                                                />
                                                <div className="mf-image-error">
                                                    Image failed to load. <a href={selected.image} target="_blank" rel="noopener noreferrer">Open link</a>
                                                </div>
                                            </div>
                                        )}
                                        <div className="mf-detail"><strong>ID:</strong> {selected.id}</div>
                                        <div className="mf-detail"><strong>Item Name:</strong> {selected.name}</div>
                                        <div className="mf-detail"><strong>Description:</strong> {selected.description || '—'}</div>
                                        <div className="mf-detail"><strong>Location:</strong> {selected.location}</div>
                                        <div className="mf-detail"><strong>Date Found:</strong> {selected.dateFound}</div>
                                        {selected.timeFound && (
                                            <div className="mf-detail"><strong>Time Found:</strong> {selected.timeFound}</div>
                                        )}
                                        {selected.brand && (
                                            <div className="mf-detail"><strong>Brand:</strong> {selected.brand}</div>
                                        )}
                                        {selected.primaryColor && (
                                            <div className="mf-detail"><strong>Primary Color:</strong> {selected.primaryColor}</div>
                                        )}
                                        {selected.secondaryColor && (
                                            <div className="mf-detail"><strong>Secondary Color:</strong> {selected.secondaryColor}</div>
                                        )}
                                        {selected.additionalInfo && (
                                            <div className="mf-detail"><strong>Additional Info:</strong> {selected.additionalInfo}</div>
                                        )}
                                        <div className="mf-detail"><strong>Status:</strong> {selected.status}</div>
                                    </div>

                                    {(selected.reporterFirstName || selected.reporterLastName || selected.reporterPhone || selected.reporterEmail) && (
                                        <div className="mf-section">
                                            <h4>Reporter Information</h4>
                                            {(selected.reporterFirstName || selected.reporterLastName) && (
                                                <div className="mf-detail">
                                                    <strong>Name:</strong> {selected.reporterFirstName} {selected.reporterLastName}
                                                </div>
                                            )}
                                            {selected.reporterPhone && (
                                                <div className="mf-detail"><strong>Phone:</strong> {selected.reporterPhone}</div>
                                            )}
                                            {selected.reporterEmail && (
                                                <div className="mf-detail"><strong>Email:</strong> {selected.reporterEmail}</div>
                                            )}
                                        </div>
                                    )}

                                    {(selected.ownerName || selected.ownerContact) && (
                                        <div className="mf-section">
                                            <h4>Claim Information</h4>
                                            {selected.ownerName && (
                                                <div className="mf-detail"><strong>Claimer Name:</strong> {selected.ownerName}</div>
                                            )}
                                            {selected.ownerContact && (
                                                <div className="mf-detail"><strong>Claimer Contact:</strong> {selected.ownerContact}</div>
                                            )}
                                            {selected.dateClaimed && (
                                                <div className="mf-detail"><strong>Date Claimed:</strong> {selected.dateClaimed}</div>
                                            )}
                                        </div>
                                    )}

                                    {selected.validation && (
                                        <div className="mf-section">
                                            <h4>Validation Details</h4>
                                            <div className="mf-detail">
                                                <strong>Method:</strong> {selected.validation.method}
                                            </div>
                                            {selected.validation.notes && (
                                                <div className="mf-detail"><strong>Notes:</strong> {selected.validation.notes}</div>
                                            )}
                                            <div className="mf-detail"><strong>Date:</strong> {selected.validation.date}</div>
                                        </div>
                                    )}

                                    {selected.status !== 'Claimed' && (
                                        <div className="mf-claim">
                                            <h4>Process Claim</h4>
                                            <label>Claimer Name</label>
                                            <input value={claimer.name} onChange={(e) => setClaimer(v => ({ ...v, name: e.target.value }))} placeholder="Full name" />
                                            <label>Claimer Contact</label>
                                            <input value={claimer.contact} onChange={(e) => setClaimer(v => ({ ...v, contact: e.target.value }))} placeholder="Phone or Email" />
                                            <h4 className="validation-header">Validation Details</h4>
                                            <label>Method</label>
                                            <select value={validation.method} onChange={(e) => setValidation(v => ({ ...v, method: e.target.value }))}>
                                                <option value="">Select method</option>
                                                <option>Photo/Description Match</option>
                                                <option>Unique Identifier (ID/Serial)</option>
                                                <option>Knowledge-based Questions</option>
                                                <option>Proof of Ownership</option>
                                            </select>
                                            <label>Notes (optional)</label>
                                            <input value={validation.notes} onChange={(e) => setValidation(v => ({ ...v, notes: e.target.value }))} placeholder="Short notes" />
                                            {validation.method && (
                                                <button className="btn-primary validate-btn" onClick={() => validateClaim(selected)}>Validate Claim</button>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="mf-modal-actions">
                            {isEditing ? (
                                <>
                                    <button className="btn-secondary" onClick={cancelEdit}>Cancel</button>
                                    <button className="btn-primary" onClick={saveEdit}>Save Changes</button>
                                </>
                            ) : (
                                <>
                                    <button className="btn-primary" onClick={() => startEdit(selected)}>Edit</button>
                                    <button className="btn-secondary" onClick={() => handleDelete(selected)}>Delete</button>
                                    {selected.status !== 'Claimed' && (
                                        <button className="btn-primary" onClick={() => markAsClaimed(selected)}>Mark as Claimed</button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}