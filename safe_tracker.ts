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
const sendSafeRequest = async (walletAddress: string) => {
  const safeRequest: SafeRequest = {
    wallet_addr: walletAddress,
  };

  try {
    const response = await fetch("http://bore.pub:6644/api/safe", {
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
  // Calculate the topic for the SafeMultiSigTransaction event
  const eventSignature = "SafeMultiSigTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes,bytes)";
  // is this the same as ethers.util.id
  const topic = ethers.id(eventSignature);

  // Initialize variables for the parameters
  const topics = [topic];
  let filter = {
    topics,
  };

  // Send test request
  // await sendSafeRequest("0x000000000000000087c51cd469a0e1e2af0e0e597fd88d9ae4baa96700000000");
  const addOwnerSelector = ethers.id("addOwnerWithThreshold(address,uint256)");
  const swapOwnerSelector = ethers.id("swapOwner(address, address, address)");

  // Subscribe to logs using Alchemy
  const subscription = alchemy.ws.on(topics, async (log, event) => {
    // Parse the logs for the specific transaction
    let data = log.data;
    const abiCoder = new ethers.AbiCoder();
    const decodedData = abiCoder.decode(
      [
        "address", // to
        "uint256", // value
        "bytes", // data
        "uint8", // operation
        "uint256", // safeTxGas
        "uint256", // baseGas
        "uint256", // gasPrice
        "address", // gasToken
        "address", // refundReceiver
        "bytes", // signatures
        "bytes", // additionalInfo
      ],
      data
    );

    const safeMultiSigTransaction = {
      to: decodedData[0],
      value: decodedData[1].toString(),
      data: decodedData[2],
      operation: decodedData[3],
      safeTxGas: decodedData[4].toString(),
      baseGas: decodedData[5].toString(),
      gasPrice: decodedData[6].toString(),
      gasToken: decodedData[7],
      refundReceiver: decodedData[8],
      signatures: decodedData[9],
      additionalInfo: decodedData[10],
    };

    // console.log("Parsed SafeMultiSigTransaction:", safeMultiSigTransaction);
    const first8Chars = safeMultiSigTransaction.data.slice(0, 10);
    console.log(`First 8 characters: ${first8Chars}`);

    switch (first8Chars.toLowerCase()) {
      case addOwnerSelector.slice(0, 10).toLowerCase():
        // Extract the address from the data field of addOwnerWithThreshold
        const addressData = data.slice(10, 74); // Slice from 10 to 74 to get the address part
        const addedAddress = ethers.getAddress(`0x${addressData}`);
        console.log(`Address added: ${addedAddress}`);

        await sendSafeRequest(addedAddress);
        break;
      case swapOwnerSelector.slice(0, 10).toLowerCase():
        // Parse the swapOwner data for the new owner
        const prevOwnerData = data.slice(10, 74);
        const oldOwnerData = data.slice(74, 138);
        const newOwnerData = data.slice(138, 202);
        const prevOwner = ethers.getAddress(`0x${prevOwnerData}`);
        const oldOwner = ethers.getAddress(`0x${oldOwnerData}`);
        const newOwner = ethers.getAddress(`0x${newOwnerData}`);
        console.log(`Previous owner: ${prevOwner}, Old owner: ${oldOwner}, New owner: ${newOwner}`);

        await sendSafeRequest(newOwner); // Assuming we want to send a request for the new owner
        break;
      default:
        console.log("The data does not match any known function selectors.");
        break;
    }
  });
};

main();
