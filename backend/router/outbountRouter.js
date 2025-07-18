import express from "express";
import dotenv from "dotenv";
import { createSipOutboundTrunk, deleteSipTrunk, listRecordings, listSipOutboundTrunk, makeOutboundCall } from "../controller/outboundControllers.js";

dotenv.config();

const router = express.Router();

// Get all trunks
router.get("/api/list-outboundtrunks", listSipOutboundTrunk);

// Delete trunk
router.get("/api/deleteTrunk/:id", deleteSipTrunk);

// Create new trunk
router.post("/api/trunks", createSipOutboundTrunk);

// Make outbound call with recording endpoint
router.post("/api/call", makeOutboundCall);

// Get all recordings for a room
router.get("/api/recordings/:roomName", listRecordings);

export default router;
