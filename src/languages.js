// Plain - other human languages.
//
// A program says what language it is in on its first meaningful line:
//
//     en español          or          en français
//
// and from then on every sentence in the file may be written in that
// language. The translation happens once, on the tokens, before the parser
// ever sees them - so the parser, the checker, the translator to other
// programming languages and the error line numbers all work unchanged.
//
// How it works: each pack is a dictionary from its own words to the English
// words the sentences are registered under. Multi-word entries are matched
// longest first, which is what lets "por cada" become "for each" and
// "no es" become "is not" even though the word orders differ. Any word not
// in the dictionary passes through untouched, which means:
//
//   - names you invent are left alone (and if you name something "caja" it
//     becomes "box" everywhere consistently, which still works)
//   - any English word still works mid-sentence, so a missing dictionary
//     entry is an inconvenience rather than a wall
//
// A pack is data, not code. Adding a language is adding a dictionary.

const SPANISH = {
  // --- the shape of the language -----------------------------------------
  'si': 'if', 'sino': 'otherwise', 'o si no': 'otherwise', 'fin': 'end',
  'repite': 'repeat', 'repetir': 'repeat', 'mientras': 'while',
  'por cada': 'for each', 'cada': 'every', 'cuando': 'when',
  'para': 'to', 'a': 'to', 'hasta': 'to', 'desde': 'from',
  'da': 'give', 'devuelve': 'give back', 'atrás': 'back', 'atras': 'back',
  'detén': 'stop', 'deten': 'stop', 'sigue': 'next', 'salta': 'skip',
  'haz': 'make', 'crea': 'make', 'sea': 'be', 'ser': 'be', 'como': 'as',
  'cambia': 'set', 'ajusta': 'set', 'muestra': 'show', 'enseña': 'show',
  'con': 'with', 'y': 'and', 'o': 'or', 'no es': 'is not', 'es': 'is',
  // "y" is Spanish for "and" and also the name of the up-and-down
  // coordinate every game uses. "y de moneda" is the coordinate; matched
  // longest first, so plain "y" between two conditions is still "and".
  'y de': 'y of', 'la y': 'the y',
  'sí': 'yes', 'verdadero': 'yes', 'falso': 'no',
  'nada': 'nothing', 'usa': 'use', 'espera': 'wait', 'entonces': 'then',
  'veces': 'times', 'vez': 'times', 'durante': 'for',
  'el': 'the', 'la': 'the', 'los': 'the', 'las': 'the',
  'un': 'a', 'una': 'a', 'unos': 'a', 'unas': 'a',
  'de tamaño': 'sized', 'de color': 'colored', 'coloreado': 'colored',
  'en': 'at', 'dentro de': 'in', 'sobre': 'on', 'por': 'by',
  'de': 'of', 'que': 'that', 'este': 'this', 'esta': 'this',
  'llamado': 'called', 'llamada': 'called',
  'no': 'not',

  // --- asking about things -----------------------------------------------
  'es mayor que': 'is above', 'es menor que': 'is below',
  'es al menos': 'is at least', 'es como mucho': 'is at most',
  'es a lo sumo': 'is at most', 'contiene': 'contains',
  'empieza con': 'starts with', 'termina con': 'ends with',
  'toca': 'touches', 'tocó': 'touched', 'toco': 'touched',

  // --- numbers and lists -------------------------------------------------
  'número': 'number', 'numero': 'number', 'números': 'numbers', 'numeros': 'numbers',
  'elemento': 'item', 'elementos': 'items', 'lista': 'list',
  'longitud': 'length', 'largo': 'length', 'suma': 'add', 'añade': 'add',
  'anade': 'add', 'agrega': 'add', 'quita': 'remove', 'elimina': 'remove',
  'total': 'total', 'promedio': 'average', 'mayor': 'highest', 'menor': 'lowest',
  'ordenado': 'sorted', 'ordenada': 'sorted', 'invertido': 'reversed',
  'invertida': 'reversed', 'barajado': 'shuffled', 'barajada': 'shuffled',
  'mezclado': 'shuffled', 'aleatorio': 'random', 'azar': 'random',
  'primero': 'first', 'último': 'last', 'ultimo': 'last',
  'redondea': 'round', 'redondeado': 'round', 'parte': 'part',
  'posición': 'position', 'posicion': 'position', 'únicos': 'unique',
  'unicos': 'unique', 'une': 'join', 'copia': 'copy', 'texto': 'text',
  'valor': 'value', 'valores': 'values', 'vacío': 'empty', 'vacio': 'empty',
  'más': 'plus', 'mas': 'plus', 'menos': 'minus',
  'dividido entre': 'divided by', 'dividido por': 'divided by',
  'multiplicado por': 'times', 'módulo': 'modulo', 'modulo': 'modulo',
  'cuenta': 'count', 'raíz': 'root', 'raiz': 'root', 'cuadrada': 'square',
  'cuadrado': 'square', 'absoluto': 'absolute', 'piso': 'floor',
  'techo': 'ceiling', 'entre': 'between',

  // --- words about words -------------------------------------------------
  'mayúsculas': 'uppercase', 'mayusculas': 'uppercase',
  'minúsculas': 'lowercase', 'minusculas': 'lowercase',
  'recortado': 'trimmed', 'reemplaza': 'replace', 'divide': 'split',
  'palabras': 'words', 'letra': 'letter', 'letras': 'letters',

  // --- the game ----------------------------------------------------------
  'empieza': 'start', 'inicia': 'start', 'juego': 'game', 'mundo': 'world',
  'dibuja': 'draw', 'caja': 'box', 'círculo': 'circle', 'circulo': 'circle',
  'bola': 'ball', 'línea': 'line', 'linea': 'line', 'arco': 'arc',
  'estrella': 'star', 'corazón': 'heart', 'corazon': 'heart',
  'diamante': 'diamond', 'triángulo': 'triangle', 'triangulo': 'triangle',
  'anillo': 'ring', 'cubo': 'cube', 'bloque': 'block', 'suelo': 'floor',
  'poste': 'post', 'cono': 'cone', 'fondo': 'background', 'cielo': 'sky',
  'ancho': 'width', 'alto': 'height', 'anchura': 'width', 'altura': 'height',
  'mueve': 'move', 'muévete': 'move', 'gira': 'turn', 'izquierda': 'left',
  'derecha': 'right', 'arriba': 'up', 'abajo': 'down', 'adelante': 'forward',
  'velocidad': 'speed', 'gravedad': 'gravity',
  'empuja': 'push', 'tecla': 'key', 'teclas': 'keys', 'pulsada': 'pressed',
  'presionada': 'pressed', 'mantenida': 'held', 'ratón': 'mouse',
  'raton': 'mouse', 'pulsado': 'clicked', 'clicado': 'clicked',
  'fotograma': 'frame', 'cuadro': 'frame', 'fotogramas': 'frames',
  'segundo': 'second', 'segundos': 'seconds', 'minuto': 'minute',
  'pitido': 'beep', 'sonido': 'sound', 'música': 'music',
  'musica': 'music', 'reproduce': 'play',
  'puntuación': 'score', 'puntuacion': 'score', 'imagen': 'picture',
  'foto': 'picture', 'cubre': 'cover', 'descubre': 'uncover',
  'repetido': 'repeated', 'repetida': 'repeated', 'cámara': 'camera',
  'camara': 'camera', 'esconde': 'hide',
  'oculta': 'hide', 'revela': 'reveal', 'agita': 'shake', 'vista': 'view',
  'escena': 'scene', 'pantalla': 'screen', 'centrado': 'centred',
  'centrada': 'centred', 'lámpara': 'lamp', 'lampara': 'lamp',
  'luz': 'light', 'sombras': 'shadows', 'sombra': 'shadow',
  'neblina': 'haze', 'alcanzando': 'reaching', 'flecha': 'arrow',
  'espacio': 'space', 'debajo': 'under', 'encima': 'over',
  'grupo': 'group', 'todo': 'everything', 'todos': 'everything',
  'algo': 'anything', 'quieto': 'still', 'reposando': 'resting',
  'cayendo': 'falling', 'volando': 'flying', 'mira': 'look',
  'apunta': 'point', 'distancia': 'distance', 'nivel': 'level'
};

