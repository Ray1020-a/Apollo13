# 規格裁定（SPEC DECISIONS）

> **GDD 是設計意圖，這裡是工程裁定 + 完整實作規格。**
> 目標：開發時**不用思考**。所有數值、公式、邊界都固定在這裡，照抄就能寫完。
>
> 動任何系統前先讀這裡。遇到這裡沒涵蓋的新模糊 → 在這裡新增裁定，別默默自己決定。
>
> 狀態標記：🔒 鎖定（照做）｜ 🟡 模型鎖定但數值 P5 可微調

---

## 第一部分：裁定（為什麼這樣算）

### D-001 — ETA 內部表示與壓縮 🔒
- `eta` 內部存 **MET 秒**，初始 `313200`（= 87h × 3600）。COMPRESSION = **652.5**。驗算 313200÷652.5 = 480。
- 導航開啟每幀 `eta -= 652.5 * dt`。顯示時格式化 MET 秒 → `HH:MM:SS`。
- 勝利：`eta <= 0 && mainPwr > 0`。
- 480 秒是「導航全程開」的理論最短，實際因盲飛省電會更長。別把 480 寫死成局長。

### D-002 — ETA 懲罰用「真實秒」×652.5 轉回 🔒
在 480 秒的遊戲裡「+N 秒」只有理解成 real 秒才有意義（30 MET 秒 = 0.046 real 秒，無感）。
- 盲飛漂移債：導航關時 ETA 暫停扣減，但每幀 `eta += 本幀DEV漂移% * 0.5 * 652.5`。
- 大偏移懲罰：DEV 首次 `> 30%` 時一次性 `eta += 30 * 652.5`，用 `dev30PenaltyApplied` 上鎖只觸發一次。

### D-003 — 隨機取樣以「模擬秒」為單位，不是每幀 🔒
每幀抽樣會讓變異數塌縮、破壞 GDD §5-F 期望值分析。**每模擬秒抽一次**，攤在該秒各幀套用。
實作見下方 nav 系統公式（用 `devDriftAcc` / `devDriftSample`，導航開啟時把 acc 設為 1 自我預備）。

### D-004 — 跳電「最後那個設備」的定義 🔒
- `lastDeviceOn`：設備每次 off→on 就更新成它（在輸入處理設定）。
- 安培 > 紅線連續 2 秒 → 跳電三層懲罰：
  1. 所有撥動開關強制 off、`brownout=true`、畫面黑 1 秒，需點 RESET 清除。
  2. `mainPwr -= 3`（一次性，clamp ≥0）。
  3. `if rng() < 0.5: devices[lastDeviceOn].degraded = true`。
- 降效效果（具體值見常數表）：過濾器 40→25、暖氣 0.1→0.06、導航校正 −1→−0.6（ETA 倒數不受影響）。
- `brownout` 為真時所有系統跳過設備效果，輸入鎖死，只有 RESET 有效。

### D-005 — 過熱用「非對稱熱模型」，杜絕快速點放 🔒（COOL_RATE 數值 P5 可微調）
**核心**：升溫快、散熱慢，且**關掉才散熱、不歸零**。這樣快速點放無法規避過熱。
- 開著：`heat += dt`。關著（或鎖定中）：`heat -= COOL_RATE * dt`（floor 0）。
- `heat >= 過熱上限` → 強制 off、鎖定 5 秒（`lockUntil = elapsed + 5`）。鎖定期間 heat 持續散，不特別歸零。
- COOL_RATE = **1.5** → 可持續最大工作週期 = 1.5/(1.5+1) = **60%**。
  - CO2 控制需 ≥50% 開機率，60% 上限留一點縫：能贏，但點放無法逼近 100%（杜絕 OP）。
  - 想衝就燒一段（最多到上限前一刻）猛清，再吃散熱代價。模型鎖定，1.5 這個數字 P5 可調手感。

### D-006 — O2 自然消耗重算為 −0.18%/秒 🔒（覆寫 GDD §5-C 的 −0.15）
**理由**：補氧總預算固定（3 罐 = +24%），消耗率必須落在「用滿 3 罐救得回」與「不管會死」之間。
- −0.18%/秒 → 自然死亡 **556 秒**（100÷0.18），最大存活（含 3 罐）= 124÷0.18 = **689 秒**。
- 效果：480 秒衝關流自然剩 13.6%（可不管 O2）；一旦盲飛拖過 ~550 秒，O2 先殺你 → **逼點放補氧 → 掉溫 → 逼開暖氣 → 吃電吃安培**。資源互鎖，達成「有管理就活、沒管理就死」。
- 補氧本身的溫度副作用（−0.6°C/秒）是它的代價，與此互補，無衝突。

