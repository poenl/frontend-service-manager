import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { Socket } from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";
import { getService } from "@/lib/config";

interface ProcessEntry {
  proc: ChildProcess;
  logs: string[];
  startTime: number;
}

const processes = new Map<string, ProcessEntry>();

function cleanup() {
  const ids = [...processes.keys()];
  for (const id of ids) {
    stopService(id);
  }
}

process.on("SIGTERM", cleanup);
process.on("SIGINT", cleanup);
process.on("exit", cleanup);

function detectPm(cwd: string): string {
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(cwd, "yarn.lock"))) return "yarn";
  return "npx";
}

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new Socket();
    socket.setTimeout(2000);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, "127.0.0.1");
    socket.unref();
  });
}

export async function startService(id: string): Promise<{ success: boolean; message: string }> {
  const config = getService(id);
  if (!config) return { success: false, message: "服务不存在" };
  if (!config.projectDir) return { success: false, message: "请填写项目目录" };
  if (!config.backendHost) return { success: false, message: "请填写后端地址" };
  if (!config.backendPort) return { success: false, message: "请填写后端端口" };
  if (!config.frontendPort) return { success: false, message: "请填写前端端口" };
  if (await isPortInUse(parseInt(config.frontendPort, 10))) {
    return { success: false, message: `端口 ${config.frontendPort} 已被其他进程占用` };
  }
  if (processes.has(id)) {
    const existing = processes.get(id)!;
    if (existing.proc.exitCode === null && existing.proc.signalCode === null) return { success: false, message: "服务已在运行" };
    existing.logs.length = 0;
    existing.startTime = Date.now();
  }

  const cwd = config.projectDir.replace(/^~(?=\/|$)/, homedir());
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

  const envPrefix = env.VITE_APP_BASE_URL
    ? `VITE_APP_BASE_URL=${env.VITE_APP_BASE_URL} `
    : "";

  // ponytail: 仅支持 Vite，后续可按需扩展 webpack/dev-server 等
  const logs: string[] = [
    `[${new Date().toLocaleTimeString()}] $ ${envPrefix}${pm} ${args.join(" ")}`,
  ];

  const child: ChildProcess = spawn(pm, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });

  child.stdout?.on("data", (data: Buffer) => {
    const lines = data.toString().split("\n").filter(Boolean);
    for (const line of lines) {
      logs.push(`[${new Date().toLocaleTimeString()}] ${line}`);
    }
  });

  child.stderr?.on("data", (data: Buffer) => {
    const lines = data.toString().split("\n").filter(Boolean);
    for (const line of lines) {
      logs.push(`[${new Date().toLocaleTimeString()}] ${line}`);
    }
  });

  child.on("exit", () => {
    logs.push(`[${new Date().toLocaleTimeString()}] 进程已退出`);
  });

  const result = await new Promise<{ success: boolean; message: string }>((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ success: false, message: "启动超时（15s）" });
    }, 15000);

    const onOutput = () => {
      clearTimeout(timeout);
      resolve({ success: true, message: "服务已启动" });
    };

    child.stdout?.once("data", onOutput);
    child.stderr?.once("data", onOutput);

    child.on("exit", (code) => {
      clearTimeout(timeout);
      resolve({ success: false, message: `进程异常退出 (code: ${code})` });
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      resolve({ success: false, message: `启动失败: ${err.message}` });
    });
  });

  if (result.success) {
    const entry = processes.get(id);
    if (entry) {
      entry.proc = child;
      entry.logs = logs;
      entry.startTime = Date.now();
    } else {
      processes.set(id, { proc: child, logs, startTime: Date.now() });
    }
  }

  return result;
}

export async function stopService(id: string): Promise<{ success: boolean; message: string }> {
  const entry = processes.get(id);
  if (!entry) return { success: false, message: "服务未在运行" };

  const { proc } = entry;
  proc.kill("SIGTERM");

  return new Promise((resolve) => {
    const forceKill = setTimeout(() => {
      if (proc.exitCode === null && proc.signalCode === null) proc.kill("SIGKILL");
    }, 3000);

    proc.on("exit", () => {
      clearTimeout(forceKill);
      entry.logs.push(`[${new Date().toLocaleTimeString()}] 服务已停止`);
      resolve({ success: true, message: "服务已停止" });
    });
  });
}

export function getServiceStatus(id: string): {
  running: boolean;
  pid?: number;
  uptime?: number;
} {
  const entry = processes.get(id);
  if (!entry || entry.proc.exitCode !== null || entry.proc.signalCode !== null) {
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
