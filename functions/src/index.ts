import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";

initializeApp();

const auth = getAuth();

type Claims = Record<string, unknown>;
type BandRoles = Record<string, "admin" | "member">;

const normalizeRole = (role: unknown): "admin" | "member" => {
	return role === "admin" ? "admin" : "member";
};

const getBandRolesFromClaims = (claims: Claims): BandRoles => {
	const existing = claims.bandRoles;
	if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
		return {};
	}

	const roles: BandRoles = {};
	for (const [bandId, role] of Object.entries(existing as Record<string, unknown>)) {
		if (role === "admin" || role === "member") {
			roles[bandId] = role;
		}
	}
	return roles;
};

export const syncBandRoleClaims = onDocumentWritten(
	"bands/{bandId}/members/{uid}",
	async (event) => {
		const bandId = event.params.bandId;
		const uid = event.params.uid;

		const user = await auth.getUser(uid);
		const baseClaims: Claims = {...(user.customClaims || {})};
		const bandRoles = getBandRolesFromClaims(baseClaims);

		const afterData = event.data?.after.data();
		if (afterData) {
			bandRoles[bandId] = normalizeRole(afterData.role);
		} else {
			delete bandRoles[bandId];
		}

		delete baseClaims.bandRoles;
		const updatedClaims: Claims = {...baseClaims};
		if (Object.keys(bandRoles).length > 0) {
			updatedClaims.bandRoles = bandRoles;
		}

		await auth.setCustomUserClaims(uid, updatedClaims);
		logger.info("Synced band role claims", {
			uid,
			bandId,
			role: afterData ? bandRoles[bandId] : null,
			bandCount: Object.keys(bandRoles).length,
		});
	}
);