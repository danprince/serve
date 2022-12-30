#!/usr/bin/env node

import { join, relative } from "node:path";
import { createLiveReloadServer, LiveReloadServer } from "./server";
import { blue, green, red } from "picocolors";

let dir = process.cwd();

if (process.argv[2]) {
  dir = join(process.cwd(), process.argv[2]);
}

const RELOAD_ICON = green("↻");
const LISTENING_ICON = blue("⚡");
const ERROR_ICON = red("⚠️");

const friendlyEventNames = {
  "change": "Changed",
  "unlink": "Deleted",
  "unlinkDir": "Deleted",
  "add": "Added",
  "addDir": "Added",
}

let server: LiveReloadServer;
let port = 8080;

try {
  server = createLiveReloadServer({ dir, port });
} catch (err: any) {
  console.log(`${ERROR_ICON} server error: ${red(err)}`);
  process.exit(1);
}

server.httpServer.on("listening", () => {
  console.log(`${LISTENING_ICON}server listening on ${blue(`http://localhost:${port}`)}`);
});

server.httpServer.once("error", (err: any) => {
  console.log(` ${ERROR_ICON} server error: ${red(err)}`);
  process.exit(1);
});

server.watcher.on("all", (eventName, path) => {
  let relativePath = relative(dir, path);
  let event = friendlyEventNames[eventName] || "changed";
  console.log(`${RELOAD_ICON} ${event} ${relativePath}`);
});
