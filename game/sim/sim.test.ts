/**
 * T-085 sim 決定性斷言
 *
 * 兩層：
 *  A. 引擎層（一定要過，過不了 = bug）：決定性、跳電、勝負正確。
 *  B. 平衡層（過不了 = 平衡跑掉，回報 PROGRESS_LOG，不要偷改斷言）。
 *
 * rotate 現況（run.ts 觀察 2026-06-13）：
 *   死於 temp 約 495~503s，navOnSeconds 約 293~299/480。
 *   navComp+co2Filter=9A 時暖氣無法插入（10A 紅線），導致溫度無法管理。
 *   → 數值平衡問題，回報設計師，暫不收緊「must win」斷言。
 */
import { describe, it, expect } from 'vitest'
import { runGame } from './runner'
import { doNothing, co2Only, panic, navOnly, makeRotateAgent, STRATEGIES } from './strategies'
import type { RunResult } from './runner'

// ── A. 決定性（最重要） ──────────────────────────────────────────────────────

describe('A. 決定性：同輸入兩次結果完全相等', () => {
  for (const agent of STRATEGIES) {
    it(`${agent.name} seed=7 兩次 RunResult 深度相等`, () => {
      const r1 = runGame(agent, { seed: 7, record: true })
      const r2 = runGame(agent, { seed: 7, record: true })
      expect(r1.outcome).toBe(r2.outcome)
      expect(r1.loseReason).toBe(r2.loseReason)
      expect(r1.endSecond).toBe(r2.endSecond)
      expect(r1.final.mainPwr).toBe(r2.final.mainPwr)
      expect(r1.final.co2).toBe(r2.final.co2)
      expect(r1.final.temp).toBe(r2.final.temp)
      expect(r1.timeline.length).toBe(r2.timeline.length)
      // 抽查時間軸中間點確認整條一致
      if (r1.timeline.length > 10) {
        const mid = Math.floor(r1.timeline.length / 2)
        expect(r1.timeline[mid].mainPwr).toBe(r2.timeline[mid].mainPwr)
        expect(r1.timeline[mid].co2).toBe(r2.timeline[mid].co2)
      }
    })
  }
})

// ── B-1. 各 oracle 策略的預期結局 ─────────────────────────────────────────

describe('B-1. doNothing：完全不操作就輸', () => {
  it('seed=1 → outcome lose，導航秒 = 0', () => {
    const r = runGame(doNothing, { seed: 1 })
    expect(r.outcome).toBe('lose')
    expect(r.stats.navOnSeconds).toBe(0)
  })

  it('任何 seed 都輸（與 balance.test 同調）', () => {
    for (const seed of [1, 2, 3, 7, 42]) {
      const r = runGame(doNothing, { seed })
      expect(r.outcome).toBe('lose')
    }
  })
})

describe('B-1. co2Only：單顧 CO2，CO2 被壓住但 DEV 仍殺人', () => {
  it('seed=1 → 輸，CO2 被過濾器壓在致死線以下（< 10000）', () => {
    const r = runGame(co2Only, { seed: 1 })
    expect(r.outcome).toBe('lose')
    expect(r.stats.maxCo2).toBeLessThan(10000)   // 過濾器有效壓住 CO2
    expect(r.loseReason).not.toBe('co2')          // 死因不是 CO2（co2 牆被壓住）
  })
})

describe('B-1. panic：全開跳電', () => {
  it('seed=1 → 跳電至少 1 次，主電力被扣（< 100）', () => {
    const r = runGame(panic, { seed: 1 })
    expect(r.stats.brownouts).toBeGreaterThanOrEqual(1)
    expect(r.final.mainPwr).toBeLessThan(100)
  })
})

describe('B-1. navOnly：壓住 DEV，但 CO2 牆在約 480s 殺人', () => {
  it('seed=1 → 導航有開，明顯撐得比 doNothing 久', () => {
    const rNav = runGame(navOnly, { seed: 1 })
    const rDo  = runGame(doNothing, { seed: 1 })
    expect(rNav.stats.navOnSeconds).toBeGreaterThan(0)
    expect(rNav.endSecond).toBeGreaterThan(rDo.endSecond)
  })

  it('seed=1 → 撐過 deviation，最終死於 co2（400s 以後）', () => {
    const r = runGame(navOnly, { seed: 1 })
    expect(r.loseReason).toBe('co2')
    expect(r.endSecond).toBeGreaterThan(400)
  })
})

// ── B-2. rotate 衝關探針（平衡層，寬鬆） ────────────────────────────────

describe('B-2. rotate：衝關探針（run.ts 觀測：死於 temp 約 495~503s）', () => {
  // TODO：run.ts 觀察到 rotate 目前贏不了。
  //       navComp(4A)+co2Filter(5A)=9A 時暖氣(3A)無法插入，溫度無法管理。
  //       待設計師調整數值或策略啟發式後收緊此斷言為 outcome==='win'。
  it('五個種子至少都能撐到 endSecond >= 300（基本生存能力）', () => {
    for (const seed of [1, 2, 3, 7, 42]) {
      const r = runGame(makeRotateAgent(), { seed })
      expect(r.endSecond).toBeGreaterThanOrEqual(300)
    }
  })

  it('seed=1 → 有開導航推 ETA（navOnSeconds > 0）', () => {
    const r = runGame(makeRotateAgent(), { seed: 1 })
    expect(r.stats.navOnSeconds).toBeGreaterThan(0)
  })
})

// ── C. 不變量（引擎層，任何策略都該成立） ───────────────────────────────

describe('C. 不變量：數值不超出合理範圍', () => {
  it('rotate seed=1 整局 timeline 各欄位在合理範圍內', () => {
    const r = runGame(makeRotateAgent(), { seed: 1, record: true })
    for (const snap of r.timeline) {
      expect(snap.o2Tank).toBeGreaterThanOrEqual(0)
      expect(snap.o2Tank).toBeLessThanOrEqual(100)
      expect(snap.mainPwr).toBeGreaterThanOrEqual(0)
      expect(snap.mainPwr).toBeLessThanOrEqual(100)
      expect(snap.co2).toBeGreaterThanOrEqual(0)
      expect(snap.dev).toBeGreaterThanOrEqual(0)
      expect(snap.dev).toBeLessThanOrEqual(100)
      expect(snap.liqO2).toBeGreaterThanOrEqual(0)
    }
  })

  it('結局是 lose/win/timeout 之一（不存在無效 phase）', () => {
    for (const agent of STRATEGIES) {
      const r = runGame(agent, { seed: 3 })
      expect(['win', 'lose', 'timeout']).toContain(r.outcome)
    }
  })
})
