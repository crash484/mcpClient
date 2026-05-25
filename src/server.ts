import express from "express";
import path from "path";
import { MCPClient } from "./index.ts";

// one shared client instance for the server's lifetime
// this is to avoid creating a new client instance for each request
let client: MCPClient | null = null;

const app = express();

app.use(express.json());
app.listen(3000,()=>{
    console.log("app is running on port 3000");
});

app.get("/", (req, res) => {
    //here we will serve the frontend using express
    res.sendFile(path.join(process.cwd(), "index.html"));
});

//the intended flow is that, after accessing the frontend, 
// the mcp class will be initialized and the chatLoop will be called,
//  and the response will be displayed on the frontend but 

// POST /connect  { "target": "https://..." or "./server.py" }
app.post("/connect", async (req, res) => {
    const { target } = req.body;
    if (!target) return res.status(400).json({ error: "target is required" });
  
    try {
      if (client) await client.cleanup(); // disconnect old client if any
      client = new MCPClient();
      await client.connectToServer(target);
      res.json({ ok: true, message: `Connected to ${target}` });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });
  
  // POST /query  { "query": "What tools do you have?" }
  app.post("/query", async (req, res) => {
    if (!client) return res.status(400).json({ error: "Not connected. Call /connect first." });
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: "query is required" });
  
    try {
      const response = await client.processQuery(query);
      res.json({ response });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });
  