import { Request } from 'express';
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createSupabaseClient } from '../helpers/supabaseClientHelpers';
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import 'dotenv/config';

// Formats the retrieved docs into a single string to inject into the prompt
function formatDocs(docs: { pageContent: string }[]): string {
    return docs.map(doc => doc.pageContent).join('\n\n---\n\n');
}

export async function queryDocuments(req: Request) {
    try {
        const { question } = req.body;

        if (!question) {
            return { ok: false, error: 'Missing question in request body' };
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

        // Retrieve the 5 most relevant chunks for the question
        const retriever = vectorStore.asRetriever(5);

        const llm = new ChatGoogleGenerativeAI({
            apiKey: process.env.GEMINI_API_KEY,
            model: "gemini-1.5-flash",
            temperature: 0.3,
        });

        const prompt = PromptTemplate.fromTemplate(`
You are a helpful assistant that answers questions based on YouTube video transcripts.
Use ONLY the context below to answer. If the answer isn't in the context, say so clearly.

Context:
{context}

Question: {question}

Answer:`);

        // Build a simple RAG chain: retrieve -> format -> prompt -> LLM -> parse
        const ragChain = RunnableSequence.from([
            {
                context: retriever.pipe(formatDocs),
                question: new RunnablePassthrough(),
            },
            prompt,
            llm,
            new StringOutputParser(),
        ]);

        const answer = await ragChain.invoke(question);

        return { ok: true, question, answer };

    } catch (error) {
        console.error(error);
        return { ok: false, error: String(error) };
    }
}