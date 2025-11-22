import React, { useState, useEffect, useMemo } from 'react';
import './manage-users.css';
import { app, auth, secondaryAuth } from '../../../../firebase.js';
import { getDatabase, ref, onValue, update, get, set, runTransaction } from 'firebase/database';
import { createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { logAction } from '../../../../utils/logAction';

async function reserveUserId(db) {
    const counterRef = ref(db, 'counters/users');
    const result = await runTransaction(counterRef, (currentValue) => {
        if (typeof currentValue !== 'number' || Number.isNaN(currentValue) || currentValue < 0) {
            return 1;
        }
        return currentValue + 1;
    });

    if (!result.committed) {
        throw new Error('Unable to reserve a new User ID. Please try again.');
    }

    const nextNumber = result.snapshot.val();
    return `User${String(nextNumber).padStart(3, '0')}`;
}

export default function ManageUsers() {
    const [userData, setUserData] = useState(null);
    const isAdmin = userData?.role === 'Admin';

    // Load user data
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const db = getDatabase(app);
                const usersRef = ref(db, 'users');
                try {
                    const snapshot = await get(usersRef);
                    if (snapshot.exists()) {
                        const users = snapshot.val();
                        const userEntry = Object.entries(users).find(([id, data]) => data.email === user.email);
                        if (userEntry) {
                            setUserData({ id: userEntry[0], ...userEntry[1] });
                        }
                    }
                } catch (error) {
                    console.error('Error fetching user data:', error);
                }
            } else {
                setUserData(null);
            }
        });

        return unsubscribe;
    }, []);
    const [users, setUsers] = useState([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [form, setForm] = useState({ name: '', email: '', birthday: '', role: 'User', status: 'Active' });
    const [searchQuery, setSearchQuery] = useState('');
    const [editingUser, setEditingUser] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', email: '', birthday: '', role: 'User', status: 'Active' });
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [addErrorMsg, setAddErrorMsg] = useState('');
    const [addSuccessMsg, setAddSuccessMsg] = useState('');

    // Load users from Firebase
    useEffect(() => {
        const db = getDatabase(app);
        const usersRef = ref(db, 'users');

        onValue(usersRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const usersList = Object.entries(data).map(([id, value]) => ({
                    id,
                    displayId: value.customId || id,
                    name: value.name || '',
                    email: value.email || '',
                    birthday: value.birthday || '',
                    role: value.role || 'User',
                    status: value.status || 'Active',
                    profileLink: value.profileLink || '',
                    profileInitials: value.profileInitials || getInitials(value.name || ''),
                }));
                setUsers(usersList);
            } else {
                setUsers([]);
            }
        });
    }, []);

    // Filter users based on search
    const filteredUsers = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return users;
        return users.filter(
            (u) =>
                u.name.toLowerCase().includes(query) ||
                u.email.toLowerCase().includes(query) ||
                (u.role || '').toLowerCase().includes(query) ||
                ((u.displayId || u.id || '').toLowerCase().includes(query))
        );
    }, [users, searchQuery]);

    function isAdult(birthdayStr) {
        if (!birthdayStr) return false;
        const today = new Date();
        const dob = new Date(birthdayStr);
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
        return age >= 18;
    }

    function defaultPasswordFromBirthday(birthdayStr) {
        // Set default password exactly as the birthday string (YYYY-MM-DD)
        return birthdayStr;
    }

    // Helper function to get initials from name
    function getInitials(name) {
        if (!name) return "U";
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    async function addUser() {
        if (!isAdmin) {
            setAddErrorMsg('Only administrators can add users.');
            return;
        }

        if (!form.name || !form.email || !form.birthday) {
            setAddErrorMsg('Please fill in all required fields (Name, Email, Birthday).');
            return;
        }

        if (!isAdult(form.birthday)) {
            setAddErrorMsg('User must be at least 18 years old.');
            return;
        }
        const db = getDatabase(app);
        
        try {
            // Create user in Firebase Auth
            const defaultPassword = defaultPasswordFromBirthday(form.birthday);
            await createUserWithEmailAndPassword(secondaryAuth, form.email, defaultPassword);
            await signOut(secondaryAuth);
            
            // Add user to database WITH passwordChanged flag and profile placeholder
            const profileInitials = getInitials(form.name);
            const formattedId = await reserveUserId(db);
            const userRef = ref(db, `users/${formattedId}`);
            await set(userRef, {
                customId: formattedId,
                name: form.name,
                email: form.email,
                birthday: form.birthday,
                role: form.role,
                status: form.status,
                passwordChanged: false,  // Force password change on first login
                profileInitials: profileInitials, // Store initials for placeholder
                profileLink: '', // Empty by default, can be set later
                createdAt: new Date().toISOString()
            });
            
            await logAction('Added user', form.name, `Email: ${form.email}, Role: ${form.role}, Status: ${form.status}`);
            setForm({ name: '', email: '', birthday: '', role: 'User', status: 'Active' });
            setAddSuccessMsg(`User added successfully with ID ${formattedId}.`);
            setAddErrorMsg('');
            // Keep form visible so user sees success message
        } catch (error) {
            console.error('Error adding user:', error);
            try {
                await signOut(secondaryAuth);
            } catch (signOutError) {
                console.warn('Unable to clear secondary auth session:', signOutError);
            }
            
            // Provide specific error messages based on error type
            let errorMessage = 'Failed to add user. ';
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'This email address is already registered. Please use a different email.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Invalid email address. Please check the email format and try again.';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'Password is too weak. Please ensure the birthday format is correct (YYYY-MM-DD).';
            } else if (error.code === 'auth/network-request-failed' || error.message?.includes('network') || error.message?.includes('Network')) {
                errorMessage = 'Network error. Please check your internet connection and try again.';
            } else if (error.code === 'unavailable' || error.message?.includes('unavailable')) {
                errorMessage = 'Service temporarily unavailable. Please try again in a few moments.';
            } else if (error.code === 'permission-denied' || error.message?.includes('permission')) {
                errorMessage = 'Permission denied. You do not have access to perform this action.';
            } else if (error.message?.includes('reserve')) {
                errorMessage = error.message;
            } else {
                errorMessage += error.message || 'An unexpected error occurred. Please try again.';
            }
            
            setAddErrorMsg(errorMessage);
            setAddSuccessMsg('');
        }
    }

    function startEdit(user) {
        if (!isAdmin) {
            setErrorMsg('Only administrators can edit users.');
            return;
        }
        setEditingUser(user);
        setEditForm({
            name: user.name,
            email: user.email,
            birthday: user.birthday || '',
            role: user.role,
            status: user.status,
            profileLink: user.profileLink || '',
            profileInitials: user.profileInitials || getInitials(user.name || ''),
        });
        setErrorMsg('');
        setSuccessMsg('');
    }

    function isAdult(birthdayStr) {
        if (!birthdayStr) return false;
        const today = new Date();
        const dob = new Date(birthdayStr);
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
        return age >= 18;
    }

    async function saveEdit() {
        if (!isAdmin) {
            setErrorMsg('Only administrators can edit users.');
            return;
        }

        if (!editForm.name || !editForm.email || !editForm.birthday) {
            setErrorMsg('Please fill in all required fields (Name, Email, Birthday).');
            return;
        }

        if (!isAdult(editForm.birthday)) {
            setErrorMsg('User must be at least 18 years old.');
            return;
        }

        // Check if role is being changed - only admin can change roles
        const roleChanged = editingUser.role !== editForm.role;
        if (roleChanged && !isAdmin) {
            setErrorMsg('Only administrators can change user roles.');
            return;
        }

        // Prevent suspending or demoting the last active admin
        const activeAdmins = users.filter(u => (u.role === 'Admin') && (u.status === 'Active')).map(u => u.id);
        const isEditingAdmin = editingUser.role === 'Admin';
        const isSuspending = editForm.status === 'Suspended' && editingUser.status !== 'Suspended';
        const isDemoting = editingUser.role === 'Admin' && editForm.role !== 'Admin';
        if (isEditingAdmin && (isSuspending || isDemoting)) {
            const otherAdmins = activeAdmins.filter(id => id !== editingUser.id);
            if (otherAdmins.length === 0) {
                setErrorMsg('Cannot remove or suspend the last administrator. Add another admin first.');
                return;
            }
        }

        const db = getDatabase(app);
        const userRef = ref(db, `users/${editingUser.id}`);

        const updateData = {
            name: editForm.name,
            email: editForm.email,
            birthday: editForm.birthday,
            status: editForm.status,
        };

        // Update profile initials if name changed
        const nameChanged = (editingUser.name || '') !== (editForm.name || '');
        if (nameChanged) {
            updateData.profileInitials = getInitials(editForm.name);
        }

        // If birthday changed, force password change on next login
        const birthdayChanged = (editingUser.birthday || '') !== (editForm.birthday || '');
        if (birthdayChanged) {
            updateData.passwordChanged = false;
            updateData.birthdayUpdatedAt = new Date().toISOString();
        }

        // If status changed, add timestamp to trigger logout on other devices
        const statusChanged = editingUser.status !== editForm.status;
        if (statusChanged) {
            updateData.statusChangedAt = new Date().toISOString();
        }

        // Only update role if admin
        if (isAdmin) {
            updateData.role = editForm.role;
        }

        try {
            await update(userRef, updateData);
            await logAction('Edited user', editForm.name, `Email: ${editForm.email}, Role: ${editForm.role || editingUser.role}, Status: ${editForm.status}`);
            setEditingUser(null);
            setEditForm({ name: '', email: '', birthday: '', role: 'User', status: 'Active' });
            setSuccessMsg('User updated successfully.' + (statusChanged ? ' User will be logged out on other devices if status changed.' : ''));
            setErrorMsg('');
        } catch (error) {
            console.error('Error updating user:', error);
            
            // Provide specific error messages based on error type
            let errorMessage = 'Failed to update user. ';
            if (error.code === 'permission-denied' || error.message?.includes('permission')) {
                errorMessage = 'Permission denied. You do not have access to update this user.';
            } else if (error.code === 'unavailable' || error.message?.includes('unavailable')) {
                errorMessage = 'Service temporarily unavailable. Please check your internet connection and try again.';
            } else if (error.code === 'network-request-failed' || error.message?.includes('network') || error.message?.includes('Network')) {
                errorMessage = 'Network error. Please check your internet connection and try again.';
            } else if (error.code === 'database/error' || error.message?.includes('database')) {
                errorMessage = 'Database error. Please try again or contact administrator if the problem persists.';
            } else {
                errorMessage += error.message || 'An unexpected error occurred. Please try again.';
            }
            
            setErrorMsg(errorMessage);
            setSuccessMsg('');
        }
    }

    function cancelEdit() {
        setEditingUser(null);
        setEditForm({ name: '', email: '', role: 'User', status: 'Active' });
        setErrorMsg('');
        setSuccessMsg('');
    }
    
    return (
        <div className="admin-page">
            <div className="mu-header">
                <h2>Manage Users</h2>
                {isAdmin && (
                    <button className="btn-primary" onClick={() => { setShowAddForm(!showAddForm); setAddErrorMsg(''); setAddSuccessMsg(''); }}>
                        {showAddForm ? 'Cancel' : '+ Add New User'}
                    </button>
                )}
            </div>
            <div className="toolbar">
                <input 
                    className="search" 
                    placeholder="Search by name, email, or role" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button className="btn-sm" onClick={() => setSearchQuery('')}>Clear</button>
            </div>


            {showAddForm && (
                <div className="mu-form">
                    <h3>Add New User</h3>
                    {addErrorMsg && (
                        <div className="alert alert-error">{addErrorMsg}</div>
                    )}
                    {addSuccessMsg && (
                        <div className="alert alert-success">{addSuccessMsg}</div>
                    )}
                    <div className="mu-grid">
                        <div className="mu-field">
                            <label>Name</label>
                            <input value={form.name} onChange={(e) => setForm(v => ({ ...v, name: e.target.value }))} placeholder="Full name" />
                        </div>
                        <div className="mu-field">
                            <label>Email</label>
                            <input value={form.email} onChange={(e) => setForm(v => ({ ...v, email: e.target.value }))} placeholder="email@example.com" />
                        </div>
                        <div className="mu-field">
                            <label>Birthday</label>
                            <input type="date" value={form.birthday} onChange={(e) => setForm(v => ({ ...v, birthday: e.target.value }))} max={new Date().toISOString().slice(0,10)} />
                            <small>Must be 18+; default password will be DOB as YYYY-MM-DD</small>
                        </div>
                        {isAdmin && (
                            <div className="mu-field">
                                <label>Role</label>
                                <select value={form.role} onChange={(e) => setForm(v => ({ ...v, role: e.target.value }))}>
                                    <option>User</option>
                                    <option>Admin</option>
                                </select>
                            </div>
                        )}
                        <div className="mu-field">
                            <label>Status</label>
                            <select value={form.status} onChange={(e) => setForm(v => ({ ...v, status: e.target.value }))}>
                                <option>Active</option>
                                <option>Suspended</option>
                            </select>
                        </div>
                    </div>
                    <button className="btn-primary" onClick={addUser}>Add User</button>
                </div>
            )}

            <div className="table-card">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.length > 0 ? (
                            filteredUsers.map(u => (
                                <tr key={u.id}>
                                    <td data-label="ID">{u.displayId || u.id}</td>
                                    <td data-label="Name">{u.name}</td>
                                    <td data-label="Email">{u.email}</td>
                                    <td data-label="Role">{u.role}</td>
                                    <td data-label="Status">{u.status}</td>
                                    <td data-label="Actions">
                                        <div className="row-actions">
                                            {isAdmin && (
                                                <button className="btn-sm" onClick={() => startEdit(u)}>Edit</button>
                                            )}
                                            {!isAdmin && (
                                                <span className="no-actions">No actions available</span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="6" className="empty-table-cell">
                                    {searchQuery ? 'No users found matching your search.' : 'No users found.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Edit User Modal */}
            {editingUser && (
                <div className="mf-modal" onClick={cancelEdit}>
                    <div className="mf-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="mf-modal-header">
                            <h3>Edit User</h3>
                            <button className="mf-close" onClick={cancelEdit}>×</button>
                        </div>
                        <div className="mf-modal-body">
                            {errorMsg && (
                                <div className="alert alert-error">{errorMsg}</div>
                            )}
                            {successMsg && (
                                <div className="alert alert-success">{successMsg}</div>
                            )}
                            
                            {/* Profile Picture Display (Non-editable) */}
                            <div className="mu-profile-section">
                                <div className="mu-profile-picture-container">
                                    {editForm.profileLink ? (
                                        <img
                                            src={editForm.profileLink}
                                            alt={editForm.name}
                                            className="mu-profile-picture"
                                            onError={(e) => {
                                                e.target.style.display = "none";
                                                e.target.nextSibling.style.display = "flex";
                                            }}
                                        />
                                    ) : null}
                                    <div
                                        className="mu-profile-placeholder"
                                        style={{ display: editForm.profileLink ? "none" : "flex" }}
                                    >
                                        {editForm.profileInitials || getInitials(editForm.name || '')}
                                    </div>
                                </div>
                                <p className="mu-profile-name">{editForm.name}</p>
                                <p className="mu-profile-note">Profile picture (not editable here)</p>
                            </div>

                            <div className="mu-grid">
                                <div className="mu-field">
                                    <label>Name *</label>
                                    <input 
                                        value={editForm.name} 
                                        onChange={(e) => setEditForm(v => ({ ...v, name: e.target.value }))} 
                                        placeholder="Full name" 
                                    />
                                </div>
                                <div className="mu-field">
                                    <label>Email *</label>
                                    <input 
                                        type="email"
                                        value={editForm.email} 
                                        onChange={(e) => setEditForm(v => ({ ...v, email: e.target.value }))} 
                                        placeholder="email@example.com" 
                                    />
                                </div>
                            <div className="mu-field">
                                <label>Birthday *</label>
                                <input 
                                    type="date"
                                    max={new Date().toISOString().slice(0,10)}
                                    value={editForm.birthday}
                                    onChange={(e) => setEditForm(v => ({ ...v, birthday: e.target.value }))}
                                />
                            </div>
                                {isAdmin && (
                                    <div className="mu-field">
                                        <label>Role</label>
                                        <select 
                                            value={editForm.role} 
                                            onChange={(e) => setEditForm(v => ({ ...v, role: e.target.value }))}
                                        >
                                            <option>User</option>
                                            <option>Admin</option>
                                        </select>
                                    </div>
                                )}
                                {!isAdmin && (
                                    <div className="mu-field">
                                        <label>Role</label>
                                        <input value={editForm.role} disabled />
                                    </div>
                                )}
                                <div className="mu-field">
                                    <label>Status</label>
                                    <select 
                                        value={editForm.status} 
                                        onChange={(e) => setEditForm(v => ({ ...v, status: e.target.value }))}
                                    >
                                        <option>Active</option>
                                        <option>Suspended</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="mf-modal-actions">
                            <button className="btn-secondary" onClick={cancelEdit}>Cancel</button>
                            <button className="btn-primary" onClick={saveEdit}>Save Changes</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}