import { useState, useEffect, useRef } from "react";
import { NavLink, useNavigate } from "react-router";
import "./admin-nav.css";
import logo from "../../../../imgs/logo.png";
import { app, auth } from "../../../../firebase.js";
import { getDatabase, ref, get } from "firebase/database";
import { onAuthStateChanged, signOut } from "firebase/auth";
import ChangePassword from "../../../Components/ChangePassoword/ChangePassword.jsx";

function AdminNav() {
	const navigate = useNavigate();
	const [currentUser, setCurrentUser] = useState(null);
	const [userData, setUserData] = useState(null);
	const [showDropdown, setShowDropdown] = useState(false);
	const [showChangePassword, setShowChangePassword] = useState(false);
	const dropdownRef = useRef(null);

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, async (user) => {
			setCurrentUser(user);
			if (user) {
				// Get user data from database
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

	// Close dropdown when clicking outside
	useEffect(() => {
		function handleClickOutside(event) {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
				setShowDropdown(false);
			}
		}

		if (showDropdown) {
			document.addEventListener("mousedown", handleClickOutside);
		}

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [showDropdown]);

	const handleLogout = async () => {
		try {
			await signOut(auth);
			navigate("/admin");
		} catch (error) {
			console.error("Logout failed:", error);
		}
	};

	const handleChangePassword = () => {
		setShowDropdown(false);
		setShowChangePassword(true);
	};

	const handlePasswordChangeSuccess = () => {
		setShowChangePassword(false);
		alert("Password changed successfully!");
	};

	const handlePasswordChangeCancel = () => {
		setShowChangePassword(false);
	};

	// Get user's display name (fallback to email if name not available)
	const displayName = userData?.name || currentUser?.email?.split('@')[0] || "User";

	return (
		<>
			<nav className="admin-nav">
				<div className="logo">
					<img src={logo} alt="Lost & Found logo" />
					<h2>FindZone</h2>
				</div>

				<div className="links">
					<NavLink
						to="/admin/dashboard"
						className={({ isActive }) => (isActive ? "link active" : "link")}
					>
						<i className="fa-solid fa-table-columns"></i>Dashboard
					</NavLink>
					<NavLink
						to="/admin/manage-found"
						className={({ isActive }) => (isActive ? "link active" : "link")}
					>
						<i className="fa-solid fa-box"></i>Manage Found
					</NavLink>
					<NavLink
						to="/admin/manage-lost"
						className={({ isActive }) => (isActive ? "link active" : "link")}
					>
						<i className="fa-solid fa-box"></i>Manage Lost
					</NavLink>
					<NavLink
						to="/admin/claim-history"
						className={({ isActive }) => (isActive ? "link active" : "link")}
					>
						<i className="fa-solid fa-history"></i>Claim History
					</NavLink>
					<NavLink
						to="/admin/manage-users"
						className={({ isActive }) => (isActive ? "link active" : "link")}
					>
						<i className="fa-solid fa-users"></i>Manage Users
					</NavLink>
					<NavLink
						to="/admin/reports"
						className={({ isActive }) => (isActive ? "link active" : "link")}
					>
						<i className="fa-solid fa-chart-line"></i>Reports
					</NavLink>
				</div>

				<div className="account-dropdown" ref={dropdownRef}>
					<button 
						className="account-button link" 
						onClick={() => setShowDropdown(!showDropdown)}
					>
						<i className="fa-solid fa-user-circle"></i>
						<span>{displayName}</span>
						<i className={`fa-solid fa-chevron-${showDropdown ? 'up' : 'down'}`}></i>
					</button>

					{showDropdown && (
						<div className="dropdown-menu">
							<button 
								className="dropdown-item" 
								onClick={handleChangePassword}
							>
								<i className="fa-solid fa-key"></i>
								Change Password
							</button>
							<div className="dropdown-divider"></div>
							<button 
								className="dropdown-item logout" 
								onClick={handleLogout}
							>
								<i className="fa-solid fa-right-from-bracket"></i>
								Log Out
							</button>
						</div>
					)}
				</div>
			</nav>

			{showChangePassword && currentUser && (
				<ChangePassword
					user={currentUser}
					userId={userData?.id}
					onSuccess={handlePasswordChangeSuccess}
					onCancel={handlePasswordChangeCancel}
					isDefaultAdmin={false}
					isRequired={false}
				/>
			)}
		</>
	);
}

export default AdminNav;