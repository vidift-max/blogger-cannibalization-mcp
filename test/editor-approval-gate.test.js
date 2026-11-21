import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('../public/editor.html',import.meta.url),'utf8');
test('editor requires explicit approval before publish',()=>{assert.match(html,/id="publish"/);assert.match(html,/id="approve"/);assert.match(html,/grantPublishCapability/);assert.match(html,/canOperatorPublish/);});
test('publish gate checks approval capability',()=>{assert.match(html,/workflow!==['"]approved['"] \|\| !publicationAllowed \|\| !canOperatorPublish/);});

test('editor delegates workflow state to content-workspace contract',()=>{assert.match(html,/transitionWorkspace/);assert.match(html,/canPublishWorkspace/);assert.doesNotMatch(html,/state\.workflow=['"]approved['"]/);});

test('approval action requires an explicit user confirmation dialog',()=>{assert.match(html,/window\.confirm\('Você confirma explicitamente/);assert.match(html,/state\.operator\.user_approved=true/);});
test('publish action also requires explicit confirmation',()=>{assert.match(html,/Confirmar publicação deste conteúdo/);});
