import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase"; // Import Firestore instance
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"; // Import Firebase Storage functions
import { storage } from "./firebase"; // Import Firebase Storage instance
import { PDFDocument } from "pdf-lib"; // Import PDF-Lib
import Select from "react-select"; // Import React-Select
import { onAuthStateChanged, signOut } from "firebase/auth"; // Import Firebase Auth functions
import { auth } from "./firebase"; // Import Firebase Auth instance
import Login from "./login";
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

function App() {
  const [user, setUser] = useState(null); // Track the logged-in user
  const [songs, setSongs] = useState([]);
  const [selectedSongs, setSelectedSongs] = useState([]); // Track selected songs
  const [newSong, setNewSong] = useState({
    title: "",
    key: "",
    decade: "",
    artist: "",
    pdfUrl: "",
  });
  const [uploadedFileName, setUploadedFileName] = useState(""); // Track the uploaded file name
  const [editingSongId, setEditingSongId] = useState(null); // Track the song being edited
  const [error, setError] = useState(""); // Track validation or Firestore errors
  const [searchTerm, setSearchTerm] = useState(""); // Track the search input
  const [isLoading, setIsLoading] = useState(false); // Track loading state
  const [isFormVisible, setIsFormVisible] = useState(false); // State to toggle form visibility
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" }); // Sorting configuration

    // Monitor authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log("Auth state changed:", currentUser); // Debugging log
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);
  
    // Handle logout
    const handleLogout = () => {
      signOut(auth);
    };

    useEffect(() => {
      if (!user) {
        console.error("User is not authenticated.");
        return;
      }
      const fetchSongs = async () => {
        try {
          const querySnapshot = await getDocs(collection(db, "songs"));
          const songsList = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
  
          // Sort songs by title (A-Z)
          const sortedSongs = songsList.sort((a, b) => {
            const aTitle = a.title.toLowerCase();
            const bTitle = b.title.toLowerCase();
            return aTitle < bTitle ? -1 : aTitle > bTitle ? 1 : 0;
          });
  
          setSongs(sortedSongs); // Update the songs state
        } catch (error) {
          console.error("Error fetching songs:", error);
          setError("Failed to fetch songs. Please try again.");
        }
      };
  
      fetchSongs();
    }, [user]); // Only re-run when `user` changes
  
  
    // If no user is logged in, show the Login component
    if (!user) {
      return <Login onLogin={(user) => setUser(user)} />;
    }  

  const handleFileUpload = async (file) => {
    if (!file || file.type !== "application/pdf" || file.size > 5 * 1024 * 1024) { // 5MB limit
      alert("Invalid file. Please upload a PDF smaller than 5MB.");
      return;}
  
    try {
      const storageRef = ref(storage, `pdfs/${file.name}`); // Create a reference in Firebase Storage
      const snapshot = await uploadBytes(storageRef, file); // Upload the file
      const downloadURL = await getDownloadURL(snapshot.ref); // Get the download URL
  
      // Remove the ".pdf" extension from the file name
      const cleanedFileName = file.name.replace(/\.pdf$/i, "");
      setUploadedFileName(cleanedFileName); // Save the cleaned file name
      setNewSong((prev) => ({ ...prev, pdfUrl: downloadURL })); // Save the download URL to the new song
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Failed to upload file. Please try again.");
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewSong({ ...newSong, [name]: value });
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value); // Update the search term
  };

  const handleSelectSong = (id, isSelected) => {
    if (isSelected) {
      setSelectedSongs([...selectedSongs, id]);
    } else {
      setSelectedSongs(selectedSongs.filter((songId) => songId !== id));
    }
  };

  const handleAddOrUpdateSong = async (e) => {
    e.preventDefault();
  
    if (!newSong.title || !newSong.key || !newSong.decade || !newSong.artist || !newSong.pdfUrl) {
      setError("All fields are required!");
      return;
    }
  
    try {
      if (editingSongId) {
        const songRef = doc(db, "songs", editingSongId);
        await updateDoc(songRef, newSong); // Update the song in Firestore
        setSongs((prev) =>
          prev.map((song) => (song.id === editingSongId ? { id: editingSongId, ...newSong } : song))
        );
      } else {
        const docRef = await addDoc(collection(db, "songs"), newSong); // Add a new song to Firestore
        setSongs((prev) => [...prev, { id: docRef.id, ...newSong }]);
      }
  
      setNewSong({ title: "", key: "", decade: "", artist: "", pdfUrl: "" }); // Reset the form
      setError("");
      setEditingSongId(null); // Exit edit mode
    } catch (error) {
      console.error("Error saving song:", error);
      setError("Failed to save the song. Please try again.");
    }
  };

  const handleEditSong = (song) => {
    setNewSong(song); // Populate the form with the song's details
  
    // Extract the file name from the URL, decode it, and remove the ".pdf" extension
    const fileName = decodeURIComponent(song.pdfUrl.split("/").pop().split("?")[0])
    .replace(/^pdfs\//, "") // Remove the "pdfs/" prefix
    .replace(/.pdf$/i, ""); // Remove the ".pdf" extension
    setUploadedFileName(fileName); // Save the cleaned file name
    setEditingSongId(song.id); // Set the editing song ID
    setIsFormVisible(true); // Make the form visible
  };
  
  const handleDeleteSong = async (id) => {
    // List of users allowed to delete songs
    const allowedEmails = ["william.cherrette@gmail.com"];

    // Check if the logged-in user's email is in the allowed list
    if (!user || !allowedEmails.includes(user.email)) {
      alert("You do not have permission to delete songs.");
      return;
    }

    const confirmDelete = window.confirm("Are you sure you want to delete this song?");
    if (!confirmDelete) {
      return; // Exit if the user cancels
    }

    try {
      await deleteDoc(doc(db, "songs", id)); // Delete the song from Firestore
      setSongs(songs.filter((song) => song.id !== id)); // Update the UI
    } catch (error) {
      console.error("Error deleting song:", error);
      setError("Failed to delete the song. Please try again.");
    }
  };
  const mergePDFs = async () => {
    console.log("Selected Songs:", selectedSongs); // Debugging
    if (selectedSongs.length === 0) {
      alert("Please select at least one song to create a playlist.");
      return;
    }
  
    setIsLoading(true); // Start loading
    try {
      const mergedPdf = await PDFDocument.create(); // Create a new PDF document
      console.log("Starting PDF merge...");
  
      for (const songId of selectedSongs) {
        console.log(`Processing song ID: ${songId}`); // Debugging
        const song = songs.find((s) => s.id === songId); // Find the song by ID
      
        if (!song) {
          console.error(`Song not found for ID: ${songId}`);
          continue; // Skip this iteration if the song is not found
        }
      
        console.log(`Fetching PDF for song: ${song.title}, URL: ${song.pdfUrl}`);
  
        // Fetch the PDF file
        const pdfBytes = await fetch(song.pdfUrl).then((res) => {
          if (!res.ok) {
            console.error(`Failed to fetch PDF for ${song.title}. Status: ${res.status}`);
            throw new Error(`Failed to fetch PDF for ${song.title}`);
          }
          return res.arrayBuffer();
        });
  
        // Load the PDF and copy its pages
        const pdf = await PDFDocument.load(pdfBytes);
        console.log(`Loaded PDF for song: ${song.title}, Pages: ${pdf.getPageCount()}`);
  
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page)); // Add pages to the merged PDF
        console.log(`Added ${copiedPages.length} pages from ${song.title} to the merged PDF.`);
      }
  
      // Save the merged PDF
      const mergedPdfBytes = await mergedPdf.save();
      console.log("Merged PDF created successfully.");
  
      const blob = new Blob([mergedPdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
  
      // Create a temporary <a> element to trigger the download
      const a = document.createElement("a");
      a.href = url;
      a.download = "Playlist.pdf"; // Set the desired file name
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  
      // Revoke the object URL to free up memory
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error merging PDFs:", error);
      alert("Failed to create the playlist. Please try again.");
    } finally {
      setIsLoading(false); // Stop loading
    }
  };

  const moveSongUp = (id) => {
    const index = selectedSongs.indexOf(id);
    if (index > 0) {
      const newOrder = [...selectedSongs];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]]; // Swap positions
      setSelectedSongs(newOrder);
    }
  };

  const moveSongDown = (id) => {
    const index = selectedSongs.indexOf(id);
    if (index < selectedSongs.length - 1) {
      const newOrder = [...selectedSongs];
      [newOrder[index + 1], newOrder[index]] = [newOrder[index], newOrder[index + 1]]; // Swap positions
      setSelectedSongs(newOrder);
    }
  };

