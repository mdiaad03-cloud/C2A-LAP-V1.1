import { spawn } from "node:child_process";
import path from "node:path";

const projectRoot = process.cwd();
const nodeExe = "C:\\Program Files\\nodejs\\node.exe";

const serverEntry = path.join(projectRoot, "server", "src", "server.js");
const viteEntry = path.join(projectRoot, "client", "node_modules", "vite", "bin", "vite.js");

function start(name, args, cwd) {
  const child = spawn(nodeExe, args, {
    cwd,
    stdio: ["inherit", "pipe", "pipe"],
    windowsHide: false,
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });

  child.on("exit", (code) => {
    if (code !== 0) {
      process.stderr.write(`[${name}] exited with code ${code}\n`);
    }
  });

  return child;
}

const server = start("server", [serverEntry], path.join(projectRoot, "server"));
const client = start(
  "client",
  [viteEntry, "--port", "5500", "--strictPort"],
  path.join(projectRoot, "client"),
);

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  for (const child of [server, client]) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => process.exit(0), 500);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

server.on("exit", () => shutdown());
client.on("exit", () => shutdown());
