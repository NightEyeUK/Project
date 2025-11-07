// ViewFoundItem.jsx
import { useState, useEffect, useMemo } from "react";
import "./view-found-item.css";
import FoundCard from "../../Components/FoundCard/FoundCard";
import {app,auth}  from "../../../firebase.js";
import { getDatabase, ref, onValue } from "firebase/database";

export default function ViewFoundItem() {
  const [selectedItem, setSelectedItem] = useState(null);
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  const defaultImage =
    "https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg";

  // Load items from Firebase
  useEffect(() => {
    const db = getDatabase(app);
    const foundRef = ref(db, "foundItems");

    onValue(foundRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const itemsList = Object.entries(data)
          .map(([id, value]) => ({
            id,
            name: value.name || "",
            description: value.description || "",
            image: value.image || "",
            location: value.location || "",
            dateFound: value.dateFound || "",
            status: value.status || "Pending",
          }))
          // Filter out items marked as "Claimed"
          .filter((item) => item.status !== "Claimed");
        setItems(itemsList);
      } else {
        setItems([]);
      }
    });
  }, []);

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return items;
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.location.toLowerCase().includes(query) ||
        (item.description || "").toLowerCase().includes(query)
    );
  }, [items, searchQuery]);

  const getImage = (url) => {
    if (!url || url.trim() === "") return defaultImage;
    return url;
  };

  return (
    <div className="view-found-container">
      <h2>View Found Items</h2>

      <div className="notice">
        <p>
          If you found your item listed here, please go to our Center for
          verification and to claim it. If you can’t find your item, you can
          submit a Lost Item Report and we will notify you once found.
        </p>
      </div>
      <div className="toolbar">
        <input
          className="search"
          placeholder="Search by item name, location, or description"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="found-list">
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <FoundCard
              key={item.id}
              item={{ ...item, image: getImage(item.image) }}
              onSelect={setSelectedItem}
            />
          ))
        ) : (
          <div className="empty-state">
            {searchQuery
              ? "No items found matching your search."
              : "No found items available at this time."}
          </div>
        )}
      </div>

      {selectedItem && (
        <div
          className="item-details-overlay"
          onClick={() => setSelectedItem(null)}
        >
          <div className="item-details" onClick={(e) => e.stopPropagation()}>
            <img
              src={getImage(selectedItem.image)}
              alt={selectedItem.name}
              className="details-image"
            />
            <p><strong>ID:</strong> {selectedItem.id}</p>
            <h3>{selectedItem.name}</h3>
            <p><strong>Description:</strong> {selectedItem.description || "—"}</p>
            <p><strong>Found at:</strong> {selectedItem.location}</p>
            <p><strong>Date Found:</strong> {selectedItem.dateFound}</p>
            <p><strong>Status:</strong> {selectedItem.status}</p>
            <button onClick={() => setSelectedItem(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
