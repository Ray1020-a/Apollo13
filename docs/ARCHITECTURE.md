# 技術現況與系統合約

> **活的文件。** 反映「現在程式碼長怎樣」，不是「設計打算怎樣」（那是 GDD）。
> 結構/合約一變就更新這裡。下一輪 agent 靠這份接上系統介面。

---

## 現況

- 程式碼：**尚未開始**。目前只有控制平面文件。
- 下一步：T-001 建立 `game/` 骨架。

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
  s = devices(s, dt);   // 1. 先結算過熱/鎖定/跳電
  s = power(s, dt);     // 2. 扣電
  s = oxygen(s, dt);    // 3. o2 / 液態氧
  s = temp(s, dt);      // 4. 溫度（讀 heater 與「實際釋放中」旗標）
  s = co2(s, dt);       // 5. CO2
  s = nav(s, dt);       // 6. ETA / DEV（漂移範圍依賴本幀 temp）
  s = checkWinLose(s);  // 7. 判定（P3 才加）
  return s;
}
```

**禁止把可變 dt 餵進系統。** 系統永遠收 `FIXED_DT`。

---

## GameState（草案 — T-010 落地後以實際程式碼為準）

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
  eta: number;           // 剩餘 MET 秒數，初始 313200（=87h）；顯示時格式化成 HH:MM:SS
  mainPwr: number;       // %，只降不升（GDD 5-B）
  o2Tank: number;        // %
  liqO2: number;         // 剩餘長按秒數，初始 30（=3 罐 ×10s）；顯示 = ceil(liqO2/10) 個罐
  co2: number;           // PPM
  temp: number;          // °C
  dev: number;           // %

  devices: Record<DeviceId, DeviceState>;
  o2Held: boolean;       // O2 釋放閥是否被按住
  brownout: boolean;     // 是否跳電中（等 RESET）

  // 模擬簿記（不顯示，但系統要用）
  rng: () => number;        // 注入的決定性 RNG（D-010）
  o2Releasing: boolean;     // 本幀是否實際在釋放 O2（oxygen 算、temp 讀，D-007）
  devDriftAcc: number;      // DEV 漂移的秒累加器（D-003）
  devDriftSample: number;   // 本模擬秒抽到的漂移率（D-003）
  dev30PenaltyApplied: boolean;  // ETA +30s 懲罰是否已觸發（D-002）
  lastDeviceOn: DeviceId | null; // 最後開啟的設備，跳電降效目標（D-004）
  ampOverRedSeconds: number;     // 安培超紅線連續秒數，跳電倒數（D-004, D-008）
};
```

> 衍生值（每幀現算、不存 state）：`ampLoad`（由 devices + o2Held 加總，D-008）。
> 所有模擬常數（COMPRESSION=652.5、FIXED_DT、各速率/閾值）集中在 `constants.ts`，註解標 GDD 章節。

### 關鍵換算（別寫錯）

- **ETA 壓縮**：87h = 313200 MET 秒，壓縮 652.5× → 480 real 秒。
  導航開啟時，每 real 秒 `eta -= 652.5 * dt`。顯示時 `eta` 秒 → `HH:MM:SS`。
- **液態氧**：存「剩餘長按秒數」(0–30)，不存「罐數」。
  顯示用 `Math.ceil(liqO2 / 10)` 算亮著幾個罐。消除「半罐」的特殊情況。
- **安培負載**：由 `devices` 即時加總，不存 state，避免 desync。

---

## 模組依賴方向

```
ui/      ──讀──>  game/state（只讀，唯一碰 DOM）
game/loop ──呼叫──> game/systems/*
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

其他參考：`../阿波羅13號遊戲企劃書.pdf`、`../簡報腳本_企劃版.md`。
這些是**目標畫面**，不是切好的 UI 零件 —— P7 時可能需要再切圖或重做。

---

## 測試策略

- 每個系統一個 `*.test.ts`，斷言 GDD 的關鍵時間點（清單見 DEVELOPMENT_PLAN §3）。
- 系統是純函式，所以測試只要：給初始 state → 跑 N 次 dt → 斷言數值。
- 跳電的機率性降效（50%）：把 `Math.random` 注入或 mock，讓測試可決定性。
