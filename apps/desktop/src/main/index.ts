import { app, BrowserWindow, clipboard, dialog, ipcMain } from "electron";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  agentConnected,
  createPost,
  dataVersion,
  deletePost,
  exportPost,
  fileName,
  getPost,
  listPosts,
  loadEnv,
  requirePost,
  scorePost,
  setAnswer,
  setNotes,
  setTitle,
  updateParagraph,
  type ExportFormat,
} from "@draft/core";

declare const __DRAFT_REPO__: string;

const repoRoot = process.env.DRAFT_REPO ?? (app.isPackaged ? __DRAFT_REPO__ : resolve(app.getAppPath(), "..", ".."));
loadEnv([repoRoot]);

function connectCommand(postId: number): string {
  const entry = join(repoRoot, "mcp", "src", "index.ts");
  return `node "${entry}" --post ${postId}`;
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: "Draft",
    backgroundColor: "#EFEFE4",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 26 },
    show: false,
    webPreferences: { preload: join(__dirname, "../preload/index.js"), sandbox: false },
  });
  win.once("ready-to-show", () => win.show());
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL);
  else win.loadFile(join(__dirname, "../renderer/index.html"));

  const screenshot = process.env.DRAFT_SCREENSHOT;
  if (screenshot) {
    win.webContents.on("console-message", (event) => console.log(`[renderer] ${event.message}`));
    win.webContents.once("did-finish-load", () => {
      setTimeout(async () => {
        const image = await win.webContents.capturePage();
        await writeFile(screenshot, image.toPNG());
        app.quit();
      }, 2500);
    });
  }
  return win;
}

function registerIpc(): void {
  ipcMain.handle("posts:list", () => listPosts());
  ipcMain.handle("posts:get", (_e, id: number) => getPost(id));
  ipcMain.handle("posts:create", (_e, title: string, notes: string) => createPost(title, notes));
  ipcMain.handle("posts:delete", (_e, id: number) => deletePost(id));
  ipcMain.handle("posts:setTitle", (_e, id: number, title: string) => setTitle(id, title));
  ipcMain.handle("posts:setNotes", (_e, id: number, notes: string) => setNotes(id, notes));
  ipcMain.handle("posts:score", (_e, id: number) => scorePost(id));
  ipcMain.handle("paragraphs:update", (_e, postId: number, paragraphId: number, text: string) =>
    updateParagraph(postId, paragraphId, text, "human"),
  );
  ipcMain.handle("paragraphs:answer", (_e, postId: number, paragraphId: number, answer: string) => setAnswer(postId, paragraphId, answer));
  ipcMain.handle("agent:status", (_e, postId?: number) => agentConnected(postId));
  ipcMain.handle("agent:command", (_e, postId: number) => connectCommand(postId));
  ipcMain.handle("agent:copyCommand", (_e, postId: number) => clipboard.writeText(connectCommand(postId)));
  ipcMain.handle("integrations", () => ({ pangram: Boolean(process.env.PANGRAM_API_KEY) }));
  ipcMain.handle("posts:export", async (event, id: number, format: ExportFormat) => {
    const post = requirePost(id);
    const win = BrowserWindow.fromWebContents(event.sender);
    const options = { defaultPath: join(app.getPath("documents"), fileName(post, format)) };
    const { canceled, filePath } = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
    if (canceled || !filePath) return null;
    await writeFile(filePath, await exportPost(post, format));
    return filePath;
  });
}

function watchDatabase(): void {
  let version = dataVersion();
  setInterval(() => {
    const next = dataVersion();
    if (next === version) return;
    version = next;
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send("db:changed");
  }, 1000);
}

app.setName("Draft");
app.whenReady().then(() => {
  if (process.platform === "darwin" && !app.isPackaged) app.dock?.setIcon(join(app.getAppPath(), "resources", "icon.png"));
  registerIpc();
  watchDatabase();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
