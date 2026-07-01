const MOTAS = [
  { value: 'nor', label: 'Nor' },
  { value: 'nor-nori', label: 'Nor-Nori' },
  { value: 'nor-nork', label: 'Nor-Nork' },
  { value: 'nor-nori-nork', label: 'Nor-Nori-Nork' },
];

// Un seul choix utilisateur "Nor-Nori-Nork" regroupe en réalité deux tables
// de conjugaison (NOR singulier/pluriel) : on tire l'une ou l'autre au hasard.
const MOTA_GROUPS = {
  'nor-nori-nork': ['nor-sg-nori-nork', 'nor-pl-nori-nork'],
};

function motasForFilter(value) {
  return MOTA_GROUPS[value] || [value];
}

// Baldintza, Ondorioa et Hipotetikoa ne sont pas des Modua indépendants côté
// UI : ce sont des variantes d'Aldia rattachées respectivement à Indikatiboa
// et Ahalera/Potentziala. Chaque sous-option porte le (modua, aldia) réel à
// utiliser pour le lookup dans conjugations.json / le filtrage des templates.
const MODUA_GROUPS = {
  indikatiboa: {
    label: 'Indikatiboa',
    aldias: [
      { value: 'orain', label: 'Orain', modua: 'indikatiboa', aldia: 'orain' },
      { value: 'lehen', label: 'Lehen', modua: 'indikatiboa', aldia: 'lehen' },
      { value: 'baldintza', label: 'Baldintza', modua: 'baldintza', aldia: null },
      { value: 'ondorioa-orain', label: 'Ondorioa Orain', modua: 'ondorioa', aldia: 'orain' },
      { value: 'ondorioa-lehen', label: 'Ondorioa Lehen', modua: 'ondorioa', aldia: 'lehen' },
    ],
  },
  ahalera: {
    label: 'Ahalera / Potentziala',
    aldias: [
      { value: 'orain', label: 'Orain', modua: 'ahalera', aldia: 'orain' },
      { value: 'lehen', label: 'Lehen', modua: 'ahalera', aldia: 'lehen' },
      { value: 'hipotetikoa', label: 'Hipotetikoa / Alegiazkoa', modua: 'hipotetikoa', aldia: null },
    ],
  },
  subjuntiboa: {
    label: 'Subjuntiboa',
    aldias: [
      { value: 'orain', label: 'Orain', modua: 'subjuntiboa', aldia: 'orain' },
      { value: 'lehen', label: 'Lehen', modua: 'subjuntiboa', aldia: 'lehen' },
    ],
  },
  agintera: {
    label: 'Agintera',
    aldias: [
      { value: 'orain', label: 'Orain', modua: 'agintera', aldia: 'orain' },
    ],
  },
};

const MODUAS = Object.entries(MODUA_GROUPS).map(([value, g]) => ({ value, label: g.label }));

// Traduit la paire (modua, aldia) telle qu'écrite dans templates.txt vers les
// clés réelles de conjugations.json. Ex: ('ahalera','hipotetikoa') → {modua:'hipotetikoa', aldia:null}
// car l'utilisateur écrit la hiérarchie UI, pas la structure interne du JSON.
function resolveConjKey(displayModua, displayAldia) {
  const group = MODUA_GROUPS[displayModua];
  if (group) {
    const opt = group.aldias.find((a) => a.value === displayAldia);
    if (opt) return { modua: opt.modua, aldia: opt.aldia };
  }
  return { modua: displayModua, aldia: displayAldia };
}

const ROLES_FOR_MOTA = {
  'nor': ['nor'],
  'nor-nori': ['nor', 'nori'],
  'nor-nork': ['nor', 'nork'],
  'nor-sg-nori-nork': ['nori', 'nork'],
  'nor-pl-nori-nork': ['nori', 'nork'],
};

const ROLE_TOKEN_RE = { nor: /\bNOR\b/, nori: /\bNORI\b/, nork: /\bNORK\b/ };

let conjugations = null;
let templates = [];
let score = 0;
let total = 0;
let current = null; // { phraseWithBlank, answer }

function $(id) { return document.getElementById(id); }

function fillSelect(select, options, allLabel) {
  select.innerHTML = '';
  const allOpt = document.createElement('option');
  allOpt.value = '';
  allOpt.textContent = allLabel;
  select.appendChild(allOpt);
  for (const o of options) {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    select.appendChild(opt);
  }
}

