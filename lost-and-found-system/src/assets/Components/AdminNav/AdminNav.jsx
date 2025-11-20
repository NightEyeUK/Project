import { useState, useEffect, useRef } from "react";
import { NavLink, useNavigate } from "react-router";
import "./admin-nav.css";
import logo from "../../../imgs/logo.png";
import { app, auth } from "../../../firebase.js";
import { getDatabase, ref, get } from "firebase/database";
import { onAuthStateChanged, signOut } from "firebase/auth";
import ChangePassword from "../ChangePassoword/ChangePassword.jsx";
import EditProfile from "../EditProfile/EditProfile.jsx";

function AdminNav() {
	const navigate = useNavigate();
	const [currentUser, setCurrentUser] = useState(null);
	const [userData, setUserData] = useState(null);
	const [showDropdown, setShowDropdown] = useState(false);
	const [showChangePassword, setShowChangePassword] = useState(false);
	const [showEditProfile, setShowEditProfile] = useState(false);
	const dropdownRef = useRef(null);
	const [isMenuOpen, setIsMenuOpen] = useState(false);

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
						const userEntry = Object.entries(users).find(([id, data]) => 
							data.email && user.email && data.email.toLowerCase() === user.email.toLowerCase()
						);
						if (userEntry) {
							setUserData({ id: userEntry[0], ...userEntry[1] });
						} else {
							console.warn('User data not found in database for email:', user.email);
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

	const handleEditProfile = async () => {
		setShowDropdown(false);
		
		// Ensure userData is loaded before showing edit profile
		if (!userData && currentUser) {
			const db = getDatabase(app);
			const usersRef = ref(db, 'users');
				try {
					const snapshot = await get(usersRef);
					if (snapshot.exists()) {
						const users = snapshot.val();
						const userEntry = Object.entries(users).find(([id, data]) => 
							data.email && currentUser.email && data.email.toLowerCase() === currentUser.email.toLowerCase()
						);
						if (userEntry) {
							setUserData({ id: userEntry[0], ...userEntry[1] });
							setShowEditProfile(true);
						} else {
							alert("User data not found. Please contact administrator.");
						}
					} else {
						alert("User database not found. Please contact administrator.");
					}
				} catch (error) {
					console.error('Error fetching user data:', error);
					alert("Failed to load user data. Please try again.");
				}
		} else if (userData) {
			setShowEditProfile(true);
		} else {
			alert("Unable to load profile. Please try logging out and back in.");
		}
	};

	const handleProfileUpdateSuccess = async () => {
		setShowEditProfile(false);
		// Refresh user data
		if (currentUser) {
			const db = getDatabase(app);
			const usersRef = ref(db, 'users');
			try {
				const snapshot = await get(usersRef);
				if (snapshot.exists()) {
					const users = snapshot.val();
					const userEntry = Object.entries(users).find(([id, data]) => 
						data.email && currentUser.email && data.email.toLowerCase() === currentUser.email.toLowerCase()
					);
					if (userEntry) {
						setUserData({ id: userEntry[0], ...userEntry[1] });
					}
				}
			} catch (error) {
				console.error('Error refreshing user data:', error);
			}
		}
		alert("Profile updated successfully!");
	};

	const handleProfileUpdateCancel = () => {
		setShowEditProfile(false);
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

				{/* Hamburger button for small screens */}
				<button
					className="burger"
					onClick={() => setIsMenuOpen(!isMenuOpen)}
				>
					<i className={`fa-solid ${isMenuOpen ? "fa-xmark" : "fa-bars"}`}></i>
				</button>

				{/* Navigation links */}
				<div className={`links ${isMenuOpen ? "show" : ""}`}>
					<NavLink to="/admin/dashboard" className={({ isActive }) => (isActive ? "link active" : "link")}>
						<i className="fa-solid fa-table-columns"></i>Dashboard
					</NavLink>
					<NavLink to="/admin/manage-found" className={({ isActive }) => (isActive ? "link active" : "link")}>
						<i className="fa-solid fa-box"></i>Manage Found
					</NavLink>
					<NavLink to="/admin/manage-lost" className={({ isActive }) => (isActive ? "link active" : "link")}>
						<i className="fa-solid fa-box"></i>Manage Lost
					</NavLink>
					<NavLink to="/admin/claim-history" className={({ isActive }) => (isActive ? "link active" : "link")}>
						<i className="fa-solid fa-history"></i>Claim History
					</NavLink>
					<NavLink to="/admin/manage-users" className={({ isActive }) => (isActive ? "link active" : "link")}>
						<i className="fa-solid fa-users"></i>Manage Users
					</NavLink>
					<NavLink to="/admin/reports" className={({ isActive }) => (isActive ? "link active" : "link")}>
						<i className="fa-solid fa-chart-line"></i>Reports
					</NavLink>
				</div>

				{/* Account dropdown stays the same */}
				<div className="account-dropdown" ref={dropdownRef}>
					<button className="account-button link" onClick={() => setShowDropdown(!showDropdown)}>
						<i className="fa-solid fa-user-circle"></i>
						<span>{displayName}</span>
						<i className={`fa-solid fa-chevron-${showDropdown ? 'up' : 'down'}`}></i>
					</button>
					{showDropdown && (
						<div className="dropdown-menu">
							<button className="dropdown-item" onClick={handleChangePassword}>
								<i className="fa-solid fa-key"></i>Change Password
							</button>
							
							<div className="dropdown-divider"></div>
							<button className="dropdown-item editProfile" onClick={handleEditProfile}>
								<i className="fa-solid fa-user"></i> Edit Profile
							</button>
							<div className="dropdown-divider"></div>
							<button className="dropdown-item logout" onClick={handleLogout}>
								<i className="fa-solid fa-right-from-bracket"></i>Log Out
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

			{showEditProfile && currentUser && userData && userData.id && (
				<EditProfile
					user={currentUser}
					userId={userData.id}
					userData={userData}
					onSuccess={handleProfileUpdateSuccess}
					onCancel={handleProfileUpdateCancel}
				/>
			)}
		</>
	);
}

export default AdminNav;