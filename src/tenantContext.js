import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
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

const deriveBandsFromMembership = async (uid, candidateBands = {}) => {
  const memberships = {};
  for (const [bandId, bandInfo] of Object.entries(candidateBands || {})) {
    const memberSnap = await getDoc(doc(db, "bands", bandId, "members", uid));
    if (!memberSnap.exists()) continue;

    const memberData = memberSnap.data();
    let bandName = "";

    if (bandInfo?.bandName) {
      bandName = bandInfo.bandName;
    }

    try {
      if (!bandName) {
        const bandSnap = await getDoc(doc(db, "bands", bandId));
        if (bandSnap.exists()) {
          bandName = bandSnap.data().name || "";
        }
      }
    } catch {
      // Keep cached name if the band root doc is temporarily unreadable.
    }

    memberships[bandId] = {
      role: memberData.role || "member",
      bandName,
    };

    // Keep users/{uid}/bands/{bandId} in sync for fast future lookups.
    await setDoc(
      doc(db, "users", uid, "bands", bandId),
      {
        role: memberData.role || "member",
        bandName,
      },
      { merge: true }
    );
  }

  return memberships;
};

const backfillOwnerMemberships = async (uid, cachedBands = {}, memberships = {}) => {
  const updates = { ...memberships };

  for (const [bandId, bandInfo] of Object.entries(cachedBands || {})) {
    if (!bandInfo?.owned || updates[bandId]) continue;

    try {
      // Owner self-enrollment is allowed by rules when band.ownerId == uid.
      await setDoc(
        doc(db, "bands", bandId, "members", uid),
        { role: "admin" },
        { merge: true }
      );

      updates[bandId] = {
        role: "admin",
        bandName: bandInfo?.bandName || "",
      };

      await setDoc(
        doc(db, "users", uid, "bands", bandId),
        { role: "admin", bandName: bandInfo?.bandName || "", owned: true },
        { merge: true }
      );
    } catch {
      // Ignore bands that fail owner backfill checks.
    }
  }

  return updates;
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
  const cachedBandsMap = hasBandsMap(userData)
    ? userData.bands
    : await readUserBandsSubcollection(uid);

  const candidateBands = { ...cachedBandsMap };
  if (userData?.lastActiveBandId && !candidateBands[userData.lastActiveBandId]) {
    candidateBands[userData.lastActiveBandId] = {};
  }

  // Membership docs are the security-rule authority for tenant access.
  let bandsMap = await deriveBandsFromMembership(uid, candidateBands);
  bandsMap = await backfillOwnerMemberships(uid, cachedBandsMap, bandsMap);

  if (Object.keys(bandsMap).length === 0) bandsMap = {};

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

// Firestore: bands/{bandId}/sheet_music
export const tenantSheetMusicCollectionRef = (tenantContext) => {
  const tenant = requireTenantBandContext(tenantContext);
  return collection(db, "bands", tenant.bandId, "sheet_music");
};

export const tenantSheetMusicDocRef = (tenantContext, songId) => {
  const tenant = requireTenantBandContext(tenantContext);
  return doc(db, "bands", tenant.bandId, "sheet_music", songId);
};

// Storage: bands/{bandId}/{folder}/{fileName}
// folder should be "sheet_music" for chart PDFs, "playlists" for exports.
export const tenantStoragePath = (tenantContext, folder, fileName) => {
  const tenant = requireTenantBandContext(tenantContext);
  return `bands/${tenant.bandId}/${folder}/${fileName}`;
};
