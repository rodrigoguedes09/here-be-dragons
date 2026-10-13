// Programmatic API.
//
//   import { survey } from 'here-be-dragons';
//   const { realm, svg, html, json } = await survey('.');

import { analyze } from './analyze.js';
import { layout } from './layout.js';
import { renderSVG } from './render.js';
import { renderHTML } from './html.js';
import { toJSON, toMarkdown, toTerminal } from './report.js';

export { analyze, layout, renderSVG, renderHTML, toJSON, toMarkdown, toTerminal };
export { chronicle, quests } from './chronicle.js';

/** Analyze a repository and draw everything in one go. */
export async function survey(dir = '.', options = {}) {
  const { theme = 'parchment', seed, width, height, ...analyzeOptions } = options;
  const realm = await analyze(dir, analyzeOptions);
  const geo = layout(realm, { seed: seed ?? realm.name, width, height });
  return {
    realm,
    geo,
    get svg() {
      return renderSVG(realm, geo, { theme });
    },
    get html() {
      return renderHTML(realm, geo, renderSVG(realm, geo, { theme, interactive: true }));
    },
    get json() {
      return toJSON(realm);
    },
    get markdown() {
      return toMarkdown(realm);
    },
  };
}
