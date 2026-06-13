# 技術現況與系統合約

> **活的文件。** 反映「現在程式碼長怎樣」，不是「設計打算怎樣」（那是 GDD）。
> 結構/合約一變就更新這裡。下一輪 agent 靠這份接上系統介面。

---

## 現況

- **Phase 0-2 完成**（T-001~T-025，2026-06-13）。
- `npx tsc --noEmit` 綠、`npx vitest run` 39/39 綠。
- 下一步：T-030 勝負判定，加 `checkWinLose()` 進 `step()`。

---

## 目錄結構（已落地）

```
game/
├── index.html
├── package.json          Vite + TS + Vitest
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.ts           → import { startLoop } from './game/loop'; startLoop()
│   ├── game/
│   │   ├── constants.ts  所有 GDD 數值（具名常數）
│   │   ├── state.ts      GameState 型別 + initialState() + computeAmp()
│   │   ├── loop.ts       requestAnimationFrame 主迴圈（固定步長）
│   │   └── systems/
│   │       ├── devices.ts  過熱/鎖定/跳電（GDD 6）
│   │       ├── power.ts    電力消耗（GDD 5-B）
│   │       ├── oxygen.ts   O2 + 液態氧（GDD 5-C）
│   │       ├── temp.ts     溫度（GDD 5-E）
│   │       ├── co2.ts      CO2 累積/過濾（GDD 5-D）
│   │       ├── nav.ts      ETA + DEV（GDD 5-A, 5-F）
│   │       └── index.ts    step() 組合所有系統
│   └── ui/
│       └── dashboard.ts  DOM 文字更新（每幀讀 state）
└── tests/
    ├── helpers.ts        mulberry32 seeded RNG
    └── systems/
        ├── power.test.ts
        ├── co2.test.ts
        ├── temp.test.ts
        ├── oxygen.test.ts
        ├── nav.test.ts
        └── devices.test.ts
```

---

## 核心合約：純函式系統

每個系統都遵守同一個簽章。這是不可妥協的設計：

```ts
type System = (state: GameState, dt: number) => GameState;
//   dt = 這一幀經過的秒數（real seconds）
//   不准碰 DOM、不准有純函式以外的副作用（Math.random 例外，nav 用得到）
```

主迴圈用**固定步長**（避免不同 framerate 算出不同結果，完整理由見 SPEC_DECISIONS D-009）：

```ts
// loop.ts
const FIXED_DT = 1 / 60, MAX_FRAME = 0.25;
let acc = 0, last = performance.now();
function frame(now: number) {
  acc += Math.min((now - last) / 1000, MAX_FRAME);  // clamp 防死亡螺旋
  last = now;
  while (acc >= FIXED_DT) { state = step(state, FIXED_DT); acc -= FIXED_DT; }
  render(state);                                     // 算繪唯一碰 DOM 的地方
  requestAnimationFrame(frame);
}
```

`step()` 內依**固定順序**串系統（順序有意義，理由見 SPEC_DECISIONS D-007）：

```ts
function step(s: GameState, dt: number): GameState {
  s.elapsed += dt;       // 先更新時間，系統讀到的是本幀的 elapsed
  s = devices(s, dt);   // 1. 先結算過熱/鎖定/跳電
  s = power(s, dt);     // 2. 扣電
  s = oxygen(s, dt);    // 3. o2 / 液態氧
  s = temp(s, dt);      // 4. 溫度（讀 heater 與「實際釋放中」旗標）
  s = co2(s, dt);       // 5. CO2
  s = nav(s, dt);       // 6. ETA / DEV（漂移範圍依賴本幀 temp）
  // checkWinLose 在 T-030（Phase 3）加入
  return s;
}
```

**禁止把可變 dt 餵進系統。** 系統永遠收 `FIXED_DT`。

---

## GameState（已落地，以 state.ts 為準）

```ts
type DeviceId = 'heater' | 'co2Filter' | 'navComp';

type DeviceState = {
  on: boolean;
  heat: number;          // 熱量計（D-005）：開機 +dt，關機 −1.5·dt，達上限過熱
  lockUntil: number;     // 鎖定到 elapsed 的哪一秒；0 = 沒鎖
  degraded: boolean;     // 跳電 50% 機率永久降效
};

type Phase = 'cutscene' | 'playing' | 'win' | 'lose';
type LoseReason = 'power' | 'oxygen' | 'co2' | 'temp' | 'deviation';

type GameState = {
  phase: Phase;
  loseReason: LoseReason | null;
  elapsed: number;       // playing 開始後經過的 real seconds

  // 7 組儀表數值（GDD §7-A）
  eta: number;           // 剩餘 MET 秒數，初始 313200（=87h）
  mainPwr: number;       // %，只降不升（GDD 5-B）
  o2Tank: number;        // %
  liqO2: number;         // 剩餘長按秒數，初始 30（=3 罐 ×10s）
  co2: number;           // PPM
  temp: number;          // °C
  dev: number;           // %

  devices: Record<DeviceId, DeviceState>;
  o2Held: boolean;       // O2 釋放閥是否被按住
  brownout: boolean;     // 是否跳電中（等 RESET）

  // 模擬簿記（不顯示，但系統要用）
  rng: () => number;
  o2Releasing: boolean;
  devDriftAcc: number;
  devDriftSample: number;
  dev30PenaltyApplied: boolean;
  lastDeviceOn: DeviceId | null;
  ampOverRedSeconds: number;
};
```

> `computeAmp(s)` 在 `state.ts` 導出，所有系統透過它取安培數，不重複計算。
> 衍生值（每幀現算、不存 state）：`ampLoad`（由 devices + o2Releasing 加總，D-008）。

---

## 模組依賴方向

```
ui/          ──讀──>  game/state（只讀，唯一碰 DOM）
game/loop    ──呼叫──> game/systems/index（step）
game/systems/* ──讀──> game/state（computeAmp 等 helpers）
game/systems/* ──讀──> game/constants（GDD 數值）
game/systems/* 彼此不互相 import（透過 state 溝通）
```

違反這個方向 = 架構錯了，回報到 PROGRESS_LOG。

---

## 素材庫存（給 P7 用，M2 前別碰）

`../images/` 已有 8 張狀態參考圖，對應 GDD 各狀態，是視覺整合的目標樣貌：

| 檔案 | 對應 |
|------|------|
| `0基礎狀態.jpg` | 正常遊玩儀表板（GDD §7-A 基準畫面） |
| `1爆炸前一刻.png` / `2爆炸.png` | 開場過場（GDD §3） |
| `3複合危機狀態.png` | 黑暈+霜花疊加（GDD §7-C） |
| `4盲飛狀態.png` | 導航關閉、DEV 顯示 ERR（GDD §5-F） |
| `5跳電瞬間.png` | 全黑+RESET（GDD §6-B） |
| `6GameOver.png` / `7勝利／濺落.png` | 結局（GDD §4） |

---

## 測試策略

- 每個系統一個 `*.test.ts`，斷言 GDD 的關鍵時間點（清單見 DEVELOPMENT_PLAN §3）。
- 系統是純函式，所以測試只要：給初始 state → 跑 N 次 dt → 斷言數值。
- 隨機數走 `state.rng`（D-010），測試注入 `mulberry32` seed 或固定值（`() => 0` / `() => 1`）。
- devices 測試中需手動 `s.elapsed += FIXED_DT`，模擬 `step()` 的 elapsed 增量行為。