const FRENCH = {
  // --- the shape of the language -----------------------------------------
  'si': 'if', 'sinon': 'otherwise', 'fin': 'end',
  'répète': 'repeat', 'repete': 'repeat', 'tant que': 'while',
  'pour chaque': 'for each', 'chaque': 'every', 'quand': 'when',
  'pour': 'to', 'à': 'to', 'a': 'to', "jusqu'à": 'to', "jusqu'a": 'to',
  'allant de': 'from', 'depuis': 'from',
  'donne': 'give', 'renvoie': 'give back', 'retour': 'back',
  'arrête': 'stop', 'arrete': 'stop', 'suivant': 'next', 'saute': 'skip',
  'fais': 'make', 'crée': 'make', 'cree': 'make', 'soit': 'be',
  'être': 'be', 'etre': 'be', 'comme': 'as',
  'change': 'set', 'règle': 'set', 'regle': 'set',
  'montre': 'show', 'affiche': 'show',
  'avec': 'with', 'et': 'and', 'ou': 'or', "n'est pas": 'is not', 'est': 'is',
  'oui': 'yes', 'vrai': 'yes', 'non': 'no', 'faux': 'no',
  'rien': 'nothing', 'utilise': 'use', 'attends': 'wait', 'alors': 'then',
  'fois': 'times', 'pendant': 'for',
  'le': 'the', 'la': 'the', 'les': 'the', "l'": 'the',
  'un': 'a', 'une': 'a', 'des': 'a',
  'de taille': 'sized', 'de couleur': 'colored', 'coloré': 'colored',
  'colore': 'colored', 'en': 'at', 'dans': 'in', 'sur': 'on', 'par': 'by',
  'de': 'of', 'que': 'that', 'ce': 'this', 'cette': 'this',
  'appelé': 'called', 'appele': 'called', 'appelée': 'called',
  'appelee': 'called', 'pas': 'not', 'ne': 'not',

  // --- asking about things -----------------------------------------------
  'est plus grand que': 'is above', 'est plus petit que': 'is below',
  'est au moins': 'is at least', 'est au plus': 'is at most',
  // "touche" is both the verb (joueur touche piece) and the key of a
  // keyboard. French says the noun with its article - "la touche" - and
  // longest-first matching uses that to tell them apart.
  'la touche': 'key', 'une touche': 'key', 'toute touche': 'any key',
  'contient': 'contains', 'commence par': 'starts with',
  'finit par': 'ends with', 'touche': 'touches', 'a touché': 'touched',

  // --- numbers and lists -------------------------------------------------
  'nombre': 'number', 'nombres': 'numbers', 'élément': 'item',
  'element': 'item', 'éléments': 'items', 'elements': 'items',
  'liste': 'list', 'longueur': 'length', 'ajoute': 'add',
  'enlève': 'remove', 'enleve': 'remove', 'retire': 'remove',
  'total': 'total', 'moyenne': 'average', 'plus haut': 'highest',
  'plus bas': 'lowest', 'trié': 'sorted', 'trie': 'sorted',
  'triée': 'sorted', 'inversé': 'reversed', 'inverse': 'reversed',
  'mélangé': 'shuffled', 'melange': 'shuffled', 'mélangée': 'shuffled',
  'hasard': 'random', 'aléatoire': 'random', 'aleatoire': 'random',
  'premier': 'first', 'dernier': 'last', 'arrondi': 'round',
  'arrondis': 'round', 'partie': 'part', 'position': 'position',
  'uniques': 'unique', 'joins': 'join', 'copie': 'copy', 'texte': 'text',
  'valeur': 'value', 'valeurs': 'values', 'vide': 'empty',
  'moins': 'minus', 'divisé par': 'divided by', 'divise par': 'divided by',
  'multiplié par': 'times', 'multiplie par': 'times',
  'compte': 'count', 'racine': 'root', 'carrée': 'square',
  'carre': 'square', 'carré': 'square', 'absolu': 'absolute',
  'plancher': 'floor', 'plafond': 'ceiling', 'entre': 'between',

  // --- words about words -------------------------------------------------
  'majuscules': 'uppercase', 'minuscules': 'lowercase',
  'coupé': 'trimmed', 'coupe': 'trimmed', 'remplace': 'replace',
  'découpe': 'split', 'decoupe': 'split', 'mots': 'words',
  'lettre': 'letter', 'lettres': 'letters',

  // --- the game ----------------------------------------------------------
  'démarre': 'start', 'demarre': 'start', 'lance': 'start', 'jeu': 'game',
  'monde': 'world', 'dessine': 'draw', 'boîte': 'box', 'boite': 'box',
  'cercle': 'circle', 'balle': 'ball', 'ligne': 'line', 'arc': 'arc',
  'étoile': 'star', 'etoile': 'star', 'coeur': 'heart', 'cœur': 'heart',
  'diamant': 'diamond', 'triangle': 'triangle', 'anneau': 'ring',
  'cube': 'cube', 'bloc': 'block', 'sol': 'floor', 'poteau': 'post',
  'cône': 'cone', 'cone': 'cone', 'fond': 'background', 'ciel': 'sky',
  'largeur': 'width', 'hauteur': 'height', 'bouge': 'move',
  'déplace': 'move', 'deplace': 'move', 'tourne': 'turn',
  'gauche': 'left', 'droite': 'right', 'haut': 'up', 'bas': 'down',
  'avant': 'forward', 'vitesse': 'speed', 'gravité': 'gravity',
  'gravite': 'gravity', 'pousse': 'push',
  'touches': 'keys', 'pressée': 'pressed', 'pressee': 'pressed',
  'appuyée': 'pressed', 'appuyee': 'pressed', 'tenue': 'held',
  'souris': 'mouse', 'cliquée': 'clicked', 'cliquee': 'clicked',
  'image': 'picture', 'photo': 'picture', 'couvre': 'cover',
  'découvre': 'uncover', 'decouvre': 'uncover', 'répété': 'repeated',
  'répétée': 'repeated',
  'caméra': 'camera', 'camera': 'camera', 'suis': 'follow',
  'cache': 'hide', 'révèle': 'reveal', 'revele': 'reveal',
  'secoue': 'shake', 'vue': 'view', 'scène': 'scene', 'scene': 'scene',
  'écran': 'screen', 'ecran': 'screen', 'centré': 'centred',
  'centre': 'centred', 'lampe': 'lamp', 'lumière': 'light',
  'lumiere': 'light', 'ombres': 'shadows', 'ombre': 'shadow',
  'brume': 'haze', 'atteignant': 'reaching', 'flèche': 'arrow',
  'fleche': 'arrow', 'espace': 'space', 'sous': 'under',
  'dessus': 'over', 'groupe': 'group', 'tout': 'everything',
  'quelque chose': 'anything', 'immobile': 'still', 'posé': 'resting',
  'pose': 'resting', 'tombant': 'falling', 'volant': 'flying',
  'regarde': 'look', 'pointe': 'point', 'distance': 'distance',
  'niveau': 'level', 'seconde': 'second', 'secondes': 'seconds',
  'trame': 'frame', 'son': 'sound',
  'musique': 'music', 'joue': 'play', 'bip': 'beep'
};

