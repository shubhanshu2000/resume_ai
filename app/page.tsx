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

const { generateId } = INTERNAL;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit

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
      const formData = new FormData();
      formData.append("file", attachment.file);

      const response = await fetch("/api/extract-text", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to extract text");

      const { text } = await response.json();

      return {
        ...attachment,
        content: [{ type: "text", text }],
        status: { type: "complete" },
      };
    } catch (error: any) {
      console.error("File processing error:", error);
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
