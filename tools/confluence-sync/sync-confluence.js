import axios from "axios";
import TurndownService from "turndown";
import fs from "fs-extra";
import path from "path";
import yaml from "js-yaml";
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

// 👉 docs/ está en la raíz del repo
const DOCS_DIR = path.resolve(__dirname, "../../docs");
const MKDOCS_PATH = path.resolve(__dirname, "../../mkdocs.yml");

async function run() {
  console.log("🔄 Obteniendo páginas de Confluence...");

  const { data } = await api.get(
    `/content?spaceKey=${spaceKey}&type=page&expand=body.storage&limit=50`
  );

  // Limpia docs/ antes de volver a generar
  await fs.ensureDir(DOCS_DIR);
  await fs.emptyDir(DOCS_DIR);

  const pagesIndex = [];

  for (const page of data.results) {
    const html = page.body.storage.value;
    const markdown = turndown.turndown(html);

    const fileName = page.title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]/gi, "")
      .replace(/\s+/g, "-")
      .toLowerCase();

    const filePath = path.join(DOCS_DIR, `${fileName}.md`);

    await fs.outputFile(filePath, `# ${page.title}\n\n${markdown}`, "utf8");

    pagesIndex.push({
      title: page.title,
      file: `${fileName}.md`,
    });

    console.log(`✅ ${page.title}`);
  }

  // ==============================
  // Generar index.md automáticamente
  // ==============================

  const indexContent = `# Confluence Docs

Esta documentación se sincroniza automáticamente desde Confluence.

## 📚 Páginas disponibles

${pagesIndex.map((p) => `- [${p.title}](${p.file})`).join("\n")}
`;

  await fs.outputFile(path.join(DOCS_DIR, "index.md"), indexContent, "utf8");

  // ==============================
  // Generar mkdocs.yml automáticamente
  // ==============================

  const files = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith(".md"));

  const nav = [
    { Home: "index.md" },
    ...files
      .filter((f) => f !== "index.md")
      .map((file) => ({
        [file
          .replace(".md", "")
          .replace(/-/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase())]: file,
      })),
  ];

  const mkdocs = {
    site_name: "Confluence Docs",
    docs_dir: "docs",
    nav,
  };

  await fs.writeFile(MKDOCS_PATH, yaml.dump(mkdocs), "utf8");

  console.log("📘 mkdocs.yml generado automáticamente");
  console.log("🏠 index.md generado automáticamente");
  console.log("🎉 Sincronización completa");
}

run().catch((err) => {
  console.error("❌ Error:", err.message);
});
