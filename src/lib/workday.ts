// 中国工作日判断工具：从 jsdelivr CDN 拉取 chinese-days 的年度 json，取「休/班」日期
// 数据源：https://cdn.jsdelivr.net/npm/chinese-days/dist/years/{year}.json
import { getWorkdayCache, setWorkdayCache } from '@/lib/config'

const JSON_BASE = 'https://cdn.jsdelivr.net/npm/chinese-days/dist/years/{year}.json'
const FETCH_TIMEOUT_MS = 5000

// 节假日（休）与调休上班日（班）的日期集合，key 形如 YYYY-MM-DD
let holidays = new Set<string>()
let workdays = new Set<string>()
let loadedYear: number | null = null
let loading: Promise<void> | null = null

// 启动时从本地缓存恢复当年数据（一次拉取即全年数据，重启后无需重复请求）
{
  const cache = getWorkdayCache()
  const year = new Date().getFullYear()
  if (cache && cache.year === year) {
    holidays = new Set(cache.holidays)
    workdays = new Set(cache.workdays)
    loadedYear = year
  }
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`
}

// 拉取指定年份数据并解析，进程内缓存；失败时降级为纯周末判断
async function loadYear(year: number): Promise<void> {
  if (loadedYear === year) return
  if (loading) return loading

  loading = (async () => {
    try {
      const res = await fetch(JSON_BASE.replace('{year}', String(year)), {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
      })
      if (!res.ok) throw new Error(`json fetch failed: ${res.status}`)
      const data = (await res.json()) as {
        holidays: Record<string, unknown>
        workdays: Record<string, unknown>
      }
      holidays = new Set(Object.keys(data.holidays))
      workdays = new Set(Object.keys(data.workdays))
      loadedYear = year
      try {
        // 全年数据持久化到本地，重启后无需重新拉取；写入失败不影响本次判断
        setWorkdayCache({ year, holidays: [...holidays], workdays: [...workdays] })
      } catch {
        /* swallow */
      }
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
