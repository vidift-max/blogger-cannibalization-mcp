import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('../public/editor.html',import.meta.url),'utf8');
test('editor exposes manual Claude HTML import',()=>{assert.match(html,/id="importClaude"/);assert.match(html,/accept="\.html,\.htm,text\/html"/);assert.match(html,/HTML do Claude importado como rascunho/);});
test('Claude import does not enable publication',()=>{assert.match(html,/importClaudeHtmlToWorkspace/);assert.match(html,/publicação continua bloqueada/);assert.match(html,/publish\.disabled=workflow!==['"]approved['"]/);});
