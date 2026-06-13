# SPEC → `strategies.ts`

> 要模擬的玩家策略目錄。每個策略 = 一個 `PlayerAgent`，驗證一個具體主張。
> 任務 T-083。依賴：T-081（playerAgent.ts）。

---

## 策略的兩種角色

1. **回歸 oracle**：簡單、決定性、結論已知（對照 GDD/balance.test）。壞了代表引擎壞了。
2. **平衡探針**：複雜、想贏，用來回答「這數值下贏不贏得了、容錯多大」。

至少實作以下五個（前四個是 oracle，第五個是探針）。

---

## 數值速查（決策時會用到，全來自 constants.ts）

| 量 | 關鍵數字 |
|----|----------|
| AMP 紅線 | 10A。暖氣 3 / 濾毒 5 / 導航 4 / 補氧 2。**任兩個大的同開很容易破線** |
| 跳電 | AMP > 10 連續 **2s** → 強制全關 + 扣 3% 電 + 50% 降效 |
| 過熱上限 | 暖氣 12s / 濾毒 8s / 導航 18s 開機（散熱 1.5×，工作週期上限 60%） |
| CO2 | +20/s；開濾毒淨 −20/s；10000 致死；起始 400（→ 不管約 480s 死） |
| TEMP | −0.035/s；開暖氣淨 +0.065/s；補氧額外 −0.6/s；0°C 死；起始 21 |
| O2 | −0.18/s；補氧 +0.8/s（耗液氧）；0% 死；液氧共 30s（3 罐） |
| DEV | 導航關時漂移（常溫均 1%/s，<10°C 均 1.5%/s）；開導航 −1%/s 校正；>50% 死 |
| ETA | 導航開每秒 −652.5 MET；歸零且電>0 = **勝利**。理論最短 480s 導航全開 |

---

## 策略清單

### 1. `doNothing`（oracle）
```
decide: () => IDLE
```
- **驗證**：完全不操作的死法。
- **預期**（seeded RNG，非 rng=0）：導航沒開 → DEV 漂移約 50s 撞 50% → `lose / deviation`。
  > 這跟 `balance.test.ts` 的 `rng=()=>0`（孤立成 480s co2 死）**刻意不同**：
  > 那是為了隔離 CO2 牆才把漂移歸零。真實隨機下 DEV 才是不操作的第一殺手。
  > 兩者都對，記得在斷言註解寫清楚是哪種。

### 2. `co2Only`（oracle）
維持濾毒開，管它的過熱（heat 接近 8 就放手散熱），其餘不碰。
```
decide(s, t):
  toggles = []
  // 濾毒：沒開且沒鎖且 heat 低 → 開；（過熱會被引擎自動關，不用自己關）
  if !s.devices.co2Filter.on && s.elapsed >= s.devices.co2Filter.lockUntil:
    toggles.push('co2Filter')
  return { toggles, o2Held: false, reset: false }
```
- **驗證**：單顧 CO2 的隧道視野會怎麼死。
- **預期**：CO2 被壓住，但導航沒開 → 仍 `lose / deviation`（早於 480）。證明「壓住一面牆不夠」。

### 3. `panic`（oracle）
第 0 秒把三個設備全開、補氧也按住。
```
decide(s, t):
  if t === 0: return { toggles: ['heater','co2Filter','navComp'], o2Held: true, reset: false }
  return IDLE
```
- **驗證**：跳電機制。AMP = 12（+補氧 14）> 10，連續 2s → 跳電。
- **預期**：`stats.brownouts >= 1`，全設備被強制關，扣 3% 電。之後放生 → 仍會死，但
  斷言重點是**跳電確實觸發且懲罰生效**（`mainPwr < 100`、可能有 degraded）。

### 4. `navOnly`（oracle）
只管導航：沒鎖就開，壓 DEV、推 ETA。
```
decide(s, t):
  toggles = []
  if !s.devices.navComp.on && s.elapsed >= s.devices.navComp.lockUntil:
    toggles.push('navComp')
  return { toggles, o2Held: false, reset: false }
```
- **驗證**：導航能擋住 DEV 死亡，但別的牆還在。
- **預期**：撐過 deviation（DEV 被壓住），CO2 不管 → 約 480s `lose / co2`。
  `stats.navOnSeconds` 應接近開機上限工作週期（導航 18s 開 / 5s 鎖，約 78%），
  但因為鎖定空窗 DEV 會回漂，看會不會反而 deviation 先死——**這正是要觀察的平衡點**。

### 5. `rotate`（平衡探針，能贏就贏）← 最重要
分時輪轉，目標讓 ETA 歸零同時不讓任何儀表觸線。用工廠函式（要記憶）：

```ts
export function makeRotateAgent(): PlayerAgent
```

決策啟發式（實作者照這個寫，數字可調，調了記在 PROGRESS_LOG）：

```
每秒看一眼，按「離死線多近」決定優先序（救最急的）：
  1. brownout 中 → reset。
  2. DEV 逼近（> 35%）且導航沒鎖 → 開導航壓回去（最高優先，deviation 死最快）。
  3. CO2 逼近（> 7000）且濾毒沒鎖 → 開濾毒。
  4. TEMP 逼近（< 7°C）且暖氣沒鎖 → 開暖氣。
  5. O2 逼近（< 25%）且還有液氧 → o2Held = true（注意它會掉溫，跟 4 衝突要權衡）。
  6. 平時：導航是贏的唯一途徑 → 沒別的急事就盡量開導航推 ETA。

關鍵約束（避免自殺）：
  - 維持 AMP <= 10：開新設備前估 computeAmp，會破線就先關一個次要的。
  - 接近過熱上限（heat 到上限的 ~80%）主動關掉讓它散，別等引擎強關（強關會進 5s 鎖）。
```
- **驗證**：遊戲到底**贏不贏得了**、邊際多大。
- **預期**：理想是 `outcome: 'win'`。若贏不了，看 `stats.navOnSeconds` 離 480 差多少、
  死在哪面牆——這是**平衡回饋**，不是測試失敗。結果寫進 PROGRESS_LOG 給設計參考。
  > 若多種 seed 下 rotate 都贏不了且差很遠 → 可能數值太硬，回報、考慮調 GDD（屬設計決策，要問人）。

---

## 匯出

```ts
export const STRATEGIES: PlayerAgent[] = [
  doNothing, co2Only, panic, navOnly, makeRotateAgent(),
]
```
`run.ts` 與 `sim.test.ts` 都吃這個陣列。新增策略 = 往這裡加一個。

---

## 驗收（T-083）

- `npx tsc --noEmit` 綠。
- 本檔不單獨測；正確性由 `sim.test.ts`（T-085）對每個策略的預期結果斷言來覆蓋。
- `makeRotateAgent` 的啟發式數字（門檻 35/7000/7/25 等）標成檔頂的具名常數，方便調。
