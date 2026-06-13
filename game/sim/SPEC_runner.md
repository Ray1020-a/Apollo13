# SPEC → `runner.ts`

> headless 模擬引擎。給一個策略 + 種子，跑完整局，回傳結果與時間軸。
> 任務 T-082。依賴：T-080（input.ts）、T-081（playerAgent.ts）。

---

## 職責

把「真人玩一局」壓縮成一個純函式呼叫：

```
runGame(agent, opts) ──> RunResult
```

它做的事，每模擬秒一輪：

1. 呼叫 `agent.decide(s, t)` 拿本秒意圖。
2. 透過 `input.ts` 把意圖套到 state（先 reset、再 toggles、最後 o2Held），跟真人點按鈕走同一條規則路徑。
3. 跑 60 次 `step(s, FIXED_DT)`（= 1 模擬秒），對齊主迴圈的固定步長。
4. 記一筆時間軸快照。
5. 若 `phase !== 'playing'` → 收場，回傳結果。
6. 安全上限：超過 `maxSeconds`（預設 1200）仍未結束 → 標記 `outcome: 'timeout'`，
   避免 agent 寫爛造成無窮迴圈。正常局最長理論 ~689 秒（O2 上限，見 D-006），1200 綽綽有餘。

> **為什麼一秒 decide 一次、然後跑 60 步**：對齊 D-003（決策/隨機以模擬秒為單位）。
> 在這一秒內 agent 的意圖固定（o2Held 維持、設備開關狀態維持），60 個 step 共享它，
> 跟主迴圈裡「玩家按了就維持到下次再按」的行為一致。

---

## 對外型別

```ts
import type { GameState, Phase, LoseReason } from '../src/game/state'
import type { PlayerAgent } from './playerAgent'

export type RunOptions = {
  seed?: number        // 預設 1；注入 mulberry32(seed) 當 state.rng
  maxSeconds?: number  // 安全上限，預設 1200
  record?: boolean     // 是否記完整時間軸，預設 true（CI 大量跑時可關掉省記憶體）
}

export type Snapshot = {
  t: number            // 模擬秒
  eta: number; mainPwr: number; o2Tank: number; liqO2: number
  co2: number; temp: number; dev: number; amp: number
  heater: boolean; co2Filter: boolean; navComp: boolean
  brownout: boolean
}

export type RunResult = {
  agent: string
  seed: number
  outcome: 'win' | 'lose' | 'timeout'
  loseReason: LoseReason | null
  endSecond: number          // 結束在第幾模擬秒
  final: Snapshot            // 結束當下的快照
  timeline: Snapshot[]       // record=false 時為空陣列
  // 一眼看穿這局的衍生統計：
  stats: {
    brownouts: number          // 跳電次數
    degraded: string[]         // 結束時降效的設備
    minTemp: number; minO2: number; maxCo2: number; maxDev: number
    navOnSeconds: number       // 導航累計開了幾秒（離 480 多遠 = 離贏多遠）
  }
}
```

---

## 實作骨架（給實作者）

```ts
import { initialState, computeAmp } from '../src/game/state'
import { step } from '../src/game/systems/index'
import { applyToggleDevice, applySetO2Held, applyReset } from '../src/game/input'
import { FIXED_DT } from '../src/game/constants'
import { mulberry32 } from '../tests/helpers'

function snapshot(s: GameState, t: number): Snapshot { /* 抄欄位 + amp = computeAmp(s) */ }

export function runGame(agent: PlayerAgent, opts: RunOptions = {}): RunResult {
  const seed = opts.seed ?? 1
  const maxSeconds = opts.maxSeconds ?? 1200
  const record = opts.record ?? true

  const s = initialState()
  s.rng = mulberry32(seed)         // 決定性！覆蓋預設的 Math.random

  const timeline: Snapshot[] = []
  // 統計累加器：brownouts、navOnSeconds、minTemp...（每秒更新）
  let t = 0
  for (; t < maxSeconds && s.phase === 'playing'; t++) {
    const intent = agent.decide(s, t)

    // 套用意圖：順序固定 reset → toggles → o2Held（理由見下）
    if (intent.reset) applyReset(s)
    for (const id of intent.toggles) applyToggleDevice(s, id)
    applySetO2Held(s, intent.o2Held)

    // 偵測跳電「邊緣」：跑這 60 步前先記 brownout，跑完比對 → 統計跳電次數
    const wasBrownout = s.brownout
    for (let f = 0; f < 60; f++) step(s, FIXED_DT)
    if (!wasBrownout && s.brownout) stats.brownouts++
    // navComp.on 在這秒任一刻為真就算（簡化：用這秒結束的狀態近似）→ navOnSeconds++

    if (record) timeline.push(snapshot(s, t + 1))
    // 更新 min/max 統計
  }

  return { /* 組裝 RunResult，outcome 由 s.phase 推；playing 到頂 = 'timeout' */ }
}
```

### 意圖套用順序為什麼是 reset → toggles → o2Held

- `reset` 先做：跳電中先復電，後面的 toggle 才有機會生效（跳電時 toggle 會被擋）。
- `toggles` 中間：開關設備。
- `o2Held` 最後：補氧意圖獨立於設備開關，放最後最直觀。

這個順序固定下來，模擬才可重現。實作者別自己改順序。

---

## 決定性自我驗證（實作者必做的 sanity check）

同一個 `(agent, seed)` 跑兩次，`RunResult` 必須**逐欄位相等**（timeline 也是）。
若不相等 → 一定有人偷用了 `Math.random()` 或有殘留的 module 狀態。先修這個再往下。

`step()` 與系統都就地改 state（mutable），所以 `runGame` 每次都 `initialState()` 開新的，
不要重用 state 物件。

---

## 驗收（T-082）

- `npx tsc --noEmit` 綠。
- 寫一個臨時 smoke：`runGame(doNothingAgent, { seed: 0 })`
  （doNothing 之後在 strategies.ts，這裡可先 inline 一個 `decide: () => IDLE`），
  斷言 `outcome === 'lose'`、`loseReason === 'co2'`、`endSecond` 約 480
  ——直接呼應 `tests/balance.test.ts` 既有結論，證明 runner 與既有引擎一致。
  這個 smoke 之後併進 `sim.test.ts`（T-085），不要留散落的測試檔。
- 決定性檢查通過（同輸入兩次跑結果相等）。
