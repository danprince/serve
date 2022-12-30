import { afterAll, test, expect, vi, beforeAll } from "vitest";
import { createServer as createHttpServer } from "node:http";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { request } from "undici";
// @ts-ignore
import EventSource from "eventsource";
import { createLiveReloadServer } from "./server";

const tmpFixturesDir = join(__dirname, "../fixtures/tmp");

function randomPort() {
  return 15000 + Math.floor(Math.random() * 5000);
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

beforeAll(async () => {
  await mkdir(tmpFixturesDir, { recursive: true });
});

afterAll(async () => {
  await rm(tmpFixturesDir, { recursive: true });
});

test("errors if port is busy", async () => {
  let port = randomPort();

  // Start an HTTP server on the same port.
  let existingServer = createHttpServer();
  existingServer.listen(port);

  let server = createLiveReloadServer({ dir: ".", port });
  server.httpServer.once("error", (err) => {
    expect(err).toMatch(/EADDRINUSE/);
  });

  existingServer.close();
});

test("errors if dir does not exist", () => {
  let port = randomPort();
  expect(() => {
    createLiveReloadServer({ dir: "./bloop", port });
  }).toThrow(/ENOENT/);
});

test("reloads during fs changes", async () => {
  let port = randomPort();
  let dir = tmpFixturesDir;

  // Create the server
  let server = createLiveReloadServer({ dir, port, reloadInterval: 0 });
  let events = new EventSource(`http://localhost:${port}/livereload`);
  await delay(500);

  let reload = vi.fn();
  events.addEventListener("message", reload);

  server.watcher.emit("all", "add", "new.txt", {});
  server.watcher.emit("all", "change", "new.txt", {});
  server.watcher.emit("all", "unlink", "new.txt", {});

  // Clean up
  await delay(500);
  server.close();
  events.close();

  expect(reload).toHaveBeenCalledTimes(3);
});

test("serves files with correct mime types", async () => {
  let port = randomPort();
  let server = createLiveReloadServer({ dir: "fixtures/mime-types", port });

  let cases: Record<string, string> = {
    "file.css": "text/css",
    "file.html": "text/html",
    "file.js": "text/javascript",
    "file.png": "image/png",
  };

  for (let path in cases) {
    let { headers } = await request(`http://localhost:${port}/${path}`);
    expect(headers["content-type"]).toBe(cases[path]);
  }

  server.close();
});

test("injects livereload script into html files", async () => {
  let port = randomPort();
  let server = createLiveReloadServer({ dir: "fixtures/basic", port });
  let { body } = await request(`http://localhost:${port}/`);
  let html = await body.text();
  expect(html).toMatch(/new EventSource/);
  server.close();
});