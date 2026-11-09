/* 화면 캡처 덮개의 동작 — capture.html 참고. 다리는 capture-preload.js 의 window.allyCapture 하나. */
(() => {
  const shot = document.getElementById('shot');
  const dim = document.getElementById('dim');
  const sel = document.getElementById('sel');
  const hint = document.getElementById('hint');
  let start = null;

  window.allyCapture.onImage((dataUrl) => {
    shot.src = dataUrl;
  });

  const rectOf = (a, b) => ({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  });
  const draw = (r) => {
    sel.style.display = 'block';
    sel.style.left = `${r.x}px`;
    sel.style.top = `${r.y}px`;
    sel.style.width = `${r.width}px`;
    sel.style.height = `${r.height}px`;
  };

  window.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    start = { x: e.clientX, y: e.clientY };
    dim.style.display = 'none'; // 네모 바깥은 sel 의 그림자가 어둡게 한다
    hint.style.display = 'none';
    draw(rectOf(start, start));
  });
  window.addEventListener('mousemove', (e) => {
    if (start) draw(rectOf(start, { x: e.clientX, y: e.clientY }));
  });
  window.addEventListener('mouseup', (e) => {
    if (!start || e.button !== 0) return;
    const r = rectOf(start, { x: e.clientX, y: e.clientY });
    start = null;
    if (r.width < 4 || r.height < 4) {
      // 클릭만 했다 — 다시 고르게 둔다
      sel.style.display = 'none';
      dim.style.display = 'block';
      hint.style.display = 'block';
      return;
    }
    window.allyCapture.done(r);
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') window.allyCapture.cancel();
  });
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    window.allyCapture.cancel();
  });
})();
