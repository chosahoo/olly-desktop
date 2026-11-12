/*
  내려받기 저장 창 (2026-11-13 윈도우 M36 실기) — 처리가 없으면 크로미움 기본 저장 창이 메신저 창 뒤에
  'blob:https://…' 제목으로 숨어 떠서 눌러도 아무 일 없는 것처럼 보였다.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const main = readFileSync(new URL('main.js', root), 'utf8').replace(/\r\n/g, '\n');

test('내려받기는 메신저 창을 부모로 한 저장 창을 띄우고, 웹이 준 이름으로 다운로드 폴더에서 시작한다', () => {
  assert.match(main, /^\s+dialog,$/m, "electron 에서 dialog 를 안 가져온다");
  const at = main.indexOf("session.on('will-download'");
  assert.ok(at > 0, 'will-download 처리가 없다 — 기본 저장 창이 창 뒤에 숨는다');
  const fn = main.slice(at, at + 1200);
  assert.match(fn, /dialog\.showSaveDialogSync\(owner,/, '저장 창에 메신저 창을 부모로 주지 않는다');
  assert.match(fn, /defaultPath: path\.join\(app\.getPath\('downloads'\), name\)/, "'다운로드' 폴더 + 웹이 준 이름이 아니다");
  assert.match(fn, /item\.getFilename\(\)/, '웹이 붙인 파일 이름을 안 쓴다');
  assert.match(fn, /if \(!chosen\) \{\s*item\.cancel\(\);/, '취소해도 받는다');
  assert.match(fn, /item\.setSavePath\(chosen\)/);
  assert.match(fn, /state === 'completed'\) notify\('내려받기 완료'/, '다 받아도 알리지 않는다');
});

test('저장 창 처리는 세션에 한 번만 건다 — 창을 다시 만들 때 두 번 걸면 저장 창이 두 번 뜬다', () => {
  assert.match(main, /let downloadHooked = false;/);
  assert.match(main, /if \(!downloadHooked\) \{\s*downloadHooked = true;\s*win\.webContents\.session\.on\('will-download'/);
});
