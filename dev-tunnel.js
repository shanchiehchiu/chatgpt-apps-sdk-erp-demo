import { spawn } from "node:child_process";

const port = Number(process.env.PORT ?? 18787);
const server = spawn(process.execPath, ["server.js"], {
  cwd: process.cwd(),
  stdio: ["ignore", "inherit", "inherit"],
  env: { ...process.env, PORT: String(port) },
});

const tunnel = spawn(
  "cloudflared",
  ["tunnel", "--url", `http://127.0.0.1:${port}`, "--no-autoupdate"],
  { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] }
);

let announced = false;
const handleTunnelOutput = (chunk) => {
  const text = chunk.toString();
  process.stderr.write(text);
  const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
  if (match && !announced) {
    announced = true;
    console.log("\n========================================");
    console.log("ChatGPT MCP URL:");
    console.log(`${match[0]}/mcp`);
    console.log("========================================\n");
  }
};

tunnel.stdout.on("data", handleTunnelOutput);
tunnel.stderr.on("data", handleTunnelOutput);

const stop = () => {
  tunnel.kill("SIGTERM");
  server.kill("SIGTERM");
};

process.on("SIGINT", () => { stop(); process.exit(0); });
process.on("SIGTERM", () => { stop(); process.exit(0); });

server.on("exit", (code) => {
  if (code && code !== 0) {
    console.error(`MCP server exited with code ${code}`);
    stop();
    process.exit(code);
  }
});
