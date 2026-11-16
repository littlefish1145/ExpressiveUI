/** Declarative examples keep the most common CDN use cases free of initialization code. */
export const declarative: Record<string, string> = {
  'components/button': '<button data-eui="button">Save changes</button>',
  'components/fab': '<button data-eui="fab" aria-label="Create">＋</button>',
  'components/switch':
    '<label><span><input data-eui="switch" type="checkbox" checked></span> Notifications</label>',
  'components/loading-indicator':
    '<div data-eui="loading-indicator" data-label="Loading your workspace"></div>',
  'components/icon-button': '<button data-eui="icon-button" aria-label="Favorite">☆</button>',
  'components/checkbox':
    '<label><span><input data-eui="checkbox" type="checkbox"></span> I agree to the terms</label>',
  'components/radio':
    '<fieldset><legend>Plan</legend>\n<label><span><input data-eui="radio" type="radio" name="plan" checked></span> Free</label>\n<label><span><input data-eui="radio" type="radio" name="plan"></span> Pro</label>\n</fieldset>',
  'components/slider':
    '<label for="volume">Volume</label>\n<span><input data-eui="slider" id="volume" type="range" min="0" max="100" step="10" value="40"></span>',
  'components/text-field':
    '<span><input data-eui="text-field" data-label="Your name" placeholder="Alex"></span>',
  'components/chip': '<button data-eui="chip" data-variant="filter">Design</button>',
  'components/segmented-button':
    '<div data-eui="segmented-buttons" data-label="Calendar view">\n<button data-value="day">Day</button><button data-value="week">Week</button>\n</div>',
  'components/dialog':
    '<button data-eui="button" data-eui-open="details">Open dialog</button>\n<dialog id="details" data-eui="dialog" aria-labelledby="title">\n<h2 id="title">Keep this idea?</h2><p>You can return whenever inspiration strikes.</p>\n<button data-eui="button" data-variant="text" data-eui-close>Close</button>\n</dialog>',
  'components/sheet':
    '<button data-eui="button" data-eui-open="details">Open sheet</button>\n<dialog id="details" data-eui="sheet" data-label="More details">\n<h2>A little more detail</h2><button data-eui="button" data-variant="text" data-eui-close>Done</button>\n</dialog>',
  'components/menu':
    '<button id="sort" data-eui="button">Sort options</button>\n<div data-eui="menu" data-anchor="#sort" aria-label="Sort">\n<button data-menu-item data-value="recent">Recent first</button>\n<button data-menu-item data-value="name">Name</button>\n</div>',
  'components/tooltip':
    '<button id="hint" data-eui="button">Hover or focus me</button>\n<div data-eui="tooltip" data-anchor="#hint">Your work is saved automatically.</div>',
  'components/tabs':
    '<div data-eui="tabs" data-label="Your library">\n<button data-tab="ideas">Ideas</button><button data-tab="saved">Saved</button>\n</div>\n<section id="ideas">Space for ideas.</section>\n<section id="saved">Your favorites.</section>',
  'components/navigation':
    '<nav data-eui="navigation-bar" data-label="Main navigation">\n<button data-nav-item="home"><span data-icon>⌂</span><span data-label>Home</span></button>\n<button data-nav-item="saved"><span data-icon>☆</span><span data-label>Saved</span></button>\n</nav>',
  'components/surfaces':
    '<article data-eui="card" data-variant="outlined">\n<h2>Related ideas <span data-eui="badge" data-eui-options=\'{"value":12,"label":"12 unread messages"}\'></span></h2>\n<hr data-eui="divider"><ul data-eui="list"><li data-list-item>Expressive shapes</li><li data-list-item>Natural motion</li></ul>\n</article>',
  'components/app-bar':
    '<header data-eui="app-bar" data-variant="small"><span data-title>Your workspace</span></header>',
  'components/carousel':
    '<div data-eui="carousel" data-label="Creative possibilities">\n<article data-carousel-item>Make something.</article><article data-carousel-item>Try a new angle.</article><article data-carousel-item>Keep it close.</article>\n</div>',
  'components/progress':
    '<div data-eui="progress" data-label="Upload progress" data-eui-options=\'{"value":0.6}\'></div>',
  'components/date-picker':
    '<span><input data-eui="date-picker" type="date" aria-label="Date"></span>',
  'components/time-picker':
    '<span><input data-eui="time-picker" type="time" aria-label="Time"></span>',
  'components/search':
    '<div data-eui="search" data-label="Search projects"><input type="search" placeholder="Search projects"></div>',
  'components/button-group':
    '<div data-eui="button-group"><button data-value="archive">Archive</button><button data-value="share">Share</button><button data-value="delete">Delete</button></div>',
  'components/advanced-slider':
    '<div data-eui="range-slider">\n<input type="range" min="0" max="100" value="20" aria-label="Minimum">\n<input type="range" min="0" max="100" value="75" aria-label="Maximum">\n</div>',
  'components/select':
    '<span><select data-eui="select" data-label="Plan"><option>Free</option><option>Pro</option></select></span>',
  'components/banner':
    '<div data-eui="banner" data-eui-options=\'{"message":"You are working offline."}\'></div>',
};

export function cdnDocument(
  html: string,
  css: string,
  script = '',
  origin = 'https://expressive-ui-green.vercel.app',
) {
  const base = new URL('/cdn/', origin).href;
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Expressive UI · CDN example</title>
  <link rel="stylesheet" href="${base}expressive-ui.css">
  <script src="${base}expressive-ui.js"${script ? '' : ' defer'}></script>
  <style>
${css.replace(/<\/style/gi, '<\\/style')}
  </style>
</head>
<body>
${html}
${script ? `<script>\n${script.replace(/<\/script/gi, '<\\/script')}\n</script>\n` : ''}</body>
</html>`;
}
