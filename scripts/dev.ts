import { spawn } from "node:child_process";
const processes = [
  spawn(process.execPath, ["--import", "tsx", "--watch", "server/index.ts"], {
    stdio: "inherit",
  }),
  spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1"],
    { stdio: "inherit" },
  ),
];
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    processes.forEach((p) => p.kill());
    process.exit();
  });
