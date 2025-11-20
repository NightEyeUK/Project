import { useState, useEffect } from "react";
import { app, auth } from "../../../firebase.js";
import { getDatabase, ref, update } from "firebase/database";
import { updateEmail } from "firebase/auth";
import "./edit-profile.css";

// Helper function to get initials from name
function getInitials(name) {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

// Helper function to generate profile placeholder
function getProfilePlaceholder(name) {
    const initials = getInitials(name);
    return initials;
}

export default function EditProfile({ user, userId, userData, onSuccess, onCancel }) {
    const [email, setEmail] = useState(userData?.email || "");
    const [profileLink, setProfileLink] = useState(userData?.profileLink || "");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);
    const [profileInitials, setProfileInitials] = useState("");

    useEffect(() => {
        if (userData?.name) {
            setProfileInitials(getProfilePlaceholder(userData.name));
        }
    }, [userData]);

    async function handleSave(e) {
        e.preventDefault();
        setError("");
        setSuccess("");

        // Validate email
        if (!email.trim()) {
            setError("Email is required.");
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            setError("Please enter a valid email address.");
            return;
        }

        // Validate profile link if provided
        if (profileLink.trim() && !isValidUrl(profileLink.trim())) {
            setError("Please enter a valid URL for profile picture.");
            return;
        }

        setLoading(true);
        const db = getDatabase(app);

        try {
            if (!userId) {
                setError("User ID not found. Please try again.");
                setLoading(false);
                return;
            }

            const trimmedEmail = email.trim();

            if (user && trimmedEmail !== user.email) {
                try {
                    await updateEmail(user, trimmedEmail);
                } catch (emailError) {
                    console.error("Auth email update error:", emailError);
                    if (emailError.code === "auth/email-already-in-use") {
                        setError("This email is already in use. Please use a different email address.");
                    } else if (emailError.code === "auth/requires-recent-login") {
                        setError("For security reasons, please log out and log back in before changing your email.");
                    } else if (emailError.code === "auth/invalid-email") {
                        setError("Invalid email format. Please enter a valid email address.");
                    } else {
                        setError(emailError.message || "Failed to update email. Please try again.");
                    }
                    setLoading(false);
                    return;
                }
            }

            const userRef = ref(db, `users/${userId}`);
            const updateData = {
                email: trimmedEmail,
            };

            if (profileLink.trim()) {
                updateData.profileLink = profileLink.trim();
            } else {
                // If profile link is empty, remove it
                updateData.profileLink = "";
            }

            await update(userRef, updateData);

            setSuccess("Profile updated successfully!");
            setLoading(false);

            if (onSuccess) {
                setTimeout(() => {
                    onSuccess();
                }, 1500);
            }
        } catch (error) {
            console.error("Profile update error:", error);
            if (error.code === "permission-denied") {
                setError("You don't have permission to update this profile.");
            } else if (error.message?.includes("network") || error.message?.includes("Network")) {
                setError("Network error. Please check your internet connection and try again.");
            } else {
                setError(error.message || "Failed to update profile. Please try again.");
            }
            setLoading(false);
        }
    }

    function isValidUrl(string) {
        try {
            const url = new URL(string);
            return url.protocol === "http:" || url.protocol === "https:";
        } catch (_) {
            return false;
        }
    }

    function handleCancel() {
        if (onCancel) {
            onCancel();
        }
    }

    const displayName = userData?.name || "User";
    const profileUrl = profileLink.trim() || null;
    const initials = profileInitials || getInitials(displayName);

    return (
        <div className="edit-profile-overlay">
            <div className="edit-profile-modal">
                <div className="edit-profile-header">
                    <h2>Edit Profile</h2>
                    <button className="close-button" onClick={handleCancel}>×</button>
                </div>

                <form className="edit-profile-form" onSubmit={handleSave}>
                    {error && <div className="error-message">{error}</div>}
                    {success && <div className="success-message">{success}</div>}

                    {/* Profile Picture Display */}
                    <div className="profile-picture-section">
                        <div className="profile-picture-container">
                            {profileUrl ? (
                                <img
                                    src={profileUrl}
                                    alt={displayName}
                                    className="profile-picture"
                                    onError={(e) => {
                                        e.target.style.display = "none";
                                        e.target.nextSibling.style.display = "flex";
                                    }}
                                />
                            ) : null}
                            <div
                                className="profile-placeholder"
                                style={{ display: profileUrl ? "none" : "flex" }}
                            >
                                {initials}
                            </div>
                        </div>
                        <p className="profile-name">{displayName}</p>
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">Email *</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email"
                            required
                            disabled={loading || success}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="profile-link">Profile Picture URL</label>
                        <input
                            id="profile-link"
                            type="url"
                            value={profileLink}
                            onChange={(e) => setProfileLink(e.target.value)}
                            placeholder="https://example.com/profile.jpg"
                            disabled={loading || success}
                        />
                        <small className="form-hint">Leave empty to use initials placeholder</small>
                    </div>

                    <div className="form-actions">
                        <button
                            type="button"
                            onClick={handleCancel}
                            disabled={loading || success}
                            className="btn-secondary"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || success}
                            className="btn-primary"
                        >
                            {loading ? "Updating..." : success ? "Success!" : "Save Changes"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

