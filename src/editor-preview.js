/* Build an isolated preview document for untrusted editor HTML. */
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

export function createSandboxedPreviewDocument({ title = '', contentHtml = '' } = {}) {
  const safeTitle = escapeHtml(title);
  const content = String(contentHtml ?? '');
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'; form-action \'none\'; base-uri \'none\'">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + safeTitle + '</title>' +
    '<style>body{font:16px/1.7 system-ui,sans-serif;max-width:760px;margin:32px auto;padding:0 20px;color:#202124}img{max-width:100%;height:auto}table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px}</style>' +
    '</head><body><main><h1>' + safeTitle + '</h1>' + content + '</main></body></html>';
}
