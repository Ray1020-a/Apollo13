# 進度日誌

> **逐輪的集體記憶。** 每輪結尾**附加**一筆到最上面（最新在上）。
> 下一輪的人會讀最近 1–2 筆來接上下文，所以寫清楚「坑」與「下一步」。
>
> 每筆格式：
> ```
> ## YYYY-MM-DD — T-代號 任務標題
> **做了什麼**：…
> **關鍵決定**：…（為什麼這樣不那樣）
> **踩到的坑 / 注意**：…
> **下一輪該知道**：…
> ```

---

## 2026-06-13 — T-050 M2 整局平衡驗證

**做了什麼**：新增 `tests/balance.test.ts`，9 個端到端斷言涵蓋 GDD §8 主張。
59/59 全綠。**M2 里程碑達成**（P0–P5 完整）。

**關鍵決定**：
- `rng = () => 0` 把 devDriftSample 固定為 0，孤立 CO2 時間軸，排除 DEV 漂移雜訊。
  這是必要的：真實隨機 DEV 平均 1%/s，~50s 即可撞上 50% 死亡線，永遠到不了 480s。
- 反向測試 `rng = () => 1`（2%/s DEV）確認 deviation 死亡 < 30s，比 CO2 牆更早。
- 數學上確認三條死亡線錯開：CO2(480) < O2(556) < TEMP(600)，這是設計張力核心。
- DEV 50% 邊界測試：嚴格大於（>50%），剛好 50% 不觸死，符合 GDD §4。

**踩到的坑 / 注意**：
- **重要發現**：「無操作 → CO2 480s 死」在真實 RNG 下不成立——DEV 漂移 ~50s 先殺人。
  這是**設計意圖問題**，非 bug：GDD §8 的「不操作」隱含「nav 有在管理 DEV」，
  CO2 牆是「不碰過濾器」的死法，不是「什麼都不動」的死法。
  已在測試中透過 rng=0 孤立，SPEC_DECISIONS 未需新增裁定（現有 D-003 已解釋 DEV 抽樣機制）。

**下一輪該知道**：
- M2 完成。下一步是 **P6（視覺狀態層）**：霜花、黑暈、游標漂移（GDD §7-C），
  仍是草版 UI（div + CSS），不動邏輯。
- P6 任務需由人在 TASKS.md 展開（依 DEVELOPMENT_PLAN §3 加入 T-060 系列）。
- M2 之前不碰素材的鐵律已完成，現在可以開始視覺層。

---

## 2026-06-13 — T-040 輸入控制

**做了什麼**：`loop.ts` 加三個 input handlers（`toggleDevice`/`setO2Held`/`doReset`），
新增 `ui/controls.ts`（建立 5 個按鈕 DOM 元素，dependency injection 接收 handlers），
改寫 `ui/dashboard.ts`（用 `getElementById` 找按鈕，每幀更新文字與 opacity），
更新 `main.ts` 組裝。

**關鍵決定**：
- `controls.ts` 不 import `loop.ts`（會造成 loop→dashboard→controls→loop 循環）；
  改用 DI 讓 `main.ts` 傳入 handlers。`dashboard.ts` 用 DOM ID 找按鈕，不 import controls。
- `CTRL_ID` 常數定義在 `controls.ts`，`dashboard.ts` import 它（這個方向無循環）。
- O2 釋放用 `pointerdown`/`pointerup`/`pointerleave`/`pointercancel` 四事件，確保移走就放開。
- 跳電時：所有開關 opacity 0.3（視覺提示），RESET 按鈕從 `display:none` 變 `inline-block`。

**踩到的坑 / 注意**：無。

**下一輪該知道**：
- 下一個任務是 **T-050（整局平衡驗證）= M2 檢查點**。
- T-050 是端到端測試，需要在瀏覽器玩過一局並確認 GDD §8 心流時間點（或寫 end-to-end 模擬測試）。
- `vitest run` 目前全綠（50/50），T-050 可能需要增加長時間模擬測試。

---

## 2026-06-13 — T-030 勝負判定 + phase 轉換

