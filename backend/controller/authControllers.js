import { AccessToken } from "livekit-server-sdk";
import { RoomServiceClient } from "livekit-server-sdk";

/**
 * Generate a LiveKit token for room access
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getToken = async (req, res) => {
  try {
    const { model, voice, prompt } = req.body;
    const roomName = "livekitbot";
    // const roomName = `call-${cleanPhoneNumber}-${Date.now()}`;
    const participantName = `user-${Math.random().toString(36).substring(7)}`;

    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: participantName,
        ttl: "10m",
      }
    );

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    // Store agent preferences in the room metadata
    const metadata = {
      model,
      voice,
      prompt,
      timestamp: new Date().toISOString(),
    };

    // Initialize room service client
    const roomServiceClient = new RoomServiceClient(
      process.env.LIVEKIT_URL,
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET
    );

    // Create or update room with metadata
    await roomServiceClient.createRoom({
      metadata: JSON.stringify(metadata),
      name: roomName,
    });

    roomServiceClient.updateRoomMetadata(roomName, JSON.stringify(metadata));

    const token = await at.toJwt();
    res.json({
      token,
      roomName,
      participantName,
      preferences: metadata,
    });
  } catch (error) {
    console.error("Token generation error:", error);
    res.status(500).json({ error: "Failed to generate token" });
  }
};

export { getToken };
