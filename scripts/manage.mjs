#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readSync,
  rmSync,
  openSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { homedir, hostname, networkInterfaces } from 'node:os'

// 基于脚本自身定位包根，兼容本地开发与全局安装两种场景
const root = dirname(fileURLToPath(import.meta.url))
const repo = join(root, '..')
const standaloneDir = join(repo, '.next/standalone')
// 运行状态存用户主目录，避免全局安装写包目录（可能无权限）且升级/重装不丢状态
const runDir = join(homedir(), '.fsm')
const pidFile = join(runDir, 'pid')
const portFile = join(runDir, 'port')
const logFile = join(runDir, 'server.log')

// 取本机第一个非 internal 的 IPv4，用于打印 Network 访问地址；取不到返回 null
function getLanIp() {
  for (const infos of Object.values(networkInterfaces())) {
    for (const info of infos) {
      if (info.family === 'IPv4' && !info.internal) return info.address
    }
  }
  return null
}

// 打印 Next 风格的访问地址（Local/Network/Hostname；无局域网 IP 时仅 Local）
function printUrls(port) {
  console.log(`- Local:    http://localhost:${port}`)
  const lanIp = getLanIp()
  if (lanIp) console.log(`- Network:  http://${lanIp}:${port}`)
  // mDNS 主机名地址，局域网内 Apple 生态设备可直接访问；与 Network 同条件显示
  // macOS 的 os.hostname() 已带 .local 后缀，需去除后再拼，避免 .local.local
  const host = hostname().endsWith('.local') ? hostname().slice(0, -6) : hostname()
  if (lanIp) console.log(`- Hostname: http://${host}.local:${port}`)
}

// 读 pid 并探测进程是否存活
function readPid() {
  if (!existsSync(pidFile)) return null
  const pid = Number(readFileSync(pidFile, 'utf8'))
  if (!Number.isInteger(pid) || pid <= 0) return null
  try {
    process.kill(pid, 0)
    return pid
  } catch {
    return null
  }
}

// 清空目标后整体复制，保证 stage 幂等
function copyInto(src, dest) {
  rmSync(dest, { recursive: true, force: true })
  cpSync(src, dest, { recursive: true })
}

function stage() {
  const src = join(repo, '.next/static')
  const dest = join(repo, '.next/standalone/.next/static')
  if (!existsSync(src)) {
    console.error('未找到 .next/static（请先 pnpm build）')
    process.exit(1)
  }
  copyInto(src, dest)
  // Next 构建不会复制 public/ 进 standalone，这里随 static 一并就位
  const pubSrc = join(repo, 'public')
  const pubDest = join(repo, '.next/standalone/public')
  if (existsSync(pubSrc)) copyInto(pubSrc, pubDest)
  console.log(`静态资源已就位：${dest}`)
}

// 探测端口是否可绑定（用于 start 前拦截占用；探测与真正启动间有毫秒级竞态，可忽略）
function portAvailable(port) {
  return new Promise((resolve) => {
    const probe = createServer()
    probe.once('error', () => resolve(false))
    probe.listen(port, '0.0.0.0', () => {
      probe.close(() => resolve(true))
    })
  })
}

async function start() {
  const server = join(standaloneDir, 'server.js')
  if (!existsSync(server)) {
    console.error('未找到 .next/standalone/server.js，请先运行 pnpm build')
    process.exit(1)
  }
  if (readPid()) {
    console.error('服务已在运行，请先 fsm stop')
    process.exit(1)
  }
  const portIndex = process.argv.indexOf('--port')
  let port = 3000
  if (portIndex !== -1) {
    const value = Number(process.argv[portIndex + 1])
    if (!Number.isInteger(value) || value <= 0 || value > 65535) {
      console.error('无效端口号')
      process.exit(1)
    }
    port = value
  }
  if (!(await portAvailable(port))) {
    console.error(`端口 ${port} 已被占用`)
    process.exit(1)
  }
  mkdirSync(runDir, { recursive: true })
  // 以追加模式打开日志 fd，Start 后 stdout/stderr 统一落入 server.log
  const fd = openSync(logFile, 'a')
  const child = spawn('node', [server], {
    env: { ...process.env, PORT: String(port) },
    detached: true,
    stdio: ['ignore', fd, fd]
  })
  child.unref()
  // spawn 失败（如路径中无 node）时清理已落盘的 pid/port 并报错退出，避免残留脏状态
  child.on('error', () => {
    rmSync(pidFile, { force: true })
    rmSync(portFile, { force: true })
    console.error('启动失败：未找到 node 可执行文件')
    process.exit(1)
  })
  // 成功启动后才落盘并打印，失败路径由上面的 error 事件接管
  child.on('spawn', () => {
    writeFileSync(pidFile, String(child.pid))
    writeFileSync(portFile, String(port))
    console.log(`服务已启动：PID ${child.pid}（日志：${logFile}）`)
    printUrls(port)
  })
}

function stop() {
  const pid = readPid()
  if (!pid) {
    console.log('未在运行')
    return
  }
  process.kill(pid, 'SIGTERM')
  rmSync(pidFile, { force: true })
  console.log(`已停止（PID ${pid}）`)
}

function status() {
  const pid = readPid()
  if (!pid) {
    console.log('未在运行')
    return
  }
  let port = '?'
  if (existsSync(portFile)) port = readFileSync(portFile, 'utf8')
  console.log(`运行中：端口 ${port}，PID ${pid}`)
  printUrls(port)
}

function log() {
  if (!existsSync(logFile)) {
    console.log('暂无日志')
    return
  }
  // 轮询读取文件新增内容替代 spawn('tail -f')，跨平台（Windows 无 tail 命令）
  const fd = openSync(logFile, 'r')
  // 与 tail -f 一致，初始定位到文件末尾，只跟随新增内容
  let pos = statSync(logFile).size
  const poll = () => {
    const { size } = statSync(logFile)
    if (size > pos) {
      const buf = Buffer.alloc(size - pos)
      readSync(fd, buf, 0, size - pos, pos)
      process.stdout.write(buf)
      pos = size
    }
  }
  poll()
  setInterval(poll, 500)
}

// 输出版本号（读 package.json），供 --version/-v 使用
function printVersion() {
  const { version } = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'))
  console.log(version)
}

// 打印 CLI 用法，供 --help/-h 及无匹配命令时使用
function printHelp() {
  console.log(
    '用法：\n' +
      '  fsm stage            将 static/ 与 public/ 复制进 standalone/\n' +
      '  fsm start [--port]   启动生产守护进程（默认端口 3000）\n' +
      '  fsm stop             停止守护进程\n' +
      '  fsm status           查看运行状态\n' +
      '  fsm log              实时观看日志（Ctrl+C 退出不影响服务）\n' +
      '  fsm --version        显示版本号\n' +
      '  fsm --help           显示此帮助'
  )
}

const [cmd] = process.argv.slice(2)
switch (cmd) {
  case 'stage':
    stage()
    break
  case 'start':
    await start()
    break
  case 'stop':
    stop()
    break
  case 'status':
    status()
    break
  case 'log':
    log()
    break
  case '--version':
  case '-v':
    printVersion()
    break
  case '--help':
  case '-h':
    printHelp()
    break
  default:
    printHelp()
    process.exit(cmd ? 1 : 0)
}
