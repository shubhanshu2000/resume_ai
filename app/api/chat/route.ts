import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";

export const maxDuration = 30;

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta",
});

export async function POST(req: Request) {
  try {
    const { messages, extractedText } = await req.json();

    if (extractedText) {
      messages.push({ role: "user", content: extractedText });
    }

    const result = streamText({
      model: google("gemini-2.0-flash"),
      messages,
    });

    return result.toDataStreamResponse();
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
