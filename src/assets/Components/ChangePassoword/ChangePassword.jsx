import { useState } from "react";
import {app,auth}  from "../../../firebase.js";
import { getAuth, updatePassword, reauthenticateWithCredential, EmailAuthProvider, signOut } from "firebase/auth";
import { getDatabase, ref, update } from "firebase/database";
import "./change-password.css"; 

export default function ChangePassword({ user, userId, onSuccess, onCancel, isDefaultAdmin, isRequired }) {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleChangePassword(e) {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (newPassword !== confirmPassword) {
            setError("New password and confirmation do not match.");
            return;
        }

        if (newPassword.length < 6) {
            setError("Password should be at least 6 characters long.");
            return;
        }

        if (currentPassword === newPassword) {
            setError("New password must be different from current password.");
            return;
        }

        setLoading(true);
        const auth = getAuth(app);
        const db = getDatabase(app);

        try {
            // Reauthenticate user before updating password
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);

            // Update password in Firebase Auth
            await updatePassword(user, newPassword);

            // Update flag in Realtime Database using the actual userId
            if (userId) {
                const userRef = ref(db, `users/${userId}`);
                await update(userRef, { 
                    passwordChanged: true,
                    lastPasswordChange: new Date().toISOString()
                });
            }

            setSuccess("Password changed successfully!");
            setLoading(false);

            if (onSuccess) {
                setTimeout(() => {
                    onSuccess();
                }, 1500);
            }
        } catch (error) {
            console.error("Password change error:", error);
            if (error.code === "auth/requires-recent-login") {
                setError("Session expired. Please log in again.");
            } else if (error.code === "auth/wrong-password") {
                setError("Current password is incorrect.");
            } else if (error.code === "auth/weak-password") {
                setError("Password is too weak. Please choose a stronger password.");
            } else {
                setError(error.message || "Failed to change password. Please try again.");
            }
            setLoading(false);
        }
    }

    function handleCancel() {
        if (isRequired) {
            // If password change is required, sign out the user
            if (onCancel) {
                onCancel();
            }
        } else {
            // Otherwise just close the modal
            if (onCancel) {
                onCancel();
            }
        }
    }

    return (
        <div className="change-password-overlay">
            <div className="change-password-modal">
                <div className="change-password-header">
                    <h2>Change Password</h2>
                    {!isRequired && onCancel && (
                        <button className="close-button" onClick={handleCancel}>×</button>
                    )}
                </div>
                
                {isDefaultAdmin && (
                    <div className="security-notice">
                        <p>You must change your default password before continuing.</p>
                    </div>
                )}

                {isRequired && !isDefaultAdmin && (
                    <div className="security-notice">
                        <p>You must change your password on first login for security reasons.</p>
                    </div>
                )}

                <form className="change-password-form" onSubmit={handleChangePassword}>
                    {error && <div className="error-message">{error}</div>}
                    {success && <div className="success-message">{success}</div>}

                    <div className="form-group">
                        <label htmlFor="current-password">Current Password</label>
                        <input
                            id="current-password"
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Enter current password"
                            required
                            disabled={loading || success}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="new-password">New Password</label>
                        <input
                            id="new-password"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter new password (min. 6 characters)"
                            required
                            disabled={loading || success}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirm-password">Confirm New Password</label>
                        <input
                            id="confirm-password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm new password"
                            required
                            disabled={loading || success}
                        />
                    </div>

                    <div className="form-actions">
                        {!isRequired && onCancel && (
                            <button
                                type="button"
                                onClick={handleCancel}
                                disabled={loading || success}
                                className="btn-secondary"
                            >
                                Cancel
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={loading || success}
                            className="btn-primary"
                        >
                            {loading ? "Updating..." : success ? "Success!" : "Update Password"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}