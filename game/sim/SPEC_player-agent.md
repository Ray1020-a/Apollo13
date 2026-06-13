# SPEC → `playerAgent.ts` ＋ 前置重構 `src/game/input.ts`

> 玩家策略的型別合約。runner 與 strategies 都依賴它。
> 先做前置任務 T-080（抽輸入），再做 T-081（本檔型別）。

---

## 前置任務 T-080：把輸入處理抽成純函式 `src/game/input.ts`

### 為什麼

現在 `src/game/loop.ts` 的三個 handler 直接改 module-level `state`：

```ts
// loop.ts 現況
export function toggleDevice(id: DeviceId): void {
  const d = state.devices[id]
  if (state.brownout) return
  if (state.elapsed < d.lockUntil) return
  const wasOff = !d.on
  d.on = !d.on
  if (wasOff && d.on) state.lastDeviceOn = id
}
export function setO2Held(held: boolean): void {
  if (held && state.brownout) return
  state.o2Held = held
}
export function doReset(): void {
  if (!state.brownout) return
  state.brownout = false
}
```

runner 要在自己的 state 上重放這些規則。各寫一份 → 遲早漂移。**單一真相。**

### 怎麼做

新檔 `src/game/input.ts`，把規則搬成收 state 的純函式（就地改傳入的 state，回傳同一個，
跟系統的風格一致）：

```ts
import type { GameState, DeviceId } from './state'

export function applyToggleDevice(s: GameState, id: DeviceId): GameState {
  const d = s.devices[id]
  if (s.brownout) return s
  if (s.elapsed < d.lockUntil) return s
  const wasOff = !d.on
  d.on = !d.on
  if (wasOff && d.on) s.lastDeviceOn = id
  return s
}

export function applySetO2Held(s: GameState, held: boolean): GameState {
  if (held && s.brownout) return s
  s.o2Held = held
  return s
}

export function applyReset(s: GameState): GameState {
  if (!s.brownout) return s
  s.brownout = false
  return s
}
```

`loop.ts` 改成薄包裝（行為必須**零改變**）：

```ts
import { applyToggleDevice, applySetO2Held, applyReset } from './input'
export function toggleDevice(id: DeviceId): void { state = applyToggleDevice(state, id) }
export function setO2Held(held: boolean): void   { state = applySetO2Held(state, held) }
export function doReset(): void                  { state = applyReset(state) }
```

### 驗收

- `npx tsc --noEmit` 綠。
- `npx vitest run` 維持全綠（現有 59 個測試行為不變——這是純重構，不准改任何斷言）。
- 人在瀏覽器點按鈕，行為跟重構前一模一樣（手動確認一次即可）。

---

## 任務 T-081：`sim/playerAgent.ts`

### 設計原則

- 玩家**每模擬秒**做一次決策，不是每幀。對齊 [D-003](../../docs/SPEC_DECISIONS.md)
  「隨機與決策都以模擬秒為單位」，也符合真人手速（一秒做幾個動作，不是一秒做 60 次）。
- 決策是**宣告意圖**，不是直接改 state。runner 負責把意圖透過 `input.ts` 套到 state。
  這樣 agent 永遠不能繞過遊戲規則（鎖定中、跳電中按了也沒用，跟真人一樣）。
- agent 是純函式：看 state（唯讀）→ 回傳意圖。不准改 state、不准 `Math.random()`
  （要隨機就讀傳入的 `state.rng`，保持決定性）。

### 型別合約

```ts
import type { GameState, DeviceId } from '../src/game/state'

/**
 * 本模擬秒玩家想做的事。
 * - toggles：想「切換」哪些設備（off↔on）。runner 對每個 id 呼叫 applyToggleDevice。
 *   注意是「切換」不是「設成 on」——對齊真人按鈕語意（按一下翻面）。
 * - o2Held：本秒是否按住補氧閥（持續意圖，不是脈衝）。
 * - reset：本秒是否要點 RESET（只在跳電時有意義）。
 */
export type PlayerIntent = {
  toggles: DeviceId[]
  o2Held: boolean
  reset: boolean
}

export type PlayerAgent = {
  /** 報表/斷言用的名字，例如 'do-nothing'、'rotate'。 */
  name: string
  /** 一句話描述這個策略想驗證什麼。 */
  description: string
  /**
   * 每模擬秒呼叫一次。
   * @param s 當前狀態（唯讀；實作者請勿改 s）
   * @param t 已過的整數模擬秒（0,1,2,...）
   * @returns 本秒的操作意圖
   */
  decide(s: Readonly<GameState>, t: number): PlayerIntent
}

/** 沒有任何動作的意圖，給策略當預設回傳。 */
export const IDLE: PlayerIntent = { toggles: [], o2Held: false, reset: false }
```

### 給實作者的注意

- `decide` 拿到的 `s` 標成 `Readonly`，但 TS 的 readonly 不深層。**靠紀律別改它**，
  runner 也不會把同一個物件 alias 出去讓你誤改。
- agent 可以有自己的 closure 狀態（例如記「上次開導航是第幾秒」）嗎？**可以**，
  用工廠函式回傳 agent（見 `SPEC_strategies.md` 的 `makeRotateAgent()`）。
  但那是 agent 自己的記憶，不是遊戲 state。
- `toggles` 回傳同一個 id 兩次 = 切兩次 = 等於沒切，別這樣。

### 驗收

- `npx tsc --noEmit` 綠。
- 這支只有型別與一個常數，沒有執行邏輯，所以**不需要測試**；它的正確性由
  runner/strategies 的測試間接覆蓋。
