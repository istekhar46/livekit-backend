import { EgressClient, RoomServiceClient, SipClient } from "livekit-server-sdk";
import { startRecording } from "../utils/utilityFunctions.js";
import dotenv from "dotenv";

dotenv.config();

const sipClient = new SipClient(
  process.env.LIVEKIT_URL,
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);

const roomService = new RoomServiceClient(
  process.env.LIVEKIT_URL,
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);

// Initialize Egress client for recording
const egressClient = new EgressClient(
  process.env.LIVEKIT_URL,
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);

// Get all trunks
const listSipOutboundTrunk = async (req, res) => {
  try {
    const trunks = await sipClient.listSipOutboundTrunk();
    res.json(trunks);
  } catch (error) {
    console.error("Failed to get trunks:", error);
  }
};

// Delete trunk
const deleteSipTrunk = async (req, res) => {
  try {
    const id = req.params.id;
    console.log("Delete trunk:", id);
    const trunk = await sipClient.deleteSipTrunk(id);
    console.log("Trunk deleted:", trunk);
    res.json(trunk);
  } catch (error) {
    console.error("Failed to delete trunk:", error);
  }
};

// Create new trunk
const createSipOutboundTrunk = async (req, res) => {
  try {
    const { name, address, number, username, password } = req.body;

    // Get current list of trunks
    const existingTrunks = await sipClient.listSipOutboundTrunk();

    // Check if trunk with same name or address already exists
    const trunkExists = existingTrunks.some(
      (trunk) => trunk.name === name || trunk.address === address
    );

    if (trunkExists) {
      return res.status(409).json({
        error: "Trunk with this name or address already exists",
      });
    }

    const trunk = await sipClient.createSipOutboundTrunk(
      name,
      address,
      [number],
      {
        auth_username: username,
        auth_password: password,
      }
    );

    console.log("Trunk created:", trunk);

    // Store trunk info
    trunks.push({
      id: trunk.sid,
      name: trunk.name,
      address: trunk.address,
      number: trunk.numbers[0],
    });

    res.status(201).json(trunk);
  } catch (error) {
    console.error("Failed to create trunk:", error);
    res.status(500).json({ error: "Failed to create trunk" });
  }
};

// Make outbound call
// const makeOutboundCall = async (req, res) => {
//   try {
//     const {
//       trunkId,
//       phoneNumber,
//       roomName,
//       dtmf,
//       type = "outbound",
//       serviceProvider,
//       clientName ,
//     } = req.body;

//     const metadata = {
//       type,
//       serviceProvider, //organisation-name
//       clientName,
//     };

//     // Create or update room with proper error handling
//     try {
//       await roomService.createRoom({
//         name: roomName,
//         metadata: JSON.stringify(metadata),
//       });
//     } catch (error) {
//       if (error.code === 6) {
//         // ALREADY_EXISTS
//         await roomService.updateRoomMetadata(
//           roomName,
//           JSON.stringify(metadata)
//         );
//       } else {
//         throw error;
//       }
//     }

//     // Start recording before creating SIP participant
//     const recording = await startRecording(roomName);
//     metadata.recordingId = recording.egressId;

//     const sipParticipantOptions = {
//       participantIdentity: `sip-${Date.now()}`,
//       participantName: "Outbound Call",
//       playDialtone: true,
//     };

//     if (dtmf) {
//       sipParticipantOptions.dtmf = dtmf;
//     }

//     const participant = await sipClient.createSipParticipant(
//       trunkId,
//       phoneNumber,
//       roomName,
//       sipParticipantOptions
//     );

//     res.status(201).json({
//       participant,
//       settings: metadata,
//       recordingId: recording.egressId,
//     });
//   } catch (error) {
//     console.error("Failed to initiate call:", error);
//     res.status(500).json({ error: "Failed to initiate call" });
//   }
// };

const makeOutboundCall = async (req, res) => {
  try {
    const {
      trunkId,
      phoneNumber,
      roomName,
      dtmf,
      type = "outbound",
      serviceProvider,
      clientName,
      transferTo, // New parameter for transfer number
      transferContext // New parameter for transfer context
    } = req.body;

    const metadata = {
      type,
      serviceProvider,
      clientName,
      transferTo, // Add transfer number to metadata
      transferContext // Add transfer context to metadata
    };

    // Create or update room with proper error handling
    try {
      await roomService.createRoom({
        name: roomName,
        metadata: JSON.stringify(metadata),
      });
    } catch (error) {
      if (error.code === 6) {
        // ALREADY_EXISTS
        await roomService.updateRoomMetadata(
          roomName,
          JSON.stringify(metadata)
        );
      } else {
        throw error;
      }
    }

    // Start recording before creating SIP participant
    const recording = await startRecording(roomName);
    metadata.recordingId = recording.egressId;

    const sipParticipantOptions = {
      participantIdentity: `sip-${Date.now()}`,
      participantName: "Outbound Call",
      playDialtone: true,
    };

    if (dtmf) {
      sipParticipantOptions.dtmf = dtmf;
    }

    const participant = await sipClient.createSipParticipant(
      trunkId,
      phoneNumber,
      roomName,
      sipParticipantOptions
    );

    res.status(201).json({
      participant,
      settings: metadata,
      recordingId: recording.egressId,
    });
  } catch (error) {
    console.error("Failed to initiate call:", error);
    res.status(500).json({ error: "Failed to initiate call" });
  }
};

// Get all recordings for a room
const listRecordings = async (req, res) => {
  try {
    const { roomName } = req.params;
    const recordings = await egressClient.listEgress({
      roomName: roomName,
    });
    res.json(recordings);
  } catch (error) {
    console.error("Failed to list recordings:", error);
    res.status(500).json({
      error: "Failed to list recordings",
      details: error.message,
    });
  }
};

export {
  listSipOutboundTrunk,
  deleteSipTrunk,
  createSipOutboundTrunk,
  makeOutboundCall,
  listRecordings,
};
