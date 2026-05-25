import express from "express";
import path from "path";

const app = express();

app.use(express.json());
app.listen(3000,()=>{
    console.log("app is running on port 3000");
});

app.get("/", (req, res) => {
    //here we will serve the frontend using express
    res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});