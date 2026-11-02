# NGSL Learner

每天一關的英文學習 PWA（固定三位使用者）：NGSL 2801 個高頻單字 + 字首字尾 15 單元 + 30 個核心文法點 + 分級圖文故事，以字的組成、遊戲與提取練習為主。
架在 GitHub Pages 上，用 iPhone 加到主畫面就是一個 App。

**線上網址**：https://mickharm.github.io/ngsl-learner/

---

## v4：作業簿／黑板、等你看完的回饋、三位學習者

| 回饋 | v4 做法 |
|---|---|
| 答對自動跳題，說明看不完；有些模式答錯也自動跳 | 所有題型共用一張回饋單（`AnswerSheet`）：**答錯一律停住等「繼續」**；答對才倒數（依說明長度 1.8–5 秒），手指碰一下就暫停；設定可關。真假句卡片、單字雨／泡泡的失誤也改成停下來顯示字、意思與發音 |
| 新增使用者「玟廷」 | 登入頁三本作業簿。App 內沒有一般註冊與自由登入；唯一的建立帳號入口是玟廷那本的一次性「設定密碼」（需要當下 Supabase 開放註冊，建立後即關閉） |
| 配色與元素像 AI 公版 | 視覺語言改取材自台灣學英文的教材：**英文四線格**寫每個單字、**螢光筆**標字首（粉）字根（黃）字尾（藍）、**紅筆**圈對打叉、**老師印章**（甲上／甲／乙／加油）與評語、課表式的今日關卡、深色模式是**綠色黑板＋粉筆色**。字體：Andika（SIL 為初學閱讀設計）＋霞鶩文楷（課本感）＋Noto Sans TC |
| 今日關卡加入遊戲 | 第六節「遊戲時間」：每天輪一款（單字雨／翻牌／泡泡聽力／連連看），用當天的字、短回合，結束直接接下一節 |
| 卡頓與不自然 | 單字雨改成每幀直接寫 transform（不再每幀觸發 Vue 重繪）、泡泡改成 CSS 動畫；換頁從「淡出→等→淡入」改成只淡入 140 ms；字首字尾教學把 im-/il-/ir- 併入 in- |

---

## v3：記憶點、字首字尾、遊戲中心、整體改版

v2 用了一陣子後的回饋與對應的改法：

| 回饋 | 診斷 | v3 的做法 |
|---|---|---|
| emoji 有時跟單字對不上；自己畫圖不知道畫什麼 | 抽象字（however、achieve）沒有能指著的東西；硬配符號會教錯意思，空白畫布也不是記憶鉤 | emoji 只保留**字面可畫**的 311 字，其餘不顯示。自由繪圖移除。記憶點改由「字怎麼組成」承擔 |
| 看到音節拆開、變色，但不知道顏色的意義 | 顏色沒有圖例就只是裝飾 | **WordAnatomy**：能拆成零件的字顯示 字首／字根／原本的字／字尾 的字磚，每塊下方寫中文意思、附公式（不 ＋ 快樂的 → 不快樂的）；不能拆的字只標重音（● = 念最大聲），兩種模式都帶圖例 |
| 字首字尾應該納入課程 | 形態學教學對詞彙的效果量 d = 0.40，對英語學習者 d = 0.62（Goodwin & Ahn 2010） | **字首字尾課程**：15 單元、239 個驗證過的例字（合成字 → 人／名詞／形容詞／動詞字尾 → 「不」、次數、方向、數字字首 → 拉丁／希臘字根），每單元「先猜 → 圖解 → 8 題五種題型（字義算式、拼零件、切字、真假零件、看字尾判斷詞性）」，進 SRS，每天一單元 |
| 遊戲玩感不高 | 題目換皮、沒有節奏、沒有回饋 | **遊戲中心**：單字雨、泡泡聽力、每日猜字（Wordle，限 NGSL 字）、零件積木（60 秒）、翻牌記憶、極速連連看；共用生命值、連擊倍率、計時、合成音效、最佳紀錄、撒花，結算列出答錯的字 |
| 整體改版幅度不大 | — | 新設計系統「字磚工坊」（Lexend + Noto Sans TC、深藍與黃、字磚是唯一立體元素）；新導覽：今天／課程／遊戲／單字／我的 |

