const admin = require("firebase-admin");
const { getStorage } = require("firebase-admin/storage");
const fs = require("fs");
const path = require("path");

// Initialize Firebase Admin SDK
const serviceAccount = require("C:\\Users\\willi\\song-list-app\\src\\song-list-app-794b9-firebase-adminsdk-fbsvc-cec2b7b59e.json"); // Replace with your Firebase service account key
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "song-list-app-794b9.firebasestorage.app" // Replace with your Firebase Storage bucket name
});

const bucket = getStorage().bucket();

// Load songs data
const songs = JSON.parse(fs.readFileSync("C:\\Users\\willi\\song-list-app\\src\\songs.json", "utf8")); // Replace with your JSON file path

async function uploadPdfs() {
  for (const song of songs) {
    try {
      const pdfPath = path.resolve(song.pdfPath); // Resolve the local file path
      const storagePath = `pdfs/${path.basename(song.pdfPath)}`; // Define the storage path

      // Upload the PDF to Firebase Storage
      await bucket.upload(pdfPath, {
        destination: storagePath,
        metadata: {
          contentType: "application/pdf"
        }
      });

      // Get the download URL
      const file = bucket.file(storagePath);
      const [url] = await file.getSignedUrl({
        action: "read",
        expires: "03-01-2030" // Set an expiration date for the URL
      });

      // Add the download URL to the song object
      song.pdfUrl = url;
      console.log(`Uploaded ${song.title}: ${url}`);
    } catch (error) {
      console.error(`Failed to upload ${song.title}:`, error);
    }
  }

  // Save the updated songs data with URLs
  fs.writeFileSync("./songs-with-urls.json", JSON.stringify(songs, null, 2));
  console.log("All PDFs uploaded and URLs saved to songs-with-urls.json");
}

uploadPdfs();