function updateAldiaOptions() {
  const moduaValue = $('filter-modua').value;
  const group = $('aldia-group');
  const select = $('filter-aldia');
  const moduaGroup = MODUA_GROUPS[moduaValue];

  if (!moduaGroup || moduaGroup.aldias.length <= 1) {
    select.innerHTML = '';
    group.classList.add('hidden');
    return;
  }
  fillSelect(select, moduaGroup.aldias, 'Denak');
  group.classList.remove('hidden');
}

// ---- templates.txt parsing ----

const LINE_RE = /^(.*?)\s-\s*Modua:\s*([a-z-]+)\s*,\s*Aldia:\s*([a-z]*)\s*,\s*Mota:\s*([a-z()-]+)\s*(?:,\s*(.*))?$/i;

function parseTemplatesText(text) {
  const result = [];
  const lines = text.split('\n');
  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return;

    const m = line.match(LINE_RE);
    if (!m) {
      console.warn(`templates.txt:${idx + 1}: ligne ignorée (format non reconnu): ${line}`);
      return;
    }
    const [, phrase, modua, aldiaRaw, mota, fixedRaw] = m;
    const aldia = aldiaRaw ? aldiaRaw.toLowerCase() : null;

    const fixed = {};
    if (fixedRaw) {
      for (const part of fixedRaw.split(',')) {
        const [roleRaw, valueRaw] = part.split(':');
        if (!roleRaw || !valueRaw) continue;
        fixed[roleRaw.trim().toLowerCase()] = valueRaw.trim().toLowerCase();
      }
    }

    const freeRoles = Object.keys(ROLE_TOKEN_RE).filter((role) => ROLE_TOKEN_RE[role].test(phrase));

    if (!/\bADITZA\b/.test(phrase)) {
      console.warn(`templates.txt:${idx + 1}: jeton ADITZA manquant: ${line}`);
      return;
    }

    const expectedRoles = ROLES_FOR_MOTA[mota.toLowerCase()];
    if (!expectedRoles) {
      console.warn(`templates.txt:${idx + 1}: mota inconnue "${mota}": ${line}`);
      return;
    }
    const gotRoles = new Set([...freeRoles, ...Object.keys(fixed)]);
    const missing = expectedRoles.filter((r) => !gotRoles.has(r));
    const extra = [...gotRoles].filter((r) => !expectedRoles.includes(r));
    if (missing.length || extra.length) {
      console.warn(
        `templates.txt:${idx + 1}: rôles incohérents pour mota "${mota}" `
        + `(manquant: ${missing.join(',') || '-'}, en trop: ${extra.join(',') || '-'}): ${line}`
      );
      return;
    }

    result.push({ phrase: phrase.trim(), modua: modua.toLowerCase(), aldia, mota: mota.toLowerCase(), fixed, freeRoles });
  });
  return result;
}

// ---- conjugations.json lookup ----

function getEntries(mota, modua, aldia) {
  const { modua: m, aldia: a } = resolveConjKey(modua, aldia);
  const node = conjugations[mota] && conjugations[mota][m];
  if (!node) return [];
  if (Array.isArray(node)) return node;
  if (a && node[a]) return node[a];
  return [];
}

function matchesFixed(entry, fixed) {
  return Object.keys(fixed).every((role) => entry[role] === fixed[role]);
}

// ---- question drawing ----

