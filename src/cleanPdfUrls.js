const fs = require("fs");
const path = require("path");

// Path to the songs-with-urls.json file
const filePath = path.join(__dirname, "songs-with-urls.json");

const updatePdfUrls = () => {
  // Read the JSON file
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

  // Update the pdfUrl field for each song
  const updatedData = data.map((song) => {
    if (song.pdfUrl) {
      // Replace everything up to "/pdfs" with the new base URL
      const newBaseUrl = "https://firebasestorage.googleapis.com/v0/b/song-list-app-794b9/o";
      const updatedUrl = song.pdfUrl.replace(/https:\/\/.*?\/pdfs/, `${newBaseUrl}/pdfs`);
      song.pdfUrl = updatedUrl; // Update the pdfUrl
    }
    return song;
  });

  // Write the updated data back to the file
  fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2), "utf8");
  console.log("Updated pdfUrl fields in songs-with-urls.json.");
};

updatePdfUrls();