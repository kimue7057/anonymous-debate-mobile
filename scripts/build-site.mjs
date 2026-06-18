import { access, cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const distRoot = path.join(root, "dist");
const clientRoot = path.join(distRoot, "client");
const serverRoot = path.join(distRoot, "server");
const metadataRoot = path.join(distRoot, ".openai");

const rootFiles = [
  ".nojekyll",
  "index.html",
  "styles.css",
  "app.js",
  "supabaseClient.js",
];

const rootDirectories = ["admin", "public"];

const serverEntry = `const PLAIN_TEXT_HEADERS = {
  "content-type": "text/plain; charset=utf-8",
};

function hasExtension(pathname) {
  return /\\.[^/]+$/.test(pathname);
}

function assetCandidates(pathname) {
  if (!pathname || pathname === "/") {
    return ["/index.html"];
  }

  if (pathname.endsWith("/")) {
    return [pathname + "index.html"];
  }

  if (hasExtension(pathname)) {
    return [pathname];
  }

  return [pathname + "/index.html", pathname + ".html", pathname];
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    for (const pathname of assetCandidates(url.pathname)) {
      const assetUrl = new URL(request.url);
      assetUrl.pathname = pathname;
      const response = await env.ASSETS.fetch(new Request(assetUrl, request));
      if (response.status !== 404) {
        return response;
      }
    }

    return new Response("Not Found", {
      status: 404,
      headers: PLAIN_TEXT_HEADERS,
    });
  },
};
`;

async function exists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function copyIfPresent(relativePath) {
  const source = path.join(root, relativePath);
  if (!(await exists(source))) {
    return;
  }

  const destination = path.join(clientRoot, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true, force: true });
}

async function main() {
  await rm(distRoot, { recursive: true, force: true });
  await mkdir(clientRoot, { recursive: true });
  await mkdir(serverRoot, { recursive: true });
  await mkdir(metadataRoot, { recursive: true });

  for (const relativePath of rootFiles) {
    await copyIfPresent(relativePath);
  }

  for (const relativePath of rootDirectories) {
    await copyIfPresent(relativePath);
  }

  await cp(
    path.join(root, ".openai", "hosting.json"),
    path.join(metadataRoot, "hosting.json"),
    { force: true },
  );

  await writeFile(path.join(serverRoot, "index.js"), serverEntry, "utf8");
}

await main();
