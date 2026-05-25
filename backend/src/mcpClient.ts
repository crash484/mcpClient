import { Anthropic } from "@anthropic-ai/sdk";
import type { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages/index.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

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

  constructor(apiKey: string) {
    this.anthropic = new Anthropic({ apiKey });

    this.mcp = new Client({
      name: "MCPClient",
      version: "1.0.0",
    });
  }

  async connectToServer(target: string) {
    if (isHttpUrl(target)) {
      await this.connectViaHttp(target);
    } else {
      await this.connectViaStdio(target);
    }

    await this.loadTools();
  }

  private async connectViaStdio(serverScriptPath: string) {
    const isJs = serverScriptPath.endsWith(".js");
    const isPy = serverScriptPath.endsWith(".py");

    if (!isJs && !isPy) {
      throw new Error("Server must be .js or .py file");
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
      this.transport = new StreamableHTTPClientTransport(baseUrl);
      await this.mcp.connect(this.transport);
    } catch {
      this.transport = new SSEClientTransport(baseUrl);
      await this.mcp.connect(this.transport);
    }
  }

  private async loadTools() {
    const result = await this.mcp.listTools();

    this.tools = result.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));

    console.log("Connected tools:", this.tools.map((t) => t.name));
  }

  async processQuery(query: string): Promise<string> {
    const messages: MessageParam[] = [
      { role: "user", content: query },
    ];

    while (true) {
      const response = await this.anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages,
        tools: this.tools,
      });

      const output: string[] = [];
      let toolUsed = false;

      for (const block of response.content) {
        if (block.type === "text") {
          output.push(block.text);
        }

        if (block.type === "tool_use") {
          toolUsed = true;

          const toolResult = await this.mcp.callTool({
            name: block.name,
            arguments: block.input as any,
          });

          const toolText = Array.isArray(toolResult.content)
            ? toolResult.content
                .map((c: any) => (c.type === "text" ? c.text : ""))
                .join("\n")
            : String(toolResult.content);

          // IMPORTANT: feed tool result back properly
          messages.push({
            role: "assistant",
            content: [
              {
                type: "tool_use",
                id: block.id,
                name: block.name,
                input: block.input,
              },
            ],
          });

          messages.push({
            role: "user",
            content: toolText,
          });
        }
      }

      if (!toolUsed) {
        return output.join("\n");
      }
    }
  }

  async cleanup() {
    await this.mcp.close();
  }
}