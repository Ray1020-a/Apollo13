# SPEC → 導航改為「修正燃燒視窗」(方案 A)

> 把導航從「開著放生 = ETA 連續遞減」改成**間歇式燃燒視窗**：每隔一段時間開一個視窗，
> 你必須在視窗內把 DEV 對準、按住點火，ETA 才以高推力推進。視窗之間是滑行（coast），
> ETA 凍結、導航關掉時 DEV 會漂移。
>
> 對應決策 **D-012**。任務 **P-burn（T-090~T-094）**。
> 動工前先讀 [`AGENT_PROTOCOL.md`](./AGENT_PROTOCOL.md) 與 [`SPEC_DECISIONS.md`](./SPEC_DECISIONS.md)。

---

## 0. 為什麼要這樣改（三個目標，缺一不可）

1. **修掉「RNG 在高手線空轉」**：現況導航全程開 → `nav.ts` 永遠走修正分支、永不抽樣漂移，
   `state.rng` 與 `DEV_DRIFT_MAX_COLD`（冷了更難開船）在熟練玩家身上完全沒作用
   （sim 實證：rotate 五種子結局**一模一樣**）。視窗之間導航關著 → 漂移分支復活 → 種子有作用、低溫懲罰有牙。
2. **貼合歷史**：平台斷電後慣性導航失準，Lovell 用太陽＋地球明暗線**手動對準、特定時間點手動點火**
   （著名的 PC+2 燃燒）。這正是「間歇 × 對準 × 點火」。
3. **不毀掉 sim 探針**：勝負押在「視窗時機 + 對準 + 按住」這種**狀態邏輯**上，agent 完全可重現
   → sim 照樣秒級回答「人贏不贏得了、容錯多大」。**嚴禁**把勝負押在類比手眼對準（見 §4 升級接縫）。

---

## 1. 機制規格

### 1-A. 視窗排程（決定性、可讀）
- 每 `BURN_INTERVAL` 秒開一個視窗，每次開 `BURN_WINDOW_SECONDS` 秒。
- **判定式（無狀態、純由 elapsed 推）**：`inWindow = (elapsed % BURN_INTERVAL) < BURN_WINDOW_SECONDS`。
  - 好品味：不存 `windowOpen` 旗標、不做開關事件，現算。跟 `computeAmp` 一樣是衍生值。
- 視窗排程**先做成決定性**（不抽 RNG）。隨機性自然從「視窗之間的漂移」進來，不需要再給視窗加亂數。

### 1-B. ETA 只在視窗內、按住點火、且對準時才推進
在視窗內，且 `navComp.on && dev <= BURN_DEV_TOLERANCE && burnInput > 0`：
```
eta -= COMPRESSION_BURN * dt * burnInput      // 高推力，burnInput ∈ [0,1]
```
- 視窗外：ETA **凍結**（滑行）。不遞減也不靠導航遞減。
- `COMPRESSION_BURN` 遠大於舊的連續 `COMPRESSION`（一次點火是大脈衝，不是涓流）。數值見 §2。

### 1-C. DEV 對準 / 漂移（這裡是 RNG 的家）
- `navComp.on`：**修正**，`dev -= BURN_REALIGN_RATE * dt`（floor 0）、`devDriftAcc = 1`（沿用 D-003 預備抽樣）。
  - `BURN_REALIGN_RATE` 設快，讓「臨開窗才對準」可行 → 玩家沒理由整局開著導航乾耗安培 → 視窗之間自然關導航 → 漂移發生。
- `navComp.off`：**漂移**，沿用現況 `nav.ts` 的漂移＋漂移債（D-002）：
  ```
  dev += driftSample * dt（cold 時 driftSample 上限 2→3）
  eta += drift * DEV_PENALTY_PER_PCT * COMPRESSION        // 漂移債仍在：放著 DEV 亂跑會倒扣
  ```
  > 注意漂移債仍乘**舊的** `COMPRESSION`（real 秒 ×652.5 的語意，D-002 不變），不是 `COMPRESSION_BURN`。
- `dev > DEV_BIG_THRESHOLD(30)` 一次性懲罰（D-002）沿用不動。

### 1-D. 戰術後果（給設計者看，不是給實作者）
視窗之間關導航省安培去顧 CO2／溫度 → DEV 漂移；開窗時若 DEV 漂太高（或正逢低溫使漂移更兇），
要花掉視窗前段去對準 → 真正能點火的秒數變少 → 進度落後。**種子不同、冷不冷，結局就不同**——RNG 復活。

---

## 2. 新增常數（`constants.ts`，數值由 sim 鎖定）

```ts
// ── 導航燃燒視窗 ── GDD §5-F 延伸，D-012
export const BURN_INTERVAL = 60          // 秒，每 60s 開一次窗
export const BURN_WINDOW_SECONDS = 20    // 秒，每次開 20s（1/3 工作週期）
export const COMPRESSION_BURN = 2200     // 視窗內每「按住·對準秒」扣的 MET 秒（高推力；★sim 鎖定）
export const BURN_DEV_TOLERANCE = 10     // %，DEV 要壓到這條線內才點得了火
export const BURN_REALIGN_RATE = 3       // %/秒，視窗內快速對準（取代舊 DEV_CORRECT 在此情境的角色）
```