const handleSort = (key) => {
  setSortConfig((prev) => {
    const direction = prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc';
    return { key, direction };
  });
};

const sortedSongs = [...songs].sort((a, b) => {
  if (!sortConfig.key) return 0; // No sorting if no key is selected

  const aValue = a[sortConfig.key]?.toString().toLowerCase() || '';
  const bValue = b[sortConfig.key]?.toString().toLowerCase() || '';

  if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
  if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
  return 0;
});

const filteredSongs = songs.filter((song) =>
  song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
  song.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
  song.decade.toLowerCase().includes(searchTerm.toLowerCase())
);

  const generateRandomSelection = () => {
    if (songs.length === 0) {
      alert("No songs available to select.");
      return;
    }

    // Shuffle the songs array and pick the first 10 songs
    const shuffledSongs = [...songs].sort(() => 0.5 - Math.random());
    const randomSelection = shuffledSongs.slice(0, 10).map((song) => song.id);

    setSelectedSongs(randomSelection); // Update the selectedSongs state
  };

  const clearPlaylist = () => {
    setSelectedSongs([]); // Reset the selectedSongs state
  };

const toggleFormVisibility = () => {
  setIsFormVisible(!isFormVisible); // Toggle the form visibility
};

const handleSavePlaylist = async () => {
  if (selectedSongs.length === 0) {
    alert("Please select at least one song to save the playlist.");
    return;
  }

  const today = new Date();
  const formattedDate = today.toISOString().split("T")[0]; // Format as YYYY-MM-DD

  try {
    const mergedPdf = await PDFDocument.create(); // Create a new PDF document

    for (const songId of selectedSongs) {
      const song = songs.find((s) => s.id === songId);
      if (!song) continue;

      const pdfBytes = await fetch(song.pdfUrl).then((res) => res.arrayBuffer());
      const pdf = await PDFDocument.load(pdfBytes);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    const mergedPdfBytes = await mergedPdf.save();
    const blob = new Blob([mergedPdfBytes], { type: "application/pdf" });

    // Save the PDF to Firebase Storage
    const storageRef = ref(storage, `playlists/Playlist-${formattedDate}.pdf`);
    await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(storageRef);

    const newPlaylist = {
      title: `Playlist - ${formattedDate}`,
      artist: "US",
      key: "C",
      decade: "20s",
      pdfUrl: downloadURL, // Save the download URL to Firestore
    };

    const docRef = await addDoc(collection(db, "songs"), newPlaylist); // Save to Firestore
    setSongs((prev) => [...prev, { id: docRef.id, ...newPlaylist }]); // Update local state

    alert("Playlist saved successfully!");
  } catch (error) {
    console.error("Error saving playlist:", error);
    alert("Failed to save the playlist. Please try again.");
  }
};

return (
  <div
  className="App"
  style={{
    backgroundImage: `url('/setlistgoblin.png')`,
    backgroundSize: "620px 420px", // Ensure both images have the same size
    backgroundRepeat: "no-repeat, no-repeat", // Prevent repetition for both images
    backgroundPosition: "top", // Position one on the left and the other on the right
  }}
>
  <header
    className="App-header"
    style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", padding: "10px", backgroundColor: "rgba(255, 255, 255, 0)" }}
  >
    <h1 style={{ fontSize: "1.5rem", margin: 0, marginRight: "20px" }}>Setlist Goblin</h1>
    <button onClick={handleLogout}>Logout</button>
    {error && <p style={{ color: "red", marginLeft: "20px" }}>{error}</p>}
  </header>
  <main>
    {/* Search Section */}
    <section style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "40px" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: "50px" }}>
        <input
          type="text"
          placeholder="Search songs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: "15px", width: "200px", fontSize: "1.2rem", marginTop: "200px" }}
        />
        <button
          onClick={() => setSearchTerm("")}
            style={{ marginLeft: "10px", padding: "10px 20px", fontSize: "1.2rem", marginTop: "200px" }}
        >
          Clear
        </button>
      </div>
                {/* Button Row */}
    <div style={{ display: "flex", gap: "10px" }}>
      {selectedSongs.length > 0 && (
        <button onClick={clearPlaylist} style={{ backgroundColor: "#DC143C", color: "white" }}>
          Clear Playlist
        </button>
      )}
      <button onClick={() => setIsFormVisible(!isFormVisible)}>
        {isFormVisible ? "Hide Add Song Form" : "Add a New Song"}
      </button>
      {songs.length > 0 && (
        <button onClick={generateRandomSelection}>
          Generate Random Playlist
        </button>
      )}
      <button onClick={handleSavePlaylist} style={{ backgroundColor: "#0078d4", color: "white" }}>
        Save Playlist
      </button>
    </div>
    </section>


