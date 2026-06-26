import { ChromaClient } from "chromadb";

// If running ChromaDB locally via Docker, it defaults to http://localhost:8000
const chroma = new ChromaClient({ path: "http://localhost:8000" });

export async function initChroma() {
    try {
        // Create or get a collection to store your support data/chat history
        const collection = await chroma.getOrCreateCollection({
            name: "customer_support_docs",
        });
        console.log("Successfully connected to ChromaDB Collection!");
        return collection;
    } catch (error) {
        console.error("Failed to connect to ChromaDB:", error);
    }
}

export default chroma;