### D-007 — 系統執行順序 🔒
每幀固定：`devices → power → oxygen → temp → co2 → nav → checkWinLose`（理由：devices 先結算斷電狀態；temp 在 nav 前，因低溫擴大漂移；oxygen 在 temp 前，設定「實際釋放中」旗標供 temp 讀）。
**所有權**（一變數一系統寫）：power→`mainPwr`；oxygen→`o2Tank,liqO2,o2Releasing`；temp→`temp`；co2→`co2`；nav→`eta,dev,dev30PenaltyApplied`；devices→`heat,lockUntil,degraded,brownout,lastDeviceOn,ampOverRedSeconds`。`ampLoad` 衍生不存。

### D-008 — 安培紅線 = 跳電線（>10A／2 秒）🔒
- `amp = Σ開著的撥動開關安培 + (實際釋放O2 ? 2 : 0)`。
- `amp > 10` 進危險區（紅閃滋滋聲）；連續 **2 秒** → 跳電（D-004）。
- 紅線=跳電線，消除「10~12A 灰色地帶」特殊情況。副作用：兩開關+按住O2 也可能逼近紅線，讓高負載點放真的有風險（符合 §8 緊張感）。

### D-009 — 固定步長主迴圈 🔒
`FIXED_DT = 1/60`、`MAX_FRAME = 0.25`（clamp 防死亡螺旋）。系統永遠收固定 dt。完整迴圈碼見 ARCHITECTURE.md。

### D-010 — 決定性 RNG 🔒
所有隨機走 `state.rng`（正式 Math.random，測試注入 mulberry32 種子）。系統不准直接 `Math.random()`。

> **開放項：無。** D-005 / D-006 / D-008 已於 2026-06-13 由設計者拍板鎖定。

---

## 第二部分：常數總表（直接寫進 `constants.ts`，照抄）

> 每個常數標 GDD 來源。系統內**不准出現裸數字**，一律引用這裡。

```ts
// ── 時間/迴圈 ──
export const FIXED_DT = 1 / 60;          // D-009
export const MAX_FRAME = 0.25;           // D-009
export const COMPRESSION = 652.5;        // GDD §2

// ── ETA（MET 秒）── GDD §5-A
export const ETA_INIT = 313200;          // 87h
export const DEV_PENALTY_PER_PCT = 0.5;  // real 秒/1% 漂移（D-002）
export const DEV_BIG_THRESHOLD = 30;     // %
export const DEV_BIG_PENALTY = 30;       // real 秒（一次性）

// ── 電力 ── GDD §5-B
export const PWR_INIT = 100;
export const PWR_PER_AMP_SEC = 0.025;    // %/(A·秒)

// ── 安培/跳電 ── GDD §6，D-004/D-008
export const AMP = { heater: 3, co2Filter: 5, navComp: 4, o2Release: 2 } as const;
export const AMP_REDLINE = 10;
export const BROWNOUT_SECONDS = 2;
export const BROWNOUT_PWR_PENALTY = 3;
export const BROWNOUT_DEGRADE_CHANCE = 0.5;

// ── O2 ── GDD §5-C，D-006
export const O2_INIT = 100;
export const O2_DRAIN = 0.18;            // %/秒（覆寫 GDD 0.15）
export const O2_RELEASE_GAIN = 0.8;      // %/秒（按住）
export const LIQO2_INIT = 30;            // 秒（3 罐 × 10s）
export const LIQO2_PER_TANK = 10;        // 顯示用：亮罐數 = ceil(liqO2/10)

// ── CO2 ── GDD §5-D
export const CO2_INIT = 400;
export const CO2_RISE = 20;              // ppm/秒
export const CO2_FILTER_REMOVE = 40;     // ppm/秒（淨 −20）
export const CO2_FILTER_REMOVE_DEGRADED = 25;  // 降效後（GDD §6-B）
export const CO2_LETHAL = 10000;
export const CO2_VIGNETTE = 5000;        // 黑暈（GDD §7-C）
export const CO2_CURSOR = 8000;          // 游標漂移

// ── 溫度 ── GDD §5-E
export const TEMP_INIT = 21;
export const TEMP_NATURAL = 0.035;       // °C/秒 降溫
export const TEMP_HEATER = 0.1;          // °C/秒（開暖氣，淨 +0.065）
export const TEMP_HEATER_DEGRADED = 0.06;// 降效後
export const O2_RELEASE_TEMP = 0.6;      // °C/秒 降溫（按住 O2）
export const TEMP_LETHAL = 0;
export const TEMP_FROST = 10;            // 霜花（GDD §7-C）
export const TEMP_FROST_HEAVY = 5;       // 霜花遮數字

// ── 導航/偏離 ── GDD §5-F
export const DEV_INIT = 0;
export const DEV_CORRECT = 1;            // %/秒（導航開）
export const DEV_CORRECT_DEGRADED = 0.6; // 降效後
export const DEV_DRIFT_MAX = 2;          // 盲飛 [0,2]
export const DEV_DRIFT_MAX_COLD = 3;     // temp<10 時 [0,3]
export const DEV_LETHAL = 50;            // %

// ── 設備過熱 ── GDD §6-A，D-005
export const OVERHEAT_LIMIT = { heater: 12, co2Filter: 8, navComp: 18 } as const; // 秒
export const OVERHEAT_COOL_RATE = 1.5;   // 散熱速率（P5 可調）
export const LOCK_SECONDS = 5;
```

