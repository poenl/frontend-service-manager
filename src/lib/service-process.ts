import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getService } from "@/lib/config";

interface ProcessEntry {
  proc: ChildProcess;
  logs: string[];
  startTime: number;
}

const processes = new Map<string, ProcessEntry>();

function detectPm(cwd: string): string {
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(cwd, "yarn.lock"))) return "yarn";
  return "npx";
}

export function startService(id: string): { success: boolean; message: string } {
  const config = getService(id);
  if (!config) return { success: false, message: "服务不存在" };
  if (processes.has(id)) {
    const { proc } = processes.get(id)!;
    if (proc.exitCode === null) return { success: false, message: "服务已在运行" };
    processes.delete(id);
  }

  const cwd = config.projectDir;
  if (!cwd || !existsSync(cwd)) return { success: false, message: "项目目录不存在" };

  const pm = detectPm(cwd);
  const args = [pm === "npx" ? "vite" : "vite"];
  if (config.frontendPort) args.push("--port", config.frontendPort);

  const env = {
    ...process.env,
    VITE_APP_BASE_URL: config.backendHost && config.backendPort
      ? `http://${config.backendHost}:${config.backendPort}`
      : undefined,
  } as NodeJS.ProcessEnv;

  // ponytail: 仅支持 Vite，后续可按需扩展 webpack/dev-server 等
  const child: ChildProcess = spawn(pm, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });

  const logs: string[] = [];
  const onData = (chunk: string) => {
    const lines = chunk.split("\n").filter(Boolean);
    for (const line of lines) {
      logs.push(`[${new Date().toLocaleTimeString()}] ${line}`);
    }
  };

  child.stdout?.on("data", (data: Buffer) => onData(data.toString()));
  child.stderr?.on("data", (data: Buffer) => onData(data.toString()));

  child.on("exit", () => {
    logs.push(`[${new Date().toLocaleTimeString()}] 进程已退出`);
  });

  processes.set(id, { proc: child, logs, startTime: Date.now() });

  return { success: true, message: "服务已启动" };
}

export function stopService(id: string): { success: boolean; message: string } {
  const entry = processes.get(id);
  if (!entry) return { success: false, message: "服务未在运行" };
  const { proc } = entry;

  proc.kill("SIGTERM");
  // ponytail: 3s 超时后强制杀死，后续可做成可配置
  setTimeout(() => {
    if (proc.exitCode === null) proc.kill("SIGKILL");
  }, 3000);
  processes.delete(id);

  return { success: true, message: "服务已停止" };
}

export function getServiceStatus(id: string): {
  running: boolean;
  pid?: number;
  uptime?: number;
} {
  const entry = processes.get(id);
  if (!entry || entry.proc.exitCode !== null) {
    processes.delete(id);
    return { running: false };
  }
  return {
    running: true,
    pid: entry.proc.pid,
    uptime: Date.now() - entry.startTime,
  };
}

export function getServiceLogs(id: string, since = 0): { logs: string[] } {
  const entry = processes.get(id);
  if (!entry) return { logs: [] };
  return { logs: entry.logs.slice(since) };
}
