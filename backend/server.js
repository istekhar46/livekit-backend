import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import sipRouter from "./router/outbountRouter.js";
import authRouter from "./router/authRouter.js";
import testAgentRouter from "./router/testAgentRouter.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

app.use(sipRouter);
app.use("/", authRouter);
app.use("/api/", testAgentRouter);

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("LiveKit voice server initialized successfully");
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});
