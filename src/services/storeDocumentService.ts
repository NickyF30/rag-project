import { Request } from 'express';
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { createSupabaseClient } from '../helpers/supabaseClientHelpers';
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { YoutubeTranscript } from 'youtube-transcript';
import { Document } from "@langchain/core/documents";
import 'dotenv/config';

export async function storeDocument(req: Request) {
    try {
        const { url } = req.body;

        if (!url) {
            return { ok: false, error: 'Missing YouTube URL in request body' };
        }

        const supabase = createSupabaseClient();

        // 1. Initialize Embeddings
        const embeddings = new GoogleGenerativeAIEmbeddings({
            apiKey: process.env.GEMINI_API_KEY,
            model: "gemini-embedding-2-preview",
            maxConcurrency: 1, 
            maxRetries: 3,     
        });

        // 2. DEBUG TEST: Let's force Gemini to embed a single word
        console.log("Testing Gemini API connection...");
        if (!process.env.GEMINI_API_KEY) {
             throw new Error("GEMINI_API_KEY is undefined! Check your .env file.");
        }
        
        try {
            const testEmbed = await embeddings.embedQuery("Hello");
            console.log(`Gemini test successful! Vector dimension: ${testEmbed.length}`);
            if (testEmbed.length === 0) {
                throw new Error("Gemini returned an empty array for a simple test string.");
            }
        } catch (apiError) {
            console.error("🔥 GEMINI API ERROR:", apiError);
            return { ok: false, error: `Gemini API failed: ${String(apiError)}` };
        }

        // 3. Initialize Vector Store
        const vectorStore = new SupabaseVectorStore(embeddings, {
            client: supabase,
            tableName: 'embedded_documents',
            queryName: 'match_documents',
        });

        // 4. Fetch Transcript
        // 4. Fetch Transcript
        // Extract the 11-character Video ID safely
        const videoIdMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
        const videoId = videoIdMatch ? videoIdMatch[1] : url;
        
        console.log(`Fetching transcript for Video ID: ${videoId}`);
        const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);

        const fullText = transcriptItems.map(t => t.text).join(' ');
        console.log('Full text length:', fullText.length);

        const docs = [new Document({
            pageContent: fullText,
            metadata: { source: url },
        })];

        // 5. Split Transcript into Chunks
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });

        const splitDocs = await splitter.splitDocuments(docs);
        
        // 6. FILTER: Remove any empty or whitespace-only chunks to prevent 0-dimension vectors
        const finalDocs = (splitDocs.length > 0 ? splitDocs : docs)
            .filter(doc => doc.pageContent.trim().length > 0);

        if (finalDocs.length === 0) {
            return { ok: false, error: 'No valid text chunks found in transcript.' };
        }

        console.log(`Storing ${finalDocs.length} valid chunks from: ${url}`);

        // 7. STORE: Try batch insert, fallback to sequential if payload is too large
        try {
            await vectorStore.addDocuments(finalDocs);
        } catch (supabaseError) {
            console.log("Batch insert failed, attempting sequential insert...", supabaseError);
            
            let chunksStored = 0;
            for (const doc of finalDocs) {
                await vectorStore.addDocuments([doc]);
                chunksStored++;
                // Add a small delay between inserts to prevent rate limits
                await new Promise(resolve => setTimeout(resolve, 500)); 
            }
            return { ok: true, chunksStored, note: "Stored sequentially" };
        }

        return { ok: true, chunksStored: finalDocs.length };

    } catch (error) {
        console.error("General Error:", error);
        return { ok: false, error: String(error) };
    }
}