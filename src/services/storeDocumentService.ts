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

        const embeddings = new GoogleGenerativeAIEmbeddings({
            apiKey: process.env.GEMINI_API_KEY,
            model: "text-embedding-004",
        });

        const vectorStore = new SupabaseVectorStore(embeddings, {
            client: supabase,
            tableName: 'embedded_documents',
            queryName: 'match_documents',
        });

        const transcriptItems = await YoutubeTranscript.fetchTranscript(url);
        console.log('Transcript items:', transcriptItems.length);
        console.log('Sample:', transcriptItems.slice(0, 2));

        const fullText = transcriptItems.map(t => t.text).join(' ');
        console.log('Full text length:', fullText.length);

        const docs = [new Document({
            pageContent: fullText,
            metadata: { source: url },
        })];

        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });

        const splitDocs = await splitter.splitDocuments(docs);
        const finalDocs = splitDocs.length > 0 ? splitDocs : docs;

        console.log(`Storing ${finalDocs.length} chunks from: ${url}`);

        await vectorStore.addDocuments(finalDocs);

        return { ok: true, chunksStored: finalDocs.length };

    } catch (error) {
        console.error(error);
        return { ok: false, error: String(error) };
    }
}