Word Lab 另外加上**先猜再看**：每個新字先從零件或例句猜意思（不計分），再看完整字卡——猜過再看比直接看記得牢（pretesting effect：Richland, Kornell & Kao 2009；Potts & Shanks 2014）。

```
每天：複習挑戰 → Word Lab → 字首字尾 → (A) Grammar Studio → Story Time ／ (B) 基礎知識 → 造句 → 聽力 → 結算
```

部署：push `main` 即由 GitHub Actions 測試、建置並推到 `gh-pages`（見 `deploy/README.md`）。

---

## v2：為什麼重構、改了什麼

使用一個月後的兩個回饋，各自對應到學習科學裡很明確的失敗模式：

| 回饋 | 診斷 | v2 的做法 |
|---|---|---|
| 單字沒有記憶點，或是短時間內重複看幾次記住了，過一陣子又忘 | ① 編碼太淺：只有「英文 → 中文」一種表徵。② 同一 session 的 1 分 / 10 分重看被當成複習證據（massed practice 會讓當下正確率與自信都偏高、一週後保留較差 — Nakata & Suzuki 2019）。③ 每次複習都是同一張卡、同一個方向，「認得這張卡」被當成「會這個字」。④ 自評按鈕緊接在看完答案之後，是最容易高估的時刻 | **Word Lab**：圖片（536 字手工對應 emoji）+ 依發音拆塊與重音（1471 字）+ 學習者自己畫的記號（drawing effect）或自己的句子（self-reference）。**一天只排一次複習**，同一 session 內的重看是練習、不進排程。**提取階梯**：認得 → 聽得懂 → 想得起 → 拼得出 → 用得出，答對升一階、答錯退一階，每次複習換更難的考法。**客觀評分**取代自評。排程改用 **FSRS**（ts-fsrs） |
| 文法練習太相似，邏輯規則都一樣，照順序做就好 | 每個文法點六題同三種題型、而且只練這一點（blocked practice）——每題都能直接套剛讀到的規則，從來不需要判斷「這題考哪條規則」 | **Grammar Studio**：先讓學習者從例句猜規律（noticing），再看規則；規則用圖畫出來（時態時間線、句型色塊）；練習混合 9 種題型（看圖選句、時間線定位、意義判斷、句型積木、點出錯字、✅/❌ 分類…）；之後是**跨文法點交錯的混合挑戰**，每題答完標示「這題考：____」，混淆的文法點明天提早回來 |

另外加上「美式教學」常見的三塊：

- **Story Time**：8 篇分級圖文故事（入門／基礎／進階），每個 token 都用 app 自己的字彙解析器檢查，未預教的超綱字 ≤ 2%（Hu & Nation 的 98% coverage 原則）；讀完玩排順序、理解題、找單字。
- **遊樂場**：配對、拼字蜂、聽音辨義、誰不一樣（Marzano 六步驟的第 6 步：用遊戲玩這些字），不影響排程。
- **單字圖鑑 + 字力等級**：字力 = 每個字達到的階梯高度加總，忘記會掉、刷簡單題刷不上去，兩支手機算出來一樣。

每天的流程（A/B 兩軌輪替不變）：

```
A 日：複習挑戰 → Word Lab → Grammar Studio → Story Time → 聽力 → 結算
B 日：複習挑戰 → Word Lab → 基礎知識      → 造句       → 聽力 → 結算
```

複習改到新字前面：先把快忘的字撈回來，再學新的。

### 依據（v2 實際參考的研究）

