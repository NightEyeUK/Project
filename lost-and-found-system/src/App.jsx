import { useState, useEffect } from "react";
import { BrowserRouter, Route, Routes, Navigate } from "react-router";
import { auth } from "./firebase.js";
import { onAuthStateChanged } from "firebase/auth";

import Nav from "./assets/Components/Nav/Nav";
import AdminNav from "./assets/Pages/Admin/AdminNav/AdminNav";

import Home from "./assets/Pages/Home/Home";
import SubmitLost from "./assets/Pages/SubmitLost/SubmitLost";
import ViewFoundItem from "./assets/Pages/ViewFoundItem/ViewFoundItem";
import Login from "./assets/Pages/Login/Login";
import ResetPassword from "./assets/Pages/ResetPassword/ResetPassword";

import Dashboard from "./assets/Pages/Admin/Dashboard/Dashboard";
import ManageFound from "./assets/Pages/Admin/ManageFound/ManageFound";
import ManageLost from "./assets/Pages/Admin/ManageLost/ManageLost";
import ClaimHistory from "./assets/Pages/Admin/ClaimHistory/ClaimHistory";
import ManageUsers from "./assets/Pages/Admin/ManageUsers/ManageUsers";
import Reports from "./assets/Pages/Admin/Reports/Reports";

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const ProtectedRoute = ({ element }) => {
    return currentUser ? element : <Navigate to="/admin" />;
  };

  return (
    <BrowserRouter>

      {currentUser ? <AdminNav /> : <Nav />}

      <Routes>
        {/* Public routes */}
        {/* Public routes */}
        {
          currentUser ?
            (<>
              <Route
          path="/admin/dashboard"
          element={<Dashboard />} />
        <Route
          path="/admin/manage-found"
          element={<ManageFound />} />
        <Route
          path="/admin/manage-lost"
          element={<ManageLost />}
        />
        <Route
          path="/admin/claim-history"
          element={<ClaimHistory />} />

        <Route
          path="/admin/manage-users"
          element={<ManageUsers />} />
        <Route
          path="/admin/reports"
          element={<Reports />} />
        {/* Default route */}
        <Route path="*" element={<Navigate to="/admin/dashboard" />} />


            </>)
            :
            (<>
              <Route path="/home" element={<Home />} />
              <Route path="/submit-lost-item" element={<SubmitLost />} />
              <Route path="/view-found-items" element={<ViewFoundItem />} />
              <Route path="/admin" element={<Login />} />
              <Route path="/forgot-password" element={<ResetPassword />} />
              {/* Default route */}
        <Route path="*" element={<Navigate to="/home" />} />
            </>)
        }

        

      
      </Routes>
    </BrowserRouter>
  );
}

export default App;
