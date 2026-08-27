/**
 * Essentials — word formation.
 *
 * This is the highest-density scoring block in TOEIC Part 5: a large share of
 * its questions hand you one stem in four parts of speech and ask which one
 * the slot needs. You do not have to know the word. You have to read the
 * ending. Nothing in the app taught that, and the vocabulary path actively
 * hid it by scheduling `achieve` (#745) and `achievement` (#1998) four months
 * apart, as if they were two unrelated words to memorise.
 */

export default [
  {
    id: 'e13',
    group: 'form',
    title: '字形派生：看字尾就知道詞性',
    summary: '多益 Part 5 有一整類題目，四個選項是同一個字根的四種詞性。你不必認識那個字，只要看得懂字尾，和句子缺什麼。',
    intro: [
      '這類題長這樣：`The manager made an important _____.` 選項是 `decide / decision / decisive / decisively`。',
      '**先看空格前後，不要先看選項。** `an important ___` — an 是冠詞、important 是形容詞，形容詞後面接的一定是**名詞**，所以答案是 `decision`。整題不需要知道 decision 是什麼意思。',
      '判斷順序固定三步：**① 空格前是冠詞／形容詞／所有格 → 名詞。② 空格是句子的動作，前面是主詞 → 動詞。③ 空格在修飾動詞、形容詞或整句 → 副詞（-ly）。**',
      '所以真正要背的不是單字，是**字尾對應的詞性**。下面這張表就是全部。'
    ],
    table: {
      caption: '字尾 → 詞性（Part 5 出現頻率由高到低）',
      head: ['字尾', '產生的詞性', '例（本字表內）'],
      rows: [
        ['-tion / -sion / -ation', '名詞 n.', 'decide → decision；inform → information'],
        ['-ment', '名詞 n.', 'achieve → achievement；pay → payment'],
        ['-ness', '名詞 n.（來自形容詞）', 'happy → happiness；weak → weakness'],
        ['-ity', '名詞 n.（來自形容詞）', 'able → ability；possible → possibility'],
        ['-ance / -ence', '名詞 n.', 'appear → appearance；exist → existence'],
        ['-er / -or / -ist / -ant', '名詞 n.（人或機器）', 'manage → manager；consult → consultant'],
        ['-ship / -hood', '名詞 n.（抽象狀態）', 'leader → leadership；child → childhood'],
        ['-ly', '副詞 adv.', 'clear → clearly；quiet → quietly'],
        ['-able / -ible', '形容詞 adj.（可以…的）', 'reason → reasonable；access → accessible'],
        ['-ive', '形容詞 adj.', 'effect → effective；create → creative'],
        ['-ful / -less', '形容詞 adj.（有／沒有）', 'care → careful；care → careless'],
        ['-ous / -al / -ic', '形容詞 adj.', 'danger → dangerous；nature → natural'],
        ['-ize / -ify / -en', '動詞 v.（使…變成）', 'real → realize；strength → strengthen']
      ]
    },
    pitfalls: [
      '**`-ly` 不保證是副詞。** `friendly`、`lovely`、`likely`、`daily` 都是**形容詞**。判斷方式：`-ly` 接在**名詞**後面通常是形容詞（friend + ly），接在**形容詞**後面才是副詞（clear + ly）。',
      '**`hardly` 不是「很努力地」，是「幾乎不」。** `He works hard.`（他很努力）vs `He hardly works.`（他幾乎不工作）。`nearly`、`lately`、`shortly` 也都和原字意思不同，這四個要單獨記。',
      '**`-ing` 和 `-ed` 形容詞方向相反。** `interesting`（東西有趣）vs `interested`（人感到有趣）。❌ `I am interesting in this job.` → ✅ `I am interested in this job.`',
      '**空格在 be 動詞後面不一定填形容詞。** `The report was _____ by the team.` 後面有 by → 被動語態，要填**過去分詞**（reviewed），不是形容詞。',
      '**先看空格的位置，不要先讀選項。** 讀了選項就會開始比較字義，那正是這類題目設計來浪費你時間的地方。'
    ],
    drills: [
      {
        type: 'choice',
        q: 'The team made an important _____ about the new project.',
        options: ['decide', 'decision', 'decisive', 'decisively'],
        answer: 1,
        explain: '`an important ___`：冠詞 + 形容詞後面接名詞。-sion 是名詞字尾，所以選 decision。'
      },
      {
        type: 'choice',
        q: 'Please read the instructions _____ before you start.',
        options: ['care', 'careful', 'careless', 'carefully'],
        answer: 3,
        explain: '空格在修飾動詞 read（怎麼讀），要用副詞。-ly 加在形容詞 careful 後面，得到副詞 carefully。'
      },
      {
        type: 'choice',
        q: 'Our new manager is very _____ and easy to talk to.',
        options: ['friend', 'friendly', 'friendship', 'friendlily'],
        answer: 1,
        explain: 'be 動詞後面接形容詞。friendly 雖然是 -ly 結尾，但它接在名詞 friend 後面，是形容詞不是副詞。'
      },
      {
        type: 'choice',
        q: 'The company announced the _____ of two new stores this year.',
        options: ['open', 'opened', 'opening', 'openly'],
        answer: 2,
        explain: '`the ___ of`：冠詞和 of 中間要名詞。opening 在這裡是名詞（開幕）。'
      },
      {
        type: 'sort',
        prompt: '把這些字放進正確的詞性欄位',
        buckets: ['名詞', '形容詞', '副詞'],
        items: [
          { t: 'management', b: '名詞' },
          { t: 'ability', b: '名詞' },
          { t: 'weakness', b: '名詞' },
          { t: 'reasonable', b: '形容詞' },
          { t: 'effective', b: '形容詞' },
          { t: 'dangerous', b: '形容詞' },
          { t: 'clearly', b: '副詞' },
          { t: 'quietly', b: '副詞' }
        ],
        explain: '-ment / -ity / -ness 是名詞；-able / -ive / -ous 是形容詞；接在形容詞後的 -ly 是副詞。'
      },
      {
        type: 'correct',
        wrong: 'I am very interesting in the marketing position.',
        answer: 'I am very interested in the marketing position.',
        explain: '人「感到」有興趣用 -ed（interested），東西「令人」有興趣才用 -ing（interesting）。'
      }
    ]
  }
]
