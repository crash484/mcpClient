import express from "express";
import path from "path";

const app = express();

app.use(express.json());
app.listen(3000,()=>{
    console.log("app is running on port 3000");
});

app.get("/", (req, res) => {
    //here we will serve the frontend using express
    res.sendFile("C:\Users\ShashwatJain\mcp\mcpClient\index.html");
});

//the intended flow is that, after accessing the frontend, 
// the mcp class will be initialized and the chatLoop will be called,
//  and the response will be displayed on the frontend but 