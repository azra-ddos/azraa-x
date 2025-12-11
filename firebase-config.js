// Konfigurasi Firebase Anda
const firebaseConfig = {
  apiKey: "AIzaSyBJELTa-F_PE4ibNsHDjCCJrFlbUz4FZxg",
  authDomain: "azrax-c1acb.firebaseapp.com",
  projectId: "azrax-c1acb",
  storageBucket: "azrax-c1acb.firebasestorage.app",
  messagingSenderId: "556036996222",
  appId: "1:556036996222:web:2e0dab7dc666896cd8ec2f"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();