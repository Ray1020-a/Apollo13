# 網頁中文化 + 友善化規格

> Opus 寫的實作規格。下一個模型照這份把 UI 改成中英對照、加上友善元素。
> **動 code 前讀 [AGENT_PROTOCOL.md](./AGENT_PROTOCOL.md)。** 這份只動 `ui/`，不准碰 `game/` 邏輯。

---

## 核心決策（已裁定，可由人推翻）

### 決策 1：中英對照，不是純中文 🟡
**保留英文點陣標籤，下方/旁邊加中文小字。** 理由：

- GDD §1 視覺定位是「1970 年代黑白點陣 NASA 控制台 + CRT」。`MAIN PWR`、`ETA`、`CO2 LVL`
  這些全大寫英文是那個年代儀表的靈魂。全換中文會殺掉美學。
- 你（使用者）英文不好，需要看得懂——中文小字解決理解問題，英文保留氛圍。兩者不衝突。
- 純中文等於要求素材組員之後重做字體（GDD 要像素英文字體）。中英對照不綁死他們。

> 這是**設計取捨**（會改觀感），標 🟡。若你想要純中文，回一句話，我改規格。
> 已同步寫進 [SPEC_DECISIONS.md](./SPEC_DECISIONS.md) D-011。

### 決策 2：所有中英字串集中到 `ui/strings.ts` 🔒
不准把中文硬寫散落在 `dashboard.ts` / `controls.ts`。開一個 `ui/strings.ts` 當**單一字典**。
理由：

- 對齊鐵律「邏輯與算繪解耦」。字串是表現層資料，集中放，`game/` 永遠不知道有中文這回事。
- 之後要調字、要做純中文/純英文切換，只動一個檔。
- 素材組員 P7 換皮時，文案在一個地方，不用滿地找。

---

## 架構：`ui/strings.ts`

```ts
// ui/strings.ts — UI 文案單一真相。game/ 不准 import 這裡。
export const LABELS = {
  eta:     { en: 'ETA',      zh: '返航倒數' },
  mainPwr: { en: 'MAIN PWR', zh: '主電力' },
  o2Tank:  { en: 'O2 TANK',  zh: '氧氣槽' },
  liqO2:   { en: 'LIQ O2',   zh: '液態氧備援' },
  co2:     { en: 'CO2 LVL',  zh: '二氧化碳' },
  temp:    { en: 'TEMP',     zh: '艙內溫度' },
  dev:     { en: 'DEV',      zh: '航道偏差' },
  amp:     { en: 'AMP',      zh: '電流負載' },
} as const

export const BTN = {
  heater:    { en: 'HEATER',    zh: '暖氣' },
  co2Filter: { en: 'CO2 FILT',  zh: '濾毒' },
  navComp:   { en: 'NAV COMP',  zh: '導航電腦' },
  o2Release: { en: 'O2 RELEASE',zh: '釋放氧氣' },
  reset:     { en: 'RESET',     zh: '復電' },
} as const

export const STATUS = {
  on:        { en: 'ON',  zh: '開' },
  off:       { en: 'off', zh: '關' },
  degraded:  { en: '[!]', zh: '降效' },
  empty:     { en: 'EMPTY', zh: '已耗盡' },
  err:       { en: 'ERR', zh: '訊號中斷' },
  ampOver:   { en: 'AMP OVER REDLINE', zh: '電流超載！' },
  brownout:  { en: 'BROWNOUT', zh: '跳電！點擊復電 RESET' },
} as const

// 結局與說明（友善化用，見下）
export const ENDING = {
  win:  { title: '濺落成功 SPLASHDOWN', body: '組員平安返回地球。任務達成。' },
  lose: {
    power:     '主電力耗盡——艙內陷入永久黑暗。',
    oxygen:    '氧氣耗盡——組員失去意識。',
    co2:       '二氧化碳濃度致死——空氣再也無法呼吸。',
    temp:      '艙溫降至冰點——生命維持失效。',
    deviation: '偏離返航軌道太遠——再也回不來了。',
  },
} as const
```

格式化 helper（dashboard 用）：把 `ETA` 顯示成 `ETA 返航倒數`，按鈕顯示成
`暖氣 HEATER` 之類。實作者定一個 `bi(label) => `${zh} ${en}`` 小函式統一拼接，別到處手拼。

---

## 完整字串清單（要改的每一處）

