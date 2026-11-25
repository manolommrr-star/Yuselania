// firebase-config.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyDHhrovnCS-B41H85AqtYYe-D-3sf3eXaM",
  authDomain: "yuselania.firebaseapp.com",
  projectId: "yuselania",
  storageBucket: "yuselania.firebasestorage.app",
  messagingSenderId: "495768034028",
  appId: "1:495768034028:web:c3ce852786b90ef05b63c9"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);