import { Request } from 'express';
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { createSupabaseClient } from '../helpers/supabaseClientHelpers';
import { YoutubeLoader } from "@langchain/community/document_loaders/web/youtube";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import 'dotenv/config';

export async function storeDocument(req: Request) {
    try {
        const { url } = req.body;

        if (!url) {
            return { ok: false, error: 'Missing YouTube URL in request body' };
        }

        const supabase = createSupabaseClient();

        const embeddings = new GoogleGenerativeAIEmbeddings({
            apiKey: process.env.GEMINI_API_KEY,
            model: "text-embedding-004",
        });

        const vectorStore = new SupabaseVectorStore(embeddings, {
            client: supabase,
            tableName: 'embedded_documents',
            queryName: 'match_documents',
        });

        // Load transcript from YouTube video
        const loader = YoutubeLoader.createFromUrl(url, {
            addVideoInfo: true,
        });

        const docs = await loader.load();

        // Split transcript into smaller chunks so embeddings are more precise
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });

        const splitDocs = await splitter.splitDocuments(docs);

        console.log(`Storing ${splitDocs.length} chunks from: ${url}`);

        // Store embeddings in Supabase — this was missing before!
        await vectorStore.addDocuments(splitDocs);

        return { ok: true, chunksStored: splitDocs.length };

    } catch (error) {
        console.error(error);
        return { ok: false, error: String(error) };
    }
}