import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePosts } from '../src/analysis.js';
test('detects similar article titles as possible cannibalization',()=>{const out=analyzePosts([{id:1,title:'Best savings account for students',content_text:'Compare savings account rates for students'},{id:2,title:'Best savings accounts for students',content_text:'Savings account rates and student banking comparison'}]);assert.ok(out.length>0);assert.ok(out[0].score>=0.18);});
test('does not flag unrelated posts',()=>{const out=analyzePosts([{id:1,title:'How to bake sourdough bread',content_text:'Flour yeast starter'},{id:2,title:'Best hiking trails in winter',content_text:'Boots snow mountains'}]);assert.equal(out.length,0);});
