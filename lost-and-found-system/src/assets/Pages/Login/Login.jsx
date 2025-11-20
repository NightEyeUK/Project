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
    const [userForPasswordChange, setUserForPasswordChange] = useState(null);
    const [isPasswordChangeRequired, setIsPasswordChangeRequired] = useState(false);
    const [isDefaultAdminUser, setIsDefaultAdminUser] = useState(false);
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false); // 👈 for toggle


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
                    const adminInitials = 'AD'; // Administrator initials
                    const adminData = {
                        name: 'Administrator',
                        email: DEFAULT_ADMIN_EMAIL,
                        role: 'Admin',
                        status: 'Active',
                        passwordChanged: false,
                        profileInitials: adminInitials,
                        profileLink: '',
                        createdAt: new Date().toISOString()
                    };
                    await set(ref(db, 'users/admin-001'), adminData);

                    console.log('Default admin created successfully - password change required on first login');
                } catch (authError) {
                    if (authError.code === 'auth/email-already-in-use') {
                        // Admin exists in Auth but not DB - treat as existing account
                        // Don't force password change since we don't know if they've already changed it
                        const adminInitials = 'AD'; // Administrator initials
                        const adminData = {
                            name: 'Administrator',
                            email: DEFAULT_ADMIN_EMAIL,
                            role: 'Admin',
                            status: 'Active',
                            passwordChanged: true, // Assume password was already changed
                            profileInitials: adminInitials,
                            profileLink: ''
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
            let initErrorMessage = 'System initialization failed. ';
            if (error.code === 'auth/network-request-failed') {
                initErrorMessage += 'Network error. Please check your internet connection and refresh the page.';
            } else if (error.message && error.message.includes('network')) {
                initErrorMessage += 'Network error. Please check your internet connection and refresh the page.';
            } else {
                initErrorMessage += 'Please refresh the page or contact administrator if the problem persists.';
            }
            setError(initErrorMessage);
        } finally {
            setInitializing(false);
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        
        // Validate input fields
        if (!email.trim()) {
            setError('Please enter your email address.');
            return;
        }
        
        if (!password.trim()) {
            setError('Please enter your password.');
            return;
        }
        
        // Basic email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            setError('Please enter a valid email address.');
            return;
        }
        
        setLoading(true);

        try {
            // First, check user status BEFORE attempting Firebase Auth login
            const db = getDatabase(app);
            const usersRef = ref(db, 'users');
            let snapshot;
            
            try {
                snapshot = await get(usersRef);
            } catch (dbError) {
                console.error('Database read error:', dbError);
                if (dbError.code === 'unavailable' || dbError.message?.includes('network') || dbError.message?.includes('Network')) {
                    setError('Unable to connect to the server. Please check your internet connection and try again.');
                } else {
                    setError('Database connection error. Please try again or contact administrator if the problem persists.');
                }
                setLoading(false);
                return;
            }

            if (!snapshot.exists()) {
                setError('User database not found. Please contact administrator.');
                setLoading(false);
                return;
            }

            const users = snapshot.val();
            const userEntry = Object.entries(users).find(
                ([id, data]) => data.email === email
            );

            if (!userEntry) {
                setError('No account found with this email address. Please check your email and try again.');
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
                setUserForPasswordChange(auth.currentUser);
                setIsPasswordChangeRequired(true);
                setIsDefaultAdminUser(userData.email === DEFAULT_ADMIN_EMAIL);
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

            // Provide clear, user-friendly error messages for all possible errors
            let errorMessage = 'Login failed. Please try again.';
            
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
                errorMessage = 'Invalid email or password. Please check your credentials and try again.';
            } else if (error.code === 'auth/user-not-found') {
                errorMessage = 'No account found with this email address. Please check your email and try again.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Invalid email format. Please enter a valid email address.';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = 'Too many failed login attempts. Please wait a few minutes and try again.';
            } else if (error.code === 'auth/network-request-failed') {
                errorMessage = 'Network error. Please check your internet connection and try again.';
            } else if (error.code === 'auth/user-disabled') {
                errorMessage = 'This account has been disabled. Please contact administrator.';
            } else if (error.code === 'auth/operation-not-allowed') {
                errorMessage = 'Login operation is not allowed. Please contact administrator.';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'Password is too weak. Please use a stronger password.';
            } else if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'This email is already registered. Please use a different email.';
            } else if (error.message) {
                // Use the error message if available, but make it more user-friendly
                if (error.message.includes('network') || error.message.includes('Network')) {
                    errorMessage = 'Network error. Please check your internet connection and try again.';
                } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
                    errorMessage = 'Request timed out. Please check your internet connection and try again.';
                } else {
                    errorMessage = error.message;
                }
            } else {
                errorMessage = 'An unexpected error occurred. Please try again or contact support if the problem persists.';
            }
            
            setError(errorMessage);
            setLoading(false);
        }
    }

    function handlePasswordChangeSuccess() {
        console.log('Password changed successfully');
        setShowChangePassword(false);
        setUserIdForPasswordChange(null);
        setUserForPasswordChange(null);
        setIsPasswordChangeRequired(false);
        setIsDefaultAdminUser(false);
        navigate('/admin/dashboard');
    }

    function handlePasswordChangeCancel() {
        // Sign out user if they cancel password change
        signOut(auth);
        setShowChangePassword(false);
        setUserIdForPasswordChange(null);
        setUserForPasswordChange(null);
        setIsPasswordChangeRequired(false);
        setIsDefaultAdminUser(false);
        setError('Password change is required for security. Please log in again and change your password to continue.');
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
                        
                        disabled={loading}
                    />

                    <label htmlFor="password">Password</label>
                    <div className="password-field">
                        <input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            className="loginInput"
                            placeholder="Enter your password..."
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            
                            disabled={loading}
                        />
                        <button
                            type="button"
                            className="showPasswordBtn"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label="Toggle password visibility"
                        >
                            <i
                                className={`fa-solid ${showPassword ? "fa-eye-slash" : "fa-eye"
                                    }`}
                            ></i>
                        </button>
                    </div>

                    <NavLink to="/forgot-password">Forgot Password?</NavLink>

                    <button
                        className="loginButton"
                        type="submit"
                        disabled={loading}
                    >
                        {loading ? "Logging in..." : "Log In"}
                    </button>
                </form>
            </div>

            {showChangePassword && userForPasswordChange && (
                <ChangePassword
                    user={userForPasswordChange}
                    userId={userIdForPasswordChange}
                    onSuccess={handlePasswordChangeSuccess}
                    onCancel={handlePasswordChangeCancel}
                    isDefaultAdmin={isDefaultAdminUser}
                    isRequired={isPasswordChangeRequired}
                />
            )}
        </div>
    );
}