**為什麼 COMPRESSION_BURN ≈ 2200 是起點，不是定論**：
- 勝利需 `eta` 從 313200 → 0。整局可用視窗秒數 ≈ `(局長 / BURN_INTERVAL) × BURN_WINDOW_SECONDS`。
  若局長 ~600s → 約 200 視窗秒；但對準會吃掉前段，有效 < 200。
- 取 `313200 / 約 145 有效燃燒秒 ≈ 2160` → 起點 **2200**，留約 25% 容錯。
- **這是猜測值**。實作完用 sim 反覆跑 `burn`／`rotate` 策略，調到「用心玩能贏、容錯 ~15–25%、亂玩死」。
  調完把最終值與理由寫進 [`PROGRESS_LOG.md`](./PROGRESS_LOG.md)（沿用 D-005/006 的鎖定慣例）。

> 舊 `COMPRESSION = 652.5` **保留**：漂移債（1-C）仍用它。只有「正向推進」改走 `COMPRESSION_BURN`。
> 舊 `DEV_CORRECT / DEV_CORRECT_DEGRADED` 在視窗情境被 `BURN_REALIGN_RATE` 取代；degraded 降效仍要處理（見 §5 註）。

---

## 3. State 變更（`state.ts`）

新增**一個**欄位（輸入層擁有，鏡像 `o2Held`）：
```ts
burnInput: number      // 點火輸入品質 ∈ [0,1]；0 = 沒在點火。初始 0。
```
- 所有權（D-007 延伸）：`burnInput` 由**輸入層**寫（`applySetBurnInput`），`nav` 系統只**讀**。
  跟 `o2Held`（輸入寫）→ oxygen/temp（讀）同模式。不要讓 nav 去寫 burnInput。
- `initialState()` 補 `burnInput: 0`。

> 不需要存 `windowOpen`（§1-A 現算）。不需要新的計時器欄位（用 `elapsed`）。**只加這一個欄位。**

---

## 4. 輸入變更（`input.ts` + `loop.ts`）— 升級接縫在這裡

### 4-A. 新增 handler，與 `applySetO2Held` 並排
```ts
export function applySetBurnInput(s: GameState, quality: number): GameState {
  if (s.brownout) { s.burnInput = 0; return s }      // 跳電中不能點火
  s.burnInput = Math.max(0, Math.min(1, quality))    // 夾 [0,1]
  return s
}
```

### 4-B. 升級接縫（第 1 級先做，第 2 級之後純換皮）
核心吃的是 `quality ∈ [0,1]`，**不在乎它怎麼產生**。`nav.ts` 只有一條式子（§1-B），不分級：

| 級別 | 介面 | `quality` 來源 | sim 能測？ |
|------|------|----------------|-----------|
| **第 1 級（本 SPEC）** | 長按一鍵點火 | `held ? 1 : 0`（布林） | ✅ agent 設 1 即忠實重現 |
| 第 2 級（之後換皮） | 準星對準小遊戲 | 對準程度 0..1（類比） | ⚠ 只測得到「完美對準」天花板 |

- **第 1 級不是另一套機制，是 `quality` 被夾成 {0,1} 的特例** → 零分支、單一程式碼路徑。
- 升級到第 2 級：只換 `loop.ts` 裡產生 quality 的那段 UI，`nav.ts`／`input.ts`／sim 一行不動。
- 升級安全性：第 2 級的類比輸入只會讓遊戲**比 sim 說的更難、絕不更簡單**（agent 餵 1，真人手會抖）。
  所以**在第 1 級用 sim 把平衡鎖死**，第 2 級當作套在已驗證骨架上的皮。

### 4-C. `loop.ts`（UI，第 1 級）
- 綁一個「按住點火」鍵（建議與既有控制風格一致；鍵位由 UI 實作者定，預設可用 `B` 或空白鍵）。
- 按住 → `applySetBurnInput(s, 1)`；放開 → `applySetBurnInput(s, 0)`。跟 `o2Held` 的長按完全同模式。
- 視窗是否開啟要有畫面提示（§1-A 的 `inWindow`）。視覺細節留給 UI 任務，本 SPEC 不規定外觀。

---

## 5. `nav.ts` 改法（精確骨架）

