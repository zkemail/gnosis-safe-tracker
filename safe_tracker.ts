import { ethers } from "ethers";
// Imports the Alchemy SDK
const { Alchemy, Network } = require("alchemy-sdk");
const { keccak256 } = require("js-sha3");
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

// Configures the Alchemy SDK
const config = {
  apiKey: process.env.ALCHEMY_API_KEY, // API key is read from environment variables
  network: Network.BASE_SEPOLIA, // Replace with your network
};

// Creates an Alchemy object instance with the config to use for making requests
const alchemy = new Alchemy(config);

// Define the structure for the SafeRequest
interface SafeRequest {
  wallet_addr: string;
}

// Function to send a POST request to the bore.pub API
const sendSafeRequest = async (walletAddress: string, addOrRemove: string) => {
  const safeRequest: SafeRequest = {
    wallet_addr: walletAddress,
  };

  try {
    const response = await fetch(`http://bore.pub:6644/api/safe-${addOrRemove}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(safeRequest),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.text();
    console.log("Response from bore.pub API:", data);
  } catch (error) {
    console.error("Error sending request to bore.pub API:", error);
  }
};

const main = async () => {
  // Event selectors for AddedOwner and RemovedOwner
  const addedOwnerEvent = ethers.id("AddedOwner(address)");
  const removedOwnerEvent = ethers.id("RemovedOwner(address)");

  // Add these event selectors to the topics array for subscription
  const topics = [addedOwnerEvent, removedOwnerEvent];
  // Subscribe to logs using Alchemy
  const subscription = alchemy.ws.on(topics, async (log, event) => {
    // Parse the logs for the specific transaction
    let data = log.data;
    const abiCoder = new ethers.AbiCoder();
    const decodedData = abiCoder.decode(["address"], data);
    const affectedAddress = decodedData[0];
    console.log(`Affected Address: ${affectedAddress}`);

    switch (log.topics[0]) {
      case addedOwnerEvent:
        console.log(`Owner Added: ${affectedAddress}`);
        await sendSafeRequest(affectedAddress, "add");
        break;
      case removedOwnerEvent:
        console.log(`Owner Removed: ${affectedAddress}`);
        await sendSafeRequest(affectedAddress, "remove");
        break;
      default:
        console.log("The data does not match any known event selectors.");
        break;
    }
  });
  console.log("Subscribed to Safe owner logs...");
};

main();