---

## 第三部分：各系統逐幀公式（照抄即可）

> 每個系統簽章 `(s: GameState, dt: number) => GameState`，dt 永遠是 FIXED_DT。
> `step()` 開頭先 `s.elapsed += dt`，再依 D-007 順序呼叫。
> 共用 helper：`computeAmp(s)` = Σ 開著開關的 AMP + (s.o2Releasing ? AMP.o2Release : 0)。

```ts
// 1) devices —— 先結算過熱/鎖定/跳電
function devices(s, dt) {
  const amp = computeAmp(s);
  if (!s.brownout) {
    s.ampOverRedSeconds = amp > AMP_REDLINE ? s.ampOverRedSeconds + dt : 0;
    if (s.ampOverRedSeconds >= BROWNOUT_SECONDS) {
      s.brownout = true;
      for (const id of ['heater','co2Filter','navComp']) s.devices[id].on = false;
      s.mainPwr = Math.max(0, s.mainPwr - BROWNOUT_PWR_PENALTY);
      if (s.lastDeviceOn && s.rng() < BROWNOUT_DEGRADE_CHANCE)
        s.devices[s.lastDeviceOn].degraded = true;
      s.ampOverRedSeconds = 0;
    }
  }
  for (const id of ['heater','co2Filter','navComp']) {
    const d = s.devices[id], locked = s.elapsed < d.lockUntil;
    if (d.on && !locked) d.heat += dt;
    else d.heat = Math.max(0, d.heat - OVERHEAT_COOL_RATE * dt);
    if (d.heat >= OVERHEAT_LIMIT[id]) { d.on = false; d.lockUntil = s.elapsed + LOCK_SECONDS; }
  }
  return s;
}

// 2) power
function power(s, dt) {
  s.mainPwr = Math.max(0, s.mainPwr - computeAmp(s) * PWR_PER_AMP_SEC * dt);
  return s;
}

// 3) oxygen（先算 releasing，供 temp 讀）
function oxygen(s, dt) {
  s.o2Releasing = s.o2Held && s.liqO2 > 0 && !s.brownout;
  if (s.o2Releasing) {
    const use = Math.min(dt, s.liqO2);              // 最後半罐不溢領
    s.o2Tank = Math.min(100, s.o2Tank + O2_RELEASE_GAIN * use);
    s.liqO2 = Math.max(0, s.liqO2 - dt);
  }
  s.o2Tank = Math.max(0, s.o2Tank - O2_DRAIN * dt); // 自然消耗恆發生
  return s;
}

// 4) temp
function temp(s, dt) {
  if (s.devices.heater.on) {
    const rate = s.devices.heater.degraded ? TEMP_HEATER_DEGRADED : TEMP_HEATER;
    s.temp += rate * dt;
  }
  if (s.o2Releasing) s.temp -= O2_RELEASE_TEMP * dt;
  s.temp -= TEMP_NATURAL * dt;                      // 不 clamp，死亡交給 checkWinLose
  return s;
}

// 5) co2
function co2(s, dt) {
  s.co2 += CO2_RISE * dt;
  if (s.devices.co2Filter.on) {
    const rate = s.devices.co2Filter.degraded ? CO2_FILTER_REMOVE_DEGRADED : CO2_FILTER_REMOVE;
    s.co2 -= rate * dt;
  }
  s.co2 = Math.max(0, s.co2);
  return s;
}

// 6) nav（ETA + DEV，每模擬秒抽樣）
function nav(s, dt) {
  if (s.devices.navComp.on) {
    s.eta = Math.max(0, s.eta - COMPRESSION * dt);
    const rate = s.devices.navComp.degraded ? DEV_CORRECT_DEGRADED : DEV_CORRECT;
    s.dev = Math.max(0, s.dev - rate * dt);
    s.devDriftAcc = 1;                              // 預備：下次盲飛首幀立即抽樣
  } else {
    s.devDriftAcc += dt;
    if (s.devDriftAcc >= 1) {
      s.devDriftAcc -= 1;
      const max = s.temp < TEMP_FROST ? DEV_DRIFT_MAX_COLD : DEV_DRIFT_MAX;
      s.devDriftSample = s.rng() * max;
    }
    const drift = s.devDriftSample * dt;            // %
    s.dev = Math.min(100, s.dev + drift);
    s.eta += drift * DEV_PENALTY_PER_PCT * COMPRESSION; // 漂移債（D-002）
  }
  if (!s.dev30PenaltyApplied && s.dev > DEV_BIG_THRESHOLD) {
    s.dev30PenaltyApplied = true;
    s.eta += DEV_BIG_PENALTY * COMPRESSION;
  }
  return s;
}

// 7) checkWinLose（P3 才加）
function checkWinLose(s) {
  if (s.phase !== 'playing') return s;
  let r = null;
  if (s.mainPwr <= 0) r = 'power';
  else if (s.o2Tank <= 0) r = 'oxygen';
  else if (s.co2 >= CO2_LETHAL) r = 'co2';
  else if (s.temp <= TEMP_LETHAL) r = 'temp';
  else if (s.dev > DEV_LETHAL) r = 'deviation';
  if (r) { s.phase = 'lose'; s.loseReason = r; return s; }
  if (s.eta <= 0 && s.mainPwr > 0) s.phase = 'win';
  return s;
}
```

