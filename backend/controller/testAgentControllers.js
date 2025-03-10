import { SipClient } from "livekit-server-sdk";

const sipClient = new SipClient(
  process.env.LIVEKIT_URL,
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);

// Store active agents (in a real application, use a database)
const activeAgents = new Map();

/**
 * Create a new agent with SIP trunk configuration
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createAgent = async (req, res) => {
  try {
    const { phoneNumber, authUsername, authPassword } = req.body;

    // Validate required fields
    if (!phoneNumber || !authUsername || !authPassword) {
      return res.status(400).json({
        error: "Missing required fields",
      });
    }

    // Clean phone number format
    const cleanPhoneNumber = phoneNumber.startsWith("+")
      ? phoneNumber
      : `+${phoneNumber.replace(/[^0-9]/g, "")}`;

    // Initialize SIP client
    const sipClient = new SipClient(
      process.env.LIVEKIT_URL,
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET
    );

    // Get existing trunks
    const existingTrunks = await sipClient.listSipInboundTrunk();

    // Check if trunk already exists for this number
    const existingTrunk = existingTrunks.find(
      (trunk) =>
        trunk.name === `trunk-${cleanPhoneNumber}` ||
        trunk.numbers.includes(cleanPhoneNumber)
    );

    if (existingTrunk) {
      // If trunk exists, return the existing information
      sipClient.deleteSipTrunk(existingTrunk.sipTrunkId);
      res.status(200).json({
        success: true,
        trunk_id: existingTrunk.sipTrunkId,
      });
      return;
    }

    // If trunk doesn't exist, create new trunk
    try {
      const trunk = await sipClient.createSipInboundTrunk(
        `trunk-${cleanPhoneNumber}`,
        ["+19783213318"],
        {
          auth_username: authUsername,
          auth_password: authPassword,
        }
      );

      console.log("Trunk created successfully:", trunk);

      const dispatchRuleOptions = {
        name: `rule-${cleanPhoneNumber}`,
        trunkIds: [trunk.sipTrunkId],
        hidePhoneNumber: false,
      };

      // Dispatch rule for individual rooms
      const ruleType = {
        type: "individual",
        roomPrefix: `call-${cleanPhoneNumber}`,
        pin: "",
      };

      const dispatchRule = await sipClient.createSipDispatchRule(
        ruleType,
        dispatchRuleOptions
      );

      console.log("Dispatch rule created successfully:", dispatchRule);

      // Store agent information
      const agentInfo = {
        phoneNumber: cleanPhoneNumber,
        trunkId: trunk.sipTrunkId,
        dispatchRuleId: dispatchRule.sipDispatchRuleId,
        createdAt: new Date().toLocaleDateString(),
        status: "active",
        isExisting: false,
      };

      activeAgents.set(cleanPhoneNumber, agentInfo);

      // Return success response
      res.status(201).json({
        success: true,
        agent: agentInfo,
        roomId: `call-${cleanPhoneNumber}-${Date.now()}`,
        message: "New agent trunk created successfully",
      });
    } catch (trunkError) {
      console.error("Trunk creation error details:", {
        error: trunkError.message,
        stack: trunkError.stack,
      });
      throw trunkError;
    }
  } catch (error) {
    console.error("Error in create-agent:", error);
    res.status(500).json({
      error: "Failed to create agent",
      message: error.message,
    });
  }
};

const createInboundTrunk = async (req, res) => {
  try {
    const { name, number } = req.body;

    const numbers = [number];

    const trunkOptions = {
      krispEnabled: true,
    };

    const trunk = await sipClient.createSipInboundTrunk(
      name,
      numbers,
      trunkOptions
    );

    res.status(201).json(trunk);
  } catch (error) {
    console.error("Failed to create trunk:", error);
    res.status(500).json({ error: "Failed to create trunk" });
  }
};

const listAllInboundTrunks = async (req, res) => {
  try {
    const sipClient = new SipClient(
      process.env.LIVEKIT_URL,
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET
    );

    const trunks = await sipClient.listSipInboundTrunk();

    res.status(200).json(trunks);
  } catch (error) {
    console.error("Failed to list trunks:", error);
    res.status(500).json({ error: "Failed to list trunks" });
  }
};

export { createAgent, createInboundTrunk, listAllInboundTrunks };
