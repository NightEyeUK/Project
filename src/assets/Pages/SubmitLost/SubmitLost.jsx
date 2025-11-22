import "./submit-lost.css";
import {app,auth}  from "../../../firebase.js";
import { getDatabase, ref, set, runTransaction } from "firebase/database";
import { useState } from "react";
import { logAction } from "../../../utils/logAction";
import { useConfirmDialog } from "../../Components/ConfirmDialog/ConfirmDialog.jsx";

async function reserveLostItemId(db) {
  const counterRef = ref(db, 'counters/lostItems');
  const result = await runTransaction(counterRef, (currentValue) => {
    if (typeof currentValue !== 'number' || Number.isNaN(currentValue) || currentValue < 0) {
      return 1;
    }
    return currentValue + 1;
  });

  if (!result.committed) {
    throw new Error('Unable to reserve a new Lost Item ID. Please try again.');
  }

  const nextNumber = result.snapshot.val();
  return `Lost${String(nextNumber).padStart(3, '0')}`;
}

export default function SubmitLost() {
  const db = getDatabase(app);
  const confirmDialog = useConfirmDialog();

  const [formData, setFormData] = useState({
    item: "",
    date: "",
    time: "",
    location: "",
    brand: "",
    primary: "",
    secondary: "",
    additional: "",
    imageUrl: "",
    first: "",
    last: "",
    phone: "",
    email: ""
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successId, setSuccessId] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id]: value,
    }));
    // Clear error for this field when user starts typing
    if (errors[id]) {
      setErrors((prev) => ({
        ...prev,
        [id]: ""
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    const today = new Date().toISOString().split("T")[0];

    // Item validations
    if (!formData.item.trim()) {
      newErrors.item = "Item name is required.";
    } else if (formData.item.trim().length < 2) {
      newErrors.item = "Item name must be at least 2 characters.";
    }

    // Date validations
    if (!formData.date) {
      newErrors.date = "Date is required.";
    } else if (formData.date > today) {
      newErrors.date = "Cannot select a future date.";
    }

    // Time validation
    if (!formData.time) {
      newErrors.time = "Time is required.";
    }

    // Location validations
    if (!formData.location.trim()) {
      newErrors.location = "Location is required.";
    } else if (formData.location.trim().length < 3) {
      newErrors.location = "Location must be at least 3 characters.";
    }

    // Image URL validation (if provided)
    if (formData.imageUrl.trim()) {
      try {
        new URL(formData.imageUrl.trim());
      } catch {
        newErrors.imageUrl = "Please enter a valid URL (e.g., https://example.com/image.jpg).";
      }
    }

    // Name validations
    if (!formData.first.trim()) {
      newErrors.first = "First name is required.";
    } else if (formData.first.trim().length < 2) {
      newErrors.first = "First name must be at least 2 characters.";
    } else if (!/^[a-zA-Z\s'-]+$/.test(formData.first.trim())) {
      newErrors.first = "First name can only contain letters.";
    }

    if (!formData.last.trim()) {
      newErrors.last = "Last name is required.";
    } else if (formData.last.trim().length < 2) {
      newErrors.last = "Last name must be at least 2 characters.";
    } else if (!/^[a-zA-Z\s'-]+$/.test(formData.last.trim())) {
      newErrors.last = "Last name can only contain letters.";
    }

    // Phone validation
    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required.";
    } else if (!/^\+?\d{10,13}$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = "Enter a valid phone number (e.g., +639123456789).";
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = "Invalid email address.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const confirmed = await confirmDialog({
      title: 'Submit lost report',
      message: 'Submit this lost item report? Please review your details before continuing.',
      confirmText: 'Submit Report'
    });
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      // Clean up data before submission
      const submissionData = {
        ...formData,
        item: formData.item.trim(),
        location: formData.location.trim(),
        brand: formData.brand.trim(),
        primary: formData.primary.trim(),
        secondary: formData.secondary.trim(),
        additional: formData.additional.trim(),
        imageUrl: formData.imageUrl.trim(),
        first: formData.first.trim(),
        last: formData.last.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim().toLowerCase(),
        submittedAt: new Date().toISOString(),
        status: "Pending"
      };

      const formattedId = await reserveLostItemId(db);
      const recordRef = ref(db, `lostItems/${formattedId}`);
      await set(recordRef, {
        customId: formattedId,
        ...submissionData
      });
      await logAction(
        'Submitted lost item report', 
        submissionData.item, 
        `Location: ${submissionData.location}, Reported by: ${submissionData.first} ${submissionData.last}`
      );
      
      setSuccessId(formattedId);
      setShowSuccess(true);
      
      // Reset form
      setFormData({
        item: "",
        date: "",
        time: "",
        location: "",
        brand: "",
        primary: "",
        secondary: "",
        additional: "",
        imageUrl: "",
        first: "",
        last: "",
        phone: "",
        email: ""
      });
      setErrors({});
    } catch (error) {
      console.error("Error adding lost item:", error);
      setErrors(prev => ({ ...prev, _global: "Failed to submit. Please try again." }));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get today's date for max attribute
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="containerSubmitLost">
      <section className="submit-lost">
        <h1>Submit Lost Property</h1>

        <p className="note">
          Please be descriptive when submitting your lost property report.
          The more information you give, the better your chances of retrieving your items.
        </p>

        <form className="lost-form" onSubmit={handleSubmit}>
          {errors._global && (
            <div className="alert alert-error">{errors._global}</div>
          )}
          {/* --- Item Details --- */}
          <div className="form-section">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="item">What was Lost <span className="required">*</span></label>
                <input
                  type="text"
                  id="item"
                  placeholder="Dog, Jacket, Smartphone, Wallet, etc."
                  value={formData.item}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  
                />
                {errors.item && <small className="error">{errors.item}</small>}
              </div>

              <div className="form-group">
                <label htmlFor="date">Date Lost <span className="required">*</span></label>
                <input
                  type="date"
                  id="date"
                  value={formData.date}
                  onChange={handleChange}
                  max={today}
                  disabled={isSubmitting}
                 

                />
                {errors.date && <small className="error">{errors.date}</small>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="location">Where it was Lost? <span className="required">*</span></label>
                <input
                  type="text"
                  id="location"
                  placeholder="Park, School, Home, etc."
                  value={formData.location}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  
                />
                {errors.location && (
                  <small className="error">{errors.location}</small>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="time">Time Lost <span className="required">*</span></label>
                <input
                  type="time"
                  id="time"
                  value={formData.time}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  
                />
                {errors.time && <small className="error">{errors.time}</small>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="brand">Brand</label>
                <input
                  type="text"
                  id="brand"
                  placeholder="Ralph Lauren, Samsung, etc."
                  value={formData.brand}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="imageUrl">Image URL</label>
                <input 
                  type="url" 
                  id="imageUrl"
                  placeholder="https://example.com/image.jpg"
                  value={formData.imageUrl}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
                {errors.imageUrl && <small className="error">{errors.imageUrl}</small>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="primary">Primary Colour</label>
                <input
                  type="text"
                  id="primary"
                  placeholder="Black, Red, Blue, etc."
                  value={formData.primary}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="secondary">Secondary Colour</label>
                <input
                  type="text"
                  id="secondary"
                  placeholder="Optional secondary colour"
                  value={formData.secondary}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="additional">Additional Information</label>
              <textarea
                id="additional"
                rows="4"
                placeholder="Any other details about your lost item"
                value={formData.additional}
                onChange={handleChange}
                disabled={isSubmitting}
              ></textarea>
            </div>
          </div>

          {/* --- Contact Information --- */}
          <h2>Contact Information</h2>
          <div className="form-section">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="first">First Name <span className="required">*</span></label>
                <input
                  type="text"
                  id="first"
                  value={formData.first}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  
                />
                {errors.first && <small className="error">{errors.first}</small>}
              </div>

              <div className="form-group">
                <label htmlFor="last">Last Name <span className="required">*</span></label>
                <input
                  type="text"
                  id="last"
                  value={formData.last}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  
                />
                {errors.last && <small className="error">{errors.last}</small>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="phone">Phone Number <span className="required">*</span></label>
                <input
                  type="tel"
                  id="phone"
                  placeholder="+639123456789"
                  value={formData.phone}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  
                />
                {errors.phone && <small className="error">{errors.phone}</small>}
              </div>

              <div className="form-group">
                <label htmlFor="email">Email <span className="required">*</span></label>
                <input
                  type="email"
                  id="email"
                  placeholder="your.email@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={isSubmitting}
                 
                />
                {errors.email && <small className="error">{errors.email}</small>}
              </div>
            </div>
          </div>

          <button type="submit" className="submit-btn" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </button>
        </form>
      </section>
      {showSuccess && (
        <div className="item-details-overlay" onClick={() => setShowSuccess(false)}>
          <div className="item-details success-modal" onClick={(e) => e.stopPropagation()}>
            <img
              className="success-icon"
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Eo_circle_green_checkmark.svg/2048px-Eo_circle_green_checkmark.svg.png"
              alt="Success"
            />
            <h3 className="success-title">Report Submitted</h3>
            <p className="success-subtitle">Your lost item report has been submitted successfully.</p>
            {successId && (
              <div className="success-id-row">
              
             
        
                <span className="success-id-label">Your Report ID: {successId}</span>
              </div>
              
              
            )}
             <p id="mss">Please Save Your Report ID</p>
            
            <div className="success-actions">
              <button className="btn-primary" onClick={() => setShowSuccess(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}