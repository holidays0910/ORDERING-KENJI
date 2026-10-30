// KusinaERP Firebase Central Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBNUNZOcFBbaxTgG4oINS6WUZj_PVLCWtk",
  authDomain: "ordering-kenji.firebaseapp.com",
  projectId: "ordering-kenji",
  storageBucket: "ordering-kenji.firebasestorage.app",
  messagingSenderId: "22937850065",
  appId: "1:22937850065:web:978cdd85eae967ed6eb5f0",
  measurementId: "G-WD8ZGRBRXN"
};

let db = null;
let auth = null;
let googleProvider = null;

if (typeof firebase !== 'undefined') {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
    auth = firebase.auth();
    googleProvider = new firebase.auth.GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
    
    // Offline Data Persistence para sa Mobile / Tablet
    db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('Persistence failed: Multiple tabs open');
      } else if (err.code === 'unimplemented') {
        console.warn('Browser does not support offline persistence');
      }
    });
  } catch (e) {
    console.error('Firebase initialization error:', e);
  }
}
