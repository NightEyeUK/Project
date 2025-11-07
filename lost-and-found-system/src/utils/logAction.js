import {app,auth} from '../firebase';
import { getDatabase, ref, push, get } from 'firebase/database';
import { getAuth } from 'firebase/auth';

/**
 * Log a user action to Firebase
 * @param {string} action - The action performed (e.g., "Added found item", "Marked as claimed")
 * @param {string} item - The item affected
 * @param {string} details - Additional details about the action
 */
export async function logAction(action, item, details = '') {
    const db = getDatabase(app);
    const auth = getAuth(app);
    const logsRef = ref(db, 'actionLogs');
    
    // Get current user info
    const user = auth.currentUser;
    let userName = 'Unknown User';
    let userEmail = '';
    let userRole = 'User';
    
    if (user) {
        userEmail = user.email || '';
        // Try to get user name from database
        const usersRef = ref(db, 'users');
        try {
            const snapshot = await get(usersRef);
            if (snapshot.exists()) {
                const users = snapshot.val();
                const userEntry = Object.entries(users).find(([id, data]) => data.email === userEmail);
                if (userEntry) {
                    userName = userEntry[1].name || userEmail;
                    userRole = userEntry[1].role || 'User';
                } else {
                    userName = userEmail;
                }
            } else {
                userName = userEmail;
            }
        } catch (error) {
            userName = userEmail || 'Unknown User';
        }
    }
    
    const logEntry = {
        timestamp: new Date().toISOString(),
        action: action,
        item: item || '',
        // Backward-compatible user fields
        user: userName,
        userEmail: userEmail,
        userRole: userRole,
        // Preferred fields going forward
        performedBy: userName,
        performedByEmail: userEmail,
        performedByRole: userRole,
        details: details || ''
    };
    
    push(logsRef, logEntry).catch(error => {
        console.error('Error logging action:', error);
    });
}

