# 開發計劃：《阿波羅 13 號：極限斷電》

> 這份文件是**機器讀**的主計劃。設計聖經在 [GDD.md](./GDD.md)。
> Agent 工作守則在 [docs/AGENT_PROTOCOL.md](./docs/AGENT_PROTOCOL.md)。
> 人看進度請開 [status.html](./status.html)。

---

## 0. 核心判斷

✅ **值得做**：這是一個 60fps 即時狀態機，邏輯全在客戶端。
❌ **不做後端**：v1 沒有任何資料需要伺服器。沒有帳號、沒有排行榜、沒有存檔。
   等遊戲好玩了再談排行榜，那是另一個專案。

**最大的架構洞察**：所有遊戲系統都是**純函式** `(state, dt) => state`。
純函式 = 可單元測試 = agent 不用開瀏覽器就能驗證數學正確性。
這是整個專案能「無人駕駛」開發的根本原因。

---

## 1. 技術棧

| 項目 | 選擇 | 理由 |
|------|------|------|
| 語言 | TypeScript | 型別就是 GDD 數值的合約 |
| 建置 | Vite | 最輕、最快、零設定 |
| 框架 | **無**（Vanilla） | React 的 reconciliation 會跟 game loop 打架；Phaser 是 overkill |
| 測試 | Vitest | 純函式系統可直接驗 GDD 數值 |
| 算繪 | DOM（草版）→ Canvas/CSS（素材版） | 邏輯與算繪解耦，換皮不動邏輯 |
| 音效 | Web Audio API | 後期才接 |

**驗證指令**（agent 每輪必跑）：
```
npx tsc --noEmit      # 型別
npx vitest run        # 系統數學對照 GDD
```
**不要跑 dev server**（會卡住 agent）。視覺由人在瀏覽器肉眼確認。

---

## 2. 目錄結構

```
Apollo13/
├── GDD.md                  # 設計聖經（數值來源，唯一真相）
├── DEVELOPMENT_PLAN.md     # 本檔
├── status.html             # 人讀：CRT 風進度儀表板
├── docs/                   # 機器讀的控制平面
│   ├── AGENT_PROTOCOL.md   # agent 工作循環守則
│   ├── TASKS.md            # 看板：撿任務 + 回報的唯一真相
│   ├── PROGRESS_LOG.md     # 逐輪日誌（記憶）
│   ├── ARCHITECTURE.md     # 活的技術現況 + 系統合約
│   └── SPEC_DECISIONS.md   # GDD 模糊處的工程裁定（全體遵守）
└── game/                   # 遊戲本體（Phase 0 才建立）
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    ├── src/
    │   ├── main.ts
    │   ├── game/
    │   │   ├── state.ts        # GameState 型別 + 初始值
    │   │   ├── loop.ts         # requestAnimationFrame 主迴圈
    │   │   ├── constants.ts    # 所有 GDD 數值（具名常數）
    │   │   └── systems/        # 純函式，無 DOM
    │   │       ├── power.ts    # 電力消耗（GDD 5-B）
    │   │       ├── oxygen.ts   # O2 + 液態氧（GDD 5-C）
    │   │       ├── co2.ts      # CO2 累積/過濾（GDD 5-D）
    │   │       ├── temp.ts     # 溫度（GDD 5-E）
    │   │       ├── nav.ts      # ETA + DEV（GDD 5-A, 5-F）
    │   │       └── devices.ts  # 過熱/鎖定/跳電（GDD 6）
    │   └── ui/
    │       ├── dashboard.ts    # DOM 數值更新
    │       ├── effects.ts      # 霜花/黑暈/游標漂移（GDD 7-C）
    │       └── audio.ts        # Web Audio（GDD 7-D）
    └── tests/
        └── systems/*.test.ts   # 對照 GDD 數值
```

---

## 3. 開發階段（依賴鏈，由上而下做）

每個 Phase 完成才解鎖下一個。Agent 不准跳階。

| Phase | 名稱 | 產出 | 完成標準 |
|-------|------|------|----------|
| **P0** | 骨架 | Vite+TS+Vitest 跑得動，空 game loop 印 tick 計數 | `tsc` 綠、`vitest` 綠、瀏覽器看到 tick 在動 |
| **P1** | 狀態 + 迴圈 | `GameState` 型別、初始值、固定步長迴圈、文字 dashboard | 7 組數值以文字即時更新 |
| **P2** | 系統（核心） | 6 個純函式系統，全部對照 GDD 數值 | 每個系統有單元測試驗關鍵時間點（見下） |
| **P3** | 勝負判定 | GDD §4 五種死法 + 勝利、phase 轉換 | 每種結局可被測試觸發 |
| **P4** | 輸入控制 | 3 撥動開關、O2 長按、RESET 按鈕 | 滑鼠操作能改變狀態 |
| **P5** | 平衡驗證 | 跑通整局，校對所有時間點 | 「不操作 → 第 8 分鐘死於 CO2」等斷言成立 |
| **P6** | 視覺狀態層 | 霜花、黑暈、游標漂移（仍草版 UI） | GDD §7-C 七種效果觸發正確 |
| **P7** | 素材整合 | 換上儀表板圖、按鈕圖、像素字體、CRT shader | 草版 div 換成圖，邏輯零改動 |
| **P8** | 音效 | GDD §7-D 全部音效 | 喀噠/滋滋/警報/心跳就位 |
| **P9** | 開場過場 | GDD §3 像素風開場動畫 | 七段過場可播放 |
| **P10** | 打磨 | 手感微調、效能、邊界 | 60fps 穩定 |

### P2 系統的關鍵驗證點（單元測試直接抄 GDD）

這些是「數學沒寫錯」的試金石，全部來自 GDD §5（每個系統的灰色地帶在 [docs/SPEC_DECISIONS.md](./docs/SPEC_DECISIONS.md) 已裁定，動工前必查）：

- **CO2**：初始 400 PPM、不開過濾器 +20/秒 → 第 480 秒剛好達 10000（GDD 5-D）
- **TEMP**：初始 21°C、自然 −0.035/秒 → 480 秒後 = 4.2°C（GDD 5-E）
- **O2 自然消耗**：−0.18%/秒 → 556 秒耗盡（D-006 覆寫 GDD 5-C 的 −0.15，重新平衡）
- **電力**：9A 持續 → 480 秒消耗 108%（會死，必須點放）（GDD 5-B）
- **液態氧**：每罐長按約 10 秒 = +8% O2、−6°C（GDD 5-C）
- **DEV 盲飛**：常溫平均 1%/秒 = 校正速率；<10°C 時平均 1.5%/秒 > 校正（GDD 5-F）
- **跳電**：12A 持續 2 秒 → 強制斷電 + 扣 3% + 50% 機率降效（GDD 6-B）

---

## 4. 給人看的里程碑

- **M1（P0–P2）**：邏輯心臟跳動。終端機文字就能玩出「資源在流逝」的緊張感。
- **M2（P3–P5）**：完整可玩的草版遊戲。醜，但好玩、平衡正確。← **這是最重要的檢查點**
- **M3（P6–P9）**：換上素材與聲音，變成 GDD 描述的那個 CRT 末日體驗。
- **M4（P10）**：可以給人玩了。

**鐵律**：M2 之前不碰任何素材。先確認好玩，再變好看。