{/* Form Section */}
{isFormVisible && (
  <section>
    <h2>{editingSongId ? "Edit Song" : "Add a New Song"}</h2>
    <form onSubmit={handleAddOrUpdateSong} className="song-form">
      {/* Title Input */}
      <div className="form-group">
        <label htmlFor="title">Title:</label>
        <input
          type="text"
          id="title"
          name="title"
          value={newSong.title}
          onChange={handleInputChange}
          placeholder="Enter song title"
          required
        />
      </div>
      {/* Key Dropdown */}
       <div className="form-group">
        <label htmlFor="key">Key:</label>
        <Select
          id="key"
          name="key"
          options={keyOptions}
          value={keyOptions.find((option) => option.value === newSong.key)}
          onChange={(selectedOption) =>
            setNewSong((prev) => ({ ...prev, key: selectedOption.value }))
          }
          placeholder="Select a key"
        />
      </div>
      {/* Decade Input */}
       <div className="form-group">
        <label htmlFor="decade">Decade:</label>
        <select
          id="decade"
          name="decade"
          value={newSong.decade}
          onChange={handleInputChange}
          required
        >
          <option value="" disabled>
            Select a decade
          </option>
          <option value="50s">50s</option>
          <option value="60s">60s</option>
          <option value="70s">70s</option>
          <option value="80s">80s</option>
          <option value="90s">90s</option>
          <option value="00s">00s</option>
          <option value="10s">10s</option>
          <option value="20s">20s</option>
        </select>
      </div>
      {/* Artist Input */}
      <div className="form-group">
        <label htmlFor="artist">Artist:</label>
        <input
          type="text"
          id="artist"
          name="artist"
          value={newSong.artist}
          onChange={handleInputChange}
          placeholder="Enter artist name"
          required
        />
      </div>
      {/* File Upload */}
      <div className="form-group">
        <label htmlFor="pdf">Upload PDF:</label>
        <input
          type="file"
          id="pdf"
          accept=".pdf"
          onChange={(e) => handleFileUpload(e.target.files[0])}
        />
        {uploadedFileName && <p>Uploaded File: {uploadedFileName}</p>}
      </div>
      {/* Submit Button */}
       <div className="form-group">
        <button type="submit">
          {editingSongId ? "Update Song" : "Add Song"}
        </button>
      </div>
    </form>
  </section>
)}
          {selectedSongs.length > 0 && (
            <section>
              <h2 style={{ textAlign: "center" }}>Selected Songs</h2>
              <ul>
                {selectedSongs.map((id) => {
                  const song = songs.find((s) => s.id === id);
                  return (
                    <li key={id}>
                      <div className="song-details">
                        {song.title} - {song.artist}
                      </div>
                      <div className="song-buttons">
                        <button onClick={() => moveSongUp(id)}>Move Up</button>
                        <button onClick={() => moveSongDown(id)}>Move Down</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        {/* Song List Section */}
          <section>
            <table>
              <thead>
                <tr>
                  <th>Select</th>
                  <th onClick={() => handleSort('title')}>
                    Title {sortConfig.key === 'title' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('artist')}>
                    Artist {sortConfig.key === 'artist' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('key')}
                    style={{
                      width: "25px",      // Slightly wider to ensure "Delete" fits
                      textAlign: "left",  // Aligns text to the left
                      paddingLeft: "8px"  // Removes the inner gap on the left side
                    }}>
                    Key {sortConfig.key === 'key' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                    <th onClick={() => handleSort('decade')} style={{
                      width: "60px",      // Slightly wider to ensure "Delete" fits
                      textAlign: "left",  // Aligns text to the left
                      paddingLeft: "8px"  // Removes the inner gap on the left side
                    }}>
                    Decade {sortConfig.key === 'decade' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
              <th style={{ textAlign: 'center' }}>Actions</th>                </tr>
              </thead>
              <tbody>
                {(searchTerm.trim() ? filteredSongs : sortedSongs).map((song) => (
                  <tr key={song.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedSongs.includes(song.id)}
                        onChange={(e) => handleSelectSong(song.id, e.target.checked)}
                      />
                    </td>
                    <td>{song.title}</td>
                    <td>{song.artist}</td>
                    <td>{song.key}</td>
                    <td>{song.decade}</td>
                    <td>
                      <button
                        onClick={() => window.open(song.pdfUrl, "_blank")}
                        style={{ backgroundColor: "#007BFF", color: "white", marginRight: "10px" }}
                      >
                        OPEN
                      </button>
                      <button onClick={() => handleEditSong(song)} style={{ marginRight: "11px" }}>
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteSong(song.id)}
                        style={{
                          color: "red",
                          width: "60px",      // Slightly wider to ensure "Delete" fits
                          textAlign: "left",  // Aligns text to the left
                          paddingLeft: "5px"  // Removes the inner gap on the left side
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredSongs.length === 0 && searchTerm.trim() !== "" && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: "center" }}>
                      No songs found matching your search criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </main>
      </div>
    );
  }


export default App;