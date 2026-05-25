//this contains the mcp client class
import { Anthropic } from "@anthropic-ai/sdk";
import type { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages/index.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import readline from "readline/promises";
import dotenv from "dotenv";

dotenv.config();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }


function isHttpUrl(target: string): boolean {
  try {
    const url = new URL(target);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export class MCPClient {
    private mcp: Client;
    private anthropic: Anthropic;
    private transport: Transport | null = null;
    private tools: Tool[] = [];

    constructor() {
        this.anthropic = new Anthropic({
            apiKey: ANTHROPIC_API_KEY,
        });
        this.mcp = new Client({name:"MCPClient",version:"1.0.0",description:"A MCP client for the Anthropic API"});
    }

    private async loadTools() {
      const toolsResult = await this.mcp.listTools();
      this.tools = toolsResult.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
      }));
      console.log(
        "Connected to server with tools:",
        this.tools.map(({ name }) => name)
      );
    }

    private async connectViaStdio(serverScriptPath: string) {
      const isJs = serverScriptPath.endsWith(".js");
      const isPy = serverScriptPath.endsWith(".py");
      if (!isJs && !isPy) {
        throw new Error("Local server must be a .js or .py file");
      }
      const command = isPy
        ? process.platform === "win32"
          ? "python"
          : "python3"
        : process.execPath;

      this.transport = new StdioClientTransport({
        command,
        args: [serverScriptPath],
      });
      await this.mcp.connect(this.transport);
    }

    private async connectViaHttp(serverUrl: string) {
      const baseUrl = new URL(serverUrl);
      try {
        console.log("Connecting via Streamable HTTP...");
        this.transport = new StreamableHTTPClientTransport(baseUrl);
        await this.mcp.connect(this.transport);
        return;
      } catch (error) {
        console.log(`Streamable HTTP failed: ${error}`);
        console.log("Falling back to HTTP+SSE transport...");
        this.transport = new SSEClientTransport(baseUrl);
        await this.mcp.connect(this.transport);
      }
    }

    async connectToServer(target: string) {
        try {
            if (isHttpUrl(target)) {
              await this.connectViaHttp(target);
            } else {
              await this.connectViaStdio(target);
            }
            await this.loadTools();
          } catch (e) {
            console.log("Failed to connect to MCP server: ", e);
            throw e;
          }
    }

    async processQuery(query: string) {
        const messages: MessageParam[] = [
          {
            role: "user",
            content: query,
          },
        ];
      
        const response = await this.anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1000,
          messages,
          tools: this.tools,
        });
      
        const finalText = [];
      
        for (const content of response.content) {
          if (content.type === "text") {
            finalText.push(content.text);
          } else if (content.type === "tool_use") {
            const toolName = content.name;
            const toolArgs = content.input as { [x: string]: unknown } | undefined;
      
            const result = await this.mcp.callTool({
              name: toolName,
              arguments: toolArgs,
            });
            finalText.push(
              `[Calling tool ${toolName} with args ${JSON.stringify(toolArgs)}]`
            );
      
            messages.push({
              role: "user",
              content: result.content as MessageParam["content"],
            });
      
            const response = await this.anthropic.messages.create({
              model: "claude-sonnet-4-20250514",
              max_tokens: 1000,
              messages,
            });
      
            finalText.push(
              response.content[0].type === "text" ? response.content[0].text : ""
            );
          }
        }
      
        return finalText.join("\n");
      }

      async chatLoop() {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
      
        try {
          console.log("\nMCP Client Started!");
          console.log("Type your queries or 'quit' to exit.");
      
          while (true) {
            const message = await rl.question("\nQuery: ");
            if (message.toLowerCase() === "quit") {
              break;
            }
            const response = await this.processQuery(message);
            console.log("\n" + response);
          }
        } finally {
          rl.close();
        }
      }
      
      async cleanup() {
        await this.mcp.close();
      }
}

async function main() {
    if (process.argv.length < 3) {
      console.log("Usage: node build/index.js <server_url_or_script>");
      console.log("  URL:  node build/index.js https://subwayinfo.nyc/mcp");
      console.log("  Stdio: node build/index.js ./path/to/server.js");
      return;
    }
    const mcpClient = new MCPClient();
    try {
      await mcpClient.connectToServer(process.argv[2]);
      await mcpClient.chatLoop();
    } catch (e) {
      console.error("Error:", e);
      await mcpClient.cleanup();
      process.exit(1);
    } finally {
      await mcpClient.cleanup();
      process.exit(0);
    }
  }
  
  main();