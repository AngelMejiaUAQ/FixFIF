import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";

function normalizeReport(snapshot) {
  return {
    id: snapshot.id,
    ...snapshot.data()
  };
}

function sortReports(reports) {
  return reports.sort((left, right) => {
    const leftDate = left.createdAt?.toDate ? left.createdAt.toDate() : new Date(left.createdAt || 0);
    const rightDate = right.createdAt?.toDate ? right.createdAt.toDate() : new Date(right.createdAt || 0);

    return rightDate.getTime() - leftDate.getTime();
  });
}

export async function createReport(reportData) {
  const docRef = await addDoc(collection(db, "reports"), {
    ...reportData,
    status: reportData.status || "Pendiente",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return docRef.id;
}

export async function getReports() {
  const snapshot = await getDocs(collection(db, "reports"));
  return sortReports(snapshot.docs.map(normalizeReport));
}

export async function getReportsByUser(uid) {
  const reportsQuery = query(collection(db, "reports"), where("createdBy", "==", uid));
  const snapshot = await getDocs(reportsQuery);
  return sortReports(snapshot.docs.map(normalizeReport));
}

export async function getReportById(reportId) {
  const reportSnapshot = await getDoc(doc(db, "reports", reportId));
  return reportSnapshot.exists() ? normalizeReport(reportSnapshot) : null;
}

export async function updateReportStatus(reportId, newStatus) {
  await updateDoc(doc(db, "reports", reportId), {
    status: newStatus,
    updatedAt: serverTimestamp()
  });
}

export async function updateReport(reportId, payload) {
  await updateDoc(doc(db, "reports", reportId), {
    ...payload,
    updatedAt: serverTimestamp()
  });
}