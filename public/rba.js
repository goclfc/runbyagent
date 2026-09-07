/* runbyagent counter. one tag per project:
   <script async src="https://runbyagents.usectl.com/rba.js" data-project="painboard"></script>
   keeps an anonymous id in this site's localStorage (rba_vid, 16 random bytes), sends one
   beacon per page view and a heartbeat every 30 seconds while the tab is visible. no cookies. */
(function () {
  var tag = document.currentScript;
  if (!tag) return;
  var project = tag.getAttribute('data-project');
  if (!project) return;
  var base = tag.getAttribute('data-api') || new URL(tag.src).origin;
  var vid;
  try {
    vid = localStorage.getItem('rba_vid');
    if (!vid) {
      var bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      vid = Array.prototype.map.call(bytes, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      localStorage.setItem('rba_vid', vid);
    }
  } catch (e) { return; }

  function send(path, body) {
    var data = JSON.stringify(body);
    if (navigator.sendBeacon) { navigator.sendBeacon(base + path, data); return; }
    fetch(base + path, { method: 'POST', body: data, mode: 'cors', keepalive: true }).catch(function () {});
  }

  var lastPath = null;
  function view() {
    var path = location.pathname;
    if (path === lastPath) return;
    lastPath = path;
    send('/api/track', { project: project, vid: vid, path: path, ref: document.referrer || undefined });
  }
  function ping() {
    if (!document.hidden) send('/api/track/ping', { project: project, vid: vid });
  }

  view();
  ping();
  setInterval(ping, 30000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) ping(); });
  var pushState = history.pushState;
  history.pushState = function () { pushState.apply(this, arguments); view(); };
  window.addEventListener('popstate', view);
})();