**做了什麼**：新增 `checkWinLose.ts`，接在 `step()` 末尾（D-007 最後一步）。
五種死法（power/oxygen/co2/temp/deviation）+ 勝利全部實作；11 個測試涵蓋邊界（DEV=50不死、
ETA≤0但電力歸零先判死、非 playing phase 不重複觸發、priority 順序）。
50/50 全綠，tsc 綠。

**關鍵決定**：
- `checkWinLose` 獨立成 `systems/checkWinLose.ts`，簽章 `(s) => GameState`（無 dt，純判斷）。
- DEV 的死亡條件是嚴格大於（`> 50`），50% 本身不算死，和 GDD §4 「超過 50%」一致。
- 勝利檢查放在死亡之後：`if (r) → lose, else if eta≤0 → win`，確保電力剛好歸零那幀算死不算贏。

**踩到的坑 / 注意**：無。SPEC_DECISIONS 公式直接照抄，無歧義。

**下一輪該知道**：
- 下一個任務是 **T-040（輸入控制）**：滑鼠操作改設備狀態、O2 長按、RESET。
- T-040 需要碰 DOM（addEventListener），只能在 `ui/` 層，不進 `systems/`。
- T-040 完成後直接接 T-050（整局平衡驗證）= **M2**。

---

## 2026-06-13 — T-001~T-025 Phase 0-2 骨架 + 狀態 + 系統

**做了什麼**：一輪完成 Phase 0（T-001/T-002）、Phase 1（T-010/T-011/T-012）、Phase 2（T-020~T-025）。
建立 `game/` 下完整骨架：package.json + tsconfig + vite.config、GameState 型別、
全部 GDD 具名常數、6 個純函式系統（devices/power/oxygen/temp/co2/nav）、
固定步長迴圈、文字 dashboard，以及對照 GDD 數值的 39 個單元測試。
`npx tsc --noEmit` 綠、`npx vitest run` 39/39 綠。

**關鍵決定**：
- `computeAmp()` 放在 `state.ts` 作為共用 helper，不放系統目錄，確保 systems 不互相 import。
- 過熱不重置 heat（`d.heat = 0` 被拿掉），完全遵照 D-005 非對稱熱模型。
- 系統執行順序嚴格照 D-007，`elapsed` 在 `step()` 入口先加，各系統不管。
- `devDriftAcc = 1` 作為「nav 剛關閉、下一幀立即抽樣」的就緒旗標（D-003）。
- dashboard 顯示 DEV 時，nav 關閉顯示 `ERR`（符合 GDD §7-A）。

**踩到的坑 / 注意**：
- 測試中需手動 `s.elapsed += FIXED_DT` 模擬 `step()` 的 elapsed 增量；
  忘記這行會讓 lockUntil 邏輯永遠不觸發。
- 設備過熱測試不能精確打 8.0s（浮點），統一用 8.1s/7.9s 夾出邊界。
- nav 漂移測試需 `devDriftAcc = 1` 才能讓第一幀立即抽樣；
  不設的話第一秒漂移量只有 1/60（最後一幀），測試結果與預期不符。

**下一輪該知道**：
- 下一個任務是 **T-030（勝負判定）**，照 SPEC_DECISIONS `checkWinLose` 公式直接加。
- T-030 完成後再接 T-040（輸入控制）→ T-050（整局平衡）= **M2 檢查點**。
- 視覺確認（瀏覽器開 `game/index.html` via Vite）需人做，不需 agent。

---

## 2026-06-13 — 三項設計拍板 + 完整實作規格（SPEC_DECISIONS 定稿）

**做了什麼**：設計者拍板三個 🟡 開放項，全部鎖定。並把 SPEC_DECISIONS 擴成完整實作聖經：
新增「常數總表」（可直接抄進 constants.ts）、「各系統逐幀公式」（6 系統 + 輸入 + 勝負，照抄即可寫）、
「自然死亡時間軸」平衡表。目標：開發時不用思考。

**關鍵決定**：
- **O2 消耗 −0.15 → −0.18%/秒**（D-006，覆寫 GDD）：自然死亡從 667s 提前到 556s。
  使「衝關流可不管 O2，但盲飛拖長就被 O2 逼著點放補氧 → 掉溫 → 開暖氣 → 吃電」的資源互鎖成立。
  最大存活 689s = 必須在此前獲勝的硬天花板。
