import React, { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { createBandForUser, joinBandWithInvite } from "./bandMembershipService";

const ensureUserDocument = async (user, preferredDisplayName = "") => {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) return userSnap.data();

  const fallbackDisplayName =
    preferredDisplayName?.trim() ||
    user.displayName ||
    user.email?.split("@")[0] ||
    "Band Member";

  const createdData = {
    createdAt: serverTimestamp(),
    displayName: fallbackDisplayName,
    email: (user.email || "").toLowerCase(),
    lastActiveBandId: null,
  };

  await setDoc(userRef, createdData);
  return createdData;
};

// ─── styles ──────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: "100vh",
    background: "#0d0d0d",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Georgia', serif",
    padding: "20px",
  },
  card: {
    background: "#141414",
    border: "1px solid #2a2a2a",
    borderRadius: "4px",
    padding: "48px 40px",
    width: "100%",
    maxWidth: "420px",
    boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
  },
  logo: {
    fontSize: "1.1rem",
    letterSpacing: "0.25em",
    textTransform: "uppercase",
    color: "#888",
    marginBottom: "8px",
    fontFamily: "'Georgia', serif",
  },
  heading: {
    fontSize: "1.9rem",
    color: "#f0ede6",
    margin: "0 0 32px",
    fontWeight: "normal",
    letterSpacing: "-0.02em",
  },
  label: {
    display: "block",
    fontSize: "0.7rem",
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: "#666",
    marginBottom: "6px",
  },
  input: {
    width: "100%",
    background: "#1c1c1c",
    border: "1px solid #2e2e2e",
    borderRadius: "3px",
    color: "#f0ede6",
    padding: "12px 14px",
    fontSize: "0.95rem",
    marginBottom: "20px",
    boxSizing: "border-box",
    outline: "none",
    fontFamily: "'Georgia', serif",
    transition: "border-color 0.2s",
  },
  primaryBtn: {
    width: "100%",
    background: "#c8a84b",
    color: "#0d0d0d",
    border: "none",
    borderRadius: "3px",
    padding: "13px",
    fontSize: "0.8rem",
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    cursor: "pointer",
    fontFamily: "'Georgia', serif",
    fontWeight: "bold",
    marginTop: "4px",
    transition: "background 0.2s",
  },
  ghostBtn: {
    width: "100%",
    background: "transparent",
    color: "#888",
    border: "1px solid #2e2e2e",
    borderRadius: "3px",
    padding: "11px",
    fontSize: "0.75rem",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    cursor: "pointer",
    fontFamily: "'Georgia', serif",
    marginTop: "10px",
    transition: "color 0.2s, border-color 0.2s",
  },
  textBtn: {
    background: "none",
    border: "none",
    color: "#c8a84b",
    fontSize: "0.82rem",
    cursor: "pointer",
    padding: 0,
    fontFamily: "'Georgia', serif",
    textDecoration: "underline",
    textUnderlineOffset: "3px",
  },
  error: {
    background: "#2a1212",
    border: "1px solid #5a2020",
    borderRadius: "3px",
    color: "#e07070",
    fontSize: "0.82rem",
    padding: "10px 14px",
    marginBottom: "20px",
  },
  success: {
    background: "#122a18",
    border: "1px solid #205a30",
    borderRadius: "3px",
    color: "#70c080",
    fontSize: "0.82rem",
    padding: "10px 14px",
    marginBottom: "20px",
  },
  divider: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    margin: "24px 0",
    color: "#333",
    fontSize: "0.75rem",
  },
  line: {
    flex: 1,
    height: "1px",
    background: "#2a2a2a",
  },
  bandCode: {
    background: "#1c1c1c",
    border: "1px solid #2e2e2e",
    borderRadius: "3px",
    padding: "16px",
    marginBottom: "20px",
    textAlign: "center",
  },
  bandCodeLabel: {
    fontSize: "0.68rem",
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: "#666",
    marginBottom: "6px",
  },
  bandCodeValue: {
    fontSize: "2rem",
    letterSpacing: "0.3em",
    color: "#c8a84b",
    fontFamily: "'Georgia', serif",
  },
  footer: {
    marginTop: "28px",
    textAlign: "center",
    color: "#555",
    fontSize: "0.82rem",
  },
  step: {
    fontSize: "0.68rem",
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: "#555",
    marginBottom: "4px",
  },
};

