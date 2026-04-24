const firebaseConfig = {
  apiKey: "AIzaSyB6ipWbdqkoE37gdiAJzvOUpn-k4t5uRiU",
  authDomain: "azra-chat-54758.firebaseapp.com",
  projectId: "azra-chat-54758",
  storageBucket: "azra-chat-54758.firebasestorage.app",
  messagingSenderId: "548218898310",
  appId: "1:548218898310:web:066caf04d438779bce0e07"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