- Marzano 的詞彙教學六步驟（說明 → 用自己的話 → **自己畫圖或符號** → 延伸 → 討論 → **遊戲**）
- Wammes, Meade & Fernandes (2016)：畫出一個字（即使只有 4 秒、畫得很醜）的自由回憶常是抄寫的兩倍以上
- Nakata & Suzuki (2019, SSLA)：集中練習當下正確率較高但一週後保留較差，且集中組會高估自己的記憶；語意相近的字放在一起學會產生組內混淆
- Nakata & Suzuki (2019)「Mixing grammar exercises facilitates long-term retention」；Pan et al. (2019)：**教的時候按順序、練的時候打散**才有交錯練習的效益（純隨機或純輪流都沒有）
- Rawson & Dunlosky：successive relearning——跨多次 session 提取到答對為止（v2 的「答錯 → 當場重教 → session 結束前答對一次 → 兩天內再考」）
- Ehri：orthographic mapping——拼字、發音、意思綁在一起時新字比較好記
- Wang & Thomas (1995)：諧音／關鍵字記憶法立即效果好，但沒有複習時一週後忘得比語意策略快 → v2 把 mnemonic 當輔助，主推自己的句子與圖
- VanPatten 的 processing instruction（structured input）：學習者必須處理形式才能答對意義題
- Hu & Nation (2000)：舒適閱讀約需 98% 已知字（Lancaster 的複製研究未能完全重現精確門檻，方向不變）
- Sailer & Homner (2020) 遊戲化統合分析：認知成效 g≈0.49 在高嚴謹子集仍成立；動機與行為成效在高嚴謹子集不顯著 → 點數直接等於學習本身，不做獨立的抽獎/徽章經濟
- Open Spaced Repetition 的 SRS benchmark：FSRS-6 在 99.6% 使用者的 log loss 低於 SM-2

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

**金鑰要從哪裡拿**：Google AI Studio 目前對部分帳號只發 `AQ.` 開頭的金鑰，而這批金鑰
有一部分無法通過 Gemini API 認證（401 `ACCESS_TOKEN_TYPE_UNSUPPORTED`），是 Google
端的已知問題。若遇到，改到 **Google Cloud Console → APIs & Services → Credentials →
Create credentials → API key** 建立 `AIza...` 格式的金鑰，並確認該專案已啟用
**Generative Language API**。App 的錯誤訊息會直接指出是哪一種情況。

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
npm test               # 離線單元測試（模型挑選 / 答案比對 / 選項標號 / 生成題驗證）
npm run deploy         # 把 dist/ 推到 gh-pages 分支
```

部署走 `gh-pages` 分支（Pages → Deploy from a branch），不需要 token 的
`workflow` scope。若要改成 push 就自動建置的 GitHub Actions，
`deploy/README.md` 有完整步驟。

`npm run smoke` 會把 Supabase 與 Gemini 都 stub 在網路層，跑完 56 個畫面、63 項檢查，
檢查 console error 與水平溢出。改完 UI 跑一次再 push。fixture 內含 8 張到期的舊 SM-2 卡與
3 個已學文法點，所以 v2 的轉換、階梯題型與交錯混合每次都會被走到。

### 專案結構

```
src/
  lib/
    wordsrs.js    單字排程 v2：FSRS（ts-fsrs）+ 提取階梯 + 舊 SM-2 卡就地轉換
    srs.js        SM-2，仍用於文法點與基礎單元（concept card）
    game.js       單字遊戲共用：干擾選項、字母磚、配對
    grammarGames.js  文法題型衍生（點錯字 / 二選一 / ✅❌）、練習與交錯混合
    lexicon.js    字形 → NGSL id（瀏覽器與 Node 測試共用）
    xp.js         字力與等級
    drawings.js   學習者自己的圖與句子（只存在裝置上）
    gemini.js / tts.js / idb.js
  stores/
    progress.js   卡片狀態 + outbox（離線時寫入佇列，回線自動同步）
    session.js    當日關卡、階段解鎖、計時
    words.js      三層資料：bundled base → Supabase 共用快取 → Gemini 補齊
  data/
    words.base.json    2801 字的 rank/headword/band/family
    pictures.js        536 字的手工圖片對應（依主題分組）
    chunks.json        1471 字的發音拆塊 + 重音（hyphen 與 CMU 字典一致才收）
    grammar-b1/b2/b3   30 個文法點、180 題練習
    grammar-studio.js  每點的找規律題、視覺模型、90 題圖像/時間線/意義/積木題
    stories.js         8 篇分級圖文故事
    essentials-*       12 個基礎單元
  components/
    games/WordGame.vue     五種提取題型（同一元件）
    games/MatchPairs.vue   連連看
    grammar/               GrammarGame（9 種題型）、TenseTimeline、SentenceSlots
    SketchPad / PictureTile / WordChunks
