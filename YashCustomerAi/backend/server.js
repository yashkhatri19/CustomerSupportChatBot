import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initChroma } from "./chromaClient.js";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors({
    origin: ["http://localhost:5173", 
        "https://customer-support-guru19.vercel.app", 
        "https://customer-support-git-main-guru19.vercel.app"],
    credentials: true
}));
   
app.use(express.json());

let chatCollection = null; // This will hold the ChromaDB collection instance

// Initialize ChromaDB
initChroma().then((collection) => {
  chatCollection = collection;
  console.log("ChromaDB Connected Successfully!");
});

// Groq API Client Setup
const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1"
});

// 1. Endpoint to add support knowledge base data
app.post('/api/add-knowledge', async (req, res) => {
    const { id, document, metadata } = req.body;
    try {
        await chatCollection.add({
            ids: [id],
            documents: [document],
            metadatas: [metadata]
        });
        res.status(200).json({ message: "Successfully added to Vector DB!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Main Hybrid Endpoint: ChromaDB + Groq AI (RAG)
app.post('/api/query_support', async (req, res) => {
    // Note: Frontend passes 'prompt', so we destructure 'prompt'
    const { prompt } = req.body; 
    
    try {
        let context = "";

        // Step A: Search in ChromaDB
        if (chatCollection) {
            const dbResults = await chatCollection.query({
                queryTexts: [prompt],
                nResults: 2, 
            });

            // Agar database me documents milte hain toh unhe context banao
            if (dbResults.documents?.[0] && dbResults.documents[0].length > 0) {
                context = dbResults.documents[0].join("\n");
            }
        }

        // Step B: Formulate System Instructions based on context availability
        const systemInstruction = context 
            ? `You are a professional AI customer support assistant. Use the following knowledge base context to answer the user's question honestly. If the context doesn't contain the answer, use your own knowledge to help. \n\nContext:\n${context}`
            : `You are a professional AI customer support assistant. Answer the user's question directly and helpfully.`;

        // Step C: Call Groq AI (Llama Model)
        const completion = await client.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: prompt }
            ]
        });

        // Step D: Send the ultimate AI generated response back to frontend
        res.status(200).json({ 
            reply: completion.choices[0].message.content 
        });

    } catch (error) {
        console.error("Backend Error:", error);
        res.status(500).json({ reply: "AI service unavailable at the moment." });
    }
});

// Only one listen call is needed
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running smoothly on port ${PORT}`));