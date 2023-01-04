import { Server, createServer, IncomingMessage, ServerResponse } from "node:http";
import { join, extname } from "node:path";
import { stat, readFile } from "node:fs/promises";
import { createReadStream, Stats, statSync } from "node:fs";
import { FSWatcher, watch } from "chokidar";

type Request = IncomingMessage;
type Response = ServerResponse<Request>;

let mimeTypesByExtension: Record<string, string> = {
  ".aac": "audio/aac",
  ".avif": "image/avif",
  ".avi": "video/x-msvideo",
  ".bin": "application/octet-stream",
  ".bmp": "image/bmp",
  ".css": "text/css",
  ".csv": "text/csv",
  ".gz": "application/gzip",
  ".gif": "image/gif",
  ".html": "text/html",
  ".ico": "image/vnd.microsoft.icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript",
  ".json": "application/json",
  ".mjs": "text/javascript",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".mpeg": "video/mpeg",
  ".oga": "audio/ogg",
  ".ogv": "video/ogg",
  ".ogx": "application/ogg",
  ".opus": "audio/opus",
  ".otf": "font/otf",
  ".png": "image/png",
  ".pdf": "application/pdf",
  ".rtf": "application/rtf",
  ".sh": "application/x-sh",
  ".svg": "image/svg+xml",
  ".tar": "application/x-tar",
  ".tiff": "image/tiff",
  ".ttf": "font/ttf",
  ".txt": "text/plain",
  ".wasm": "application/wasm",
  ".wav": "audio/wav",
  ".weba": "audio/webm",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
  ".zip": "application/zip",
  ".7z": "application/x-7z-compressed"
};

/**
 * Handle errors resulting from an fs.stat call.
 */
function handleStatError(err: any, res: Response) {
  if (err.code === "ENOENT") {
    res.statusCode = 404;
    res.statusMessage = "Not found";
    res.end();
    return;
  } else {
    res.statusCode = 500;
    res.statusMessage = "Internal server error";
    res.end();
    console.error(err);
    return;
  }
}

/**
 * Serves a static file, given a request URL.
 * @param dir The directory to try serving from.
 */
async function serveStaticFile(
  dir: string,
  req: Request,
  res: Response,
): Promise<void> {
  let file = join(dir, req.url || "/");
  let stats: Stats;

  try {
    stats = await stat(file);
  } catch (err: any) {
    return handleStatError(err, res);
  }

  if (stats.isDirectory()) {
    file = join(file, "index.html");

    try {
      stats = await stat(file);
    } catch (err: any) {
      return handleStatError(err, res);
    }
  }

  let extension = extname(file);

  res.writeHead(200, {
    "Content-type": mimeTypesByExtension[extension] || "text/plain",
  });

  if (extension === ".html") {
    let contents = await readFileAndInjectReloadingScripts(file);
    res.write(contents);
    res.end();
  } else {
    createReadStream(file).pipe(res);
  }
}

/**
 * Serve an HTML file and inject the client side JS required for live reloading.
 * @param file The path to the file.
 */
async function readFileAndInjectReloadingScripts(file: string): Promise<string> {
  let contents = await readFile(file, "utf8");
  let script = `<script defer>new EventSource("/livereload").onmessage = () => location.reload();</script>`;

  return contents.replace(
    /(<\/body>|<\/head>|<script>)/,
    (_, tag) => `${script}${tag}`,
  );
}

let clients: Response[] = [];

/**
 * Handle requests 
 */
function registerReloadClient(req: Request, res: Response) {
  clients.push(res);

  res.writeHead(200, {
    "Content-type": "text/event-stream",
    "Connection": "keep-alive",
    "Cache-control": "no-cache",
  });

  req.on("close", () => {
    clients = clients.filter(client => client !== res);
  });
}

let lastRefresh = 0;
let debounceTimer = 500;

/**
 * Refresh all connected clients (assume a page has been updated). This
 * function is debounced so that there is at least N ms between refreshes.
 */
function refreshClients() {
  let now = performance.now();
  let delta = now - lastRefresh;
  if (delta < debounceTimer) return;
  lastRefresh = now;

  for (let client of clients) {
    client.write("data:reload\n\n");
  }
}

export interface LiveReloadServer {
  httpServer: Server;
  watcher: FSWatcher;
  close(): void;
}

interface LiveReloadServerParams {
  dir: string,
  port: number,
  reloadInterval?: number;
}

/**
 * @param dir The directory to serve.
 * @param port The port to serve on.
 * @param handler A handler object with callbacks for various events.
 */
export function createLiveReloadServer({
  dir,
  port,
  reloadInterval = 500,
}: LiveReloadServerParams): LiveReloadServer {
  debounceTimer = reloadInterval;

  try {
    statSync(dir)
  } catch (err: any) {
    throw err;
  }

  let server = createServer((req, res) => {
    if (req.url === "/livereload") {
      registerReloadClient(req, res);
    } else {
      serveStaticFile(dir, req, res);
    }
  });

  server.listen(port);

  let watcher = watch(dir, { ignoreInitial: true })
    .on("all", () => refreshClients());

  return {
    httpServer: server,
    watcher,
    close() {
      server.close();
      watcher.close();
    },
  };
}
