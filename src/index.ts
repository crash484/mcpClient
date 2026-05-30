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
          system: "You are a helpful, friendly assistant. Respond in a conversational and warm tone — like a knowledgeable friend, not a robotic assistant. Be concise but thorough, and always aim to actually solve the user's problem.",
          messages,
          tools: this.tools,
        });
       console.log(response); /*==>
          {
            model: 'claude-haiku-4-5-20251001',
            id: 'msg_015d9A83bw8soMcr7bxE2svu',
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: "I can show you one of the available tools. Here's an example of a useful one:\n" +
                  '\n' +
                  '**`mta_get_arrivals`** - Get upcoming train arrivals at a subway station\n' +
                  '\n' +
                  'This tool lets you check when the next trains are arriving at any NYC subway station. You can:\n' +
                  '- Specify a station by name or ID (e.g., "Times Square", "Grand Central", "14th Street")\n' +
                  '- Filter by a specific subway line (e.g., "1", "A", "F")\n' +
                  '- Filter by direction (N for uptown/Bronx-bound, S for downtown/Brooklyn-bound)\n' +
                  '- Set how many upcoming arrivals to see (up to 100)\n' +
                  '\n' +
                  '**Example usage:** If you asked "When is the next train at Times Square?", I could use this tool to show you the upcoming arrivals for all lines at that station.\n' +
                  '\n' +
                  'Would you like me to use this tool to check train arrivals somewhere, or would you like to see a different tool?'        
              }
            ],
            stop_reason: 'end_turn',
            stop_sequence: null,
            stop_details: null,
            usage: {
              input_tokens: 4967,
              cache_creation_input_tokens: 0,
              cache_read_input_tokens: 0,
              cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 0 },
              output_tokens: 220,
              service_tier: 'standard',
              inference_geo: 'not_available'
            }
          }
       ; */ 
        const finalText = [];
      
        //to take only the usefull response
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
        const formatted =  await formatResponse(finalText);
        console.log(formatted)
        if(formatted) return formatted;
      }

      //important only for cli
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

  //to do
  //1. intialize and place llm so ur talking llm
  //2. takes query and uses same processQuery function
  // treat processQuery only for the mcpclient feature, basically im giving the mcp client which is another llm basically?
  //3?. but when model is being is called
  
  main();


  //format function
  function formatResponse(parts: string[]): string {
    const text = parts.join("\n");
  
    const toolRegex = /\*\*`(.+?)`\*\*\s*-\s*([^\n*-][^\n*]*)/g;
    const tools: { name: string; desc: string }[] = [];
    let match;
    while ((match = toolRegex.exec(text)) !== null) {
      tools.push({ name: match[1], desc: match[2].trim() });
    }
  
    const exampleRegex = /- "(.+?)"/g;
    const examples: string[] = [];
    let exMatch;
    while ((exMatch = exampleRegex.exec(text)) !== null) {
      examples.push(exMatch[1]);
    }
  
    const intro = text.match(/^(.+?)(?=\*\*`)/s)?.[1]?.trim() ?? '';
    const outro = text.match(/(?:Did you|Would you|Can I).+\?$/)?.[0]?.trim() ?? '';
  
    // if no markdown patterns found, return plain text as-is
    if (tools.length === 0 && examples.length === 0) {
      return text.trim();
    }
  
    const lines: string[] = [];
  
    if (intro) lines.push(intro);
  
    tools.forEach((tool, i) => {
      lines.push(`\n🔧 ${tool.name}`);
      lines.push(`   ${tool.desc}`);
      if (i === 0 && examples.length > 0) {
        lines.push(`\n   Examples:`);
        examples.forEach(ex => lines.push(`   • "${ex}"`));
      }
    });
  
    if (outro) lines.push(`\n${outro}`);
  
    return lines.join("\n");
  }