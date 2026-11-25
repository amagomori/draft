import { contextBridge, ipcRenderer } from "electron";
import type { ExportFormat, Post, PostSummary } from "@draft/core";

const api = {
  listPosts: (): Promise<PostSummary[]> => ipcRenderer.invoke("posts:list"),
  getPost: (id: number): Promise<Post | null> => ipcRenderer.invoke("posts:get", id),
  createPost: (title: string, notes: string): Promise<number> => ipcRenderer.invoke("posts:create", title, notes),
  deletePost: (id: number): Promise<void> => ipcRenderer.invoke("posts:delete", id),
  setTitle: (id: number, title: string): Promise<void> => ipcRenderer.invoke("posts:setTitle", id, title),
  setNotes: (id: number, notes: string): Promise<void> => ipcRenderer.invoke("posts:setNotes", id, notes),
  scorePost: (id: number): Promise<Post> => ipcRenderer.invoke("posts:score", id),
  updateParagraph: (postId: number, paragraphId: number, text: string): Promise<void> =>
    ipcRenderer.invoke("paragraphs:update", postId, paragraphId, text),
  answer: (postId: number, paragraphId: number, answer: string): Promise<void> =>
    ipcRenderer.invoke("paragraphs:answer", postId, paragraphId, answer),
  exportPost: (id: number, format: ExportFormat): Promise<string | null> => ipcRenderer.invoke("posts:export", id, format),
  agentStatus: (postId?: number): Promise<boolean> => ipcRenderer.invoke("agent:status", postId),
  agentCommand: (postId: number): Promise<string> => ipcRenderer.invoke("agent:command", postId),
  copyAgentCommand: (postId: number): Promise<void> => ipcRenderer.invoke("agent:copyCommand", postId),
  integrations: (): Promise<{ pangram: boolean }> => ipcRenderer.invoke("integrations"),
  onChange: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on("db:changed", listener);
    return () => ipcRenderer.removeListener("db:changed", listener);
  },
};

export type Api = typeof api;

contextBridge.exposeInMainWorld("api", api);
