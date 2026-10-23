/**
 * @file Hilfsfunktionen für die Arbeit mit HTML-Elementen.
 *
 * Wichtig: Benutzereingaben (z. B. Gruppennamen) werden immer über
 * `textContent` eingefügt, nie über `innerHTML`. `el()` erledigt das
 * automatisch und schützt so vor eingeschleustem HTML/JavaScript.
 */

/**
 * Erstellt ein HTML-Element.
 *
 * @example
 *   el('button', { class: 'btn', onclick: save, 'aria-label': 'Speichern' }, 'Speichern')
 *
 * @param {string} tag  Tag-Name, z. B. "div".
 * @param {Record<string, any>} [attrs]  Attribute. Schlüssel, die mit "on"
 *        beginnen, werden als Event-Handler registriert. `dataset` setzt data-*-Attribute.
 *        Werte `false`, `null` und `undefined` werden ignoriert.
 * @param {...(Node|string|number|null|false)} children Kindelemente oder Text.
 * @returns {HTMLElement}
 */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'dataset') {
      Object.assign(node.dataset, value);
    } else if (value === true) {
      node.setAttribute(key, '');
    } else {
      node.setAttribute(key, String(value));
    }
  }

  for (const child of children.flat()) {
    if (child === null || child === false || child === undefined) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/**
 * Kurzform für `document.querySelector`.
 *
 * @param {string} selector CSS-Selektor.
 * @param {ParentNode} [root=document]
 * @returns {HTMLElement|null}
 */
export function $(selector, root = document) {
  return root.querySelector(selector);
}

/**
 * Startet eine CSS-Animation neu, indem die Klasse kurz entfernt und wieder
 * gesetzt wird (z. B. für ein "Aufblinken" bei Änderungen).
 *
 * @param {HTMLElement} node
 * @param {string} className Klasse mit der Animation.
 * @returns {void}
 */
export function restartAnimation(node, className) {
  node.classList.remove(className);
  void node.offsetWidth; // erzwingt Neuberechnung, damit die Animation neu startet
  node.classList.add(className);
}


/**
 * Spielt eine CSS-Animation genau einmal ab und entfernt die Klasse danach
 * wieder.
 *
 * Für einmalige Effekte (z. B. "Zahl blinkt auf") immer diese Funktion
 * verwenden statt `restartAnimation()`. Grund: Bleibt die Klasse am Element,
 * startet der Browser die Animation erneut, sobald das Element im DOM
 * verschoben wird (z. B. beim Umsortieren der Karten). Dann würden alte
 * Effekte ohne Anlass wieder aufblinken.
 *
 * `restartAnimation()` ist nur für Zustände gedacht, die bewusst länger
 * sichtbar bleiben und selbst wieder entfernt werden (z. B. Hervorhebung auf
 * der Rangliste).
 *
 * @param {HTMLElement} node
 * @param {string} className Klasse mit der Animation.
 * @returns {void}
 */
export function playAnimationOnce(node, className) {
  restartAnimation(node, className);

  /** Entfernt die Klasse, sobald die Animation DIESES Elements fertig ist. */
  const cleanup = (event) => {
    // Animationen von Kind-Elementen lösen das Ereignis ebenfalls aus (Bubbling)
    if (event.target !== node) return;
    node.classList.remove(className);
    node.removeEventListener('animationend', cleanup);
    node.removeEventListener('animationcancel', cleanup);
  };

  // Vorherige Aufräum-Funktion ersetzen, falls die Animation schnell
  // hintereinander mehrmals gestartet wird
  if (node._animationCleanup) {
    node.removeEventListener('animationend', node._animationCleanup);
    node.removeEventListener('animationcancel', node._animationCleanup);
  }
  node._animationCleanup = cleanup;
  node.addEventListener('animationend', cleanup);
  node.addEventListener('animationcancel', cleanup);
}