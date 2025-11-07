// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDK0soCqs98MUi8BI3aYB7w-0lrYKahAZE",
  authDomain: "lostandfound---finalproject.firebaseapp.com",
  databaseURL: "https://lostandfound---finalproject-default-rtdb.firebaseio.com",
  projectId: "lostandfound---finalproject",
  storageBucket: "lostandfound---finalproject.firebasestorage.app",
  messagingSenderId: "439389679693",
  appId: "1:439389679693:web:01669d155d31d0050b6c04"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { app, auth };
