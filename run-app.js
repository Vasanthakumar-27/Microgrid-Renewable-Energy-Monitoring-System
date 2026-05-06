const { spawn } = require("child_process");

const DASHBOARD_URL = "http://localhost:5000/dashboard/";

const serverProcess = spawn(process.execPath, ["server.js"], {
  stdio: "inherit",
});

// Give the server a moment to boot before opening the dashboard URL.
setTimeout(() => {
  spawn("cmd", ["/c", "start", "", DASHBOARD_URL], {
    detached: true,
    stdio: "ignore",
  }).unref();
}, 1500);

const shutdown = () => {
  if (!serverProcess.killed) {
    serverProcess.kill();
  }
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

serverProcess.on("exit", (code) => {
  process.exit(code ?? 0);
});
