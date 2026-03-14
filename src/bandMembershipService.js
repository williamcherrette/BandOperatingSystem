import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

const MAX_BANDS_PER_OWNER = 5;
const MAX_BANDS_PER_USER = 5;

const randomBandId = () =>
  Math.random().toString(36).substring(2, 8).toUpperCase();

const getUserBandCount = async (uid) => {
  const snap = await getDocs(
    query(collection(db, "users", uid, "bands"), limit(MAX_BANDS_PER_USER + 1))
  );
  return snap.size;
};

const getOwnedBandCount = async (uid) => {
  const snap = await getDocs(
    query(
      collection(db, "users", uid, "bands"),
      where("owned", "==", true),
      limit(MAX_BANDS_PER_OWNER + 1)
    )
  );
  return snap.size;
};

const ensureBandDocIdAvailable = async () => {
  for (let i = 0; i < 8; i += 1) {
    const bandId = randomBandId();
    const bandSnap = await getDoc(doc(db, "bands", bandId));
    if (!bandSnap.exists()) {
      return bandId;
    }
  }

  throw new Error("Could not generate a unique band code. Please try again.");
};

export const createBandForUser = async ({ uid, bandName }) => {
  const membershipCount = await getUserBandCount(uid);
  if (membershipCount >= MAX_BANDS_PER_USER) {
    throw new Error("You can only belong to 5 bands.");
  }

  const ownedCount = await getOwnedBandCount(uid);
  if (ownedCount >= MAX_BANDS_PER_OWNER) {
    throw new Error("You can only own 5 bands.");
  }

  const bandId = await ensureBandDocIdAvailable();
  const cleanBandName = bandName.trim();

  // Create root band doc first so security rules for member creation can
  // read ownerId from an existing document.
  await setDoc(doc(db, "bands", bandId), {
    name: cleanBandName,
    ownerId: uid,
    createdAt: serverTimestamp(),
  });

  const batch = writeBatch(db);
  batch.set(doc(db, "bands", bandId, "members", uid), { role: "admin" });
  batch.set(doc(db, "users", uid, "bands", bandId), {
    role: "admin",
    bandName: cleanBandName,
    owned: true,
    joinedAt: serverTimestamp()
  });
  batch.set(doc(db, "users", uid), { lastActiveBandId: bandId }, { merge: true });

  await batch.commit();

  return { bandId, role: "admin", bandName: cleanBandName };
};

export const joinBandForUser = async ({ uid, bandId }) => {
  const normalizedBandId = bandId.trim().toUpperCase();
  const bandRef = doc(db, "bands", normalizedBandId);
  const bandSnap = await getDoc(bandRef);

  if (!bandSnap.exists()) {
    throw new Error("Band not found. Check the code and try again.");
  }

  const existingMembershipRef = doc(db, "users", uid, "bands", normalizedBandId);
  const existingMembershipSnap = await getDoc(existingMembershipRef);

  if (!existingMembershipSnap.exists()) {
    const membershipCount = await getUserBandCount(uid);
    if (membershipCount >= MAX_BANDS_PER_USER) {
      throw new Error("You can only belong to 5 bands.");
    }
  }

  const bandData = bandSnap.data() || {};
  const existingMembershipData = existingMembershipSnap.exists()
    ? existingMembershipSnap.data()
    : null;

  const batch = writeBatch(db);
  batch.set(
    doc(db, "bands", normalizedBandId, "members", uid),
    {
      role: "member",
      ...(existingMembershipData?.joinedAt ? {} : { joinedAt: serverTimestamp() }),
    },
    { merge: true }
  );
  batch.set(existingMembershipRef, {
    role: existingMembershipData?.role || "member",
    bandName: bandData.name || "",
    owned: existingMembershipData ? !!existingMembershipData.owned : false,
    ...(existingMembershipData?.joinedAt ? {} : { joinedAt: serverTimestamp() }),
  }, { merge: true });
  batch.set(doc(db, "users", uid), { lastActiveBandId: normalizedBandId }, { merge: true });

  await batch.commit();

  return {
    bandId: normalizedBandId,
    role: existingMembershipSnap.exists() ? existingMembershipSnap.data().role || "member" : "member",
    bandName: bandData.name || "",
  };
};
