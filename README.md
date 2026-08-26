# NGSL Learner

每天一關的英文學習 PWA：NGSL 2801 個高頻單字 + 30 個核心文法點 + LLM 生成的每日短文。
架在 GitHub Pages 上，用 iPhone 加到主畫面就是一個 App。

**線上網址**：https://mickharm.github.io/ngsl-learner/

---

## 這是什麼

給「單字量約 400-500、沒有文法基礎、目標是旅遊會話與 TOEIC 600」的學習者用的。
設計上針對三個具體問題：

| 問題 | 對應機制 |
|---|---|
| 背起來的字太久沒用會忘 | Modified SM-2 間隔重複，在快要忘記前把字排回來 |
| 相似的字會搞混 | 每個字帶 confusables，複習時強制把易混字放進同一題的選項 |
| 沒有文法，句子講不出來 | 30 個文法點，每個附 6 題練習（選擇 / 句子重組 / 找錯） |
| 學了不會用 | 每天用當天的單字生成一篇短文 + 6 題理解測驗 |

還有一個開場的**分級測驗**：NGSL 第 1-100 名是 `be / and / of / to`，直接從第 1 個開始
複習等於浪費兩週。48 題二分搜尋找出你的字彙邊界，再決定從哪裡起步。

---

## 每天的流程

```
今日簡報  →  新單字  →  複習  →  文法  →  閱讀  →  結算
            ~18 min   ~22 min  ~15 min  ~20 min   ~3 min
```

每個階段要前一個完成才會解鎖（沒東西可做的階段會自動跳過）。
這條規則存在的唯一理由：防止只學新字、不做複習——那是所有單字 App 失敗的方式。

另外每 50 個字是一個小關，該關 80% 的字進入 review 階段才會解鎖下一關。

---

## 技術架構

```
GitHub Pages  ←  gh-pages 分支（npm run deploy；Actions 版本見 deploy/）
      │
      ├─ Vue 3 + Vite + Pinia + Vue Router (hash mode)
      ├─ Supabase  進度、設定、錯題、文章（Row Level Security，每人只看得到自己的）
      ├─ IndexedDB 離線鏡像，捷運上沒訊號也能複習
      └─ Gemini    單字翻譯/音標/例句、每日短文、旅遊對話（瀏覽器直接呼叫）
```

**為什麼用 Supabase 而不是 IndexedDB**：兩個人各自用不同手機，換裝置不能掉進度。
IndexedDB 只當離線快取，Supabase 才是 source of truth。

**word_data 是共用的**：產生一個字的資料要花一次 Gemini 呼叫，所以這張表不分使用者——
一個人產生過的字，另一個人直接拿來用。其他所有表都有 RLS 綁 `auth.uid()`。

**API Key 不在 repo 裡**：Gemini key 存在 `user_settings`（RLS 保護）加 localStorage 鏡像，
從瀏覽器直接送到 Google，不經過任何中間伺服器。Supabase 的 publishable key 有寫在
`src/config.js`，那是設計上就該公開的（所有防護靠 RLS）。

---

## 初次設定

### 1. Supabase schema

Supabase Dashboard → SQL Editor → New query → 貼上 `supabase/schema.sql` → Run。

建立 10 張表、RLS policy、以及一個註冊時自動建 profile 的 trigger。可以重複執行。

如果不想每次註冊都要收確認信：Authentication → Providers → Email → 關掉
**Confirm email**。

### 2. 註冊帳號

打開網站 → 註冊 → 進入分級測驗。

### 3. Gemini API Key

到「設定」頁面貼上 Key → 測試連線。單字資料會在需要時自動產生（每天約 1-2 次呼叫）。

想一次備妥全部 2801 個字：設定頁面 →「一次產生全部單字資料」，約 10 分鐘。
或用命令列（可中斷續跑）：

```bash
export GEMINI_API_KEY=your-key
npm run gen:words
```

---

## 開發

```bash
npm install
npm run build:base     # NGSL_2801_full.csv → src/data/words.base.json
npm run dev            # http://localhost:5173/ngsl-learner/
npm run build
npm run smoke          # 用 Playwright 走完整個流程並截圖到 .shots/
npm run test:models    # 離線驗證模型自動挑選邏輯
npm run deploy         # 把 dist/ 推到 gh-pages 分支
```

部署走 `gh-pages` 分支（Pages → Deploy from a branch），不需要 token 的
`workflow` scope。若要改成 push 就自動建置的 GitHub Actions，
`deploy/README.md` 有完整步驟。

`npm run smoke` 會把 Supabase 與 Gemini 都 stub 在網路層，跑完 23 個畫面，
檢查 console error 與水平溢出。改完 UI 跑一次再 push。

### 專案結構

```
src/
  lib/
    srs.js        SM-2 排程引擎（純函式，可單獨測）
    gemini.js     LLM 呼叫、structured output schema、重試
    tts.js        Web Speech，處理 iOS Safari 的 voice 載入與首次手勢限制
    idb.js        IndexedDB 薄封裝
  stores/
    progress.js   卡片狀態 + outbox（離線時寫入佇列，回線自動同步）
    session.js    當日關卡、階段解鎖、計時
    words.js      三層資料：bundled base → Supabase 共用快取 → Gemini 補齊
  data/
    words.base.json    2801 字的 rank/headword/band/family（168 KB）
    grammar-b1/b2/b3   30 個文法點、180 題練習
```

---

## SRS 參數

| 參數 | 值 | 理由 |
|---|---|---|
| Learning steps | 1 min → 10 min | 新字在同一個 session 內看三次，不是一次 |
| 畢業間隔 | 1 天（簡單：4 天） | |
| 初始 ease | 2.5，下限 1.3 | |
| Lapse 後 | 間隔 × 0.4，進 relearning | 全部歸零在這個量下太打擊人；40% 保留壓力但不重來 |
| Mastered | interval ≥ 21 天且連續 3 次正確 | 只是顯示狀態，仍會回到輪替 |
| 逾期加成 | 最多 ×1.3 | 逾期很久還答對，代表記憶比排程假設的強 |

複習佇列依 retrievability 由低到高排序——最快忘記的先出現，超過每日上限的順延。

---

## 已知限制

- Gemini 免費額度有 rate limit，一次產生 2801 字可能會撞到 429（腳本會自動退避重試）。
- 模型名稱不用自己維護：Google 改名或下架時 API 回 404，`resolveModel()` 會去問
  `ListModels` 挑一個能用的（偏好 flash 系列、避開 embedding/image/tts/live 變體）
  並存回設定。預設值只是起點，不是硬依賴。
- Web Speech 的發音品質取決於裝置。iPhone 上到「設定 → 輔助使用 → 朗讀內容 → 語音」
  下載 Enhanced/Premium 的英文語音，差別很大。
- 文法點目前是固定 30 個，沒有做到 TOEIC 全部文法範圍。
