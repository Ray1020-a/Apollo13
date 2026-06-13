# SPEC → `sim.test.ts`

> 塞進 CI 的決定性斷言。這是 gate：紅了代表遊戲壞了或平衡跑掉。
> 任務 T-085。依賴：T-082（runner）、T-083（strategies）。

---

## 哲學

`run.ts` 給人看趨勢，`sim.test.ts` 給機器把關。每條斷言必須**決定性**
（固定 seed + 固定策略 → 固定結果），否則 CI 會閃爍，比沒測還糟。

斷言分兩層：

1. **引擎正確性**（一定要過，過不了 = bug）：勝負判定、跳電、決定性。
2. **平衡特性**（過不了 = 平衡跑掉，可能要調數值，回報而非硬改斷言）。
   這層斷言**刻意寬鬆**（用範圍不用精確值），容忍策略啟發式微調，但守住「該贏的贏、該死的死」。

> 鐵律延伸（[AGENT_PROTOCOL](../../docs/AGENT_PROTOCOL.md)）：**不准為了讓測試變綠而偷改斷言遷就壞實作。**
> 平衡斷言掛了，先判斷是「策略寫爛」還是「遊戲真的不平衡」，後者寫進 PROGRESS_LOG。

---

## 必備斷言清單

### A. 決定性（引擎層，最重要）
```
對每個 STRATEGIES 裡的策略：
  runGame(agent, {seed: 7}) 跑兩次 → 兩個 RunResult 深度相等（含 timeline）。
```
這條保護整個工具的地基。先寫它。

### B. 與既有 balance.test 一致（引擎層）
```
doNothing + rng=()=>0 等價設定下，結果應呼應 balance.test：
  （runner 用 mulberry32(seed)，無法直接塞 ()=>0，所以這條改測：）
  doNothing 任一 seed → outcome 'lose'。
```
> 不要在 sim 裡重測 balance.test 已測的精確 480s——那是 balance.test 的職責，別重複。
> 這裡只確認「runner 跑出來的死亡跟既有引擎同調」。

### C. 各 oracle 策略的預期結局（混合層）
| 策略 | 斷言（seed 固定，例如 1） |
|------|--------------------------|
| `doNothing` | `outcome==='lose'`，導航秒 = 0 |
| `co2Only` | `outcome==='lose'`，`stats.maxCo2` 被壓住（< 致死，證明濾毒有效），死因不是 co2 |
| `panic` | `stats.brownouts >= 1`，`final.mainPwr < 100`（跳電扣電生效） |
| `navOnly` | `stats.navOnSeconds > 0`，撐過 deviation 第一波（`endSecond` 明顯 > doNothing 的） |

### D. 衝關探針（平衡層，寬鬆）
```
rotate 策略，跑種子組 [1,2,3,7,42]：
  斷言「至少能撐到 endSecond >= 300」（離 480 終點不算太遠）。
  —— 若想斷言「至少一個 seed 能 WIN」，先用 run.ts 確認真的贏得了再加，
     否則先留 TODO 註解，別寫一條注定紅的斷言。
```
> rotate 的精確輸贏取決於啟發式調校。**先用 `run.ts` 探出實際能到哪，再回頭把這條斷言收緊。**
> 這是唯一允許「先寬後緊」的地方，且必須在註解寫明當前 run.ts 觀察到的實際數字。

### E. 不變量（引擎層，跑任何策略都該成立）
```
對 rotate 整局 timeline 每一幀：
  o2Tank ∈ [0,100]、mainPwr ∈ [0,100]、co2 >= 0、dev ∈ [0,100]、liqO2 >= 0。
  phase 一旦離開 'playing' 就不再變回（單向）。
```
這條抓「數值跑出合理範圍」「死了又復活」這類深層 bug，比結局斷言更能挖出問題。

---

## 寫法（對齊既有測試風格）

跟 `tests/balance.test.ts` 同風格：`describe` + `it`，中文敘述講清楚在驗什麼主張。
放在 `sim/sim.test.ts`，vitest 預設會掃到（或確認 `vite.config.ts` 的 test include 涵蓋 `sim/`）。

> 確認 `vite.config.ts` / vitest 設定有沒有把 `sim/**` 納入 test 掃描範圍；
> 沒有就加，或把測試檔放 `tests/sim.test.ts` 並 import `../sim/...`。實作者擇一並記在 README。

---

## 驗收（T-085）

- `npx vitest run` 全綠（含既有 59 個 + 新增）。
- 決定性斷言（A）通過。
- 平衡斷言（D）若收緊不了，留 TODO + run.ts 實測數字註解，不留紅燈。
