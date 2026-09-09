/*
  웹 ↔ 껍데기 다리.

  웹(lib/desktop.ts)은 window.allyDesktop 이 있으면 데스크톱이라 보고
  안 읽은 수를 넘긴다. 노출은 이 한 가지뿐 — 다리가 넓으면 웹 취약점이
  로컬 권한으로 번진다.
*/
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('allyDesktop', {
  setBadge: (count) => ipcRenderer.send('ally:badge', Number(count) || 0),
  notify: (payload) =>
    ipcRenderer.send('ally:notify', {
      title: String(payload?.title || ''),
      body: String(payload?.body || ''),
      roomId: String(payload?.roomId || ''),
    }),
  /*
    우리 주소를 기본 브라우저로 연다 — 메신저의 게시판·결재 단추가 쓴다.
    주소만 넘기고 판단은 main 이 한다(우리 origin 이 아니면 버린다).
    다리를 넓히는 셈이라 남의 주소는 main 이 반드시 막아야 한다.
  */
  openExternal: (url) => ipcRenderer.send('ally:open-external', String(url || '')),
});

// 배너 클릭 → 웹에 '이 방을 열어라' 이벤트로 전달
ipcRenderer.on('ally:open-room', (_event, roomId) => {
  window.dispatchEvent(
    new CustomEvent('ally:open-room', { detail: { roomId: String(roomId || '') } })
  );
});
