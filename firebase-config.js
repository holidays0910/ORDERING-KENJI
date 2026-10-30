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
```[span_1](start_span)[span_1](end_span)

---

### Paano i-update sa GitHub:
1. Buksan ang iyong repository sa GitHub.
2. Pindutin ang file na **`firebase-config.js`**[span_2](start_span)[span_2](end_span).
3. I-click ang **Pencil icon (Edit this file)** sa kanang bahagi.
4. I-highlight lahat at palitan ng code sa itaas[span_3](start_span)[span_3](end_span).
5. Pindutin ang **Commit changes**.

---

### Mahalagang Paalala sa Firebase Console:
Dahil live na ang iyong keys, siguraduhin lang ang huling dalawang switch sa Firebase para hindi magka-error ang login:
* **Authorized Domain:** Sa Firebase Console ➔ **Authentication** ➔ **Settings** ➔ **Authorized domains**, i-add ang `holidays0910.github.io`[span_4](start_span)[span_4](end_span).
* **Google Provider:** Sa **Authentication** ➔ **Sign-in method**, tiyaking naka-**Enable** ang Google provider.
