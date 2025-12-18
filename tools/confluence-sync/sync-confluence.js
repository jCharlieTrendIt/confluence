import axios from "axios";
import TurndownService from "turndown";
import fs from "fs-extra";
import path from "path";

import { fileURLToPath } from "url";

const email = process.env.CONFLUENCE_EMAIL;
const token = process.env.CONFLUENCE_TOKEN;

if (!email || !token) {
  console.error("❌ Faltan variables de entorno");
  process.exit(1);
}

const baseUrl = "https://trend-it-team-xt9xlqsr.atlassian.net/wiki";
const spaceKey = "Backstage";

const auth = Buffer.from(`${email}:${token}`).toString("base64");

const api = axios.create({
  baseURL: `${baseUrl}/rest/api`,
  headers: {
    Authorization: `Basic ${auth}`,
    Accept: "application/json",
  },
});

const turndown = new TurndownService();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCS_DIR = path.resolve(__dirname, "../../docs");

// const DOCS_DIR = path.resolve(process.cwd(), "../../docs");

async function run() {
  console.log("🔄 Obteniendo páginas de Confluence...");

  const { data } = await api.get(
    `/content?spaceKey=${spaceKey}&type=page&expand=body.storage&limit=50`
  );

  for (const page of data.results) {
    const html = page.body.storage.value;
    const markdown = turndown.turndown(html);

    const fileName = page.title
      .replace(/[^\w\s]/gi, "")
      .replace(/\s+/g, "-")
      .toLowerCase();

    const filePath = path.join(DOCS_DIR, `${fileName}.md`);

    await fs.outputFile(filePath, `# ${page.title}\n\n${markdown}`);

    console.log(`✅ ${page.title}`);
  }

  console.log("🎉 Sincronización completa");
}

run().catch((err) => {
  console.error("❌ Error:", err.message);
});
