require("dotenv").config();
const mongoose = require("mongoose");
const { migrateExistingClassSubjects } = require("../services/globalSubjectService");

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("[Migration] Connected to MongoDB. Running global subject migration...");
  try {
    const summary = await migrateExistingClassSubjects();
    console.log("[Migration] Completed successfully:", summary);
  } finally {
    await mongoose.disconnect();
    console.log("[Migration] Disconnected from MongoDB.");
  }
}

migrate().catch((error) => {
  console.error("[Migration] Failed:", error);
  process.exit(1);
});
