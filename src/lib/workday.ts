// 中国工作日判断工具：从 jsdelivr CDN 拉取 chinese-days 的年度 ics，解析「休/班」事件
// 数据源：https://cdn.jsdelivr.net/npm/chinese-days/dist/years/{year}.ics

const ICS_BASE = 'https://cdn.jsdelivr.net/npm/chinese-days/dist/years/{year}.ics'
const FETCH_TIMEOUT_MS = 5000

// 节假日（休）与调休上班日（班）的日期集合，key 形如 YYYY-MM-DD
let holidays = new Set<string>()
let workdays = new Set<string>()
let loadedYear: number | null = null
let loading: Promise<void> | null = null

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`
}

// 解析 ics 文本，将每个 VEVENT 的「休/班」区间展开为日期集合
function parseIcs(text: string) {
  const events = text.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? []
  for (const ev of events) {
    const start = ev.match(/DTSTART;VALUE=DATE:(\d{4})(\d{2})(\d{2})/)
    const end = ev.match(/DTEND;VALUE=DATE:(\d{4})(\d{2})(\d{2})/)
    if (!start || !end) continue

    const isWork = /DESCRIPTION:班/.test(ev)
    const target = isWork ? workdays : holidays
    const startTime = new Date(+start[1], +start[2] - 1, +start[3]).getTime()
    const endTime = new Date(+end[1], +end[2] - 1, +end[3]).getTime()
    for (let t = startTime; t < endTime; t += 86400000) {
      target.add(dateKey(new Date(t)))
    }
  }
}

// 拉取指定年份数据并解析，进程内缓存；失败时降级为纯周末判断
async function loadYear(year: number): Promise<void> {
  if (loadedYear === year) return
  if (loading) return loading

  loading = (async () => {
    try {
      const res = await fetch(ICS_BASE.replace('{year}', String(year)), {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
      })
      if (!res.ok) throw new Error(`ics fetch failed: ${res.status}`)
      const text = await res.text()
      holidays = new Set()
      workdays = new Set()
      parseIcs(text)
      loadedYear = year
    } catch (err) {
      // 保持未加载状态，后续调用继续尝试；期间按周末判断兜底
      console.error('[workday] 拉取节假日数据失败，降级为周末判断', err)
    } finally {
      loading = null
    }
  })()
  return loading
}

// 判断某天是否为工作日（与 chinese-days 语义一致：调休上班日优先于节假日）
export async function isWorkday(date: Date): Promise<boolean> {
  await loadYear(date.getFullYear())

  const key = dateKey(date)
  if (workdays.has(key)) return true
  if (holidays.has(key)) return false

  const day = date.getDay()
  return day >= 1 && day <= 5
}
