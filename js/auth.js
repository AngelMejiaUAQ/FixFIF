import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

const adminEmails = ["soporte@uaq.edu.mx"];

async function ensureUserProfile(user) {
  if (!user) {
    return null;
  }

  const userRef = doc(db, "users", user.uid);
  const role = adminEmails.includes(user.email) ? "admin" : "user";
  const profile = {
    uid: user.uid,
    name: user.displayName || user.email?.split("@")[0] || "Usuario",
    email: user.email || "",
    role
  };

  await setDoc(
    userRef,
    {
      ...profile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  return {
    ...profile
  };
}

function buildFallbackProfile(user) {
  return {
    uid: user.uid,
    email: user.email || "",
    name: user.displayName || user.email?.split("@")[0] || "Usuario",
    role: adminEmails.includes(user.email) ? "admin" : "user"
  };
}

export function observeAuth(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null, null);
      return;
    }

    // Build a fallback profile immediately so the UI can render without waiting on Firestore.
    const fallback = buildFallbackProfile(user);
    callback(user, fallback);

    // Try to sync profile in background; do not log errors to avoid noisy warnings during development.
    (async () => {
      try {
        await ensureUserProfile(user);
      } catch (e) {
        // intentionally silent: we'll rely on UI-friendly messages elsewhere
      }
    })();
  });
}

export async function loginWithEmail(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function registerWithEmail(email, password, displayName = "") {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(credential.user, { displayName });
  }
  try {
    await ensureUserProfile(credential.user);
  } catch (error) {
    console.warn("No se pudo guardar el perfil durante el registro:", error);
  }
  return credential.user;
}

export async function logoutUser() {
  await signOut(auth);
}

export async function getProfileByUid(uid) {
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? { uid, ...snapshot.data() } : null;
}

export async function getUserByEmail(email) {
  const userQuery = query(collection(db, "users"), where("email", "==", email));
  const snapshot = await getDocs(userQuery);

  if (snapshot.empty) {
    return null;
  }

  const firstDoc = snapshot.docs[0];
  return {
    id: firstDoc.id,
    ...firstDoc.data()
  };
}

export function isAdminProfile(profile) {
  return profile?.role === "admin" || adminEmails.includes(profile?.email);
}