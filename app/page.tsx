"use client";

import { Thread } from "@/components/assistant-ui/thread";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import {
  AssistantRuntimeProvider,
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  AttachmentAdapter,
  INTERNAL,
} from "@assistant-ui/react";
import { ThreadList } from "@/components/assistant-ui/thread-list";
import { toast } from "sonner";
import * as pdfjs from "pdfjs-dist";
import mammoth from "mammoth";

const { generateId } = INTERNAL;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString(); // Function to extract text from a PDF file

async function extractTextFromPDF(file: File) {
  const reader = new FileReader();
  return new Promise<string>((resolve, reject) => {
    reader.onload = async () => {
      try {
        const typedArray = new Uint8Array(reader.result as ArrayBuffer);
        const pdf = await pdfjs.getDocument({ data: typedArray }).promise;
        let extractedText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          extractedText +=
            textContent.items.map((item) => (item as any).str).join(" ") + "\n";
        }

        resolve(extractedText);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

// Function to extract text from a DOCX file
async function extractTextFromDocx(file: File) {
  const reader = new FileReader();
  return new Promise<string>((resolve, reject) => {
    reader.onload = async () => {
      try {
        const text = await mammoth.extractRawText({
          arrayBuffer: reader.result as ArrayBuffer,
        });
        resolve(text.value);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

const customFileAttachmentAdapter: AttachmentAdapter = {
  accept:
    "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/*",

  async add({ file }) {
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
      throw new Error(
        `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`
      );
    }

    return {
      id: generateId(),
      file,
      type: "file",
      name: file.name,
      contentType: file.type,
      status: { type: "requires-action", reason: "composer-send" },
    };
  },

  async send(attachment) {
    try {
      let extractedText = "";

      if (attachment.file.type === "application/pdf") {
        extractedText = await extractTextFromPDF(attachment.file);
      } else if (
        attachment.file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        extractedText = await extractTextFromDocx(attachment.file);
      }

      return {
        ...attachment,
        content: [{ type: "text", text: extractedText }],
        status: { type: "complete" },
      };
    } catch (error: any) {
      console.error("File processing error:", error);
      toast.error("Failed to extract text");
      throw new Error(`Failed to process file: ${error.message}`);
    }
  },

  async remove(attachment) {
    console.log(`Removing attachment: ${attachment.name}`);
  },
};

export default function Home() {
  const runtime = useChatRuntime({
    api: "/api/chat",
    adapters: {
      attachments: new CompositeAttachmentAdapter([
        new SimpleImageAttachmentAdapter(),
        customFileAttachmentAdapter,
      ]),
    },
    onError: (error) => {
      console.error("Chat error details:", error);
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <main className="h-dvh grid grid-cols-[200px_1fr] gap-x-2 px-4 py-4">
        <ThreadList />
        <Thread />
      </main>
    </AssistantRuntimeProvider>
  );
}
