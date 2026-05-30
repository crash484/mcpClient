## Start the Backend (Node + MCP + Express)

Step 1: Go to backend
cd backend

Step 2: Install dependencies
npm install

Step 3: Build TypeScript
npm run build

This creates:

backend/dist/

Step 4: Start backend server
npm start

You should see:

Backend running on port 4000
🌐 2. Start the Frontend (Streamlit)

Open a new terminal

Step 1: Go to frontend
cd frontend

Step 2: Install Python dependencies
pip install -r requirements.txt

Step 3: Run Streamlit app
streamlit run app.py

🔗 3. How the system works
Frontend (Streamlit)
   ↓ HTTP request
Backend (Express :4000)
   ↓ MCP Client + Claude
MCP Server (NYC Subway API)
   ↓
Response back to frontend
⚠️ 4. Important things to check if it fails
❌ Backend not responding

Make sure:

http://localhost:4000/chat

is running.

❌ Anthropic API error

Make sure backend has .env file:

backend/.env

with:

ANTHROPIC_API_KEY=your_key_here
❌ Streamlit cannot connect

Check this in app.py:

BACKEND_URL = "http://localhost:4000/chat"
❌ MCP tool not working

Check backend console for:

tool connection logs
MCP server connection errors
🧠 Final run order (always follow this)
1️⃣ Backend
cd backend
npm install
npm run build
npm start

2️⃣ Frontend
cd frontend
pip install -r requirements.txt
streamlit run app.py
👍 If everything is correct

You should get:

Streamlit UI opens in browser
You type a question
Backend processes via MCP
Claude responds with tool usage
Answer appears in chat

