import { SipClient } from "livekit-server-sdk";
import { RoomConfiguration, RoomAgentDispatch } from "@livekit/protocol";

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
      // SIP address is the hostname or IP the SIP INVITE is sent to.
      // Address format for Twilio: <trunk-name>.pstn.twilio.com
      // Address format for Telnyx: sip.telnyx.com
      const address = "livekit-ri.pstn.twilio.com";

      // An array of one or more provider phone numbers associated with the trunk.
      const numbers = ["+19783213318"];

      // Trunk options
      const trunkOptions = {
        auth_username: authUsername,
        auth_password: authPassword,
      };

      const trunk = sipClient.createSipOutboundTrunk(
        "My trunk",
        address,
        numbers,
        trunkOptions
      );

      // const trunk = await sipClient.createSipInboundTrunk(
      //   `trunk-${cleanPhoneNumber}`,
      //   ["+19783213318"],
      //   {
      //     auth_username: authUsername,
      //     auth_password: authPassword,
      //   }
      // );

      console.log("Trunk created successfully:", trunk);

      const dispatchRuleOptions = {
        name: `rule-${cleanPhoneNumber}`,
        metaData: "Test Meta data",
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
    const rule = {
      roomPrefix: "call-",
      type: "individual",
    };
    const options = {
      name: "my dispatch rule",
      roomConfig: new RoomConfiguration({
        agents: [
          new RoomAgentDispatch({
            agentName: "inbound-agent",
            metadata: "dispatch metadata",
          }),
        ],
      }),
    };
    const dispatchRule = await sipClient.createSipDispatchRule(rule, options);

    res.status(201).json({
      trunk: trunk,
      dispatchRule: dispatchRule,
    });
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

const deleteInboundTrunk = async (req, res) => {
  try {
    const { trunkId } = req.params;

    const res = await sipClient.deleteSipTrunk(trunkId);

    res.status(200).json({ message: "Trunk deleted successfully", res });
  } catch (error) {
    console.error("Failed to delete trunk:", error);
    res.status(500).json({ error: "Failed to delete trunk" });
  }
};

/**
 * Create a SIP dispatch rule
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createDispatchRule = async (req, res) => {
  try {
    const {
      name,
      ruleType,
      roomPrefix,
      pin,
      trunkIds,
      hidePhoneNumber,
      metaData,
      roomConfig,
      agentName,
      agentMetadata
    } = req.body;

    // Validate required fields
    if (!name || !ruleType) {
      return res.status(400).json({
        error: "Missing required fields: name and ruleType are required",
      });
    }

    // Validate ruleType
    if (!["individual", "direct"].includes(ruleType)) {
      return res.status(400).json({
        error: "Invalid ruleType. Must be 'individual' or 'direct'",
      });
    }

    // Build rule configuration
    const rule = {
      type: ruleType,
    };

    // Add optional rule properties
    if (roomPrefix) {
      rule.roomPrefix = roomPrefix;
    }
    if (pin !== undefined) {
      rule.pin = pin;
    }

    // Build dispatch rule options
    const dispatchRuleOptions = {
      name: name,
    };

    // Add optional dispatch rule properties
    if (metaData) {
      dispatchRuleOptions.metaData = metaData;
    }
    if (trunkIds && Array.isArray(trunkIds)) {
      dispatchRuleOptions.trunkIds = trunkIds;
    }
    if (hidePhoneNumber !== undefined) {
      dispatchRuleOptions.hidePhoneNumber = hidePhoneNumber;
    }

    // Handle room configuration if provided
    if (roomConfig || agentName) {
      if (agentName) {
        // Create room configuration with agent dispatch
        dispatchRuleOptions.roomConfig = new RoomConfiguration({
          agents: [
            new RoomAgentDispatch({
              agentName: agentName,
              metadata: agentMetadata || "dispatch metadata",
            }),
          ],
        });
      } else if (roomConfig) {
        // Use provided room configuration
        dispatchRuleOptions.roomConfig = roomConfig;
      }
    }

    // Create the dispatch rule
    const dispatchRule = await sipClient.createSipDispatchRule(
      rule,
      dispatchRuleOptions
    );

    console.log("Dispatch rule created successfully:", dispatchRule);

    // Return success response
    res.status(201).json({
      success: true,
      dispatchRule: dispatchRule,
      message: "Dispatch rule created successfully",
    });

  } catch (error) {
    console.error("Error creating dispatch rule:", error);
    res.status(500).json({
      error: "Failed to create dispatch rule",
      message: error.message,
    });
  }
};

export { createAgent, createInboundTrunk, listAllInboundTrunks, deleteInboundTrunk, createDispatchRule };
