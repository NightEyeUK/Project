import { useState } from "react";
import { NavLink } from "react-router";
import "./nav.css";
import logo from "../../../imgs/logo.png";

export default function Nav() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <nav className="user-nav">
            {/* Logo */}
            <div className="logo">
                <img src={logo} alt="Lost & Found logo" />
                <h2>FindZone</h2>
            </div>

            {/* Hamburger (mobile) */}
            <button 
                className="burger"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
                <i className={`fa-solid ${isMenuOpen ? "fa-xmark" : "fa-bars"}`}></i>
            </button>

            {/* Navigation links */}
            <div className={`links ${isMenuOpen ? "show" : ""}`}>
                <NavLink
                    to="/home"
                    className={({ isActive }) => (isActive ? "link active" : "link")}
                >
                    <i className="fa-solid fa-house"></i>Home
                </NavLink>
                <NavLink
                    to="/submit-lost-item"
                    className={({ isActive }) => (isActive ? "link active" : "link")}
                >
                    <i className="fa-solid fa-magnifying-glass"></i>Submit Lost Item
                </NavLink>
                <NavLink
                    to="/view-found-items"
                    className={({ isActive }) => (isActive ? "link active" : "link")}
                >
                    <i className="fa-solid fa-box"></i>View Found Items
                </NavLink>
                <NavLink
                    to="/admin"
                    className="link admin"
                >
                    <i className="fa-solid fa-user-shield"></i>Admin / Staff?
                </NavLink>
            </div>
        </nav>
    );
}
