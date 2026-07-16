"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface ServiceConfig {
  id: string;
  name: string;
  projectDir: string;
  backendHost: string;
  backendPort: string;
  frontendPort: string;
}

export default function Home() {
  const [services, setServices] = useState<ServiceConfig[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const logEndRef = useRef<HTMLDivElement>(null);
  const sinceRef = useRef<Record<string, number>>({});

  const selected = services.find((s) => s.id === selectedId);

  // 加载服务列表
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/service");
        const data: ServiceConfig[] = await res.json();
        setServices(data);
        if (data.length > 0) setSelectedId(data[0].id);
      } catch (err) {
        console.error("加载服务失败:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 轮询状态
  useEffect(() => {
    if (!selectedId) return;
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/service/${selectedId}/status`);
        const data = await res.json();
        setRunning((prev) => ({ ...prev, [selectedId]: data.running }));
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(poll);
  }, [selectedId]);

  // 轮询日志
  useEffect(() => {
    if (!selectedId || !running[selectedId]) return;
    const poll = setInterval(async () => {
      try {
        const since = sinceRef.current[selectedId] ?? 0;
        const res = await fetch(`/api/service/${selectedId}/logs?since=${since}`);
        const data = await res.json();
        if (data.logs.length > 0) {
          sinceRef.current[selectedId] = since + data.logs.length;
          setLogs((prev) => ({
            ...prev,
            [selectedId]: [...(prev[selectedId] ?? []), ...data.logs],
          }));
        }
      } catch { /* ignore */ }
    }, 1000);
    return () => clearInterval(poll);
  }, [selectedId, running]);

  // 自动滚动日志到底部
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // 添加服务
  const addService = useCallback(async () => {
    try {
      const res = await fetch("/api/service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "",
          projectDir: "",
          backendHost: "",
          backendPort: "",
          frontendPort: "3000",
        }),
      });
      const svc: ServiceConfig = await res.json();
      setServices((prev) => [...prev, svc]);
      setSelectedId(svc.id);
    } catch (err) {
      console.error("添加服务失败:", err);
    }
  }, []);

  // 更新服务（失焦时保存）
  const saveService = useCallback(
    async (id: string, patch: Partial<ServiceConfig>) => {
      setServices((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
      );
      try {
        await fetch(`/api/service/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
      } catch (err) {
        console.error("保存服务失败:", err);
      }
    },
    []
  );

  // 删除服务
  const deleteService = useCallback(async (id: string) => {
    try {
      await fetch(`/api/service/${id}`, { method: "DELETE" });
      setServices((prev) => prev.filter((s) => s.id !== id));
      setSelectedId((prev) => (prev === id ? "" : prev));
    } catch (err) {
      console.error("删除服务失败:", err);
    }
  }, []);

  // 启动 / 停止
  const operateService = useCallback(
    async (action: "start" | "stop") => {
      if (!selectedId) return;
      setBusy(selectedId);
      try {
        await fetch(`/api/service/${selectedId}/${action}`, { method: "POST" });
        if (action === "start") {
          sinceRef.current[selectedId] = 0;
          setLogs((prev) => ({ ...prev, [selectedId]: [] }));
        }
      } catch (err) {
        console.error(`${action} 失败:`, err);
      } finally {
        setBusy(null);
      }
    },
    [selectedId]
  );

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        加载中...
      </div>
    );
  }

  return (
    <div className="flex flex-1 h-full gap-4 p-4">
      {/* 左侧服务列表 */}
      <Card className="w-64 shrink-0 h-full">
        <CardHeader>
          <CardTitle>服务列表</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <ScrollArea className="flex-1 max-h-[calc(100vh-12rem)]">
            <div className="flex flex-col gap-1.5">
              {services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  data-selected={s.id === selectedId || undefined}
                  className="flex items-center justify-between w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted data-[selected]:bg-muted"
                >
                  <span className="truncate font-medium">
                    {s.name || "未命名服务"}
                  </span>
                  <Badge
                    variant={running[s.id] ? "default" : "secondary"}
                    className="shrink-0"
                  >
                    {running[s.id] ? "运行中" : "已停止"}
                  </Badge>
                </button>
              ))}
            </div>
          </ScrollArea>
          <Button onClick={addService} variant="outline" className="w-full mt-2">
            + 添加服务
          </Button>
        </CardContent>
      </Card>

      {/* 右侧面板 */}
      {selected ? (
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {/* 服务配置 */}
          <Card>
            <CardHeader>
              <CardTitle>服务配置</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="name">名称</Label>
                <Input
                  id="name"
                  defaultValue={selected.name}
                  onBlur={(e) =>
                    saveService(selected.id, { name: e.target.value })
                  }
                  placeholder="服务名称"
                />
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="projectDir">项目目录</Label>
                <Input
                  id="projectDir"
                  defaultValue={selected.projectDir}
                  onBlur={(e) =>
                    saveService(selected.id, { projectDir: e.target.value })
                  }
                  placeholder="/path/to/project"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="backendHost">后端地址</Label>
                <Input
                  id="backendHost"
                  defaultValue={selected.backendHost}
                  onBlur={(e) =>
                    saveService(selected.id, { backendHost: e.target.value })
                  }
                  placeholder="localhost"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="backendPort">后端端口</Label>
                <Input
                  id="backendPort"
                  defaultValue={selected.backendPort}
                  onBlur={(e) =>
                    saveService(selected.id, { backendPort: e.target.value })
                  }
                  placeholder="3001"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="frontendPort">前端端口</Label>
                <Input
                  id="frontendPort"
                  defaultValue={selected.frontendPort}
                  onBlur={(e) =>
                    saveService(selected.id, { frontendPort: e.target.value })
                  }
                  placeholder="3000"
                />
              </div>
            </CardContent>
            <CardFooter className="justify-end">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteService(selected.id)}
              >
                删除此服务
              </Button>
            </CardFooter>
          </Card>

          {/* 服务控制 */}
          <Card>
            <CardHeader>
              <CardTitle>服务控制</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <Button
                onClick={() => operateService("start")}
                disabled={busy === selected.id}
              >
                ▶ 启动
              </Button>
              <Button
                variant="secondary"
                onClick={() => operateService("stop")}
                disabled={busy === selected.id}
              >
                ■ 停止
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <Badge variant={running[selected.id] ? "default" : "secondary"}>
                {running[selected.id] ? "● 运行中" : "○ 已停止"}
              </Badge>
            </CardContent>
          </Card>

          {/* 运行日志 */}
          <Card className="flex-1 min-h-0">
            <CardHeader>
              <CardTitle>运行日志</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
              <ScrollArea className="h-[200px] w-full rounded-lg border bg-muted/30 p-3">
                <pre className="text-xs leading-relaxed text-muted-foreground font-mono">
                  {(logs[selected.id] ?? []).length > 0
                    ? (logs[selected.id] ?? []).join("\n")
                    : "暂无日志"}
                </pre>
                <div ref={logEndRef} />
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          {'暂无服务，点击左侧"+ 添加服务"创建'}
        </div>
      )}
    </div>
  );
}