```ts
export function nav(s: GameState, dt: number): GameState {
  const inWindow = (s.elapsed % BURN_INTERVAL) < BURN_WINDOW_SECONDS

  if (s.devices.navComp.on) {
    // 對準：導航開著就修正 DEV（取代舊 DEV_CORRECT；degraded 仍降效，見註）
    const rate = s.devices.navComp.degraded ? BURN_REALIGN_RATE * 0.6 : BURN_REALIGN_RATE
    s.dev = Math.max(0, s.dev - rate * dt)
    s.devDriftAcc = 1

    // 點火：只有「在視窗 + 對準 + 按住」才推進 ETA
    if (inWindow && s.dev <= BURN_DEV_TOLERANCE && s.burnInput > 0) {
      s.eta = Math.max(0, s.eta - COMPRESSION_BURN * dt * s.burnInput)
    }
  } else {
    // 漂移（沿用現況，連同漂移債 D-002，仍乘舊 COMPRESSION）
    s.devDriftAcc += dt
    if (s.devDriftAcc >= 1) {
      s.devDriftAcc -= 1
      const max = s.temp < TEMP_FROST ? DEV_DRIFT_MAX_COLD : DEV_DRIFT_MAX
      s.devDriftSample = s.rng() * max
    }
    const drift = s.devDriftSample * dt
    s.dev = Math.min(100, s.dev + drift)
    s.eta += drift * DEV_PENALTY_PER_PCT * COMPRESSION   // 漂移債：用舊 COMPRESSION，不是 BURN
  }

  // DEV>30 一次性懲罰（D-002）沿用
  if (!s.dev30PenaltyApplied && s.dev > DEV_BIG_THRESHOLD) {
    s.dev30PenaltyApplied = true
    s.eta += DEV_BIG_PENALTY * COMPRESSION
  }
  return s
}
```
> **degraded 註**：跳電降效仍要讓對準變慢（這裡示意 ×0.6，沿用 `DEV_CORRECT_DEGRADED/DEV_CORRECT = 0.6` 的比例）。
> 實作者可直接乘 0.6 或新增具名常數 `BURN_REALIGN_RATE_DEGRADED`，擇一，別留魔術數字沒註解。
> **D-007 順序不變**：temp 仍在 nav 前（低溫擴大漂移要先算好 temp）。

---

## 6. sim 變更（`sim/`）

1. **`playerAgent.ts`**：`PlayerIntent` 增 `burnInput: number`（0..1）。`IDLE` 補 `burnInput: 0`。
2. **`runner.ts`**：套用意圖時，在 `applySetO2Held` 後加 `applySetBurnInput(s, intent.burnInput)`（順序：reset → toggles → o2Held → burnInput）。
   - `Snapshot` 可選擇加 `inWindow`/`burnInput` 欄位輔助 `--verbose` 觀察（非必須）。
3. **`strategies.ts`**：新增 `burn` 策略（會抓視窗的「衝關者」）：
   - 視窗外：關導航、優先壓 CO2／顧溫度（沿用 rotate 的優先序）。
   - 視窗將開／已開：開導航對準；`dev <= BURN_DEV_TOLERANCE` 時 `burnInput = 1`。
   - 仍守 AMP 紅線（`canAdd`）、跳電先 reset。
   - 既有 `rotate` 也要能跑（它不會點火 → 應該贏不了，變成對照組）。
4. **`run.ts`**：報表照印；`burn` 策略納入 `STRATEGIES`。

---

## 7. 驗收（P-burn 完成條件）

- `npx tsc --noEmit` 綠、`npx vitest run` 全綠。
- **平衡（sim 實證，缺一不可）**：
  1. `burn` 策略 → **WIN**（五種子），`eta` 歸零。容錯目標 15–25%（調 `COMPRESSION_BURN`）。
  2. **RNG 復活**：`burn` 策略**五種子結局不再完全相同**（至少 `endSecond` 或某終末值有差異）。
     ——這是本次改動的核心目的，沒做到等於白改。
  3. 不點火的策略（`rotate`／`nav-only`）→ **LOSE**（ETA 推不動）。`do-nothing`／`co2-only`／`panic` 仍 LOSE。
- **更新既有斷言**：`sim/sim.test.ts` 的 B-2（目前斷言 rotate must-win）要改寫——
  rotate 在新機制下不該贏，must-win 移到 `burn` 策略。`tests/systems/nav.test.ts` 連續推進的斷言要改成視窗語意。
- **回報**：最終 `COMPRESSION_BURN` 等數值 + 「RNG 是否真的咬到高手」的觀測，寫進 `PROGRESS_LOG.md`。

---

## 8. 風險與開放項（實作者必看）

- **最大風險：若「整局開著導航」仍可行且能贏，RNG 還是死的。** 本設計靠「視窗外 ETA 凍結 + 對準很快
  → 沒理由整局乾開導航」把玩家推向「視窗之間關導航」。**但這要 sim 證實**：若實測發現一直開導航也能贏且結局與種子無關，
  代表張力不足，需加碼（例如：點火時加 `AMP.burn` 把安培頂到紅線，使點火期無法同時洗 CO2；或讓視窗外開導航也耗一點電）。
  先用 §2 數值跑，**讓 sim 告訴你夠不夠**，不夠再加，別一開始就堆機制（YAGNI）。
- 視窗排程目前決定性。若之後想要「視窗開啟時機也帶變數」，再走 `state.rng`，但先別加——漂移已經提供隨機性。
- `BURN_INTERVAL=60`/`WINDOW=20` 是 1/3 工作週期的直覺起點，手感（太頻繁=瑣碎、太稀疏=乾等）由真人測 + sim 共同收斂。
- 本 SPEC 不含第 2 級準星小遊戲 UI（§4-B），那是之後獨立的 UI 換皮任務，不阻塞 P-burn。
