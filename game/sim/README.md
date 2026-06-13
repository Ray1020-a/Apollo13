# 玩家模擬驗證工具（Sim Harness）

> **這個目錄的所有 `.md` 是規格，不是程式碼。**
> Opus 把架構與每支 script 的合約寫死在這裡。下一個（便宜）模型照著把 `.ts` 寫出來、跑起來。
> 動工前先讀 [`../../docs/AGENT_PROTOCOL.md`](../../docs/AGENT_PROTOCOL.md) 與 [`../../docs/SPEC_DECISIONS.md`](../../docs/SPEC_DECISIONS.md)。

---

## 這是什麼、為什麼存在

我們要回答兩個問題，而且要**自動、可重複、秒級完成**：

1. **遊戲會不會壞？** 各種玩法跑完整局，不會炸、不會卡在無法脫離的狀態、勝負判定正確。
2. **遊戲平衡對不對？** 「亂玩會死、用心玩能贏」是否成立？贏的容錯有多大？哪一面牆最先殺人？

`tests/balance.test.ts` 已經證明了「無操作」會怎麼死。這個工具把它推廣成
**「模擬一個會操作的玩家」**：一個 agent 每模擬秒看著儀表、決定要不要開關設備、要不要補氧，然後我們看它活不活得下來。

---

## 核心洞察：時間是免費加速的（回答「怕時間拖太久」）

遊戲系統是純函式：

```ts
step(state, dt) => state
```

整局 = 480 模擬秒 = `480 × 60 = 28800` 次 `step(s, 1/60)`。在記憶體裡跑這串迴圈
**只要幾毫秒**——沒有 `requestAnimationFrame`、沒有真實時鐘、沒有瀏覽器。

> **所以「加速遊戲時間」不需要任何特殊機制。** 不接 wall-clock 就是無限加速。
> 一秒鐘可以跑上百局不同策略 × 不同隨機種子。這就是為什麼驗證主力是 headless，
> 瀏覽器只留一支薄薄的 DOM 煙霧測試（見 `SPEC_browser-smoke.md`）。

決定性來自 `state.rng`（[D-010](../../docs/SPEC_DECISIONS.md)）：注入 `mulberry32(seed)`
（已存在於 `../tests/helpers.ts`），同一個 seed + 同一個策略 = 同一個結果，永遠可重現。

---

## 目錄佈局（規格 → 已落地程式碼）

```
game/sim/
├── README.md               ← 本檔：總覽 + 哲學 + 怎麼跑 + 交接清單
├── SPEC_player-agent.md     ✅ → playerAgent.ts    玩家策略的型別合約（決策介面）
├── SPEC_runner.md           ✅ → runner.ts         headless 引擎：跑 step()、套用決策、錄時間軸
├── SPEC_strategies.md       ✅ → strategies.ts     要模擬的策略目錄（亂玩 / 笨玩 / 衝關）
├── SPEC_cli-report.md       ✅ → run.ts            CLI 入口：跑全部策略×種子，印報表
├── SPEC_assertions.md       ✅ → sim.test.ts       塞進 CI 的決定性斷言（vitest）
└── SPEC_browser-smoke.md    ☐  → browser-smoke.spec.ts  選配：Playwright DOM 煙霧（T-086，待做）
```

依賴方向（誰 import 誰）：

```
sim.test.ts ─┐
run.ts ──────┼─> strategies.ts ─> playerAgent.ts
             └─> runner.ts ──────> playerAgent.ts
runner.ts ─> ../src/game/{state,systems/index,input,constants}
strategies.ts ─> ../src/game/{state,constants}（只讀數值來判斷該怎麼決策）
```

**鐵律延伸**：sim 不准 import `ui/`、不准碰 DOM、不准 `Math.random()`（一律走 `state.rng`）。
sim 是 `game/` 純函式核心的第二個消費者（第一個是 `tests/`），它證明核心可以脫離畫面獨立運轉。

---

## 前置依賴（✅ 已完成 T-080）

`src/game/input.ts` 已落地：`applyToggleDevice` / `applySetO2Held` / `applyReset` 三個純函式。
`loop.ts` 已改成薄包裝，`runner.ts` 直接呼叫同一套規則。單一真相，零漂移。

---

## 怎麼跑

```bash
# headless 模擬（主力）— 跑完整局只要毫秒
npx tsx sim/run.ts                           # 全部策略 × 預設種子 [1,2,3,7,42]
npx tsx sim/run.ts --seed 42                 # 指定種子
npx tsx sim/run.ts --strategy rotate --verbose   # 單一策略，印每 10 秒時間軸

# CI 斷言（決定性，塞進既有 vitest，74/74 綠）
npx vitest run

# 瀏覽器煙霧測試（選配，T-086 待做）
# npx playwright test sim/browser-smoke.spec.ts
```

> `tsx` 已安裝（`@types/node` 同步安裝）。直接 `npx tsx sim/run.ts` 即可。

---

## 「遊戲到底贏不贏得了？」— 這工具的隱藏價值

要贏必須 ETA 歸零（導航全程開等於 480 秒），但：

- AMP 紅線 10A：暖氣 3 + 濾毒 5 + 導航 4 = **12A**，三個不能同時開 → 必須分時輪流。
- 導航一關，DEV 就漂移、還倒扣 ETA（漂移債，D-002）。
- 同時 CO2 要壓、溫度要顧、O2 會漏。

這是一個**硬最佳化問題**。我們其實不確定人類玩得贏、容錯多大。
這個 harness 不只是回歸測試——它是**平衡調校的探針**：讓「衝關策略」去撞，
就知道目前數值下勝利是否可達、邊際有多少。結果若顯示「再強的策略都贏不了」，
那是設計 bug，回報到 `PROGRESS_LOG.md`，可能要回頭調 GDD 數值。

---

## 交接清單

- [x] T-080：`src/game/input.ts` 抽出三個純函式 handler，`loop.ts` 改用它，`tsc` + 既有測試全綠
- [x] T-081：`sim/playerAgent.ts` 型別合約
- [x] T-082：`sim/runner.ts` headless 引擎 + 時間軸記錄
- [x] T-083：`sim/strategies.ts` 策略目錄（5 個）
- [x] T-084：`sim/run.ts` CLI + 報表
- [x] T-085：`sim/sim.test.ts` 決定性斷言進 CI（74/74 綠）
- [ ] T-086（選配）：`sim/browser-smoke.spec.ts` Playwright 煙霧測試（依賴 T-071）

完整任務卡（依賴 + 驗收）見 `../../docs/TASKS.md`。

**✅ 平衡已修（2026-06-13）**：原本 25 局 0 勝——勝利**數學上不可達**。
病根是 `navComp` 也會過熱，把導航工作週期壓到 ~57%，而勝利需要導航淨開滿 480s。
修正：`OVERHEAT_LIMIT` 移除 navComp（過熱是發熱設備的物理特性，固態電腦不過熱；
設備共通本質是耗電 AMP，不是過熱）。現在 `rotate` 全 5 種子 WIN，命懸一線轉為溫度（收在 ~3.2°C）。
B-2 斷言已收緊為 must-win。詳見 `../../docs/PROGRESS_LOG.md` 2026-06-13 條目。
