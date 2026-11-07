import test from 'node:test';
import assert from 'node:assert/strict';
import { safeEqual, sha256, randomToken, stripHtml } from '../src/security.js';
test('hash é determinístico e tokens são distintos', () => {
  assert.equal(sha256('abc'), sha256('abc'));
  assert.notEqual(randomToken(), randomToken());
});
test('safeEqual rejeita valores diferentes e comprimentos diferentes', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('a', 'aa'), false);
});
test('stripHtml remove tags script e converte texto básico', () => {
  assert.equal(stripHtml('<p>Olá&nbsp;mundo</p><script>alert(1)</script>'), 'Olá mundo');
});
