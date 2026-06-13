# SPEC → `run.ts`

> 給人看的 CLI 入口：跑全部策略 × 種子，印一張報表。
> 任務 T-084。依賴：T-082（runner）、T-083（strategies）。

---

## 用途

`sim.test.ts` 是給 CI 的（紅/綠）。`run.ts` 是給**人**的：跑一輪看遊戲現在的全貌——
誰活誰死、死在哪、衝關策略離贏多遠。素材組員或你自己想快速體感平衡時跑它。

---

## CLI 介面

```bash
npx tsx sim/run.ts                          # 全部策略 × 預設種子組 [1,2,3,7,42]
npx tsx sim/run.ts --seed 42                # 指定單一種子
npx tsx sim/run.ts --strategy rotate        # 只跑某策略（名字對 PlayerAgent.name）
npx tsx sim/run.ts --strategy rotate --verbose   # 印該局每 10 秒一筆時間軸
```

參數解析用 Node 內建 `process.argv` 手刻即可（就 3 個旗標，別引 commander 之類的庫——
[別鍍金](../../docs/AGENT_PROTOCOL.md)）。

---

## 預設報表（摘要表）

跑完每個 (策略 × 種子)，印一行。範例：

```
策略         seed  結局      死因        結束秒  導航秒  跳電  終末: PWR / O2 / CO2 / TEMP / DEV
─────────────────────────────────────────────────────────────────────────────────────────
doNothing     1   LOSE     deviation     51      0     0      100.0 / 90.8 / 1420 / 19.2 / 50.1
co2Only       1   LOSE     deviation     49      0     0       99.6 / 91.2 /  380 / 19.3 / 50.0
panic         1   LOSE     co2          188      3     1       12.4 /  ... （跳電後放生）
navOnly       1   LOSE     co2          480     372    0       ...
rotate        1   WIN      —            480     480    2       3.1 / 18.0 / 6200 / 4.5 / 12.0
─────────────────────────────────────────────────────────────────────────────────────────
彙總：5 局，1 勝 4 敗。rotate 平均導航秒 461/480。
```

欄位對齊用固定寬度 `padEnd/padStart`，不要引表格庫。數字固定小數位（PWR/O2/TEMP 一位、CO2 整數）。

---

## `--verbose` 時間軸

只在指定**單一策略 + 單一種子**時才印（多局印時間軸會洗版）。每 10 秒一筆：

```
  t    ETA       PWR   O2    CO2    TEMP  DEV   AMP  設備(H/F/N)  狀態
  10   86:12:30  98.2  98.0  500    20.8  3.1   9    - F N        
  20   ...                                            H - N        brownout!
```

時間軸資料直接來自 `RunResult.timeline`，每 10 筆取一筆。

---

## 結束碼

- 全部正常跑完（不管輸贏）→ exit 0。**輸不是錯誤**，輸是資料。
- runner 丟例外 / timeout → exit 1，印哪個策略×種子炸的。

> `run.ts` 是探索工具，不是 gate。CI 的 gate 是 `sim.test.ts`。別讓 run.ts 因為「有人輸了」就 exit 1。

---

## 驗收（T-084）

- `npx tsx sim/run.ts` 能跑、印出對齊的表、exit 0。
- `--strategy rotate --verbose` 印出單局時間軸。
- 純讀 + 印，無副作用、不寫檔（要存檔讓使用者自己 `> out.txt`）。
