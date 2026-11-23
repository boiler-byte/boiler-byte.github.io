/* SVG-Icon-Helfer fuer Typ, Tag und Gruppe (statische SVG-Assets, keine Imports). */
(function (B) {
  'use strict';

  const paths = Object.freeze({
    type: 'svg/type.svg',
    tag: 'svg/tag.svg',
    group: 'svg/group.svg'
  });
  const descriptions = { type: 'Typ', tag: 'Tag', group: 'Gruppe' };

  function create(kind) {
    if (!Object.prototype.hasOwnProperty.call(paths, kind)) return null;
    const img = document.createElement('img');
    img.className = 'repo-attribute-icon';
    img.src = paths[kind];
    img.alt = '';
    img.width = 18;
    img.height = 18;
    img.setAttribute('aria-hidden', 'true');
    return img;
  }

  function attribute(kind, value) {
    const badge = document.createElement('span');
    badge.className = 'discover-attribute discover-attribute-' + kind;
    const symbol = create(kind);
    if (symbol) badge.appendChild(symbol);
    badge.appendChild(document.createTextNode(String(value)));
    badge.title = (descriptions[kind] || kind) + ': ' + value;
    return badge;
  }

  B.icons = { create, attribute };
})(window.BoilerRoom);
