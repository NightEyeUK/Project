import { useState } from "react";
import { NavLink, useNavigate } from "react-router";
import "./reset-password.css";
import logo from "../../../imgs/logo.png";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import { getDatabase, ref, get } from "firebase/database";
import { app } from "../../../firebase.js";

export default function ResetPassword() {
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    async function handleResetPassword(e) {
        e.preventDefault();
        setError("");
        setSuccess("");
        setLoading(true);

        try {
            // First, check if user exists in database
            const db = getDatabase(app);
            const usersRef = ref(db, 'users');
            const snapshot = await get(usersRef);

            if (!snapshot.exists()) {
                setError("User database not found.");
                setLoading(false);
                return;
            }

            const users = snapshot.val();
            const userEntry = Object.entries(users).find(
                ([id, data]) => data.email === email
            );

            if (!userEntry) {
                setError("No account found with this email address.");
                setLoading(false);
                return;
            }

            const [userId, userData] = userEntry;

            // Check if account is active
            if (userData.status !== 'Active') {
                const statusMessage = userData.status === 'Suspended'
                    ? "Your account has been suspended. Please contact administrator."
                    : "Your account is not active. Please contact administrator.";
                setError(statusMessage);
                setLoading(false);
                return;
            }

            // Send password reset email
            const auth = getAuth(app);
            await sendPasswordResetEmail(auth, email);
            setSuccess("Password reset email sent! Please check your inbox.");
            setEmail("");
        } catch (error) {
            console.error("Password reset error:", error);
            if (error.code === "auth/user-not-found") {
                setError("No account found with this email address.");
            } else if (error.code === "auth/invalid-email") {
                setError("Invalid email address.");
            } else {
                setError(error.message || "Failed to send reset email. Please try again.");
            }
        }
        setLoading(false);
    }

    return (
        <div className="reset-password-container">
            <div className="reset-password">
                <div className="banner">
                    <img id="logo" src={logo} alt="" />
                    <h1>Reset Password</h1>
                </div>

                <p className="reset-instructions">
                    Enter your email address and we'll send you a link to reset your password.
                </p>

                <form onSubmit={handleResetPassword}>
                    {error && <div className="error-message">{error}</div>}
                    {success && <div className="success-message">{success}</div>}

                    <label htmlFor="reset-email">Email</label>
                    <input
                        id="reset-email"
                        type="email"
                        className="resetInput"
                        placeholder="Enter your email..."
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading || !!success}
                    />
                    
                    <button
                        className="resetButton"
                        type="submit"
                        disabled={loading || !!success}
                    >
                        {loading ? 'Sending...' : 'Send Reset Link'}
                    </button>
                </form>

                <div className="reset-footer">
                    <NavLink to="/admin">Back to Login</NavLink>
                </div>
            </div>
        </div>
    );
}