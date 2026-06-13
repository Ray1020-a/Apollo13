import { runGame } from './runner'
import { STRATEGIES } from './strategies'
import type { RunResult, Snapshot } from './runner'

// ── 參數解析 ────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const DEFAULT_SEEDS = [1, 2, 3, 7, 42]

let seedArg: number | null = null
let strategyArg: string | null = null
let verbose = false

for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--seed' && argv[i + 1]) { seedArg = parseInt(argv[++i]); continue }
  if (argv[i] === '--strategy' && argv[i + 1]) { strategyArg = argv[++i]; continue }
  if (argv[i] === '--verbose') { verbose = true; continue }
}

const seeds = seedArg !== null ? [seedArg] : DEFAULT_SEEDS
const strategies = strategyArg !== null
  ? STRATEGIES.filter(s => s.name === strategyArg)
  : STRATEGIES

if (strategyArg !== null && strategies.length === 0) {
  console.error(`找不到策略 "${strategyArg}"，可用：${STRATEGIES.map(s => s.name).join(', ')}`)
  process.exit(1)
}

// ── 報表格式 ────────────────────────────────────────────────────────────────

function fmtOutcome(r: RunResult): string {
  if (r.outcome === 'win') return 'WIN '
  if (r.outcome === 'timeout') return 'TIMEOUT'
  return 'LOSE'
}

function fmtReason(r: RunResult): string {
  return r.loseReason ?? '—'
}

function printSummaryHeader(): void {
  console.log(
    '策略'.padEnd(14) +
    'seed'.padEnd(6) +
    '結局'.padEnd(9) +
    '死因'.padEnd(12) +
    '結束秒'.padEnd(8) +
    '導航秒'.padEnd(8) +
    '跳電'.padEnd(6) +
    '終末: PWR / O2 / CO2 / TEMP / DEV'
  )
  console.log('─'.repeat(95))
}

function printSummaryRow(r: RunResult): void {
  const f = r.final
  console.log(
    r.agent.padEnd(14) +
    String(r.seed).padEnd(6) +
    fmtOutcome(r).padEnd(9) +
    fmtReason(r).padEnd(12) +
    String(r.endSecond).padEnd(8) +
    String(r.stats.navOnSeconds).padEnd(8) +
    String(r.stats.brownouts).padEnd(6) +
    `${f.mainPwr.toFixed(1).padStart(5)} / ${f.o2Tank.toFixed(1).padStart(4)} / ${String(Math.round(f.co2)).padStart(5)} / ${f.temp.toFixed(1).padStart(4)} / ${f.dev.toFixed(1).padStart(4)}`
  )
}

function printVerbose(r: RunResult): void {
  console.log(`\n── 時間軸：${r.agent} (seed=${r.seed}) ──`)
  console.log(
    '  t'.padEnd(6) +
    'ETA'.padEnd(12) +
    'PWR'.padEnd(7) +
    'O2'.padEnd(7) +
    'CO2'.padEnd(7) +
    'TEMP'.padEnd(7) +
    'DEV'.padEnd(7) +
    'AMP'.padEnd(5) +
    '設備(H/F/N)  狀態'
  )
  for (const snap of r.timeline) {
    if (snap.t % 10 !== 0) continue
    const etaH = Math.floor(snap.eta / 3600)
    const etaM = Math.floor((snap.eta % 3600) / 60)
    const etaS = Math.floor(snap.eta % 60)
    const etaStr = `${String(etaH).padStart(2, '0')}:${String(etaM).padStart(2, '0')}:${String(etaS).padStart(2, '0')}`
    const devices = `${snap.heater ? 'H' : '-'} ${snap.co2Filter ? 'F' : '-'} ${snap.navComp ? 'N' : '-'}`
    const status = snap.brownout ? 'brownout!' : ''
    console.log(
      `  ${String(snap.t).padEnd(4)}` +
      etaStr.padEnd(12) +
      snap.mainPwr.toFixed(1).padEnd(7) +
      snap.o2Tank.toFixed(1).padEnd(7) +
      String(Math.round(snap.co2)).padEnd(7) +
      snap.temp.toFixed(1).padEnd(7) +
      snap.dev.toFixed(1).padEnd(7) +
      snap.amp.toFixed(0).padEnd(5) +
      devices.padEnd(13) +
      status
    )
  }
}

// ── 主程式 ──────────────────────────────────────────────────────────────────

const isSingleRun = strategies.length === 1 && seeds.length === 1

printSummaryHeader()

let wins = 0
let total = 0
const rotateNavSecs: number[] = []

try {
  for (const agent of strategies) {
    for (const seed of seeds) {
      const r = runGame(agent, { seed, record: verbose || isSingleRun })
      printSummaryRow(r)
      total++
      if (r.outcome === 'win') wins++
      if (agent.name === 'rotate') rotateNavSecs.push(r.stats.navOnSeconds)

      if (verbose && isSingleRun) printVerbose(r)
    }
  }
} catch (err) {
  console.error('Runner 異常：', err)
  process.exit(1)
}

console.log('─'.repeat(95))
const rotateAvg = rotateNavSecs.length > 0
  ? `rotate 平均導航秒 ${(rotateNavSecs.reduce((a, b) => a + b, 0) / rotateNavSecs.length).toFixed(0)}/480。`
  : ''
console.log(`彙總：${total} 局，${wins} 勝 ${total - wins} 敗。${rotateAvg}`)
