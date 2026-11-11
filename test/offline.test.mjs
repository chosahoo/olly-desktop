/*
  끊긴 채 켜진 메신저가 저절로 돌아오는지 (2026-11-11 윈도우 M4).
  자동 실행은 트레이로 조용히 뜬다 — '연결하지 못했습니다' 화면을 누가 누르지
  않으면 인터넷이 붙은 뒤에도 그 화면에 머물러 메시지·알림이 안 왔다.
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const offline = main.slice(main.indexOf('const showOffline'), main.indexOf("win.webContents.on('did-fail-load'"));
const retry = main.slice(main.indexOf('const scheduleRetry'), main.indexOf('const showOffline'));

test('연결 실패 화면을 띄우면 다시 열기를 걸어 둔다', () => {
  assert.match(offline, /win\.loadURL\('data:text\/html[^\n]+\n\s*scheduleRetry\(\);/);
});

test('다시 열기는 메신저 주소를 연다 — 5초부터 두 배, 1분까지', () => {
  assert.match(retry, /setTimeout\(\(\) => \{\s*if \(!win\.isDestroyed\(\) && win\.webContents\.getURL\(\)\.startsWith\('data:'\)\) win\.loadURL\(APP_URL\);\s*\}, retryDelay\)/);
  assert.match(main, /let retryDelay = 5000;/);
  assert.match(retry, /retryDelay = Math\.min\(retryDelay \* 2, 60_000\);/);
});

test('간격은 진짜로 열린 이동(HTTP 200~399)에서만 되돌린다 — 실패 뒤 오류 문서의 did-finish-load 로 다시 열기를 지우지 않는다', () => {
  assert.doesNotMatch(main, /on\('did-finish-load'[\s\S]{0,160}clearTimeout\(retryTimer\)/);
  assert.match(main, /win\.webContents\.on\('did-navigate', \(_e, url, code\) => \{\s*if \(isOurs\(url\) && code >= 200 && code < 400\) retryDelay = 5000;/);
});

test("창 안에서도 'online' 이 오면 바로 연다", () => {
  assert.match(offline, /addEventListener\('online', \(\) => location\.replace\('\$\{APP_URL\}'\)\)/);
});
