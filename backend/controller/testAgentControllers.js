import { SipClient } from "livekit-server-sdk";

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
      const agentInfo = {
        phoneNumber: cleanPhoneNumber,
        trunkId: existingTrunk.sipTrunkId,
        createdAt: new Date(),
        status: "active",
        isExisting: true,
      };

      return res.status(200).json({
        success: true,
        agent: agentInfo,
        roomId: `call-${cleanPhoneNumber}-${Date.now()}`,
        message: "Agent trunk already exists",
      });
    }

    // If trunk doesn't exist, create new trunk
    try {
      const trunk = await sipClient.createSipInboundTrunk(
        `trunk-${cleanPhoneNumber}`,
        [cleanPhoneNumber],
        {
          auth_username: authUsername,
          auth_password: authPassword,
        }
      );

      console.log("Trunk created successfully:", trunk);

      const roomName = `call-${cleanPhoneNumber}-${Date.now()}`;

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

export { createAgent };
