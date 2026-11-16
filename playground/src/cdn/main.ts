import './page.css';
const base = location.origin + '/cdn/';
const quick = `<link rel="stylesheet" href="${base}expressive-ui.css">\n<script defer src="${base}expressive-ui.js"></script>\n\n<button data-eui="button">Hello, Expressive UI</button>`;
document.getElementById('quick-code')!.textContent = quick;
document.getElementById('module-code')!.textContent =
  `<script type="module">\n  import { enhanceButton } from '${base}components.js';\n  const button = enhanceButton(document.querySelector('#save'));\n</script>`;
document.getElementById('copy-quick')!.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(quick);
    document.getElementById('copy-status')!.textContent = '已复制，粘贴到 HTML 即可使用。';
  } catch {
    document.getElementById('copy-status')!.textContent = '请选中上方代码复制。';
  }
});
