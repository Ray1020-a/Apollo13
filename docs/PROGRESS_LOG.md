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

## 2026-06-13 — T-080~T-085 P-sim 玩家模擬驗證工具完成

**做了什麼**：完成 P-sim 全部六個任務（T-080~T-085）。
- T-080：`src/game/input.ts` 抽出三個純函式 handler，`loop.ts` 改成薄包裝。
- T-081：`sim/playerAgent.ts` 型別合約（PlayerAgent / PlayerIntent / IDLE）。
- T-082：`sim/runner.ts` headless 引擎，注入 mulberry32 決定性 RNG，跑完整局回傳 RunResult + timeline。
- T-083：`sim/strategies.ts` 五個策略（doNothing / co2Only / panic / navOnly / rotate）。
- T-084：`sim/run.ts` CLI，`npx tsx sim/run.ts` 印對齊摘要表，`--verbose` 印時間軸。
- T-085：`sim/sim.test.ts` 決定性斷言進 CI，74/74 全綠（含原有 59 個）。
- tsconfig 加入 `sim/` + 安裝 `@types/node`。

**關鍵決定**：
- `runner.ts` 意圖套用順序固定：`reset → toggles → o2Held`，保證可重現。
- 每模擬秒 60 個 step，對齊 D-003（決策以模擬秒為單位）。
- 不變量斷言（C 層）在 timeline 每幀驗數值範圍，抓深層越界 bug。

**【平衡洞察】rotate 策略死於溫度，約 495~503s（設計師必看）**：
- `navComp(4A) + co2Filter(5A) = 9A`，已達紅線 10A 的 90%，暖氣(3A)無法插入。
- 在 CO2 危險期（> 7000 PPM）策略同時開 co2Filter + navComp，暖氣被鎖死。
- 溫度持續自然下降 −0.035°C/s，約 500 秒觸及 0°C 死亡。
- **根本矛盾**：同時要壓 CO2、推 ETA（導航）、顧溫度，三樣設備總安培 3+5+4=12A > 10A 紅線。
  最佳可持續組合只能同時開其中兩個 → 必須輪轉，但 ETA 歸零需要導航開滿 480s，
  導航不能頻繁關閉 → 贏的可達性存疑。
- **建議**（供設計師決定）：
  A. 降低任一設備的 AMP（例如 co2Filter 從 5A 降至 4A → 三個全開 10A 剛好貼線）。
  B. 降低 ETA 所需壓縮導航時間（例如縮短一局到 400s，降低導航要求）。
  C. 接受目前難度，讓 rotate 策略贏不了，設計師自行拿真人測試決定是否調。
  → 此為設計決策，請回報設計師後再動 GDD 數值。

**踩到的坑 / 注意**：
- tsconfig 預設不含 `sim/`，加進 `include` 後才能 tsc 驗證。
- `process` 需要 `@types/node`，不裝就 tsc 報錯。
- vitest 預設掃整個 `game/` 目錄的 `*.test.ts`，`sim/sim.test.ts` 自動被掃到，不需改 vite.config。

**下一輪該知道**：
- P-sim 全部完成，可獨立往 **P-i18n** 線走（T-070 開始，無依賴）。
- 平衡問題已回報在本日誌，設計師看完再決定要不要調 GDD 數值。
- `npx tsx sim/run.ts --strategy rotate --verbose` 可印詳細時間軸輔助設計師判斷。

---

## 2026-06-13 — 規劃輪（Opus）：i18n + 玩家模擬驗證工具的架構文檔

**做了什麼**：這一輪**不寫 code，只立架構**。產出兩條新工作線的完整規格，供下一個（便宜）模型照著實作：

- **P-sim 玩家模擬驗證工具**：新目錄 `game/sim/`，含 7 份規格（README + 6 份 SPEC_*.md）。
  把「模擬真人玩一局」做成 headless 純函式呼叫，不接 wall-clock → 整局 8 分鐘跑幾毫秒。
  涵蓋：輸入重構（T-080）、玩家策略型別（T-081）、runner 引擎（T-082）、策略目錄（T-083）、
  CLI 報表（T-084）、CI 斷言（T-085）、選配 Playwright 煙霧（T-086）。
- **P-i18n 中文化 + 友善化**：規格 `docs/I18N_PLAN.md`。中英對照（D-011）、集中字典 `ui/strings.ts`、
  另含三項友善化（結局畫面、開場目標、控制圖例）。任務 T-070~T-074。

