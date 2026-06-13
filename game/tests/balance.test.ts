/**
 * T-050 整局平衡驗證（端到端）
 *
 * 用 step() 跑完整局，直接對照 SPEC_DECISIONS「自然死亡時間軸」與 GDD §8 主張。
 * rng = () => 0：devDriftSample = 0 × DEV_DRIFT_MAX = 0，DEV 固定不動，
 *   用來孤立「CO2 是最硬的牆」時間軸，排除 DEV 漂移的雜訊。
 * rng = () => 1：devDriftSample = 1 × DEV_DRIFT_MAX = 2%/sim-s，反向驗 DEV 比 CO2 更早殺人。
 */
import { describe, it, expect } from 'vitest'
import { initialState } from '../src/game/state'
import { step } from '../src/game/systems/index'
import { FIXED_DT, ETA_INIT, COMPRESSION } from '../src/game/constants'

// ── 主斷言：CO2 最硬的牆 ─────────────────────────────────────────────────────

describe('T-050 整局平衡驗證', () => {
  it('無操作局：CO2 在 480s 首先致死（GDD §8 核心主張）', () => {
    let s = initialState()
    s.rng = () => 0   // DEV drift = 0，孤立 CO2 時間軸
    while (s.phase === 'playing') s = step(s, FIXED_DT)

    expect(s.phase).toBe('lose')
    expect(s.loseReason).toBe('co2')
    expect(s.elapsed).toBeCloseTo(480, 0)
  })

  it('CO2 死亡時：O2 ≈ 13.6%（比 556s O2 死亡線還有 76s 緩衝）', () => {
    let s = initialState()
    s.rng = () => 0
    while (s.phase === 'playing') s = step(s, FIXED_DT)
    // 100 − 0.18 × 480 = 13.6%
    expect(s.o2Tank).toBeCloseTo(13.6, 0)
    expect(s.o2Tank).toBeGreaterThan(0)
  })

  it('CO2 死亡時：溫度 ≈ 4.2°C（GDD §5-E 歷史數據吻合，仍遠高於 0°C 死亡線）', () => {
    let s = initialState()
    s.rng = () => 0
    while (s.phase === 'playing') s = step(s, FIXED_DT)
    // 21 − 0.035 × 480 = 4.2°C
    expect(s.temp).toBeCloseTo(4.2, 0)
    expect(s.temp).toBeGreaterThan(0)
  })

  it('無設備時電力全程 100%（電力只被設備消耗，不自然流失）', () => {
    let s = initialState()
    s.rng = () => 0
    while (s.phase === 'playing') s = step(s, FIXED_DT)
    expect(s.mainPwr).toBe(100)
  })

  // ── DEV 張力：漂移可以比 CO2 更快殺人 ──────────────────────────────────────

  it('DEV 恆最大漂移（rng=1, 2%/sim-s）：< 30s 死於 deviation（早於 CO2 的 480s）', () => {
    // devDriftSample = 1 × DEV_DRIFT_MAX(2) = 2%/s
    // 第 1 秒後開始抽樣，之後每秒 +2% DEV，約 26s 觸達 50%
    let s = initialState()
    s.rng = () => 1
    while (s.phase === 'playing') s = step(s, FIXED_DT)

    expect(s.phase).toBe('lose')
    expect(s.loseReason).toBe('deviation')
    expect(s.elapsed).toBeLessThan(30)
  })

  it('DEV = 50% 邊界不觸死，50.001% 才觸死（嚴格大於，GDD §4）', () => {
    const exact = initialState()
    exact.dev = 50
    exact.rng = () => 0
    const r1 = step(exact, FIXED_DT)  // dev 可能變化，但一步不到 0.001%
    // 驗收：剛好 50% 時 checkWinLose 不會設 lose
    // （nav off + rng=0 → drift = 0，dev 不變）
    expect(r1.phase).toBe('playing')

    const over = initialState()
    over.dev = 50.001
    over.rng = () => 0
    const r2 = step(over, FIXED_DT)
    expect(r2.phase).toBe('lose')
    expect(r2.loseReason).toBe('deviation')
  })

  // ── 壓縮比與上限數學驗算 ─────────────────────────────────────────────────

  it('ETA 壓縮比：313200 ÷ 652.5 = 480.0s（D-001 核心公式）', () => {
    expect(ETA_INIT / COMPRESSION).toBeCloseTo(480, 1)
  })

  it('O2 最大存活理論上限 ≈ 689s（3 罐 ×8% = +24%，共 124% ÷ 0.18/s）', () => {
    expect((100 + 3 * 8) / 0.18).toBeCloseTo(689, 0)
  })

  it('三條自然死亡線正確錯開：CO2(480) < O2(556) < TEMP(600)', () => {
    const co2Death  = (10000 - 400) / 20        // = 480s
    const o2Death   = 100 / 0.18                 // = 555.6s ≈ 556s
    const tempDeath = 21 / 0.035                 // = 600s

    expect(co2Death).toBeCloseTo(480, 0)
    expect(o2Death).toBeCloseTo(556, 0)
    expect(tempDeath).toBeCloseTo(600, 0)

    expect(co2Death).toBeLessThan(o2Death)
    expect(o2Death).toBeLessThan(tempDeath)
  })
})
