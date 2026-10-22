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