**關鍵決定**：
- **「怕時間拖太久」是假問題**：系統是純函式 `step(state,dt)`，整局僅 480 模擬秒 = 28800 次 step。
  在記憶體迴圈跑只要毫秒，根本不碰真實時鐘——「加速時間」是免費附贈，不需任何特殊機制。
  瀏覽器（真實時鐘）只留一支薄煙霧測試，且用 dev-only debug hook 直接設值，不等模擬。
- **驗證主力 headless、瀏覽器最薄**：邏輯數學歸 headless（決定性、秒級），DOM 接線歸 Playwright。
  不在瀏覽器重測平衡（慢又脆）。
- **前置重構 T-080**：輸入處理現在綁在 `loop.ts` 的 module state，runner 不能用。抽成純函式
  `src/game/input.ts`，loop 與 runner 共用一份規則 → 單一真相，避免漂移。
- **i18n 中英對照而非純中文**：保 GDD CRT 美學 + 不綁死素材組員。集中字典守解耦鐵律。標 🟡 待人拍板。
- **發現缺口**：目前**沒有勝負結局畫面**，死了只印 `phase: lose / co2`。列為 i18n 最高價值友善化 F1。

**踩到的坑 / 注意**：
- runner 的隨機要注入 `mulberry32(seed)` 覆蓋 `initialState()` 的預設 `Math.random`，否則不可重現。
- `rotate` 衝關策略的輸贏未知——這工具同時是**平衡探針**，回答「遊戲贏不贏得了」。若多 seed 都贏不了
  且差很遠，可能是數值太硬（設計問題，要回報問人），別硬把斷言改綠。
- i18n 任務做完前別寫 browser-smoke（T-086 依賴 T-071），否則斷英文字串之後得重改。

**下一輪該知道**：
- 兩條線都可獨立開工。建議先 **T-080**（解鎖整個 sim 線）或 **T-070**（解鎖整個 i18n 線）。
- 撿任務照舊：`TASKS.md` 順序 = 優先級，P-sim 與 P-i18n 區各自由上而下。
- 這輪純文檔，未動任何 `.ts`，`tsc`/`vitest` 狀態不變（仍 59/59 綠）。

---

## 2026-06-13 — T-061~T-064 P6 視覺狀態層

**做了什麼**：實作 GDD §7-C 全部七種視覺效果（分四個 commit）：
- T-061：CO2 黑暈（CSS `radial-gradient` fixed div，5000→10000 PPM opacity 0→1）
- T-062：TEMP 霜花（兩層：< 10°C 淺藍邊緣漸入；< 5°C 第二層 `backdropFilter blur` 遮字）
- T-063：CO2 游標漂移（> 8000 PPM 安裝 capture-phase pointerdown 攔截，最大 30px 偏移，每 250ms 重抽）
- T-064：設備視覺指示（lockUntil 期間 `btn-overheat` 閃紅 0.4s；degraded `btn-degraded` 閃黃 1.2s；AMP > 10A `#amp-warn` 閃爍）

**P6 達成**。59/59 測試全綠，tsc 綠。

**關鍵決定**：
- 所有視覺效果純 CSS/DOM，完全在 `ui/` 層，零 game logic 改動。
- `effects.ts` 採用懶建立模式（lazy element creation）：第一次呼叫才插入 DOM，之後只改 opacity/class。
- 游標漂移不用 `mousemove` 修改事件座標（做不到），改用 capture-phase `pointerdown` 重新派送到偏移目標 — 點擊「打歪」而非游標偏移，符合「頭暈」語意。
- `btn-overheat` 和 `btn-degraded` 不能同時 active（overheat 優先），確保動畫一次只跑一個。

**踩到的坑 / 注意**：
- CSS animation 會覆蓋 `style.color`。setBtn 在 `dim=false` 時不設 color，避免與 animation 衝突。若之後按鈕需要更精細的顏色控制，改成去掉 `animation` 用 JS 直接改 `style.color`。
- `backdropFilter: 'blur(2px)'` 在 Chromium 需要硬體加速，某些 iframe 環境可能無效 — P7 換素材時評估是否改成 canvas 霜花。

**下一輪該知道**：
- P6 完成，下一步是 **P7（素材整合）**：換上 `../images/` 裡的儀表板圖、按鈕圖、像素字體。
- P7 任務需先看 `../images/` 目錄結構，按 GDD §7-A 佈局對應。
- 視覺效果 overlay（T-061~T-063）的 z-index 分配：vignette=100、frost_light=101、frost_heavy=102；P7 素材 z-index 應在 99 以下，overlay 才能蓋上去。

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
