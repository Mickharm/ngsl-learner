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
      food: '🍱', meal: '🍽️', coffee: '☕', tea: '🍵', milk: '🥛', water: '💧', wine: '🍷',
      beer: '🍺', bottle: '🍾', bread: '🍞', rice: '🍚', egg: '🥚', meat: '🥩', chicken: '🐔',
      fish: '🐟', cheese: '🧀', cake: '🍰', chocolate: '🍫', fruit: '🍎', orange: '🍊',
      vegetable: '🥦', potato: '🥔', salt: '🧂'
    }
  },
  animals: {
    label: '動物',
    words: {
      dog: '🐕', cat: '🐈', bird: '🐦', horse: '🐎', cow: '🐄', pig: '🐖', sheep: '🐑', mouse: '🐁',
      rat: '🐀'
    }
  },
  body: {
    label: '身體',
    words: {
      hand: '✋', finger: '☝️', arm: '💪', muscle: '💪', leg: '🦵', foot: '🦶', eye: '👁️', ear: '👂',
      nose: '👃', mouth: '👄', tongue: '👅', tooth: '🦷', brain: '🧠', heart: '❤️', blood: '🩸'
    }
  },
  people: {
    label: '人物',
    words: {
      man: '👨', woman: '👩', child: '🧒', kid: '🧒', boy: '👦', girl: '👧', baby: '👶',
      person: '🧑', people: '👥', family: '👨‍👩‍👧', mother: '👩‍👧', mom: '👩‍👧', father: '👨‍👧',
      dad: '👨‍👧', grandmother: '👵', couple: '💑', friend: '🧑‍🤝‍🧑', king: '🤴', hero: '🦸',
      guard: '💂', soldier: '🪖'
    }
  },
  jobs: {
    label: '職業',
    words: {
      worker: '👷', teacher: '🧑‍🏫', student: '🧑‍🎓', doctor: '🧑‍⚕️', police: '👮',
      judge: '👨‍⚖️', farmer: '🧑‍🌾', engineer: '🧑‍🔧', scientist: '🧑‍🔬', artist: '🧑‍🎨',
      pilot: '🧑‍✈️', singer: '🧑‍🎤'
    }
  },
  places: {
    label: '地點',
    words: {
      house: '🏠', home: '🏡', school: '🏫', office: '🏢', factory: '🏭', hotel: '🏨', bank: '🏦',
      church: '⛪', castle: '🏰', tower: '🗼', bridge: '🌉', city: '🏙️', town: '🏘️', store: '🏪',
      station: '🚉', park: '🏞️', camp: '🏕️', tent: '⛺', island: '🏝️', beach: '🏖️', desert: '🏜️',
      mountain: '⛰️', forest: '🌲', field: '🌾', port: '⚓', world: '🌍', earth: '🌏'
    }
  },
  home: {
    label: '家裡',
    words: {
      door: '🚪', window: '🪟', wall: '🧱', bed: '🛏️', bath: '🛁', shower: '🚿', furniture: '🛋️',
      chair: '🪑', mirror: '🪞'
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
      snow: '❄️', storm: '⛈️', fire: '🔥', ice: '🧊', sea: '🌊', ocean: '🌊', rock: '🪨', wood: '🪵',
      tree: '🌳', plant: '🪴', flower: '🌸', autumn: '🍂', winter: '⛄', planet: '🪐',
      temperature: '🌡️'
    }
  },
  feelings: {
    label: '情緒',
    words: {
      happy: '😊', smile: '😄', laugh: '😂', funny: '🤣', sad: '😞', cry: '😢', angry: '😠',
      fear: '😨', scream: '😱', surprise: '😲', worry: '😟', nervous: '😬', bore: '🥱',
      embarrass: '😳', confuse: '😕',     }
  },
  health: {
    label: '健康',
    words: {
      sick: '🤒', pain: '🤕', medicine: '💊', virus: '🦠', hospital: '🏥'
    }
  },
  clothes: {
    label: '衣物',
    words: {
      clothes: '👚', shirt: '👕', dress: '👗', coat: '🧥', hat: '🎩', cap: '🧢', shoe: '👟',
      boot: '👢', tie: '👔', ring: '💍'
    }
  },
  media: {
    label: '科技媒體',
    words: {
      phone: '📱', telephone: '☎️', computer: '💻', screen: '🖥️', camera: '📷', photograph: '📸',
      video: '📹', television: '📺', radio: '📻', film: '🎞️', movie: '🎬', music: '🎵', song: '🎶',
      sound: '🔊', news: '📰', newspaper: '🗞️', email: '📧', electricity: '⚡', printer: '🖨️'
    }
  },
  sport: {
    label: '運動休閒',
    words: {
      ball: '🏀', football: '⚽', tennis: '🎾', golf: '⛳', ski: '⛷️', goal: '🥅', win: '🏆',
      party: '🎉', art: '🎨', target: '🎯'
    }
  },
  colors: {
    label: '顏色形狀',
    words: {
      red: '🔴', blue: '🔵', green: '🟢', yellow: '🟡', black: '⚫', white: '⚪', brown: '🟤',
      pink: '🩷', gray: '🩶', circle: '⭕', square: '🟥'
    }
  },
  actions: {
    label: '動作',
    words: {
      run: '🏃', walk: '🚶', climb: '🧗', swim: '🏊', dance: '💃', write: '✍️', read: '📖',
      look: '👀', speak: '🗣️', call: '📞', gift: '🎁', search: '🔍', lock: '🔐',
      cut: '✂️', exercise: '🏋️', hello: '👋', hi: '👋', cook: '🧑‍🍳', graduate: '🎓', arrive: '🛬',
      travel: '🧳', ride: '🚴'
    }
  },
  things: {
    label: '物品',
    words: {
      book: '📕', paper: '📃', page: '📄', letter: '✉️', envelope: '📩', mail: '📮', pen: '🖊️',
      journal: '📓', file: '📁', box: '📦', package: '📦', bag: '👜', key: '🔑', bell: '🔔',
      button: '🔘', hook: '🪝', chain: '⛓️', tool: '🛠️', trap: '🪤', toy: '🧸', bin: '🗑️',
      flag: '🚩', sign: '🪧', license: '🪪', bomb: '💣', hole: '🕳️', cigarette: '🚬',
      picture: '🖼️', guitar: '🎸', piano: '🎹', bowl: '🥣', knife: '🔪', shell: '🐚', wing: '🪽',
      bone: '🦴', web: '🕸️', map: '🗺️'
    }
  },
  money: {
    label: '金錢',
    words: {
      money: '💰', dollar: '💵', coin: '🪙', price: '🏷️', bill: '🧾', chart: '📊', increase: '📈',
      decrease: '📉'
    }
  },
  time: {
    label: '時間',
    words: {
      clock: '🕰️', morning: '🌅', evening: '🌆', night: '🌙'
    }
  },
  describe: {
    label: '形容樣子',
    words: {
      cold: '🥶', hot: '🥵'
    }
  },
  mind: {
    label: '想法與狀態',
    words: {
      sleep: '😴',     }
  },
  symbols: {
    label: '符號概念',
    words: {
      stop: '🛑', up: '⬆️', down: '⬇️', left: '⬅️', right: '➡️', one: '1️⃣', vote: '🗳️',
      oil: '🛢️', construction: '🚧'
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