- **過熱非對稱熱模型**（D-005）：開機 heat+dt、關機 heat−1.5·dt、達上限鎖 5s。
  可持續工作週期 60%，杜絕「快速點放規避過熱」的 OP 打法。CO2 需 ≥50% 開機率，留 10% 縫，能贏但要動腦。
- **跳電門檻 >10A／2 秒**（D-008）確認鎖定。
- DeviceState 欄位 `heatSeconds` 改名 `heat`（語意是熱量計非純秒數）；新增 state `o2Releasing`。

**踩到的坑 / 注意**：
- 自然死亡三條時間軸刻意錯開：CO2 480s < O2 556s < TEMP 600s。改任何相關常數都要回頭檢查這三條還錯不錯得開。
- COOL_RATE=1.5 是手感參數，模型鎖定但數值列 P5 可微調。

**下一輪該知道**：
- SPEC_DECISIONS 現在含**可照抄的常數表與逐幀公式**，寫系統不用再回去推導 GDD。
- 仍從 **T-001** 開始；專案還不是 git repo，先 `git init`。

---

## 2026-06-13 — 規格精修（建立 SPEC_DECISIONS，升級 protocol 與 architecture）

**做了什麼**：把 GDD 數值挖到底，建立 `SPEC_DECISIONS.md`（D-001~D-010），裁定所有模糊/矛盾點。
升級 AGENT_PROTOCOL（加卡關處理、何時問人、任務粒度、Git 紀律）、ARCHITECTURE（固定步長迴圈、
系統執行順序、決定性 RNG、新增模擬簿記欄位）。仍未寫遊戲 code。

**關鍵決定**（細節見 SPEC_DECISIONS）：
- ETA 內部存 MET 秒（313200），懲罰用 real 秒 ×652.5 轉回（D-001/D-002）。
- DEV 漂移**每模擬秒抽一次**，非每幀——否則變異數塌縮、期望值分析失真（D-003）。
- 固定步長 FIXED_DT=1/60 + dt clamp，系統永遠收固定 dt（D-009）。
- 全部隨機走注入的決定性 RNG，測試用種子（D-010）。
- 系統執行順序鎖定：devices→power→oxygen→temp→co2→nav（D-007）。

**踩到的坑 / 注意**：
- 發現 GDD 數學矛盾：O2 自然消耗 667 秒 > 一局 480 秒，**單局內不會自然缺氧死**（D-006）。
  這不是 bug 是設計問題，先照字面實作，列 P5 平衡調查。
- 三條 🟡 暫定項待人拍板：過熱能否點放規避(D-005)、O2 是否真實威脅(D-006)、跳電門檻>10A還是嚴格12A(D-008)。

**下一輪該知道**：
- 動任何系統前**先讀 SPEC_DECISIONS**，數值灰色地帶都裁定好了，別重猜。
- 仍從 **T-001** 開始。專案還不是 git repo，請先 `git init`。

---

## 2026-06-13 — 專案初始化（控制平面建立）

**做了什麼**：建立 vibe coding 的協作骨架。寫好 DEVELOPMENT_PLAN、AGENT_PROTOCOL、
TASKS、本日誌、ARCHITECTURE，以及人讀的 status.html。尚未寫任何遊戲 code。

**關鍵決定**：
- 純前端，不做後端（v1 沒有需要伺服器的資料）。
- Vanilla TypeScript + Vite + Vitest，不用 React/Phaser。
- 系統一律純函式 `(state, dt) => state`，好讓 agent 用 vitest 對照 GDD 數值自我驗證，
  不必開瀏覽器就能確認邏輯正確 —— 這是無人駕駛開發的根本。
- 任務優先級 = TASKS.md 裡的順序，不用會漂移的 priority 數字。

**踩到的坑 / 注意**：
- `status.html` 用 `fetch()` 讀 markdown，必須透過 http 開（file:// 會被 CORS 擋）。
  建議用 vite 一起 serve，或 `npx serve`。

**下一輪該知道**：
- 從 **T-001（建立 game/ 骨架）** 開始，它無依賴。
- 開工先讀 AGENT_PROTOCOL.md，照那 12 步走。
- 所有 magic number 去 GDD.md 抄，寫成 constants.ts 的具名常數。