// ─── Step indicator ───────────────────────────────────────────────────────────
const StepDots = ({ current, total }) => (
  <div style={{ display: "flex", gap: "6px", marginBottom: "24px" }}>
    {Array.from({ length: total }).map((_, i) => (
      <div
        key={i}
        style={{
          width: "28px",
          height: "2px",
          background: i <= current ? "#c8a84b" : "#2a2a2a",
          borderRadius: "2px",
          transition: "background 0.3s",
        }}
      />
    ))}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const Login = ({ onLogin }) => {
  // "login" | "signup" | "band-choice" | "create-band" | "join-band"
  const [mode, setMode] = useState("login");
  const [pendingUser, setPendingUser] = useState(null); // Firebase Auth user mid-onboarding

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bandName, setBandName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const clearMessages = () => { setError(""); setInfo(""); };

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await ensureUserDocument(cred.user);

      // Fetch user doc to get their band context
      const userSnap = await getDoc(doc(db, "users", cred.user.uid));
      const userData = userSnap.exists() ? userSnap.data() : {};

      onLogin(cred.user, userData);
    } catch (err) {
      if (err.code === "auth/invalid-credential") {
        setError(
          "Login failed. This email/password is invalid for the current Firebase project. If you just switched projects, create the user again or reset their password in Firebase Auth."
        );
      } else if (err.code === "auth/user-not-found") {
        setError("No auth account exists for that email in this Firebase project.");
      } else if (err.code === "auth/wrong-password") {
        setError("Incorrect password. Please try again.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many failed login attempts. Wait a moment and try again.");
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── SIGN UP (step 1) ───────────────────────────────────────────────────────
  const handleSignup = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!displayName.trim()) { setError("Please enter your display name."); return; }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: displayName.trim() });

      // Create user doc (no band yet)
      await ensureUserDocument(cred.user, displayName);

      setPendingUser(cred.user);
      setMode("band-choice");
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError("That email is already registered. Try logging in.");
      } else if (err.code === "auth/weak-password") {
        setError("Password must be at least 6 characters.");
      } else {
        setError("Signup failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── CREATE BAND (step 2a) ──────────────────────────────────────────────────
  const handleCreateBand = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!bandName.trim()) { setError("Please enter a band name."); return; }
    setLoading(true);
    try {
      const user = pendingUser || auth.currentUser;
      await createBandForUser({ uid: user.uid, bandName: bandName.trim() });

      const userSnap = await getDoc(doc(db, "users", user.uid));
      onLogin(user, userSnap.data());
    } catch (err) {
      setError(err?.message || "Failed to create band. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── JOIN BAND (step 2b) ────────────────────────────────────────────────────
  const handleJoinBand = async (e) => {
    e.preventDefault();
    clearMessages();
    const code = joinCode.trim();
    if (!code) { setError("Please enter an invite code."); return; }
    setLoading(true);
    try {
      const user = pendingUser || auth.currentUser;
      await joinBandWithInvite({ uid: user.uid, token: code });

      const userSnap = await getDoc(doc(db, "users", user.uid));
      onLogin(user, userSnap.data());
    } catch (err) {
      setError(err?.message || "Failed to join band. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── PASSWORD RESET ─────────────────────────────────────────────────────────
  const handlePasswordReset = async () => {
    clearMessages();
    if (!email) { setError("Enter your email above first."); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      setInfo("Reset email sent — check your inbox.");
    } catch {
      setError("Couldn't send reset email. Please try again.");
    }
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>Band OS</div>

        {/* ── LOGIN ── */}
        {mode === "login" && (
          <>
            <h1 style={S.heading}>Welcome back</h1>
            {error && <div style={S.error}>{error}</div>}
            {info && <div style={S.success}>{info}</div>}
            <form onSubmit={handleLogin}>
              <label style={S.label}>Email</label>
              <input
                style={S.input}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@band.com"
                required
                autoFocus
              />
              <label style={S.label}>Password</label>
              <input
                style={S.input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button style={S.primaryBtn} type="submit" disabled={loading}>
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </form>
            <button style={S.ghostBtn} onClick={handlePasswordReset}>
              Forgot password?
            </button>
            <div style={S.footer}>
              New here?{" "}
              <button style={S.textBtn} onClick={() => { clearMessages(); setMode("signup"); }}>
                Create an account
              </button>
            </div>
          </>
        )}

        {/* ── SIGN UP ── */}
        {mode === "signup" && (
          <>
            <div style={S.step}>Step 1 of 2</div>
            <StepDots current={0} total={2} />
            <h1 style={S.heading}>Create account</h1>
            {error && <div style={S.error}>{error}</div>}
            <form onSubmit={handleSignup}>
              <label style={S.label}>Display Name</label>
              <input
                style={S.input}
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                required
                autoFocus
              />
              <label style={S.label}>Email</label>
              <input
                style={S.input}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@band.com"
                required
              />
              <label style={S.label}>Password</label>
              <input
                style={S.input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6+ characters"
                required
              />
              <button style={S.primaryBtn} type="submit" disabled={loading}>
                {loading ? "Creating account…" : "Continue"}
              </button>
            </form>
            <div style={S.footer}>
              Already have an account?{" "}
              <button style={S.textBtn} onClick={() => { clearMessages(); setMode("login"); }}>
                Sign in
              </button>
            </div>
          </>
        )}

        {/* ── BAND CHOICE ── */}
        {mode === "band-choice" && (
          <>
            <div style={S.step}>Step 2 of 2</div>
            <StepDots current={1} total={2} />
            <h1 style={S.heading}>Your band</h1>
            <p style={{ color: "#666", fontSize: "0.88rem", marginBottom: "28px", lineHeight: 1.6 }}>
              Create a new band or join one with an invite code.
            </p>
            {error && <div style={S.error}>{error}</div>}
            <button style={S.primaryBtn} onClick={() => { clearMessages(); setMode("create-band"); }}>
              Create a New Band
            </button>
            <div style={S.divider}>
              <div style={S.line} />
              <span style={{ color: "#444", fontSize: "0.72rem", letterSpacing: "0.1em" }}>OR</span>
              <div style={S.line} />
            </div>
            <button style={S.ghostBtn} onClick={() => { clearMessages(); setMode("join-band"); }}>
              Join with Invite Code
            </button>
          </>
        )}

        {/* ── CREATE BAND ── */}
        {mode === "create-band" && (
          <>
            <div style={S.step}>Step 2 of 2</div>
            <StepDots current={1} total={2} />
            <h1 style={S.heading}>Name your band</h1>
            {error && <div style={S.error}>{error}</div>}
            <form onSubmit={handleCreateBand}>
              <label style={S.label}>Band Name</label>
              <input
                style={S.input}
                type="text"
                value={bandName}
                onChange={(e) => setBandName(e.target.value)}
                placeholder="The Midnight, etc."
                required
                autoFocus
              />
              <button style={S.primaryBtn} type="submit" disabled={loading}>
                {loading ? "Creating…" : "Create Band"}
              </button>
            </form>
            <button style={S.ghostBtn} onClick={() => { clearMessages(); setMode("band-choice"); }}>
              ← Back
            </button>
          </>
        )}

        {/* ── JOIN BAND ── */}
        {mode === "join-band" && (
          <>
            <div style={S.step}>Step 2 of 2</div>
            <StepDots current={1} total={2} />
            <h1 style={S.heading}>Join a band</h1>
            <p style={{ color: "#666", fontSize: "0.88rem", marginBottom: "20px", lineHeight: 1.6 }}>
              Ask your band admin for the invite code.
            </p>
            {error && <div style={S.error}>{error}</div>}
            <form onSubmit={handleJoinBand}>
              <label style={S.label}>Invite Code</label>
              <input
                style={{ ...S.input, letterSpacing: "0.04em", fontSize: "1.0rem", textAlign: "left" }}
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Paste invite token"
                required
                autoFocus
              />
              <button style={S.primaryBtn} type="submit" disabled={loading}>
                {loading ? "Joining…" : "Join Band"}
              </button>
            </form>
            <button style={S.ghostBtn} onClick={() => { clearMessages(); setMode("band-choice"); }}>
              ← Back
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default Login;
