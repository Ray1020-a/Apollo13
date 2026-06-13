# SPEC → `browser-smoke.spec.ts`（選配）

> Playwright DOM 煙霧測試。驗「畫面接線對不對」，不驗遊戲數學（數學歸 headless）。
> 任務 T-086（**選配，優先度最低**）。依賴：headless 那組全做完再考慮。

---

## 為什麼這支是選配、而且很薄

headless 模擬已經把**遊戲邏輯**驗到底了。瀏覽器測試只該回答 headless 答不了的問題：

- 按鈕真的存在、點得到嗎？
- 點 `[HEATER]` 真的會 toggle 到 state、文字真的更新嗎？
- CO2 高的時候黑暈 overlay 真的出現嗎？

就這些。**別在瀏覽器裡重測平衡或時間軸**——那是浪費，且慢又脆。
DOM 接線壞掉的機率低，所以這支價值低、放最後。

---

## 瀏覽器的時間問題（這裡才需要「加速」）

headless 不接 wall-clock 所以免費加速。但瀏覽器裡 `loop.ts` 用
`requestAnimationFrame` + `performance.now()`，是**真實時間**——要等 CO2 爬到 5000
觸發黑暈得等真實 250 秒，不可接受。

解法二選一（實作者挑一個，記在本檔）：

### 方案 A（推薦）：直接操作 state，不等模擬
Playwright 不跑完整局，而是：
1. 開頁面，等 loop 起來。
2. 用 `page.evaluate` 直接呼叫遊戲暴露的 debug hook 把某個值設高，看 overlay 反應。

需要 `main.ts` 在 `import.meta.env.DEV` 時掛一個 debug 窗口：
```ts
// main.ts，僅 dev 模式
if (import.meta.env.DEV) {
  (window as any).__APOLLO__ = {
    getState: () => state,        // 需從 loop.ts re-export 或加 getter
    setCo2: (v: number) => { state.co2 = v },
    setTemp: (v: number) => { state.temp = v },
  }
}
```
測試：`await page.evaluate(() => (window as any).__APOLLO__.setCo2(9000))` → 斷言黑暈 div opacity > 0。

> 這個 hook 只在 dev build 存在，正式 build 不含（`import.meta.env.DEV` 守住）。
> 加 hook 要動 `loop.ts`（暴露 state getter）——屬於小改，記得更新 ARCHITECTURE.md。

### 方案 B：時間倍率旗標
`loop.ts` 讀 `?speed=N`，把 `acc += Math.min((now-last)/1000, MAX_FRAME) * speed`。
測試開 `?speed=60` 把 8 分鐘壓成 8 秒。
- 缺點：仍要等數秒、且改了主迴圈時間語意（要小心別讓 `MAX_FRAME` clamp 破壞加速）。
- 優點：測到的是「真的跑模擬」的整條路徑。

**推薦 A**：更快、更穩、不污染主迴圈。B 留給「想驗整條 RAF 路徑」時。

---

## 必備煙霧斷言（少而精）

1. **接線**：頁面載入後，5 個按鈕（heater/filter/nav/o2/reset）都在 DOM，reset 預設隱藏。
2. **toggle**：點 `[HEATER]` → 按鈕文字含 `ON`（或中文「開」，對齊 i18n 後的標籤）。
3. **長按補氧**：對 O2 按鈕 `pointerdown` → `__APOLLO__.getState().o2Held === true`；`pointerup` → false。
4. **黑暈 overlay**：`setCo2(9000)` 後，vignette div 的 opacity 明顯 > 0。
5. **（可選）結局畫面**：若 i18n 任務加了勝負結局畫面（見 I18N_PLAN），驗 lose 時它出現。

> 斷言要對齊 i18n 後的字串。**先做完中文化（T-070 系列）再寫這支**，否則斷英文字串、之後又得改。

---

## 環境

- `npm i -D @playwright/test && npx playwright install chromium`
- Playwright 自己起 vite dev server（`webServer` 設定指向 `npm run dev`）——
  **這是唯一允許跑 dev server 的場合**（Playwright 管它的生命週期，會自動關，不會卡住）。
  一般 agent 開發時仍**禁止**手動跑 dev server。

---

## 驗收（T-086）

- `npx playwright test sim/browser-smoke.spec.ts` 綠。
- debug hook 僅 dev 模式存在（`npx vite build` 後的產物 grep 不到 `__APOLLO__`）。
- 不重測任何 headless 已覆蓋的數學。