function eligibleTemplates() {
  const fMota = $('filter-mota').value;
  const fModua = $('filter-modua').value;
  const fAldia = $('filter-aldia').value;
  const fMotas = fMota ? motasForFilter(fMota) : null;

  // "Modua" sélectionné : on traduit en (modua, aldia) réels via le groupe
  // (Aldia non sélectionné = toutes les sous-options du groupe).
  const moduaGroup = MODUA_GROUPS[fModua];
  const fModuaAldias = moduaGroup
    ? (fAldia ? moduaGroup.aldias.filter((a) => a.value === fAldia) : moduaGroup.aldias)
    : null;

  return templates.filter((t) => {
    const { modua: tModua, aldia: tAldia } = resolveConjKey(t.modua, t.aldia);
    return (!fMotas || fMotas.includes(t.mota))
      && (!fModuaAldias || fModuaAldias.some((a) => a.modua === tModua && a.aldia === tAldia));
  });
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function drawQuestion(pool) {
  const candidates = [];
  for (const template of pool) {
    const entries = getEntries(template.mota, template.modua, template.aldia);
    const matches = entries.filter((e) => matchesFixed(e, template.fixed));
    for (const entry of matches) candidates.push({ template, entry });
  }
  if (candidates.length === 0) return null;
  const { template, entry } = pickRandom(candidates);

  let phrase = template.phrase;
  for (const role of template.freeRoles) {
    phrase = phrase.replace(ROLE_TOKEN_RE[role], entry[role]);
  }
  phrase = phrase.replace(/\bADITZA\b/, '___');
  phrase = phrase.charAt(0).toUpperCase() + phrase.slice(1);

  return { phraseWithBlank: phrase, answer: entry.form };
}

function showQuestion(q) {
  current = q;
  $('phrase-text').textContent = q.phraseWithBlank;
  $('answer-input').value = '';
  $('answer-input').disabled = false;
  $('feedback').classList.add('hidden');
  $('btn-check').classList.remove('hidden');
  $('btn-next').classList.add('hidden');
  $('answer-input').focus();
}

function showScreen(name) {
  for (const id of ['screen-select', 'screen-game', 'screen-result']) {
    $(id).classList.toggle('hidden', id !== name);
  }
}

// ---- event wiring ----

function startSession() {
  const pool = eligibleTemplates();
  const q = drawQuestion(pool);
  if (!q) {
    $('select-error').textContent = 'Ez da esaldirik aurkitu hautatutako irizpidearekin.';
    $('select-error').classList.remove('hidden');
    return;
  }
  $('select-error').classList.add('hidden');
  score = 0;
  total = 0;
  $('score').textContent = '0';
  $('total').textContent = '0';
  $('score-display').classList.remove('hidden');
  showScreen('screen-game');
  showQuestion(q);
}

function checkAnswer() {
  const given = $('answer-input').value.trim().toLowerCase();
  const correct = given === current.answer.toLowerCase();
  total += 1;
  if (correct) score += 1;
  $('score').textContent = String(score);
  $('total').textContent = String(total);

  const feedback = $('feedback');
  feedback.classList.remove('hidden', 'ok', 'ko');
  if (correct) {
    feedback.textContent = 'Zuzen!';
    feedback.classList.add('ok');
  } else {
    feedback.textContent = `Okerra. Erantzun zuzena: ${current.answer}`;
    feedback.classList.add('ko');
  }
  $('answer-input').disabled = true;
  $('btn-check').classList.add('hidden');
  $('btn-next').classList.remove('hidden');
}

function nextQuestion() {
  const pool = eligibleTemplates();
  const q = drawQuestion(pool);
  if (!q) {
    finishSession();
    return;
  }
  showQuestion(q);
}

function finishSession() {
  $('score-display').classList.add('hidden');
  $('result-summary').textContent = `${score} / ${total} zuzen`;
  showScreen('screen-result');
}

function init() {
  fillSelect($('filter-mota'), MOTAS, 'Denak');
  fillSelect($('filter-modua'), MODUAS, 'Denak');

  $('filter-modua').addEventListener('change', updateAldiaOptions);
  updateAldiaOptions();

  $('btn-start').addEventListener('click', startSession);
  $('answer-form').addEventListener('submit', (e) => { e.preventDefault(); checkAnswer(); });
  $('btn-next').addEventListener('click', nextQuestion);
  // Une fois la réponse validée, l'input est désactivé (donc ne reçoit plus
  // le submit du form) : on capture Entrée au niveau document pour avancer.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !$('btn-next').classList.contains('hidden')) {
      e.preventDefault();
      nextQuestion();
    }
  });
  $('btn-finish').addEventListener('click', finishSession);
  $('btn-restart-same').addEventListener('click', startSession);
  $('btn-restart-new').addEventListener('click', () => showScreen('screen-select'));

  Promise.all([
    fetch('data/conjugations.json').then((r) => r.json()),
    fetch('data/templates.txt').then((r) => r.text()),
  ]).then(([conjData, templatesText]) => {
    conjugations = conjData;
    templates = parseTemplatesText(templatesText);
    console.log(`${templates.length} phrase(s) chargée(s).`);
  }).catch((err) => {
    console.error('Datuak kargatzean errorea:', err);
    $('select-error').textContent = 'Datuak kargatzean errorea. Ikus kontsola.';
    $('select-error').classList.remove('hidden');
  });
}

init();