| 位置 | 現況（英文） | 改成（中英對照） |
|------|--------------|------------------|
| `index.html` `<title>` | `Apollo 13: Power Triage` | `阿波羅 13 號：極限斷電` |
| `index.html` `<html lang>` | `en` | `zh-Hant` |
| `dashboard.ts` 儀表標籤 ×8 | `ETA` `MAIN PWR` … | 走 `LABELS`，例如 `返航倒數 ETA: 87:00:00` |
| `dashboard.ts` AMP 警告 | `⚠ OVER REDLINE` | `⚠ 電流超載` |
| `dashboard.ts` 跳電行 | `** BROWNOUT — CLICK RESET **` | `** 跳電！點擊復電 RESET **` |
| `dashboard.ts` `#amp-warn` 字 | `!! AMP OVER REDLINE !!` | `!! 電流超載 OVER REDLINE !!` |
| `dashboard.ts` 設備狀態 | `ON ` / `off` / `[!]` | `開` / `關` / `降效`（或保留 ON/off + 中文）|
| `dashboard.ts` DEV 盲飛 | `ERR` | `訊號中斷 ERR` |
| `dashboard.ts` O2 空 | `[O2: EMPTY]` | `[釋放氧氣 O2: 已耗盡]` |
| `controls.ts` 5 個按鈕初始字 | `[HEATER: off]` … | 走 `BTN`，例如 `[暖氣 HEATER: 關]` |
| `dashboard.ts` `phase:` 行 | `phase: playing / co2` | 平時可隱藏；結局改用結局畫面（見下） |

> `tick:` 那行是 debug 資訊，中文化沒意義——**保留或在正式版隱藏**（實作者判斷，傾向隱藏給玩家看的版本）。

---

## 友善化（讓頁面對玩家更友善，非純翻譯）

翻譯只解決「看不懂字」。下面這幾項解決「不知道在幹嘛」。**按價值排序，可分批做**：

### F1（高價值）：結局畫面 — 目前完全沒有！
現在死了只在文字板印 `phase: lose / co2`，玩家不知道發生什麼。
加一個覆蓋全屏的結局 overlay（純 DOM/CSS，放 `ui/`）：

- lose：大字「任務失敗」+ `ENDING.lose[reason]` 那句中文死因 + 撐了多久（格式化 elapsed）。
- win：「濺落成功」+ `ENDING.win`。
- 對齊既有 effects.ts 的懶建立 + overlay z-index 慣例（vignette=100…，結局畫面用更高，例如 200）。
- 先不做重玩按鈕（重整頁面即可），別鍍金。

### F2（高價值）：開場目標說明
頁面頂端或第一次進來時，一行中文講清楚怎麼玩、怎麼贏：
> 「目標：撐 8 分鐘讓返航倒數歸零。分時開關設備管理電力、空氣、溫度與航道——別讓任何一項觸及死線。電流別超過 10A，否則跳電。」

放在儀表板上方，或做成可關閉的小提示。純文字即可。

### F3（中價值）：控制區圖例
每個按鈕旁一句話「這顆在幹嘛」：
- 暖氣：升溫，但耗電
- 濾毒：清二氧化碳，開久會過熱
- 導航電腦：推進返航 + 修正航道（沒開會偏航）
- 釋放氧氣：長按補氧，但會急速降溫

### F4（低價值，選配）：分組與留白
把 8 個儀表照「危機類別」分組（生命：O2/CO2/TEMP；任務：ETA/DEV；系統：PWR/AMP），
加點留白與分隔。目前是一坨 `<pre>`，分組能降低認知負荷。**M3 換素材時會重做佈局，
所以這項投資報酬低，除非你現在就想要，否則留給 P7。**

---

## 範圍邊界（別越界）

- ✅ 只動 `game/index.html` 與 `game/src/ui/*`（dashboard、controls、effects、新增 strings.ts、新增結局 overlay）。
- ❌ 不准動 `game/src/game/*`（任何邏輯、常數、系統）。中文化是純表現層。
- ❌ 不碰 `images/` 素材（M2 後才整合，那是組員的事，[鐵律](./AGENT_PROTOCOL.md) 5）。
- ❌ 不加 i18n 框架（i18next 之類）。就一個 `strings.ts` 字典，[別鍍金](./AGENT_PROTOCOL.md)。

---

## 建議任務切分（已加進 TASKS.md，見 P-i18n 區）

| 任務 | 內容 | 依賴 |
|------|------|------|
| T-070 | 建 `ui/strings.ts` 字典 + `bi()` helper | — |
| T-071 | dashboard.ts / controls.ts 全部標籤改走字典（中英對照） | T-070 |
| T-072 | index.html title/lang + AMP/跳電警告中文化 | T-070 |
| T-073 | F1 結局畫面 overlay（勝/敗 + 中文死因 + 存活時長） | T-071 |
| T-074 | F2 開場目標說明 + F3 控制圖例 | T-071 |

每個任務照協定：`tsc` 綠、不破壞既有測試（UI 無單元測試，靠人肉眼 + 之後的 browser-smoke）、
移 TASKS、寫 PROGRESS_LOG。

---

## 驗收（整條 i18n 線）

- 頁面所有玩家看得到的字都有中文（中英對照）。
- 死亡/勝利有看得懂的結局畫面，講清楚為什麼。
- `game/src/game/` 一個字都沒改（`git diff game/src/game/` 為空）。
- 換素材（P7）時這層字典與 overlay 不需重寫，只需換樣式。
