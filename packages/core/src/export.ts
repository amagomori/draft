import { AlignmentType, Document, HeadingLevel, Packer, Paragraph as DocParagraph, TextRun } from "docx";
import PDFDocument from "pdfkit";
import type { ExportFormat, Post } from "./types.ts";

export const EXTENSIONS: Record<ExportFormat, string> = { markdown: "md", docx: "docx", pdf: "pdf" };

export function fileName(post: Post, format: ExportFormat): string {
  const slug = post.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "post";
  return `${slug}.${EXTENSIONS[format]}`;
}

export function toMarkdown(post: Post): string {
  return [`# ${post.title}`, ...post.paragraphs.map((p) => p.text)].join("\n\n") + "\n";
}

async function toDocx(post: Post): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          new DocParagraph({ text: post.title, heading: HeadingLevel.TITLE, alignment: AlignmentType.LEFT }),
          ...post.paragraphs.map((p) => new DocParagraph({ children: [new TextRun({ text: p.text, size: 24 })], spacing: { after: 200, line: 360 } })),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

function toPdf(post: Post): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margins: { top: 72, bottom: 72, left: 72, right: 72 }, info: { Title: post.title } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.font("Helvetica-Bold").fontSize(24).text(post.title, { lineGap: 4 });
    doc.moveDown(1);
    doc.font("Helvetica").fontSize(12);
    for (const p of post.paragraphs) {
      doc.text(p.text, { lineGap: 5, align: "left" });
      doc.moveDown(0.8);
    }
    doc.end();
  });
}

export async function exportPost(post: Post, format: ExportFormat): Promise<Buffer> {
  if (format === "markdown") return Buffer.from(toMarkdown(post), "utf8");
  if (format === "docx") return toDocx(post);
  return toPdf(post);
}
