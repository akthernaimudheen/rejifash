/**
 * Reji Fashions - Where uploaded photographs are kept.
 *
 * On a host with no persistent disk (Render's free plan, most container
 * platforms) the filesystem is rebuilt from the repository on every deploy and
 * every wake from idle. Photographs written there are destroyed. That is the
 * single most painful failure this project has, because it silently eats a
 * day's cataloguing work.
 *
 * Two providers:
 *
 *   local   Write to disk. Correct on a VPS or any host with a mounted volume,
 *           and correct when running on your own machine.
 *
 *   github  Commit the image straight into the repository through the GitHub
 *           API and serve it from raw.githubusercontent.com. Permanent, free,
 *           and needs no account you do not already have. The catalog is
 *           committed alongside it, so a fresh container rebuilds with both.
 *
 * The GitHub commits carry "[skip render]", which Render honours, so uploading
 * a photograph does not trigger a redeploy — a redeploy would wipe any orders
 * taken since the last one.
 */

const https = require("https");
const config = require("./config");

const API_HOST = "api.github.com";

/* ------------------------------------------------------------- github --- */

function githubRequest(method, path, body, token) {
  const payload = body ? JSON.stringify(body) : null;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: API_HOST,
        path,
        method,
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "reji-fashions",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {})
        }
      },
      res => {
        let data = "";
        res.on("data", chunk => (data += chunk));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data ? JSON.parse(data) : {});
          } else if (res.statusCode === 404) {
            resolve(null); // "does not exist yet" is a normal answer here
          } else {
            reject(new Error(`GitHub ${res.statusCode}: ${data.slice(0, 240)}`));
          }
        });
      }
    );
    req.setTimeout(20000, () => req.destroy(new Error("GitHub request timed out")));
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function githubSettings() {
  const { github } = config.load().storage;
  const [owner, repo] = String(github.repository || "").split("/");
  if (!owner || !repo) throw new Error('storage.github.repository must look like "owner/repo"');
  if (!github.token) throw new Error("A GitHub token is required to store images in the repository");
  return { owner, repo, branch: github.branch || "main", token: github.token };
}

/**
 * Create or replace a file in the repository.
 * Updating requires the blob sha of what is already there, so look first.
 */
async function githubPutFile(path, contentBase64, message) {
  const { owner, repo, branch, token } = githubSettings();
  const endpoint = `/repos/${owner}/${repo}/contents/${encodeURI(path)}`;

  const existing = await githubRequest("GET", `${endpoint}?ref=${encodeURIComponent(branch)}`, null, token);

  await githubRequest(
    "PUT",
    endpoint,
    {
      message: `${message} [skip render]`,
      content: contentBase64,
      branch,
      ...(existing && existing.sha ? { sha: existing.sha } : {})
    },
    token
  );

  // raw.githubusercontent serves the committed bytes immediately. jsDelivr is
  // faster but caches by tag, so a freshly replaced image can serve stale for
  // a while — not what you want while building a catalog.
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
}

/* --------------------------------------------------------------- api --- */

const EXT_BY_MIME = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

function decodeDataUrl(dataUrl) {
  const match = /^data:([\w/+.-]+);base64,(.+)$/s.exec(String(dataUrl || ""));
  if (!match) throw new Error("Expected a base64 data URL");
  const ext = EXT_BY_MIME[match[1].toLowerCase()];
  if (!ext) throw new Error(`Unsupported image type: ${match[1]}`);
  return { ext, base64: match[2], bytes: Buffer.from(match[2], "base64") };
}

function provider() {
  return config.load().storage.provider === "github" ? "github" : "local";
}

/**
 * Persist a processed image.
 * @returns {Promise<string>} the src to record against the product
 */
async function saveImage(dataUrl, hint, localSaver) {
  if (provider() === "local") return localSaver(dataUrl, hint);

  const { ext, base64, bytes } = decodeDataUrl(dataUrl);
  if (bytes.length > 6 * 1024 * 1024) throw new Error("Image exceeds 6 MB after processing");

  const slug = String(hint).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "product";
  const name = `${slug}-${Date.now().toString(36)}.${ext}`;
  const path = `assets/products/${name}`;

  return githubPutFile(path, base64, `Add product photograph ${name}`);
}

/**
 * Commit the catalog so a rebuilt container comes back with it. Without this
 * the images survive but nothing references them any more.
 */
async function saveCatalog(products) {
  if (provider() === "local") return null;
  const json = JSON.stringify(products, null, 2);
  return githubPutFile("catalog.json", Buffer.from(json, "utf8").toString("base64"), "Update catalog");
}

/** Cheap check that the token and repository actually work, for Settings. */
async function testConnection() {
  const { owner, repo, branch, token } = githubSettings();
  const info = await githubRequest("GET", `/repos/${owner}/${repo}`, null, token);
  if (!info) throw new Error(`Repository ${owner}/${repo} not found, or the token cannot see it`);
  if (info.permissions && !info.permissions.push) {
    throw new Error(`The token can read ${owner}/${repo} but cannot write to it`);
  }
  return { repository: info.full_name, branch, private: info.private };
}

module.exports = { provider, saveImage, saveCatalog, testConnection, decodeDataUrl };
