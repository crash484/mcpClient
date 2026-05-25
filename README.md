# MCP Client

A TypeScript-based client for connecting to Model Context Protocol (MCP) servers and routing queries through the Anthropic API.

## Prerequisites

- Node.js (v18+ recommended)
- npm
- An Anthropic API key

## Installation

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Configure environment variables by creating a `.env` file in the project root:

   ```bash
   ANTHROPIC_API_KEY=your_api_key_here
   ```

## Build

Compile the TypeScript source into `build/`:

```bash
npm run build
```

## Run Locally

Start the client by passing either an MCP server URL (HTTP/S) or a local MCP server script path:

```bash
node build/index.js <server_url_or_script>
```

### Examples

```bash
# Connect to an HTTP/S MCP server
node build/index.js https://subwayinfo.nyc/mcp

# Connect to a local MCP server over stdio
node build/index.js ./path/to/server.js
node build/index.js ./path/to/server.py
```

## Usage

Once running, type your queries into the prompt. Type `quit` to exit.

## Notes

- Local stdio servers must be `.js` or `.py` files.
- HTTP connections try Streamable HTTP first, then fall back to HTTP+SSE.

## Tests

```bash
npm test
```

> The current test script is a placeholder and returns a non-zero exit code.
