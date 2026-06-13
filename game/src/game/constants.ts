// ── 時間/迴圈 ──
export const FIXED_DT = 1 / 60          // D-009
export const MAX_FRAME = 0.25           // D-009
export const COMPRESSION = 652.5        // GDD §2

// ── ETA（MET 秒）── GDD §5-A
export const ETA_INIT = 313200          // 87h × 3600
export const DEV_PENALTY_PER_PCT = 0.5  // real 秒/1% 漂移（D-002）
export const DEV_BIG_THRESHOLD = 30     // %
export const DEV_BIG_PENALTY = 30       // real 秒（一次性）

// ── 電力 ── GDD §5-B
export const PWR_INIT = 100
export const PWR_PER_AMP_SEC = 0.025    // %/(A·秒)

// ── 安培/跳電 ── GDD §6，D-004/D-008
export const AMP = { heater: 3, co2Filter: 5, navComp: 4, o2Release: 2 } as const
export const AMP_REDLINE = 10
export const BROWNOUT_SECONDS = 2
export const BROWNOUT_PWR_PENALTY = 3
export const BROWNOUT_DEGRADE_CHANCE = 0.5

// ── O2 ── GDD §5-C，D-006
export const O2_INIT = 100
export const O2_DRAIN = 0.18            // %/秒（覆寫 GDD 0.15，見 D-006）
export const O2_RELEASE_GAIN = 0.8      // %/秒（按住）
export const LIQO2_INIT = 30            // 秒（3 罐 × 10s）
export const LIQO2_PER_TANK = 10        // 顯示用：亮罐數 = ceil(liqO2/10)

// ── CO2 ── GDD §5-D
export const CO2_INIT = 400
export const CO2_RISE = 20              // ppm/秒
export const CO2_FILTER_REMOVE = 40     // ppm/秒（淨 −20）
export const CO2_FILTER_REMOVE_DEGRADED = 25  // 降效後（GDD §6-B）
export const CO2_LETHAL = 10000
export const CO2_VIGNETTE = 5000        // 黑暈（GDD §7-C）
export const CO2_CURSOR = 8000          // 游標漂移

// ── 溫度 ── GDD §5-E
export const TEMP_INIT = 21
export const TEMP_NATURAL = 0.035       // °C/秒 降溫
export const TEMP_HEATER = 0.1          // °C/秒（開暖氣，淨 +0.065）
export const TEMP_HEATER_DEGRADED = 0.06  // 降效後
export const O2_RELEASE_TEMP = 0.6      // °C/秒 降溫（按住 O2）
export const TEMP_LETHAL = 0
export const TEMP_FROST = 10            // 霜花（GDD §7-C）
export const TEMP_FROST_HEAVY = 5       // 霜花遮數字

// ── 導航/偏離 ── GDD §5-F
export const DEV_INIT = 0
export const DEV_CORRECT = 1            // %/秒（導航開）
export const DEV_CORRECT_DEGRADED = 0.6 // 降效後
export const DEV_DRIFT_MAX = 2          // 盲飛 [0,2]
export const DEV_DRIFT_MAX_COLD = 3     // temp<10 時 [0,3]
export const DEV_LETHAL = 50            // %

// ── 設備過熱 ── GDD §6-A，D-005
export const OVERHEAT_LIMIT = { heater: 12, co2Filter: 8, navComp: 18 } as const
export const OVERHEAT_COOL_RATE = 1.5   // 散熱速率（P5 可調）
export const LOCK_SECONDS = 5
