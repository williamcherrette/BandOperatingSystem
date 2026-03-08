const admin = require('firebase-admin');
const fs = require('fs');

// Initialize Firebase Admin SDK
const serviceAccount = require("C:\\Users\\willi\\song-list-app\\src\\song-list-app-794b9-firebase-adminsdk-fbsvc-cec2b7b59e.json");  // Replace with your service account key file
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Read the JSON file
const songs = JSON.parse(fs.readFileSync('./songs-with-urls.json', 'utf8'));

// Upload data to Firestore
async function uploadSongs() {
  const collectionRef = db.collection('songs'); // Replace 'songs' with your desired Firestore collection name

  for (const song of songs) {
    try {
      await collectionRef.add(song);
      console.log(`Uploaded: ${song.title}`);
    } catch (error) {
      console.error(`Error uploading ${song.title}:`, error);
    }
  }

  console.log('All songs uploaded successfully!');
}

uploadSongs();