```

**v2 不需要改資料庫**：`card_progress` 欄位照舊，`ease` 存 FSRS difficulty、
`interval_days` 存 stability、`step_index` 存 `100 + 階梯`；`step_index < 100` 的舊卡在讀入時轉換、
下次作答寫回 v2 格式（`scripts/test-wordsrs.mjs` 釘住轉換保留到期日、等級對應與冪等）。

**基礎單元不需要新資料表**：`grammar_progress` 的欄位完全相同，且 id 不會撞
（文法是 g01…g30，基礎是 e01…e12），兩個 store 各自用前綴過濾。

---

## SRS 參數（單字，v2）

| 參數 | 值 | 理由 |
|---|---|---|
| 演算法 | FSRS-6（ts-fsrs 預設參數），目標保留率 90% | 對大量真實資料的預測優於 SM-2 |
| 短期步驟 | 關閉 | 同一 session 的重看不算複習；每字每天只排一次 |
| 最短間隔 | 約 1 天 | 「今天稍後」不排，那是 Word Lab 的事 |
| 階梯上限 | 認得 3 天 / 聽得懂 7 / 想得起 14 / 拼得出 30 / 用得出 365 | 只靠辨識答對的字不會被推到一個月後 |
| 答錯 | 退一階，2 天內重考 | successive relearning |
| 評分 | 錯 = AGAIN、慢或用提示 = HARD、乾淨答對 = GOOD；遊戲永不給 EASY | 客觀量測取代自評 |
| 熟練 | stability ≥ 21 天且階梯 ≥ 拼得出 | 只認得不算熟練 |

文法點與基礎單元仍用原本的 SM-2 concept card 參數（`CONCEPT_SRS`）。

---

## 已知限制

- Gemini 免費額度有 rate limit，一次產生 2801 字可能會撞到 429（腳本會自動退避重試）。
- 模型名稱不用自己維護：Google 改名或下架時 API 回 404，`resolveModel()` 會去問
  `ListModels` 挑一個能用的（偏好 flash 系列、避開 embedding/image/tts/live 變體）
  並存回設定。預設值只是起點，不是硬依賴。
- Web Speech 的發音品質取決於裝置。iPhone 上到「設定 → 輔助使用 → 朗讀內容 → 語音」
  下載 Enhanced/Premium 的英文語音，差別很大。
- 文法點固定 30 個、基礎單元 12 個，沒有涵蓋 TOEIC 全部範圍——但每個單元的練習題是
  無限的（AI 生成），所以「練不完」比「教材不夠」更接近實情。

## AI 在哪裡介入

固定內容只負責「教」，AI 負責「出題」與「評分」——題庫會枯竭，生成不會。

| 環節 | 函式 | 做什麼 |
|---|---|---|
| 單字資料 | `enrichWords` | 翻譯、音標、例句、易混字 |
| 每日短文 | `generateArticle` | 用當天單字寫文章 + 6 題理解測驗 |
| 出新題 | `generateDrills` | 針對任何文法/基礎單元無限生成練習，避開已出過的句子 |
| 文法批改 | `judgeSentence` | 判斷「另一種正確寫法」是否該算對 |
| 造句批改 | `judgeProduction` | 文法、用字、自然度三個維度 + 母語者說法 |
| 造句題目 | `generateWritingTask` | 針對單字設計具體到能馬上下筆的任務 |
| 旅遊對話 | `generateDialogue` | 20 個情境的角色扮演 |

生成的題目一律經過 `normalizeDrill()` 驗證才會顯示：選項不是 4 個、order 的 tokens
拼不出 answer、correct 的錯句和正解一樣——這些直接丟掉，寧可少一題也不給壞題目。
`npm run test:drills` 涵蓋這些情況。

## 文法批改怎麼判對錯

句子重組與找錯這兩種題型不能用字串比對定生死——英文同一個意思有很多寫法，
把它們判錯只會教出「猜參考答案的措辭」而不是文法。所以分兩關：

1. **本地比對**（`src/lib/answer.js`）：展開縮寫、統一標點與大小寫後比對。
   `I'll wait` 等同 `I will wait`，免費、離線、瞬間完成，多數誤判在這關就消失。
2. **AI 複判**（`judgeSentence()`）：本地不過、但答案與參考答案夠接近時才呼叫，
   判斷是否文法正確、有沒有修好目標錯誤、意思有沒有跑掉。判對時會明說
   「你的寫法也對」。沒有 API Key 或連不上時退回第 1 關的結果，不會卡住。

`worthJudging()` 擋掉空白與完全無關的作答，不浪費呼叫。
