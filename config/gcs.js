const { Storage } = require("@google-cloud/storage");
const path = require("path");

// Format the private key properly
const formatPrivateKey = (key) => {
  if (!key) return null;
  return key.replace(/\\n/g, "\n").replace(/"/g, "");
};

const storage = new Storage({
  projectId: process.env.GCS_PROJECT_ID,
  credentials: {
    client_email: process.env.GCS_CLIENT_EMAIL,
    private_key: formatPrivateKey(process.env.GCS_PRIVATE_KEY),
  },
});

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

// Function to upload a file to GCS
const uploadFile = async (file, destination) => {
  try {
    console.log("Uploading file:", {
      name: file.name,
      size: file.size,
      mimetype: file.mimetype,
      destination: destination,
    });

    const blob = bucket.file(destination);
    const blobStream = blob.createWriteStream({
      resumable: false,
      gzip: true,
      metadata: {
        contentType: file.mimetype,
      },
    });

    return new Promise((resolve, reject) => {
      blobStream.on("error", (err) => {
        console.error("Error uploading to GCS:", err);
        reject(err);
      });

      blobStream.on("finish", () => {
        console.log("File uploaded successfully:", destination);
        resolve();
      });

      // Ensure we're using the correct buffer
      if (file.buffer) {
        blobStream.end(file.buffer);
      } else if (file.data) {
        blobStream.end(file.data);
      } else {
        reject(new Error("No file data available"));
      }
    });
  } catch (error) {
    console.error("Error in uploadFile:", error);
    throw error;
  }
};

// Function to delete a file from GCS
const deleteFile = async (fileUrl) => {
  try {
    const fileName = fileUrl.split("/").pop();
    await bucket.file(fileName).delete();
    return true;
  } catch (error) {
    console.error("Error deleting file from GCS:", error);
    throw error;
  }
};

module.exports = {
  uploadFile,
  deleteFile,
  bucket,
};