// The line that names the language, and the words that pull in a file.
export const PACKS = {
  spanish: { marker: /^[ \t]*en[ \t]+espa(ñ|n)ol[ \t]*$/im, words: SPANISH, name: 'español' },
  french: { marker: /^[ \t]*en[ \t]+fran(ç|c)ais[ \t]*$/im, words: FRENCH, name: 'français' }
};

export const USE_WORDS = ['use', 'usa', 'utilise'];

// Which language is this source in? Returns { pack, cleaned } - the marker
// line is blanked rather than removed so every line number stays honest.
export function detectLanguage(source) {
  for (const pack of Object.values(PACKS)) {
    const match = pack.marker.exec(source);
    if (match) {
      const cleaned = source.slice(0, match.index) +
        match[0].replace(/[^\n]/g, '') + source.slice(match.index + match[0].length);
      return { pack, cleaned };
    }
  }
  return { pack: null, cleaned: source };
}

// Turn a pack's dictionary into match tables: multi-word entries first,
// longest first, so "por cada" is tried before "por".
function tablesFor(pack) {
  if (pack._tables) return pack._tables;
  const multi = [];
  const single = new Map();
  for (const [from, to] of Object.entries(pack.words)) {
    if (from.endsWith('_')) continue;          // reserved spelling variants
    const parts = from.toLowerCase().split(/\s+/);
    const out = to.split(/\s+/);
    if (parts.length > 1) multi.push({ parts, out });
    else single.set(parts[0], out);
  }
  multi.sort((a, b) => b.parts.length - a.parts.length);
  pack._tables = { multi, single };
  return pack._tables;
}

