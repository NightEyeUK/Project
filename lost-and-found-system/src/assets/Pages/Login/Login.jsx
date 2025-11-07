import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router";
import "./log-in.css";
import logo from "../../../imgs/logo.png";
import { app, auth } from "../../../firebase.js";
import { getDatabase, ref, get, set, update } from "firebase/database";
import { getAuth, signOut, signInWithEmailAndPassword } from "firebase/auth";
import { createUserWithEmailAndPassword } from "firebase/auth";
import ChangePassword from "../../Components/ChangePassoword/ChangePassword.jsx";

const DEFAULT_ADMIN_EMAIL = "admin@lostandfound.com";
const DEFAULT_ADMIN_PASSWORD = "Admin123";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [initializing, setInitializing] = useState(true);
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [userIdForPasswordChange, setUserIdForPasswordChange] = useState(null);
    const navigate = useNavigate();

    // Initialize default admin on component mount
    useEffect(() => {
        initializeDefaultAdmin();
    }, []);

    async function initializeDefaultAdmin() {
        const db = getDatabase(app);

        try {
            // Check if admin exists in database
            const usersRef = ref(db, 'users');
            const snapshot = await get(usersRef);
            let adminExists = false;
            let adminId = null;

            if (snapshot.exists()) {
                const users = snapshot.val();
                const adminEntry = Object.entries(users).find(
                    ([id, data]) => data.email === DEFAULT_ADMIN_EMAIL
                );
                if (adminEntry) {
                    adminExists = true;
                    adminId = adminEntry[0];
                }
            }

            if (!adminExists) {
                // Create admin in Auth
                try {
                    const userCredential = await createUserWithEmailAndPassword(
                        auth,
                        DEFAULT_ADMIN_EMAIL,
                        DEFAULT_ADMIN_PASSWORD
                    );

                    // Sign out immediately after creation
                    await signOut(auth);

                    // Create admin in database with passwordChanged: false for first-time login
                    const adminData = {
                        name: 'Administrator',
                        email: DEFAULT_ADMIN_EMAIL,
                        role: 'Admin',
                        status: 'Active',
                        passwordChanged: false,
                        createdAt: new Date().toISOString()
                    };
                    await set(ref(db, 'users/admin-001'), adminData);

                    console.log('Default admin created successfully - password change required on first login');
                } catch (authError) {
                    if (authError.code === 'auth/email-already-in-use') {
                        // Admin exists in Auth but not DB - treat as existing account
                        // Don't force password change since we don't know if they've already changed it
                        const adminData = {
                            name: 'Administrator',
                            email: DEFAULT_ADMIN_EMAIL,
                            role: 'Admin',
                            status: 'Active',
                            passwordChanged: true // Assume password was already changed
                        };
                        await set(ref(db, 'users/admin-001'), adminData);
                        console.log('Existing admin account synced to database');
                    } else {
                        throw authError;
                    }
                }
            } else if (adminId) {
                // Ensure admin has all required fields
                const adminSnapshot = await get(ref(db, `users/${adminId}`));
                if (adminSnapshot.exists()) {
                    const adminData = adminSnapshot.val();
                    const updates = {};

                    // Only set to false if it's undefined - don't override existing value
                    if (adminData.passwordChanged === undefined) {
                        updates.passwordChanged = false;
                    }
                    if (!adminData.role) updates.role = 'Admin';
                    if (!adminData.status) updates.status = 'Active';

                    if (Object.keys(updates).length > 0) {
                        await update(ref(db, `users/${adminId}`), updates);
                        console.log('Admin data updated with missing fields');
                    }
                }
            }
        } catch (error) {
            console.error('Error initializing admin:', error);
            setError('System initialization failed. Please refresh the page.');
        } finally {
            setInitializing(false);
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            // First, check user status BEFORE attempting Firebase Auth login
            const db = getDatabase(app);
            const usersRef = ref(db, 'users');
            const snapshot = await get(usersRef);

            if (!snapshot.exists()) {
                setError('User database not found');
                setLoading(false);
                return;
            }

            const users = snapshot.val();
            const userEntry = Object.entries(users).find(
                ([id, data]) => data.email === email
            );

            if (!userEntry) {
                setError('No account found with this email');
                setLoading(false);
                return;
            }

            const [userId, userData] = userEntry;

            console.log('User data found:', {
                userId,
                email: userData.email,
                passwordChanged: userData.passwordChanged
            });

            // Check if account is active BEFORE logging in
            if (userData.status !== 'Active') {
                const statusMessage = userData.status === 'Suspended'
                    ? "Your account has been suspended. Please contact administrator."
                    : "Your account is not active. Please contact administrator.";
                setError(statusMessage);
                setLoading(false);
                return;
            }

            // Now attempt Firebase Auth login
            await signInWithEmailAndPassword(auth, email, password);

            console.log('Login successful, checking password status...');

            // Check if password change is required
            const passwordChanged = userData.passwordChanged === true;

            // Also detect if user is still using default password derived from birthday
            let isUsingDefaultPassword = false;
            if (userData.birthday) {
                const dob = (userData.birthday || '').trim(); // expected YYYY-MM-DD
                const [y, m, d] = dob.split('-');
                if (y && m && d) {
                    const defaultPwdCompact = `${y}${m}${d}`; // YYYYMMDD
                    const defaultPwdDashed = `${y}-${m}-${d}`; // YYYY-MM-DD
                    if (password === defaultPwdCompact || password === defaultPwdDashed) {
                        isUsingDefaultPassword = true;
                    }
                }
            }

            console.log('Password changed status:', passwordChanged);

            if (!passwordChanged || isUsingDefaultPassword) {
                console.log('Password change required - showing modal');
                setUserIdForPasswordChange(userId);
                setShowChangePassword(true);
                setLoading(false);
                return;
            }

            // Successful login with password already changed
            console.log('Login complete - navigating to dashboard');
            navigate('/admin/dashboard');
        } catch (error) {
            console.error("Login error:", error);

            // Make sure user is signed out on error
            try {
                await signOut(auth);
            } catch (signOutError) {
                console.error("Sign out error:", signOutError);
            }

            // Provide user-friendly error messages
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
                setError('Invalid email or password');
            } else if (error.code === 'auth/user-not-found') {
                setError('No account found with this email');
            } else if (error.code === 'auth/too-many-requests') {
                setError('Too many failed attempts. Please try again later');
            } else {
                setError(error.message || 'Login failed. Please try again');
            }
            setLoading(false);
        }
    }

    function handlePasswordChangeSuccess() {
        console.log('Password changed successfully');
        setShowChangePassword(false);
        setUserIdForPasswordChange(null);
        navigate('/admin/dashboard');
    }

    function handlePasswordChangeCancel() {
        // Sign out user if they cancel password change
        signOut(auth);
        setShowChangePassword(false);
        setUserIdForPasswordChange(null);
        setError('Password change is required to continue');
    }

   

    return (
        <div className="login-container">
            <div className="login">
                <div className="banner">
                    <img id="logo" src={logo} alt="" />
                    <h1>Log In</h1>
                </div>

                <form onSubmit={handleSubmit}>
                    {error && <div className="error-message">{error}</div>}

                    <label htmlFor="email">Email</label>
                    <input
                        id="email"
                        type="email"
                        className="loginInput"
                        placeholder="Enter your email..."
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                    />

                    <label htmlFor="password">Password</label>
                    <input
                        id="password"
                        type="password"
                        className="loginInput"
                        placeholder="Enter your password..."
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading}
                    />

                    <NavLink to="/forgot-password">Forgot Password?</NavLink>

                    <button
                        className="loginButton"
                        type="submit"
                        disabled={loading}
                    >
                        {loading ? 'Logging in...' : 'Log In'}
                    </button>
                </form>
            </div>

            {showChangePassword && (
                <ChangePassword
                    user={auth.currentUser}
                    userId={userIdForPasswordChange}
                    onSuccess={handlePasswordChangeSuccess}
                    onCancel={handlePasswordChangeCancel}
                    isDefaultAdmin={email === DEFAULT_ADMIN_EMAIL} 
                    isRequired={true}
                />
            )}
        </div>
    );
}