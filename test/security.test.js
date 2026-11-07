import test from 'node:test';
import assert from 'node:assert/strict';
import { safeEqual, sha256, randomToken } from '../src/security.js';
test('hash is deterministic and tokens are random-looking',()=>{assert.equal(sha256('abc'),sha256('abc'));assert.notEqual(randomToken(),randomToken());});
test('safeEqual compares values without accepting mismatches',()=>{assert.equal(safeEqual('abc','abc'),true);assert.equal(safeEqual('abc','abd'),false);assert.equal(safeEqual('a','aa'),false);});