// The translation itself: a run over the tokens, replacing words and runs
// of words, keeping every token's line and file so errors still point at
// the right place.
export function translateTokens(tokens, pack) {
  const { multi, single } = tablesFor(pack);
  const out = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token.type !== 'word') {
      if (token.type === 'text' && !token.raw) {
        out.push({ ...token, value: translateBraces(token.value, pack) });
      } else {
        out.push(token);
      }
      i++;
      continue;
    }

    // A single letter straight before ":" is a field name in a literal -
    // { y: 9 } is somebody's coordinate, not the Spanish word for "and".
    // Only single letters: longer field names translate like every other
    // word, so writing "ancho: 5" and reading "ancho de cosa" agree.
    const next = tokens[i + 1];
    if (token.value.length === 1 && next && next.type === 'symbol' && next.value === ':') {
      out.push(token);
      i++;
      continue;
    }

    // Longest multi-word match first.
    let matched = null;
    for (const entry of multi) {
      if (entry.parts.length > tokens.length - i) continue;
      let ok = true;
      for (let j = 0; j < entry.parts.length; j++) {
        const t = tokens[i + j];
        if (!t || t.type !== 'word' || t.value.toLowerCase() !== entry.parts[j]) { ok = false; break; }
      }
      if (ok) { matched = entry; break; }
    }
    if (matched) {
      for (const word of matched.out) out.push({ type: 'word', value: word, line: token.line, file: token.file });
      i += matched.parts.length;
      continue;
    }

    const found = single.get(token.value.toLowerCase());
    if (found) {
      for (const word of found) out.push({ type: 'word', value: word, line: token.line, file: token.file });
      i++;
      continue;
    }

    // French elision: "l'écran" is one token but two words. If the whole
    // word is unknown, split at the apostrophe and translate the halves -
    // the prefix with its apostrophe ("l'" is the), then the rest.
    const apostrophe = token.value.indexOf("'");
    if (apostrophe > 0 && apostrophe < token.value.length - 1) {
      const head = single.get(token.value.slice(0, apostrophe + 1).toLowerCase());
      const tail = token.value.slice(apostrophe + 1);
      if (head) {
        for (const word of head) out.push({ type: 'word', value: word, line: token.line, file: token.file });
        const rest = single.get(tail.toLowerCase());
        for (const word of (rest || [tail])) out.push({ type: 'word', value: word, line: token.line, file: token.file });
        i++;
        continue;
      }
    }

    out.push(token);
    i++;
  }
  return out;
}

