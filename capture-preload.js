/*
  화면 캡처 덮개 전용 다리 — 고른 네모를 돌려주거나 취소만 한다.
  메신저 창의 preload.js 와 따로 둔다: 덮개는 로컬 페이지라 메신저 기능이 필요 없다.
*/
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('allyCapture', {
  onImage: (fn) => ipcRenderer.on('ally:capture-image', (_e, dataUrl) => fn(String(dataUrl || ''))),
  done: (rect) =>
    ipcRenderer.send('ally:capture-done', {
      x: Number(rect?.x) || 0,
      y: Number(rect?.y) || 0,
      width: Number(rect?.width) || 0,
      height: Number(rect?.height) || 0,
    }),
  cancel: () => ipcRenderer.send('ally:capture-cancel'),
});
