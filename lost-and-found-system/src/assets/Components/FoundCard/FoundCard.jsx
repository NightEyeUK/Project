import "./found-card.css";
import { NavLink } from "react-router";

export default function FoundCard({ item, onSelect }) {
  return (
    <NavLink
      to="#"
      className="found-card-link"
      onClick={(e) => {
        e.preventDefault();
        onSelect(item);
      }}
    >
      <div className="found-card">
        <img
          src={item.image || "/placeholder.jpg"}
          alt={item.name}
          className="found-card-image"
        />
        <div className="found-card-info">
          <h3>{item.name}</h3>
          <p>{item.description}</p>
        </div>
      </div>
    </NavLink>
  );
}
