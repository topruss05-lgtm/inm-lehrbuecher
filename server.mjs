// ═══════════════════════════════════════════════════════════════════
// DocBook 5 Live Preview Server
// Zero dependencies – Node.js built-ins only
// ═══════════════════════════════════════════════════════════════════

import { createServer } from "node:http";
import { watch, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

const ROOT = resolve(import.meta.dirname);
const BUILD_DIR = join(ROOT, "build");
const XSL = join(ROOT, "docbook2html.xsl");
const BOOK = join(ROOT, "book.xml");
const OUTPUT = join(BUILD_DIR, "index.html");
const PORT = parseInt(process.env.PORT || "3000", 10);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

// ─── WebSocket Client Script (injected into HTML) ──────────────
const WS_CLIENT = `<script>
(function() {
  function connect() {
    var ws = new WebSocket("ws://" + location.host + "/ws");
    ws.onmessage = function(e) {
      if (e.data === "reload") location.reload();
    };
    ws.onclose = function() {
      setTimeout(connect, 1000);
    };
  }
  connect();
})();
</script>`;

// ─── Build ─────────────────────────────────────────────────────
function build() {
  try {
    if (!existsSync(BUILD_DIR)) mkdirSync(BUILD_DIR, { recursive: true });
    execSync(
      `/usr/bin/xsltproc --xinclude -o "${OUTPUT}" "${XSL}" "${BOOK}"`,
      { cwd: ROOT, timeout: 15000, stdio: "pipe" }
    );
    const now = new Date().toLocaleTimeString("de-DE");
    console.log(`\x1b[32m[${now}]\x1b[0m Build OK`);
    return true;
  } catch (err) {
    const now = new Date().toLocaleTimeString("de-DE");
    console.error(`\x1b[31m[${now}]\x1b[0m Build FEHLER:`, err.stderr?.toString() || err.message);
    return false;
  }
}

// ─── WebSocket (raw, minimal) ──────────────────────────────────
const WS_MAGIC = "258EAFA5-E914-47DA-95CA-5AB9F64F3A2E";
const clients = new Set();

function wsAccept(req, socket) {
  const key = req.headers["sec-websocket-key"];
  if (!key) { socket.destroy(); return; }
  const accept = createHash("sha1").update(key + WS_MAGIC).digest("base64");
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
    "Upgrade: websocket\r\n" +
    "Connection: Upgrade\r\n" +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );
  clients.add(socket);
  socket.on("close", () => clients.delete(socket));
  socket.on("error", () => clients.delete(socket));
}

function notifyReload() {
  // WebSocket text frame: opcode 0x81, payload "reload" (6 bytes)
  const payload = Buffer.from("reload");
  const frame = Buffer.alloc(2 + payload.length);
  frame[0] = 0x81;
  frame[1] = payload.length;
  payload.copy(frame, 2);
  for (const s of clients) {
    try { s.write(frame); } catch { clients.delete(s); }
  }
}

// ─── HTTP Server ───────────────────────────────────────────────
const server = createServer((req, res) => {
  let filePath;
  const url = req.url.split("?")[0];

  if (url === "/" || url === "/index.html") {
    filePath = OUTPUT;
  } else if (url === "/style.css") {
    filePath = join(ROOT, "style.css");
  } else {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  let content = readFileSync(filePath, "utf-8");
  const ext = extname(filePath);

  // Inject WebSocket client into HTML
  if (ext === ".html") {
    content = content.replace("</body>", WS_CLIENT + "\n</body>");
  }

  res.writeHead(200, { "Content-Type": MIME[ext] || "text/plain" });
  res.end(content);
});

server.on("upgrade", (req, socket) => {
  if (req.url === "/ws") {
    wsAccept(req, socket);
  } else {
    socket.destroy();
  }
});

// ─── File Watcher ──────────────────────────────────────────────
let rebuildTimer = null;

watch(ROOT, { recursive: true }, (event, filename) => {
  if (!filename) return;
  // Only react to XML and XSL changes, ignore build/ output
  if (!filename.endsWith(".xml") && !filename.endsWith(".xsl")) return;
  if (filename.startsWith("build")) return;

  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => {
    if (build()) notifyReload();
  }, 300);
});

// ─── Startup ───────────────────────────────────────────────────
console.log("Building...");
build();

server.listen(PORT, () => {
  console.log(`\n  \x1b[1mDynamik Mechanischer Systeme – Live Preview\x1b[0m`);
  console.log(`  \x1b[36mhttp://localhost:${PORT}\x1b[0m\n`);
  console.log("  Watching for XML changes...\n");
});
