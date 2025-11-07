import { NavLink } from "react-router";
import "./nav.css";
import logo from "../../../imgs/logo.png";


export default function Nav() {
    return (
        <>
            
            <nav>
                <div className="logo">
                    <img src={logo} alt="Lost & Found logo" />
                    <h2>FindZone</h2>
                </div>
                <div className="option">
                    <NavLink to="/home">HOME</NavLink>
                    <NavLink to="/submit-lost-item">SUBMIT LOST ITEM</NavLink>
                    <NavLink to="/view-found-items">VIEW FOUND ITEMS</NavLink>
                </div>
                <div className="adminAcc">
                <NavLink to="/admin">Admin/Staff?</NavLink>
            </div>
            </nav>
        </>
    )
}