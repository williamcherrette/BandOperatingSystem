import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "./firebase";

const MAX_BANDS_PER_OWNER = 5;
const MAX_BANDS_PER_USER = 5;
const INVITE_EXPIRY_DAYS = 7;

const refreshCurrentUserToken = async (uid) => {
  if (auth.currentUser?.uid !== uid) return;
  await auth.currentUser.getIdToken(true);
};

// ── Internal helpers ─────────────────────────────────────────────────────────

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

// ── Band creation ─────────────────────────────────────────────────────────────

export const createBandForUser = async ({ uid, bandName }) => {
  const membershipCount = await getUserBandCount(uid);
  if (membershipCount >= MAX_BANDS_PER_USER) {
    throw new Error("You can only belong to 5 bands.");
  }

  const ownedCount = await getOwnedBandCount(uid);
  if (ownedCount >= MAX_BANDS_PER_OWNER) {
    throw new Error("You can only own 5 bands.");
  }

  // crypto.randomUUID() provides 122 bits of randomness — collision-safe
  // without requiring a pre-read existence check. A pre-read would be denied
  // by security rules (bands/{bandId} is only readable by members, and the
  // creator is not yet a member). The bandId is an internal tenant key; the
  // human-facing join mechanism is now the invite token.
  const bandId = crypto.randomUUID();
  const cleanBandName = bandName.trim();

  // Write the band root doc first so the member create rule can verify ownerId.
  await setDoc(doc(db, "bands", bandId), {
    name: cleanBandName,
    ownerId: uid,
    createdAt: serverTimestamp(),
  });

  const batch = writeBatch(db);

  // Admin self-enrollment: permitted by the "role == admin && ownerId matches"
  // rule branch. No claimedVia field is set or required for this path.
  batch.set(doc(db, "bands", bandId, "members", uid), {
    role: "admin",
  });
  batch.set(doc(db, "users", uid, "bands", bandId), {
    role: "admin",
    bandName: cleanBandName,
    owned: true,
    joinedAt: serverTimestamp(),
  });
  batch.set(doc(db, "users", uid), { lastActiveBandId: bandId }, { merge: true });

  await batch.commit();

  await refreshCurrentUserToken(uid);

  return { bandId, role: "admin", bandName: cleanBandName };
};

// ── Invite management ─────────────────────────────────────────────────────────

/**
 * Creates a single-use invite token for a band.
 *
 * Only callable by band admins (enforced server-side by firestore.rules).
 * The returned token is the only way for a new user to join the band.
 *
 * @param {string}  bandId        - The band to create the invite for.
 * @param {string}  adminUid      - The requesting admin's UID.
 * @param {number}  expiresInDays - Token validity window (default: 7 days).
 * @returns {Promise<string>}       The invite token — share this with the invitee.
 */
export const createInviteForBand = async ({
  bandId,
  adminUid,
  expiresInDays = INVITE_EXPIRY_DAYS,
}) => {
  const token = crypto.randomUUID();

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  await setDoc(doc(db, "invites", token), {
    bandId,
    createdBy: adminUid,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
    usedBy: null,
    usedAt: null,
  });

  return token;
};

/**
 * Joins a band using a single-use invite token.
 *
 * This replaces joinBandForUser. Call sites to update:
 *
 *   src/App.js
 *     import: { joinBandForUser }           → { joinBandWithInvite }
 *     call:   joinBandForUser({ uid, bandId: code })
 *          →  joinBandWithInvite({ uid, token: code })
 *
 *   src/login.js
 *     import: { joinBandForUser }           → { joinBandWithInvite }
 *     call:   joinBandForUser({ uid, bandId: code })
 *          →  joinBandWithInvite({ uid, token: code })
 *
 * Uses runTransaction so that the invite claim and member creation are
 * atomic. If two users attempt to claim the same token simultaneously,
 * Firestore's optimistic concurrency aborts one of the transactions —
 * that caller will receive "This invite has already been used."
 *
 * @param {string} uid   - The joining user's UID.
 * @param {string} token - The invite token (UUID v4).
 */
export const joinBandWithInvite = async ({ uid, token }) => {
  const normalizedToken = token.trim();

  // Band-count guard runs outside the transaction because getDocs() is not
  // permitted inside runTransaction.
  const membershipCount = await getUserBandCount(uid);
  if (membershipCount >= MAX_BANDS_PER_USER) {
    throw new Error("You can only belong to 5 bands.");
  }

  const result = await runTransaction(db, async (tx) => {
    // ── 1. Read and validate the invite ─────────────────────────────────
    const inviteRef = doc(db, "invites", normalizedToken);
    const inviteSnap = await tx.get(inviteRef);

    if (!inviteSnap.exists()) {
      throw new Error("Invite not found. Check the code and try again.");
    }

    const invite = inviteSnap.data();

    if (invite.usedBy !== null) {
      throw new Error("This invite has already been used.");
    }
    if (invite.expiresAt.toDate() < new Date()) {
      throw new Error("This invite has expired. Ask your band admin for a new one.");
    }

    // ── 2. Verify the band still exists ──────────────────────────────────
    const { bandId } = invite;
    const bandSnap = await tx.get(doc(db, "bands", bandId));

    if (!bandSnap.exists()) {
      throw new Error("Band no longer exists.");
    }

    // ── 3. Handle already-a-member case ──────────────────────────────────
    const memberRef = doc(db, "bands", bandId, "members", uid);
    const memberSnap = await tx.get(memberRef);
    const bandName = bandSnap.data().name || "";

    if (memberSnap.exists()) {
      // Mark the invite used so it cannot be replayed, but skip re-creating
      // the membership docs.
      tx.update(inviteRef, { usedBy: uid, usedAt: serverTimestamp() });
      return {
        bandId,
        role: memberSnap.data().role || "member",
        bandName,
      };
    }

    // ── 4. Claim invite + create membership atomically ────────────────────
    // The invite update is validated by firestore.rules: resource.data.usedBy
    // must be null and the immutable fields (bandId, createdBy, expiresAt)
    // must not change.
    tx.update(inviteRef, { usedBy: uid, usedAt: serverTimestamp() });

    // claimedVia is required by firestore.rules for the invite-gated member
    // create path. It allows the rule to call isValidInviteClaim() server-side.
    tx.set(memberRef, {
      role: "member",
      claimedVia: normalizedToken,
      joinedAt: serverTimestamp(),
    });

    tx.set(doc(db, "users", uid, "bands", bandId), {
      role: "member",
      bandName,
      owned: false,
      joinedAt: serverTimestamp(),
    });

    tx.set(doc(db, "users", uid), { lastActiveBandId: bandId }, { merge: true });

    return { bandId, role: "member", bandName };
  });

  await refreshCurrentUserToken(uid);
  return result;
};
