import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MCPClient } from "./mcpClient.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  throw new Error("ANTHROPIC_API_KEY is not set");
}

const client = new MCPClient(API_KEY);

let isReady = false;

async function initialize() {
  try {
    await client.connectToServer("https://subwayinfo.nyc/mcp");
    isReady = true;
    console.log("MCP connected successfully");
  } catch (err) {
    console.error("MCP init failed:", err);
    process.exit(1);
  }
}

initialize();

app.get("/health", (_, res) => {
  res.json({
    status: "ok",
    mcpReady: isReady,
  });
});

app.post("/chat", async (req, res) => {
  try {
    if (!isReady) {
      return res.status(503).json({
        success: false,
        error: "MCP not ready yet",
      });
    }

    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: "Message is required",
      });
    }

    const response = await client.processQuery(message);

    res.json({
      success: true,
      response,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      error: "Failed to process query",
    });
  }
});

const PORT = 4000;

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});