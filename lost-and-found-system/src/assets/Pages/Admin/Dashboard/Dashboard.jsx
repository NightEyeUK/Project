import React, { useState, useEffect } from 'react';
import './dashboard.css';
import {app,auth}  from '../../../../firebase.js';
import { getDatabase, ref, onValue, get } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';

export default function Dashboard() {
    const [userData, setUserData] = useState(null);
    const [totalFound, setTotalFound] = useState(0);
    const [totalLost, setTotalLost] = useState(0);
    const [claimedItems, setClaimedItems] = useState(0);
    const [totalUsers, setTotalUsers] = useState(0);
    const [totalAdmins, setTotalAdmins] = useState(0);

    // Load user data
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
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

    // Load real-time counts from Firebase
    useEffect(() => {
        const db = getDatabase(app);

        // Listen to foundItems
        const foundRef = ref(db, 'foundItems');
        onValue(foundRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const items = Object.values(data);
                setTotalFound(items.length);
                const claimed = items.filter(item => item.status === 'Claimed').length;
                setClaimedItems(claimed);
            } else {
                setTotalFound(0);
                setClaimedItems(0);
            }
        });

        // Listen to lostItems
        const lostRef = ref(db, 'lostItems');
        onValue(lostRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const items = Object.values(data);
                setTotalLost(items.length);
            } else {
                setTotalLost(0);
            }
        });

        // Listen to users
        const usersRef = ref(db, 'users');
        onValue(usersRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const users = Object.values(data);
                setTotalUsers(users.length);
                const admins = users.filter(u => (u.role || '').toLowerCase() === 'admin').length;
                setTotalAdmins(admins);
            } else {
                setTotalUsers(0);
                setTotalAdmins(0);
            }
        });
    }, []);

    const summary = [
        { label: 'Total Found', value: totalFound },
        { label: 'Total Lost', value: totalLost },
        { label: 'Claimed Items', value: claimedItems },
        { label: 'Total Users', value: totalUsers },
        { label: 'Total Admins', value: totalAdmins }
    ];

    const userName = userData?.name || userData?.email || 'User';

    return (
        <div className="admin-page">
            <div className="count">
                <h2 id='welcomeMessage'>Welcome Back {userName}!</h2>
                <div className="summary">
                    {summary.map(s => (
                        <div className="summary-card" key={s.label}>
                            <div className="summary-value">{s.value}</div>
                            <div className="summary-label">{s.label}</div>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    );
}

