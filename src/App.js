import { useCallback, useEffect, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";
import { PDFDocument } from "pdf-lib";
import Select from "react-select";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { Navigate, Route, Routes } from "react-router-dom";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { auth, db } from "./firebase";
import Login from "./login";
import {
  resolveTenantContext,
  requireTenantBandContext,
  tenantSheetMusicCollectionRef,
  tenantSheetMusicDocRef,
  tenantStoragePath,
} from "./tenantContext";
import {
  createBandForUser,
  createInviteForBand,
  joinBandWithInvite,
} from "./bandMembershipService";
import HeaderBar from "./components/HeaderBar";
import NavTabs from "./components/NavTabs";
import SelectionBar from "./components/SelectionBar";
import './App.css';

const keyOptions = [
  { value: "C", label: "C (Major)" },
  { value: "C#", label: "C# (Major)" },
  { value: "D", label: "D (Major)" },
  { value: "D#", label: "D# (Major)" },
  { value: "E", label: "E (Major)" },
  { value: "F", label: "F (Major)" },
  { value: "F#", label: "F# (Major)" },
  { value: "G", label: "G (Major)" },
  { value: "G#", label: "G# (Major)" },
  { value: "A", label: "A (Major)" },
  { value: "A#", label: "A# (Major)" },
  { value: "B", label: "B (Major)" },
  { value: "Cm", label: "Cm (Minor)" },
  { value: "C#m", label: "C#m (Minor)" },
  { value: "Dm", label: "Dm (Minor)" },
  { value: "D#m", label: "D#m (Minor)" },
  { value: "Em", label: "Em (Minor)" },
  { value: "Fm", label: "Fm (Minor)" },
  { value: "F#m", label: "F#m (Minor)" },
  { value: "Gm", label: "Gm (Minor)" },
  { value: "G#m", label: "G#m (Minor)" },
  { value: "Am", label: "Am (Minor)" },
  { value: "A#m", label: "A#m (Minor)" },
  { value: "Bm", label: "Bm (Minor)" },
];

function BandOnboarding({ user, onComplete, onLogout }) {
  const [mode, setMode] = useState("pick");
  const [bandName, setBandName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreateBand = async (e) => {
    e.preventDefault();
    setError("");
    if (!bandName.trim()) {
      setError("Please enter a band name.");
      return;
    }

    setLoading(true);
    try {
      await createBandForUser({ uid: user.uid, bandName: bandName.trim() });

      await onComplete();
    } catch (err) {
      console.error("Error creating band:", err);
      setError(err?.message || "Failed to create band. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinBand = async (e) => {
    e.preventDefault();
    setError("");
    const code = joinCode.trim();
    if (!code) {
      setError("Please enter an invite code.");
      return;
    }

    setLoading(true);
    try {
      await joinBandWithInvite({ uid: user.uid, token: code });

      await onComplete();
    } catch (err) {
      console.error("Error joining band:", err);
      setError(err?.message || "Failed to join band. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "40px", textAlign: "center", fontFamily: "Georgia, serif" }}>
      <h2>Set up your band</h2>
      <p style={{ color: "#666" }}>Create a band or join one with an invite code.</p>
      {error && <p style={{ color: "#c0392b" }}>{error}</p>}

      {mode === "pick" && (
        <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "16px" }}>
          <button onClick={() => setMode("create")}>Create Band</button>
          <button onClick={() => setMode("join")}>Join Band</button>
          <button onClick={onLogout}>Logout</button>
        </div>
      )}

      {mode === "create" && (
        <form onSubmit={handleCreateBand} style={{ marginTop: "18px" }}>
          <input
            type="text"
            value={bandName}
            onChange={(e) => setBandName(e.target.value)}
            placeholder="Band name"
            style={{ padding: "10px", width: "280px" }}
          />
          <div style={{ marginTop: "12px", display: "flex", gap: "8px", justifyContent: "center" }}>
            <button type="submit" disabled={loading}>{loading ? "Creating..." : "Create"}</button>
            <button type="button" onClick={() => setMode("pick")}>Back</button>
          </div>
        </form>
      )}

      {mode === "join" && (
        <form onSubmit={handleJoinBand} style={{ marginTop: "18px" }}>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Invite code"
            style={{ padding: "10px", width: "280px" }}
          />
          <div style={{ marginTop: "12px", display: "flex", gap: "8px", justifyContent: "center" }}>
            <button type="submit" disabled={loading}>{loading ? "Joining..." : "Join"}</button>
            <button type="button" onClick={() => setMode("pick")}>Back</button>
          </div>
        </form>
      )}
    </div>
  );
}

function SetlistModal({ open, name, date, onNameChange, onDateChange, onConfirm, onCancel }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm rounded-md border border-border bg-surface p-6">
        <h2 className="mb-4 text-sm font-medium text-text-primary">Save Setlist</h2>
        <div className="mb-3 flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wide text-text-secondary">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. Friday Night Show"
            autoFocus
          />
        </div>
        <div className="mb-5 flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wide text-text-secondary">
            Performance Date <span className="normal-case text-text-secondary">(optional)</span>
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!name.trim()}
            className="border-transparent bg-accent text-white hover:bg-accent/85"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [, setUserData] = useState(null);   // users/{uid} doc data
  const [tenantContext, setTenantContext] = useState(null);
  const [isResolvingTenant, setIsResolvingTenant] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeBandId, setActiveBandId] = useState(null);
  const [activeBandName, setActiveBandName] = useState("");
  const [userRole, setUserRole] = useState("member"); // "admin" | "member"

  const [songs, setSongs] = useState([]);
  const [selectedSongs, setSelectedSongs] = useState([]);
  const [newSong, setNewSong] = useState({ title: "", key: "", decade: "", artist: "", pdfUrl: "" });
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [editingSongId, setEditingSongId] = useState(null);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [inviteCopied, setInviteCopied] = useState(false);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [activeTab, setActiveTab] = useState("songs");
  const [setlists, setSetlists] = useState([]);
  const [isSetlistsLoading, setIsSetlistsLoading] = useState(false);
  const [setlistsError, setSetlistsError] = useState("");
  const [editingSetlistId, setEditingSetlistId] = useState(null);
  const [setlistModalOpen, setSetlistModalOpen] = useState(false);
  const [setlistModalName, setSetlistModalName] = useState("");
  const [setlistModalDate, setSetlistModalDate] = useState("");

  const refreshTenantContext = async (currentUser, firestoreData = null) => {
    const resolvedTenant = await resolveTenantContext(currentUser.uid, firestoreData || {});
    setTenantContext(resolvedTenant);
    setUserData(resolvedTenant.userData);
    setActiveBandId(resolvedTenant.bandId);
    setActiveBandName(resolvedTenant.bandName);
    setUserRole(resolvedTenant.role);
    return resolvedTenant;
  };

  // ── Auth state listener (handles page refresh) ────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setIsResolvingTenant(true);
      if (!currentUser) {
        setUser(null);
        setUserData(null);
        setTenantContext(null);
        setActiveBandId(null);
        setActiveBandName("");
        setUserRole("member");
        setIsResolvingTenant(false);
        setAuthChecked(true);
        return;
      }
      setUser(currentUser);

      try {
        await refreshTenantContext(currentUser);
      } catch (err) {
        console.error("Error loading user context:", err);
        setError("Could not load your band data. Please try logging in again.");
      } finally {
        setIsResolvingTenant(false);
        setAuthChecked(true);
      }
    });
    return () => unsubscribe();
  }, []);

  // ── onLogin callback passed to <Login> ───────────────────────────────────
  // Called immediately after signup/login flow completes in login.js
  const handleLoginComplete = async (firebaseUser, firestoreData) => {
    setIsResolvingTenant(true);
    setUser(firebaseUser);

    try {
      await refreshTenantContext(firebaseUser, firestoreData || {});
      setAuthChecked(true);
    } catch (err) {
      console.error("Error finalizing login:", err);
      setError("Login succeeded but band data could not be loaded.");
    } finally {
      setIsResolvingTenant(false);
    }
  };

  // ── Fetch songs whenever activeBandId changes ─────────────────────────────
  useEffect(() => {
    if (!user || !tenantContext?.bandId) return;
    setEditingSetlistId(null);

    const fetchSongs = async () => {
      try {
        const tenant = requireTenantBandContext(tenantContext);
        const querySnapshot = await getDocs(tenantSheetMusicCollectionRef(tenant));
        const songsList = querySnapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            pdfUrl: data.pdfUrl || data.pdfPath || "",
          };
        });
        const sorted = songsList.sort((a, b) =>
          a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1
        );
        setSongs(sorted);
      } catch (err) {
        console.error("Error fetching songs:", err);
        setError("Failed to fetch songs. Please try again.");
      }
    };

    fetchSongs();
  }, [user, tenantContext]);

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    signOut(auth);
    setSongs([]);
    setSelectedSongs([]);
    setEditingSetlistId(null);
    setSetlistModalOpen(false);
    setSetlistModalName("");
    setSetlistModalDate("");
    setTenantContext(null);
    setActiveBandId(null);
  };

  // ── Generate invite token ─────────────────────────────────────────────────
  const handleGenerateInvite = async () => {
    if (!activeBandId || !user?.uid) return;

    setError("");
    setIsGeneratingInvite(true);
    try {
      const token = await createInviteForBand({
        bandId: activeBandId,
        adminUid: user.uid,
      });
      await navigator.clipboard.writeText(token);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2500);
    } catch (err) {
      console.error("Error generating invite:", err);
      setError(err?.message || "Failed to generate invite token.");
    } finally {
      setIsGeneratingInvite(false);
    }
  };

  const isAuthed = !!user;
  const hasTenantBand = !!activeBandId;
  const isAppReady = authChecked && (!isAuthed || !isResolvingTenant);

  // ── File upload (scoped to band) ──────────────────────────────────────────
  const handleFileUpload = async (file) => {
    if (!file || file.type !== "application/pdf" || file.size > 5 * 1024 * 1024) {
      alert("Invalid file. Please upload a PDF smaller than 5MB.");
      return;
    }
    try {
      const tenant = requireTenantBandContext(tenantContext);
      const storageRef = ref(storage, tenantStoragePath(tenant, "sheet_music", file.name));
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      const cleanedFileName = file.name.replace(/\.pdf$/i, "");
      setUploadedFileName(cleanedFileName);
      setNewSong((prev) => ({ ...prev, pdfUrl: downloadURL }));
    } catch (err) {
      console.error("Error uploading file:", err);
      alert("Failed to upload file. Please try again.");
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewSong({ ...newSong, [name]: value });
  };

  const extractStoragePathFromUrl = (url) => {
    try {
      if (!url) return "";
      if (url.startsWith("gs://")) {
        const firstSlash = url.indexOf("/", 5);
        return firstSlash === -1 ? "" : decodeURIComponent(url.slice(firstSlash + 1));
      }
      const parsed = new URL(url);
      const marker = "/o/";
      const markerIndex = parsed.pathname.indexOf(marker);
      if (markerIndex === -1) return "";
      const encodedPath = parsed.pathname.slice(markerIndex + marker.length);
      return decodeURIComponent(encodedPath);
    } catch {
      return "";
    }
  };

  const resolveSongPdfUrl = async (song) => {
    const existingUrl = song?.pdfUrl || song?.pdfPath || "";
    if (!existingUrl) {
      throw new Error(`Missing PDF URL for ${song?.title || "song"}`);
    }

    const currentBucket = storage.app.options.storageBucket || "";
    if (existingUrl.includes(currentBucket) && existingUrl.includes("token=")) {
      return existingUrl;
    }

    const storagePath = extractStoragePathFromUrl(existingUrl);
    if (!storagePath) {
      return existingUrl;
    }

    const fileName = storagePath.split("/").pop();
    const candidatePaths = [storagePath];

    if (fileName && activeBandId) {
      candidatePaths.push(`bands/${activeBandId}/sheet_music/${fileName}`);
    }

    let freshUrl = "";
    for (const candidatePath of [...new Set(candidatePaths)]) {
      try {
        freshUrl = await getDownloadURL(ref(storage, candidatePath));
        break;
      } catch {}
    }

    if (!freshUrl) {
      // If the file cannot be found in current storage paths, fall back to the
      // saved URL so legacy/public links still get a chance to open.
      return existingUrl;
    }

    if (freshUrl !== existingUrl && song?.id) {
      try {
        const tenant = requireTenantBandContext(tenantContext);
        const songRef = tenantSheetMusicDocRef(tenant, song.id);
        await updateDoc(songRef, { pdfUrl: freshUrl });
        setSongs((prev) => prev.map((s) => (s.id === song.id ? { ...s, pdfUrl: freshUrl } : s)));
      } catch (err) {
        console.error("Could not persist refreshed PDF URL:", err);
      }
    }

    return freshUrl;
  };

  const handleSelectSong = (id, isSelected) => {
    if (isSelected) {
      setSelectedSongs([...selectedSongs, id]);
    } else {
      setSelectedSongs(selectedSongs.filter((songId) => songId !== id));
    }
  };

  // ── Add / Update song ─────────────────────────────────────────────────────
  const handleAddOrUpdateSong = async (e) => {
    e.preventDefault();
    if (!newSong.title || !newSong.key || !newSong.decade || !newSong.artist) {
      setError("All fields are required!");
      return;
    }
    try {
      const tenant = requireTenantBandContext(tenantContext);
      if (editingSongId) {
        const songRef = tenantSheetMusicDocRef(tenant, editingSongId);
        await updateDoc(songRef, newSong);
        setSongs((prev) =>
          prev.map((s) => (s.id === editingSongId ? { id: editingSongId, ...newSong } : s))
        );
      } else {
        const songPayload = {
          ...newSong,
          createdBy: user.uid,
        };
        const docRef = await addDoc(tenantSheetMusicCollectionRef(tenant), songPayload);
        setSongs((prev) => [...prev, { id: docRef.id, ...songPayload }]);
      }
      setNewSong({ title: "", key: "", decade: "", artist: "", pdfUrl: "" });
      setUploadedFileName("");
      setError("");
      setEditingSongId(null);
      setIsFormVisible(false);
    } catch (err) {
      console.error("Error saving song:", err);
      setError("Failed to save the song. Please try again.");
    }
  };

  const handleEditSong = (song) => {
    setNewSong({
      title: song?.title || "",
      key: song?.key || "",
      decade: song?.decade || "",
      artist: song?.artist || "",
      pdfUrl: song?.pdfUrl || song?.pdfPath || "",
    });

    const storagePath = extractStoragePathFromUrl(song?.pdfUrl || song?.pdfPath || "");
    const fileName = (storagePath.split("/").pop() || "")
      .replace(/\.pdf$/i, "");

    setUploadedFileName(fileName);
    setEditingSongId(song.id);
    setIsFormVisible(true);
  };

  // ── Delete song (admin only) ──────────────────────────────────────────────
  const handleDeleteSong = async (id) => {
    if (userRole !== "admin") {
      alert("Only band admins can delete songs.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this song?")) return;
    try {
      const tenant = requireTenantBandContext(tenantContext);
      await deleteDoc(tenantSheetMusicDocRef(tenant, id));
      setSongs(songs.filter((s) => s.id !== id));
    } catch (err) {
      console.error("Error deleting song:", err);
      setError("Failed to delete the song. Please try again.");
    }
  };

  // ── Merge & download playlist PDF ────────────────────────────────────────
  const mergePDFs = async () => {
    if (selectedSongs.length === 0) {
      alert("Please select at least one song to create a playlist.");
      return;
    }
    setIsLoading(true);
    try {
      const mergedPdf = await PDFDocument.create();
      for (const songId of selectedSongs) {
        const song = songs.find((s) => s.id === songId);
        if (!song) continue;
        const resolvedUrl = await resolveSongPdfUrl(song);
        const pdfBytes = await fetch(resolvedUrl).then((res) => {
          if (!res.ok) throw new Error(`Failed to fetch PDF for ${song.title}`);
          return res.arrayBuffer();
        });
        const pdf = await PDFDocument.load(pdfBytes);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }
      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([mergedPdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Playlist.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error merging PDFs:", err);
      alert("Failed to create the playlist. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;
    const newOrder = [...selectedSongs];
    const [moved] = newOrder.splice(result.source.index, 1);
    newOrder.splice(result.destination.index, 0, moved);
    setSelectedSongs(newOrder);
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const sortedSongs = [...songs].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const aVal = a[sortConfig.key]?.toString().toLowerCase() || "";
    const bVal = b[sortConfig.key]?.toString().toLowerCase() || "";
    if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const filteredSongs = songs.filter(
    (song) =>
      song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
      song.decade.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const generateRandomSelection = () => {
    if (songs.length === 0) { alert("No songs available to select."); return; }
    const randomSelection = [...songs]
      .sort(() => 0.5 - Math.random())
      .slice(0, 10)
      .map((s) => s.id);
    setSelectedSongs(randomSelection);
  };

  const clearPlaylist = () => setSelectedSongs([]);

  const fetchSetlists = useCallback(async () => {
    if (!user || !tenantContext?.bandId) return;
    setIsSetlistsLoading(true);
    setSetlistsError("");

    try {
      const tenant = requireTenantBandContext(tenantContext);
      const setlistsRef = collection(db, "bands", tenant.bandId, "setlists");
      const snap = await getDocs(query(setlistsRef, orderBy("createdAt", "desc")));
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSetlists(rows);
    } catch (err) {
      console.error("Error fetching setlists:", err);
      setSetlistsError("Could not load setlists.");
    } finally {
      setIsSetlistsLoading(false);
    }
  }, [user, tenantContext]);

  useEffect(() => {
    fetchSetlists();
  }, [fetchSetlists]);

  const handleSaveSetlist = () => {
    if (selectedSongs.length === 0) {
      alert("Select at least one song before saving a setlist.");
      return;
    }

    const currentSetlist = editingSetlistId
      ? setlists.find((s) => s.id === editingSetlistId)
      : null;
    setSetlistModalName(currentSetlist?.name || `Setlist ${new Date().toISOString().split("T")[0]}`);
    setSetlistModalDate(currentSetlist?.performanceDate || "");
    setSetlistModalOpen(true);
  };

  const handleConfirmSaveSetlist = async () => {
    const name = setlistModalName.trim();
    if (!name) return;

    try {
      const tenant = requireTenantBandContext(tenantContext);
      const payload = {
        name,
        songIds: selectedSongs,
        performanceDate: setlistModalDate || null,
      };

      if (editingSetlistId) {
        await updateDoc(doc(db, "bands", tenant.bandId, "setlists", editingSetlistId), payload);
        setEditingSetlistId(null);
      } else {
        await addDoc(collection(db, "bands", tenant.bandId, "setlists"), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: user.uid,
        });
      }

      setSetlistModalOpen(false);
      setSetlistModalName("");
      setSetlistModalDate("");
      await fetchSetlists();
      setActiveTab("setlists");
    } catch (err) {
      console.error("Error saving setlist:", err);
      alert("Could not save setlist. Please try again.");
    }
  };

  const handleRenameSetlist = (setlist) => {
    setEditingSetlistId(setlist.id);
    setSelectedSongs(Array.isArray(setlist.songIds) ? setlist.songIds : []);
    setSetlistModalName(setlist.name || "");
    setSetlistModalDate(setlist.performanceDate || "");
    setSetlistModalOpen(true);
  };

  const handleEditSetlist = (setlist) => {
    if (!Array.isArray(setlist.songIds) || setlist.songIds.length === 0) {
      alert("This setlist has no songs.");
      return;
    }

    const availableSongIds = new Set(songs.map((s) => s.id));
    const filteredSongIds = setlist.songIds.filter((id) => availableSongIds.has(id));
    if (filteredSongIds.length === 0) {
      alert("None of the songs in this setlist are currently available.");
      return;
    }

    setSelectedSongs(filteredSongIds);
    setEditingSetlistId(setlist.id);
    setActiveTab("songs");
  };

  const handleDeleteSetlist = async (setlistId) => {
    if (userRole !== "admin") {
      alert("Only band admins can delete setlists.");
      return;
    }

    if (!window.confirm("Delete this setlist?")) return;

    try {
      const tenant = requireTenantBandContext(tenantContext);
      await deleteDoc(doc(db, "bands", tenant.bandId, "setlists", setlistId));
      await fetchSetlists();
    } catch (err) {
      console.error("Error deleting setlist:", err);
      alert("Could not delete setlist. Please try again.");
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const appShell = (
    <div
      className="App min-h-screen bg-base text-text-primary"
    >
      <HeaderBar
        activeBandName={activeBandName}
        canGenerateInvite={!!activeBandId && userRole === "admin"}
        inviteCopied={inviteCopied}
        isGeneratingInvite={isGeneratingInvite}
        onGenerateInvite={handleGenerateInvite}
        onLogout={handleLogout}
        error={error}
      />

      <main>
        <NavTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === "songs" && (
          <>
        {/* Toolbar */}
            <section className="flex items-center gap-2.5 border-b border-border px-4 py-3">
              <input
                type="text"
                placeholder="Search songs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-48"
              />
          <button onClick={() => setSearchTerm("")}>Clear</button>

          <div className="flex-1" />

          <button onClick={() => setIsFormVisible(!isFormVisible)}>
            {isFormVisible ? "Hide Form" : "+ Add"}
          </button>
          {songs.length > 0 && (
            <button onClick={generateRandomSelection}>Random</button>
          )}
        </section>

        {/* Selection bar — only shows when songs are selected */}
        {selectedSongs.length > 0 && (
          <SelectionBar
            selectedCount={selectedSongs.length}
            onClear={clearPlaylist}
            onDownload={mergePDFs}
            isLoading={isLoading}
            onSave={handleSaveSetlist}
            onLiveMode={() => setActiveTab("live")}
          />
        )}

        {/* Form Section */}
        {isFormVisible && (
          <section className="mx-auto my-4 w-full max-w-2xl px-4">
            <h2 className="mb-3 text-sm font-medium text-text-primary">{editingSongId ? "Edit Song" : "Add a New Song"}</h2>
            <form onSubmit={handleAddOrUpdateSong} className="rounded-md border border-border bg-surface p-4">
              <div className="mb-3 flex flex-col gap-1.5">
                <label className="text-xs uppercase tracking-wide text-text-secondary" htmlFor="title">Title:</label>
                <input
                  className="w-full"
                  type="text"
                  id="title"
                  name="title"
                  value={newSong.title}
                  onChange={handleInputChange}
                  placeholder="Enter song title"
                  required
                />
              </div>
              <div className="mb-3 flex flex-col gap-1.5">
                <label className="text-xs uppercase tracking-wide text-text-secondary" htmlFor="key">Key:</label>
                <Select
                  id="key"
                  name="key"
                  options={keyOptions}
                  value={keyOptions.find((o) => o.value === newSong.key)}
                  onChange={(opt) => setNewSong((prev) => ({ ...prev, key: opt.value }))}
                  placeholder="Select a key"
                  classNamePrefix="react-select"
                />
              </div>
              <div className="mb-3 flex flex-col gap-1.5">
                <label className="text-xs uppercase tracking-wide text-text-secondary" htmlFor="decade">Decade:</label>
                <select id="decade" name="decade" value={newSong.decade} onChange={handleInputChange} required>
                  <option value="" disabled>Select a decade</option>
                  {["50s","60s","70s","80s","90s","00s","10s","20s"].map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="mb-3 flex flex-col gap-1.5">
                <label className="text-xs uppercase tracking-wide text-text-secondary" htmlFor="artist">Artist:</label>
                <input
                  className="w-full"
                  type="text"
                  id="artist"
                  name="artist"
                  value={newSong.artist}
                  onChange={handleInputChange}
                  placeholder="Enter artist name"
                  required
                />
              </div>
              <div className="mb-4 flex flex-col gap-1.5">
                <label className="text-xs uppercase tracking-wide text-text-secondary" htmlFor="pdf">Upload PDF:</label>
                <input
                  className="w-full"
                  type="file"
                  id="pdf"
                  accept=".pdf"
                  onChange={(e) => handleFileUpload(e.target.files[0])}
                />
                {uploadedFileName && <p className="text-xs text-text-secondary">Uploaded File: {uploadedFileName}</p>}
              </div>
              <div>
                <button type="submit" className="border-transparent bg-accent text-white hover:bg-accent/85">
                  {editingSongId ? "Update Song" : "Add Song"}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Selected Songs */}
        {selectedSongs.length > 0 && (
          <section className="mx-auto my-4 w-full max-w-4xl px-4">
            <h2 className="mb-2 text-center text-sm font-medium text-text-primary">
              Selected Songs
            </h2>
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="selected-songs">
                {(provided) => (
                  <ul
                    className="space-y-1.5"
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                  >
                    {selectedSongs.map((id, index) => {
                      const song = songs.find((s) => s.id === id);
                      if (!song) return null;
                      return (
                        <Draggable key={id} draggableId={id} index={index}>
                          {(provided, snapshot) => (
                            <li
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`flex items-center gap-3 rounded-md border px-3 py-2 ${
                                snapshot.isDragging
                                  ? "border-accent bg-accent/10 shadow-lg"
                                  : "border-border bg-surface"
                              }`}
                            >
                              <span
                                {...provided.dragHandleProps}
                                className="cursor-grab text-text-secondary active:cursor-grabbing"
                                title="Drag to reorder"
                              >
                                ⠿
                              </span>
                              <span className="flex-1 text-sm font-medium text-text-primary">
                                {index + 1}. {song.title}
                                <span className="ml-2 text-xs font-normal text-text-secondary">
                                  {song.artist}
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleSelectSong(id, false)}
                                className="border-transparent text-text-secondary hover:text-danger"
                                title="Remove from setlist"
                              >
                                ✕
                              </button>
                            </li>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </ul>
                )}
              </Droppable>
            </DragDropContext>
          </section>
        )}

        {/* Song List */}
        <section className="px-4 pb-8">
          <div className="overflow-x-auto rounded-md border border-border bg-base">
          <table className="w-full table-fixed border-collapse">
            <thead className="bg-surface">
              <tr className="border-b border-border">
                <th className="w-16 px-3 py-2 text-left text-[11px] uppercase tracking-wide text-text-secondary">Select</th>
                <th onClick={() => handleSort("title")} className="cursor-pointer px-2 py-2 text-left text-[11px] uppercase tracking-wide text-text-secondary hover:text-text-primary">
                  Title {sortConfig.key === "title" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
                <th onClick={() => handleSort("artist")} className="cursor-pointer px-2 py-2 text-left text-[11px] uppercase tracking-wide text-text-secondary hover:text-text-primary">
                  Artist {sortConfig.key === "artist" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
                <th onClick={() => handleSort("key")} className="w-[60px] cursor-pointer px-2 py-2 text-left text-[11px] uppercase tracking-wide text-text-secondary hover:text-text-primary">
                  Key {sortConfig.key === "key" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
                <th onClick={() => handleSort("decade")} className="w-[80px] cursor-pointer px-2 py-2 text-left text-[11px] uppercase tracking-wide text-text-secondary hover:text-text-primary">
                  Era {sortConfig.key === "decade" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
                <th className="w-[180px] px-2 py-2 text-center text-[11px] uppercase tracking-wide text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(searchTerm.trim() ? filteredSongs : sortedSongs).map((song) => (
                <tr key={song.id} className="border-b border-border/70 hover:bg-surface/70">
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-accent"
                      checked={selectedSongs.includes(song.id)}
                      onChange={(e) => handleSelectSong(song.id, e.target.checked)}
                    />
                  </td>
                  <td className="px-2 py-2 text-sm text-text-primary">{song.title}</td>
                  <td className="px-2 py-2 text-sm text-text-primary">{song.artist}</td>
                  <td className="px-2 py-2 text-sm text-text-secondary">{song.key}</td>
                  <td className="px-2 py-2 text-sm text-text-secondary">{song.decade}</td>
                  <td className="px-2 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={async () => {
                          const pdfTab = window.open("about:blank", "_blank");
                          if (!pdfTab) {
                            alert("Popup blocked. Please allow popups for this site to open PDFs in a new tab.");
                            return;
                          }
                          pdfTab.document.title = "Opening PDF...";
                          pdfTab.document.body.innerHTML = "<p style='font-family:Georgia,serif;padding:24px;'>Loading PDF...</p>";
                          try {
                            const resolvedUrl = await resolveSongPdfUrl(song);
                            if (!resolvedUrl) throw new Error("No resolved URL available");
                            pdfTab.location.replace(resolvedUrl);
                          } catch (err) {
                            console.error("Error opening PDF:", err);
                            const fallbackUrl = song?.pdfUrl || song?.pdfPath || "";
                            if (fallbackUrl) {
                              pdfTab.location.replace(fallbackUrl);
                              return;
                            }
                            pdfTab.close();
                            alert("Could not open this PDF.");
                          }
                        }}
                        style={{ color: "#2563eb", border: "none", background: "transparent" }}
                      >
                        Open
                      </button>
                      <button onClick={() => handleEditSong(song)}>
                        Edit
                      </button>
                      {userRole === "admin" && (
                        <button
                          onClick={() => handleDeleteSong(song.id)}
                          style={{ color: "#a0a09a", borderColor: "#2e2e2c", background: "transparent" }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSongs.length === 0 && searchTerm.trim() !== "" && (
                <tr>
                  <td colSpan="6" className="px-2 py-5 text-center text-sm text-text-secondary">
                    No songs found matching your search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </section>
          </>
        )}

        {activeTab === "setlists" && (
          <section className="px-4 py-6">
            <div className="rounded-md border border-border bg-surface p-4">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-medium text-text-primary">Setlists</h2>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={handleSaveSetlist}
                  disabled={selectedSongs.length === 0}
                  className="border-transparent bg-accent text-white hover:bg-accent/85"
                >
                  Save Current Selection
                </button>
              </div>

              {setlistsError && (
                <p className="mb-3 text-sm text-danger">{setlistsError}</p>
              )}

              {isSetlistsLoading ? (
                <p className="text-sm text-text-secondary">Loading setlists...</p>
              ) : setlists.length === 0 ? (
                <p className="text-sm text-text-secondary">No saved setlists yet.</p>
              ) : (
                <ul className="space-y-2">
                  {setlists.map((setlist) => {
                    const createdLabel =
                      setlist?.createdAt?.toDate
                        ? setlist.createdAt.toDate().toLocaleDateString()
                        : "Unknown date";
                    const songCount = Array.isArray(setlist.songIds) ? setlist.songIds.length : 0;
                    const isBeingEdited = editingSetlistId === setlist.id;

                    return (
                      <li
                        key={setlist.id}
                        className={`flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 ${
                          isBeingEdited
                            ? "border-accent bg-accent/10"
                            : "border-border bg-base"
                        }`}
                      >
                        <div className="min-w-[180px] flex-1">
                          <p className="text-sm font-medium text-text-primary">
                            {setlist.name || "Untitled setlist"}
                            {isBeingEdited && (
                              <span className="ml-2 text-xs text-accent">editing</span>
                            )}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {songCount} song{songCount === 1 ? "" : "s"}
                            {setlist.performanceDate && (
                              <> • {new Date(setlist.performanceDate + "T00:00:00").toLocaleDateString()}</>
                            )}
                            {" • "}{createdLabel}
                          </p>
                        </div>
                        <button type="button" onClick={() => handleEditSetlist(setlist)}>
                          {isBeingEdited ? "Reload" : "Edit"}
                        </button>
                        <button type="button" onClick={() => handleRenameSetlist(setlist)}>
                          Rename
                        </button>
                        {userRole === "admin" && (
                          <button
                            type="button"
                            onClick={() => handleDeleteSetlist(setlist.id)}
                            className="border-danger/30 text-danger"
                          >
                            Delete
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        )}

        {activeTab === "live" && (
          <section className="px-4 py-6">
            <div className="rounded-md border border-border bg-surface p-4">
              <h2 className="mb-2 text-sm font-medium text-text-primary">Live Mode</h2>
              <p className="text-sm text-text-secondary">Fullscreen per-song PDF view will be wired in the next feature slice.</p>
            </div>
          </section>
        )}

        {activeTab === "members" && (
          <section className="px-4 py-6">
            <div className="rounded-md border border-border bg-surface p-4">
              <h2 className="mb-2 text-sm font-medium text-text-primary">Members</h2>
              <p className="text-sm text-text-secondary">Member roster and admin actions are queued for next implementation slices.</p>
            </div>
          </section>
        )}

        <SetlistModal
          open={setlistModalOpen}
          name={setlistModalName}
          date={setlistModalDate}
          onNameChange={setSetlistModalName}
          onDateChange={setSetlistModalDate}
          onConfirm={handleConfirmSaveSetlist}
          onCancel={() => {
            setSetlistModalOpen(false);
            setSetlistModalName("");
            setSetlistModalDate("");
            setEditingSetlistId(null);
          }}
        />
      </main>
    </div>
  );

  if (!isAppReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base px-6">
        <h2 className="text-sm font-medium text-text-secondary">Loading your band...</h2>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthed
            ? <Navigate to={hasTenantBand ? "/" : "/onboarding"} replace />
            : <Login onLogin={handleLoginComplete} />
        }
      />
      <Route
        path="/onboarding"
        element={
          !isAuthed
            ? <Navigate to="/login" replace />
            : hasTenantBand
              ? <Navigate to="/" replace />
              : <BandOnboarding user={user} onComplete={() => refreshTenantContext(user)} onLogout={handleLogout} />
        }
      />
      <Route
        path="/"
        element={
          !isAuthed
            ? <Navigate to="/login" replace />
            : !hasTenantBand
              ? <Navigate to="/onboarding" replace />
              : appShell
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
