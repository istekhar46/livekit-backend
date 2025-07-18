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

    // Trunk options
    const trunkOptions = {
      auth_username: username,
      auth_password: password
    };
    console.log(address, number, trunkOptions)
    const trunk = await sipClient.createSipOutboundTrunk(
      name,
      address,
      [number],
      trunkOptions
    );

    console.log("Trunk created:", trunk);

    // Store trunk info
    // trunks.push({
    //   id: trunk.sid,
    //   name: trunk.name,
    //   address: trunk.address,
    //   number: trunk.numbers[0],
    // });

    res.status(201).json(trunk);
  } catch (error) {
    console.error("Failed to create trunk:", error);
    res.status(500).json({ error: "Failed to create trunk" });
  }
};

// Make outbound call
const makeOutboundCall = async (req, res) => {
  try {
    const { trunkId, phoneNumber, roomName, dtmf, type = "outbound", 
            serviceProvider, clientName, transferTo, transferContext } = req.body;
    
    const metadata = { type, serviceProvider, clientName, transferTo, transferContext };
    
    // Execute room creation and SIP participant creation in parallel
    const [roomResult, participant] = await Promise.all([
      (async () => {
        try {
          return await roomService.createRoom({
            name: roomName,
            metadata: JSON.stringify(metadata),
          });
        } catch (error) {
          if (error.code === 6) {
            return await roomService.updateRoomMetadata(roomName, JSON.stringify(metadata));
          }
          throw error;
        }
      })(),
      
      sipClient.createSipParticipant(
        "ST_fdKg8t7ebHpx",
        phoneNumber,
        roomName,
        {
          participantIdentity: `sip-${Date.now()}`,
          participantName: "Outbound Call",
          playDialtone: true,
          dtmf: dtmf || undefined
        }
      )
    ]);
    
    // Start recording after call is connected to avoid delaying connection
    // const recordingPromise = startRecording(roomName).then(recording => {
    //   // Update metadata with recording ID
    //   metadata.recordingId = recording.egressId;
    //   return roomService.updateRoomMetadata(roomName, JSON.stringify(metadata))
    //     .then(() => recording);
    // });
    
    res.status(201).json({
      participant,
      settings: metadata,
      recordingStarted: true
    });
    
    // Let recording complete in background
    // await recordingPromise;
  } catch (error) {
    console.error("Failed to initiate call:", error);
    res.status(500).json({ error: "Failed to initiate call" });
  }
};

// Get all recordings for a room
const listRecordings = async (req, res) => {
  try {
    const { egressId } = req.params;
    const recordings = await egressClient.listEgress({
      egressId: egressId,
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