### 輸入規則（T-040，先固定）
- **撥動開關**（heater/filter/nav）：點擊時若 `elapsed < lockUntil` 或 `brownout` → 忽略；否則翻轉。
  發生 off→on 時設 `s.lastDeviceOn = id`。
- **O2 釋放閥**：pointer-down → `o2Held = true`（brownout 時忽略）；pointer-up → `o2Held = false`。
  `liqO2 === 0` 時按鈕顯示失效（oxygen 系統的 releasing 條件自然為 false）。
- **RESET**：僅 `brownout` 時有效，點擊 → `brownout = false`（設備維持 off，玩家自行重開）。

---

## 第四部分：自然死亡時間軸（平衡骨架，給人看）

什麼都不操作時，各資源觸死時間。三條錯開正是設計核心：

| 資源 | 觸死時間 | 公式 |
|------|----------|------|
| CO2（最硬的牆） | **480 秒** | (10000−400)/20 |
| O2 | **556 秒** | 100/0.18 |
| TEMP | **600 秒** | 21/0.035 |
| POWER | 不自然流失 | 只有開設備才扣 |
| 勝利 | 需累積 **480 秒**導航開啟 | 313200/652.5 |

**策略張力**：
- 衝關流（導航全開、480 秒贏）：CO2 靠過濾器壓住、TEMP 自然剩 4.2°C、O2 自然剩 13.6%——可全程不碰暖氣與補氧，但電力吃緊、零容錯。
- 省電流（盲飛拖長）：一旦超過 ~550 秒，O2 先殺你 → 被迫補氧 → 掉溫 → 被迫開暖氣 → 吃電吃安培。省下的電又還回去。
- O2 最大存活上限 689 秒 = 硬性「必須在這之前贏」的天花板。
