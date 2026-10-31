/**
 * Picture layer — one emoji per NGSL headword that has an honest picture.
 *
 * Why emoji and not photos: they render natively on the learner's iPhone,
 * cost zero bytes, work offline, and never need an API key. Dual coding
 * (Paivio) only helps when the picture actually depicts the word, so this
 * table is hand-curated — an automatic match on emoji tags produced things
 * like "be → 🇧🇪 (Belgium)" and "of → 💩 (pile of poo)", which teach nonsense.
 *
 * Inclusion rule: the emoji must make a learner think of THIS word, or be the
 * conventional symbol for it (📈 increase, 🔁 repeat). Words with no honest
 * picture are simply absent; for those the Word Lab asks the learner to draw
 * their own symbol instead (Marzano step 3, the drawing effect).
 *
 * Grouped by theme. The themes double as data for the odd-one-out game and for
 * thematic (not semantic) clustering of new words — Tinkham/Waring found that
 * learning near-synonyms together causes interference, while words that share
 * a scene (menu, waiter, bill) do not.
 *
 * Every key is checked against words.base.json by scripts/test-pictures.mjs,
 * which also pins a list of pictures that must never come back.
 */

export const THEMES = {
  food: {
    label: '食物飲料',
    words: {
      food: '🍱', meal: '🍽️', breakfast: '🥞', lunch: '🥪', dinner: '🍲', coffee: '☕', tea: '🍵',
      milk: '🥛', water: '💧', wine: '🍷', beer: '🍺', pub: '🍻', bottle: '🍾', bread: '🍞',
      rice: '🍚', egg: '🥚', meat: '🥩', chicken: '🐔', fish: '🐟', cheese: '🧀', cake: '🍰',
      chocolate: '🍫', sweet: '🍬', fruit: '🍎', orange: '🍊', vegetable: '🥦', potato: '🥔',
      salt: '🧂'
    }
  },
  animals: {
    label: '動物',
    words: {
      animal: '🐾', dog: '🐕', cat: '🐈', bird: '🐦', horse: '🐎', cow: '🐄', pig: '🐖', sheep: '🐑',
      mouse: '🐁', rat: '🐀'
    }
  },
  body: {
    label: '身體',
    words: {
      body: '🧍', hand: '✋', finger: '☝️', arm: '💪', muscle: '💪', leg: '🦵', foot: '🦶',
      eye: '👁️', ear: '👂', nose: '👃', mouth: '👄', tongue: '👅', tooth: '🦷', brain: '🧠',
      heart: '❤️', blood: '🩸', hair: '💇', face: '🙂'
    }
  },
  people: {
    label: '人物',
    words: {
      man: '👨', woman: '👩', child: '🧒', kid: '🧒', boy: '👦', girl: '👧', baby: '👶',
      person: '🧑', people: '👥', family: '👨‍👩‍👧', mother: '👩‍👧', mom: '👩‍👧', father: '👨‍👧',
      dad: '👨‍👧', grandmother: '👵', couple: '💑', friend: '🧑‍🤝‍🧑', gentleman: '🤵', king: '🤴',
      hero: '🦸', guard: '💂', soldier: '🪖'
    }
  },
  jobs: {
    label: '職業',
    words: {
      job: '🧑‍💼', worker: '👷', teacher: '🧑‍🏫', student: '🧑‍🎓', doctor: '🧑‍⚕️', police: '👮',
      judge: '👨‍⚖️', farmer: '🧑‍🌾', engineer: '🧑‍🔧', scientist: '🧑‍🔬', artist: '🧑‍🎨',
      pilot: '🧑‍✈️', singer: '🧑‍🎤', actor: '🎭'
    }
  },
  places: {
    label: '地點',
    words: {
      house: '🏠', home: '🏡', school: '🏫', office: '🏢', factory: '🏭', hotel: '🏨', bank: '🏦',
      church: '⛪', castle: '🏰', tower: '🗼', bridge: '🌉', city: '🏙️', town: '🏘️',
      government: '🏛️', store: '🏪', shop: '🛍️', market: '🧺', station: '🚉', park: '🏞️',
      camp: '🏕️', tent: '⛺', island: '🏝️', beach: '🏖️', desert: '🏜️', mountain: '⛰️',
      forest: '🌲', field: '🌾', library: '📚', laboratory: '🧪', place: '📍', location: '📍',
      port: '⚓', world: '🌍', earth: '🌏', restaurant: '🍴', bar: '🍸'
    }
  },
  home: {
    label: '家裡',
    words: {
      room: '🚪', door: '🚪', window: '🪟', wall: '🧱', bed: '🛏️', bath: '🛁', shower: '🚿',
      furniture: '🛋️', chair: '🪑', mirror: '🪞'
    }
  },
  transport: {
    label: '交通',
    words: {
      car: '🚗', bus: '🚌', train: '🚆', taxi: '🚕', truck: '🚚', van: '🚐', vehicle: '🚙',
      bike: '🚲', ship: '🚢', boat: '🚤', sail: '⛵', plane: '✈️', flight: '🛫', traffic: '🚦',
      rail: '🛤️', gas: '⛽', wheel: '🛞', seat: '💺', ticket: '🎫', road: '🛣️'
    }
  },
  nature: {
    label: '天氣自然',
    words: {
      weather: '🌦️', sun: '☀️', moon: '🌕', star: '⭐', sky: '🌤️', cloud: '☁️', rain: '🌧️',
      snow: '❄️', storm: '⛈️', wind: '💨', air: '🌬️', fire: '🔥', ice: '🧊', sea: '🌊', ocean: '🌊',
      rock: '🪨', wood: '🪵', tree: '🌳', plant: '🪴', flower: '🌸', garden: '🌻', nature: '🌿',
      autumn: '🍂', winter: '⛄', spring: '🌷', planet: '🪐', space: '🚀', temperature: '🌡️'
    }
  },
  feelings: {
    label: '情緒',
    words: {
      happy: '😊', smile: '😄', laugh: '😂', funny: '🤣', joy: '😆', sad: '😞', cry: '😢',
      angry: '😠', hate: '😡', fear: '😨', scream: '😱', surprise: '😲', amaze: '😮', worry: '😟',
      nervous: '😬', calm: '😌', relax: '🧘', bore: '🥱', excite: '🤩', embarrass: '😳',
      confuse: '😕', terrible: '😖', complain: '😤', doubt: '🤨', crazy: '🤪', love: '💕'
    }
  },
  clothes: {
    label: '衣物',
    words: {
      clothes: '👚', shirt: '👕', dress: '👗', coat: '🧥', hat: '🎩', cap: '🧢', shoe: '👟',
      boot: '👢', tie: '👔', ring: '💍', fashion: '👠'
    }
  },
  media: {
    label: '科技媒體',
    words: {
      phone: '📱', telephone: '☎️', computer: '💻', screen: '🖥️', camera: '📷', photograph: '📸',
      video: '📹', television: '📺', radio: '📻', film: '🎞️', movie: '🎬', music: '🎵', song: '🎶',
      sound: '🔊', voice: '🎙️', news: '📰', newspaper: '🗞️', email: '📧', message: '📨',
      signal: '📶', online: '🌐', electric: '🔌', electricity: '⚡', energy: '🔋', printer: '🖨️',
      link: '🔗', light: '🔦'
    }
  },
  sport: {
    label: '運動休閒',
    words: {
      sport: '🏅', ball: '🏀', football: '⚽', tennis: '🎾', golf: '⛳', ski: '⛷️', goal: '🥅',
      win: '🏆', game: '🎲', party: '🎉', holiday: '🌴', art: '🎨', target: '🎯', aim: '🏹',
      victory: '✌️', honor: '🎖️', first: '🥇', silver: '🥈', festival: '🎪', race: '🏎️'
    }
  },
  colors: {
    label: '顏色形狀',
    words: {
      red: '🔴', blue: '🔵', green: '🟢', yellow: '🟡', black: '⚫', white: '⚪', brown: '🟤',
      pink: '🩷', gray: '🩶', circle: '⭕', square: '🟥', shape: '🔷', color: '🌈'
    }
  },
  health: {
    label: '健康',
    words: {
      sick: '🤒', pain: '🤕', cough: '😷', medicine: '💊', drug: '💊', virus: '🦠', disease: '🦠',
      hospital: '🏥'
    }
  },
  describe: {
    label: '形容樣子',
    words: {
      healthy: '🥗', tall: '🦒', big: '🐘', small: '🐜', slow: '🐢', slowly: '🐌', lazy: '🦥',
      pregnant: '🤰', blind: '🦯', old: '👴', royal: '👑', high: '🏔️', cold: '🥶', hot: '🥵',
      warm: '♨️', wet: '💦', dark: '🌑', loud: '📢', quiet: '🔇', bright: '🔆'
    }
  },
  mind: {
    label: '想法與狀態',
    words: {
      breath: '😮‍💨', lucky: '🍀', wish: '🌠', sleep: '😴', rest: '🛌', dream: '💭', think: '🤔',
      idea: '💡', smart: '🤓', secret: '🤫', disappear: '🫥', shake: '🫨', rich: '🤑', thank: '🙏',
      sorry: '🙇', hope: '🤞'
    }
  },
  actions: {
    label: '動作',
    words: {
      run: '🏃', walk: '🚶', stand: '🧍', sit: '🪑', climb: '🧗', swim: '🏊', dance: '💃',
      sing: '🎤', play: '🎮', write: '✍️', read: '📖', draw: '🖍️', paint: '🖌️', study: '✏️',
      look: '👀', see: '👁️', watch: '📺', listen: '🎧', speak: '🗣️', talk: '💬', shout: '📣',
      call: '📞', ask: '🙋', meet: '🤝', agree: '🙆', give: '🫴', gift: '🎁', find: '🔎',
      search: '🔍', open: '🔓', close: '🔒', lock: '🔐', cut: '✂️', build: '🏗️', fix: '🔧',
      clean: '🧹', wash: '🧼', buy: '🛒', pay: '💳', send: '📤', receive: '📥', touch: '👆',
      point: '👉', fight: '🥊', exercise: '🏋️', dig: '⛏️', pack: '🎒', rescue: '🛟', protect: '🛡️',
      celebrate: '🥳', welcome: '🤗', hello: '👋', hi: '👋', print: '🖨️', die: '🪦', marry: '💒',
      divorce: '💔', predict: '🔮', eat: '😋', drink: '🥤', cook: '🧑‍🍳', pour: '🫗', fly: '🕊️',
      hear: '👂', smell: '👃', embrace: '🫂', work: '🧑‍💻', teach: '🧑‍🏫', graduate: '🎓',
      arrive: '🛬', travel: '🧳', ride: '🚴', grow: '🌱', kiss: '💋'
    }
  },
  things: {
    label: '物品',
    words: {
      book: '📕', paper: '📃', page: '📄', letter: '✉️', envelope: '📩', mail: '📮', pen: '🖊️',
      journal: '📓', poem: '📜', list: '📋', file: '📁', box: '📦', package: '📦', bag: '👜',
      key: '🔑', card: '🃏', bell: '🔔', button: '🔘', hook: '🪝', chain: '⛓️', tool: '🛠️',
      machine: '⚙️', metal: '🔩', trap: '🪤', toy: '🧸', bin: '🗑️', flag: '🚩', sign: '🪧',
      license: '🪪', bomb: '💣', hole: '🕳️', magic: '🪄', ancient: '🏺', cigarette: '🚬',
      smoke: '🚬', picture: '🖼️', instrument: '🎻', guitar: '🎸', piano: '🎹', album: '💿',
      tune: '🎼', bowl: '🥣', knife: '🔪', shell: '🐚', wing: '🪽', bone: '🦴', web: '🕸️',
      map: '🗺️'
    }
  },
  money: {
    label: '金錢',
    words: {
      money: '💰', dollar: '💵', coin: '🪙', price: '🏷️', cost: '💸', bill: '🧾', expensive: '💎',
      currency: '💱', chart: '📊', increase: '📈', decrease: '📉', business: '💼'
    }
  },
  time: {
    label: '時間',
    words: {
      time: '⌛', wait: '⏳', clock: '🕰️', hour: '🕐', minute: '⏱️', wake: '⏰', date: '📅',
      month: '📆', week: '🗓️', morning: '🌅', evening: '🌆', night: '🌙', half: '🌗'
    }
  },
  symbols: {
    label: '符號概念',
    words: {
      yes: '✅', check: '☑️', no: '🙅', wrong: '❌', ban: '🚫', question: '❓', information: 'ℹ️',
      warn: '⚠️', emergency: '🚨', stop: '🛑', start: '▶️', pause: '⏸️', finish: '🏁', end: '🔚',
      next: '⏭️', back: '🔙', up: '⬆️', down: '⬇️', left: '⬅️', right: '➡️', turn: '↩️',
      repeat: '🔁', change: '🔄', add: '➕', plus: '➕', equal: '🟰', divide: '➗', mathematics: '📐',
      measure: '📏', count: '🧮', number: '🔢', one: '1️⃣', perfect: '💯', new: '🆕', top: '🔝',
      okay: '🆗', fine: '👌', good: '👍', great: '👏', help: '🆘', little: '🤏', peace: '☮️',
      freedom: '🗽', law: '⚖️', vote: '🗳️', war: '⚔️', accident: '💥', symbol: '🔣', word: '🔤',
      name: '📛', service: '🛎️', safety: '🦺', attract: '🧲', experiment: '⚗️', science: '🔬',
      exam: '📝', fast: '⏩', mystery: '🕵️', oil: '🛢️', farm: '🚜', construction: '🚧',
      direction: '🧭'
    }
  }
}

/** Flattened lookup: headword → emoji. First theme listed wins on duplicates. */
export const PICTURES = (() => {
  const out = {}
  for (const t of Object.values(THEMES)) {
    for (const [w, e] of Object.entries(t.words)) if (!(w in out)) out[w] = e
  }
  return Object.freeze(out)
})()

/** Headword → theme key, for odd-one-out and thematic batching. */
export const THEME_OF = (() => {
  const out = {}
  for (const [k, t] of Object.entries(THEMES)) {
    for (const w of Object.keys(t.words)) if (!(w in out)) out[w] = k
  }
  return Object.freeze(out)
})()

export function pictureOf (headword) {
  return PICTURES[String(headword || '').toLowerCase()] || ''
}