// "{number de elementos dentro de x}" inside quoted text is a piece of the
// language too, so the same dictionary is run over what sits in the braces.
function translateBraces(text, pack) {
  return String(text).replace(/\{([^{}]*)\}/g, (whole, inside) => {
    return '{' + translateWordsIn(inside, pack) + '}';
  });
}

function translateWordsIn(text, pack) {
  const { multi, single } = tablesFor(pack);
  const pieces = String(text).split(/([\p{L}_][\p{L}\p{N}_]*(?:[ \t]+[\p{L}_][\p{L}\p{N}_]*)*)/u);
  return pieces.map(piece => {
    if (!/^[\p{L}_]/u.test(piece)) return piece;
    let words = piece.split(/[ \t]+/);
    const out = [];
    let i = 0;
    while (i < words.length) {
      let matched = null;
      for (const entry of multi) {
        if (entry.parts.length > words.length - i) continue;
        let ok = true;
        for (let j = 0; j < entry.parts.length; j++) {
          if (words[i + j].toLowerCase() !== entry.parts[j]) { ok = false; break; }
        }
        if (ok) { matched = entry; break; }
      }
      if (matched) { out.push(...matched.out); i += matched.parts.length; continue; }
      const found = single.get(words[i].toLowerCase());
      out.push(found ? found.join(' ') : words[i]);
      i++;
    }
    return out.join(' ');
  }).join('');
}
