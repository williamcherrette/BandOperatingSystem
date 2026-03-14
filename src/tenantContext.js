import {
  collection,
  collectionGroup,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

const defaultBandContext = {
  bandId: null,
  bandName: "",
  role: "member",
};

const hasBandsMap = (userData) => {
  return !!(
    userData?.bands &&
    typeof userData.bands === "object" &&
    Object.keys(userData.bands).length > 0
  );
};

const readUserDocData = async (uid) => {
  const userSnap = await getDoc(doc(db, "users", uid));
  return userSnap.exists() ? userSnap.data() : {};
};

const readUserBandsSubcollection = async (uid) => {
  const bands = {};
  const bandsSnap = await getDocs(collection(db, "users", uid, "bands"));

  bandsSnap.forEach((bandDoc) => {
    bands[bandDoc.id] = bandDoc.data();
  });

  return bands;
};

const deriveBandsFromMembership = async (uid) => {
  const memberships = {};
  const membershipsSnap = await getDocs(
    query(collectionGroup(db, "members"), where(documentId(), "==", uid))
  );

  for (const memberDoc of membershipsSnap.docs) {
    const bandId = memberDoc.ref.parent.parent?.id;
    if (!bandId) continue;

    const memberData = memberDoc.data();
    let bandName = "";

    try {
      const bandSnap = await getDoc(doc(db, "bands", bandId));
      if (bandSnap.exists()) {
        bandName = bandSnap.data().name || "";
      }
    } catch {
      // If band root doc is not readable, keep an empty band name.
    }

    memberships[bandId] = {
      role: memberData.role || "member",
      bandName,
    };

    // Keep users/{uid}/bands/{bandId} in sync for fast future lookups.
    await setDoc(
      doc(db, "users", uid, "bands", bandId),
      { role: memberData.role || "member", bandName },
      { merge: true }
    );
  }

  return memberships;
};

const pickActiveBand = (bandsMap, preferredBandId = null) => {
  const entries = Object.entries(bandsMap || {});
  if (entries.length === 0) return defaultBandContext;

  if (preferredBandId && bandsMap[preferredBandId]) {
    const preferredBand = bandsMap[preferredBandId];
    return {
      bandId: preferredBandId,
      bandName: preferredBand?.bandName || "",
      role: preferredBand?.role || "member",
    };
  }

  const [bandId, bandInfo] = entries[0];
  return {
    bandId,
    bandName: bandInfo?.bandName || "",
    role: bandInfo?.role || "member",
  };
};

export const resolveTenantContext = async (uid, seedUserData = null) => {
  let userData = seedUserData || (await readUserDocData(uid));
  let bandsMap = hasBandsMap(userData) ? userData.bands : await readUserBandsSubcollection(uid);

  if (Object.keys(bandsMap).length === 0) {
    bandsMap = await deriveBandsFromMembership(uid);
  }

  const activeBand = pickActiveBand(bandsMap, userData?.lastActiveBandId || null);

  if (activeBand.bandId && userData?.lastActiveBandId !== activeBand.bandId) {
    await setDoc(
      doc(db, "users", uid),
      { lastActiveBandId: activeBand.bandId },
      { merge: true }
    );
  }

  userData = {
    ...userData,
    bands: bandsMap,
    lastActiveBandId: activeBand.bandId || userData?.lastActiveBandId || null,
  };

  return {
    uid,
    userData,
    ...activeBand,
  };
};

export const setLastActiveBandId = async (uid, bandId) => {
  if (!uid || !bandId) return;
  await setDoc(doc(db, "users", uid), { lastActiveBandId: bandId }, { merge: true });
};

export const requireTenantBandContext = (tenantContext) => {
  if (!tenantContext?.bandId) {
    throw new Error("Tenant context is not resolved yet");
  }
  return tenantContext;
};

export const tenantSongsCollectionRef = (tenantContext) => {
  const tenant = requireTenantBandContext(tenantContext);
  return collection(db, "bands", tenant.bandId, "songs");
};

export const tenantSongDocRef = (tenantContext, songId) => {
  const tenant = requireTenantBandContext(tenantContext);
  return doc(db, "bands", tenant.bandId, "songs", songId);
};

export const tenantStoragePath = (tenantContext, folder, fileName) => {
  const tenant = requireTenantBandContext(tenantContext);
  return `bands/${tenant.bandId}/${folder}/${fileName}`;
};
