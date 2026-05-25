import dotenv from "dotenv";
import readline from "readline/promises";
import { MCPClient } from "./mcpClient.js";

dotenv.config();

const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  throw new Error("ANTHROPIC_API_KEY is not set");
}

async function main() {
  const target = process.argv[2];

  if (!target) {
    console.log("Usage: node dist/index.js <server_url_or_script>");
    process.exit(1);
  }

  const client = new MCPClient(API_KEY);

  try {
    await client.connectToServer(target);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log("\nMCP Chat Ready (type 'quit' to exit)");

    while (true) {
      const msg = await rl.question("\nYou: ");
      if (msg.toLowerCase() === "quit") break;

      const res = await client.processQuery(msg);
      console.log("\nAssistant:\n", res);
    }

    rl.close();
  } catch (err) {
    console.error("Fatal error:", err);
  } finally {
    await client.cleanup();
  }
}

main();