import { Request } from 'express';
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { createSupabaseClient } from '../helpers/supabaseClientHelpers';
import { YoutubeLoader } from "@langchain/community/document_loaders/web/youtube";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase"

export async function storeDocument(req: Request) {
    try {
        const { url } = req.body
        // Init supabase client
        const supabase = createSupabaseClient();

        // 1. Initialize the Gemini embeddings
        const embeddings = new GoogleGenerativeAIEmbeddings({
            apiKey: process.env.GEMINI_API_KEY,
            model: "text-embedding-004", 
        })

        // Initialize vector store
        const vectorStore = new SupabaseVectorStore(embeddings, {
            client: supabase,
            tableName: 'embedded_documents',
            queryName: 'match_documents'
        })

        // Load document from youtube video
        const loader = YoutubeLoader.createFromUrl(url, {
            addVideoInfo: true,
        })

        const docs = await loader.load();

        console.log(docs);

    } catch (error) {
        console.error(error);
        return { 
            ok: false 
        }
    }

    return { 
        ok: true 
    };
}