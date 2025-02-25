import { EgressClient, EncodedFileOutput } from "livekit-server-sdk";
import dotenv from "dotenv";

dotenv.config();

// Initialize Egress client for recording
const egressClient = new EgressClient(
  process.env.LIVEKIT_URL,
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);



export async function startRecording(roomName) {
  try {
    // Create proper outputs object following LiveKit examples
    const outputs = {
      file: new EncodedFileOutput({
        filepath: `recordings/${roomName}-${Date.now()}.mp3`,
        output: {
          case: "s3",
          value: {
            accessKey: process.env.S3_ACCESS_KEY,
            secret: process.env.S3_SECRET_KEY,
            bucket: process.env.S3_BUCKET,
            region: process.env.S3_REGION,
            forcePathStyle: true,
          },
        },
      }),
    };

    // Start room composite egress with audio only
    const recording = await egressClient.startRoomCompositeEgress(
      roomName,
      outputs,
      {
        audioOnly: true,
      }
    );

    console.log(
      `Recording started for room ${roomName}, egress ID: ${recording.egressId}`
    );
    return recording;
  } catch (error) {
    console.error(`Failed to start recording for room ${roomName}:`, error);
    throw error;
  }
}