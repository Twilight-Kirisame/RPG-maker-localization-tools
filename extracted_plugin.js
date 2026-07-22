// 由 RPG 汉化工作台自动注入，预览结束后会自动移除
(function() {
  'use strict';
  const params = PluginManager.parameters('${PREVIEW_NOTIFIER_PLUGIN_NAME}');
  const enabled = String(params['Enabled'] || 'true').toLowerCase() === 'true';
  const text = String(params['Text'] || '${safeText}');
  const position = String(params['Position'] || '${safePosition}');
  const duration = Number(params['Duration'] || '${safeDuration}');
  const commandFile = String(params['CommandFile'] || '${safeCommandFile}');
  const labelPrev = String(params['ButtonPrev'] || '${safePrev}');
  const labelNext = String(params['ButtonNext'] || '${safeNext}');
  const labelTitle = String(params['ButtonTitle'] || '${safeTitle}');

  if (!enabled) return;

  // 状态显示元素，用于给用户即时反馈
  let statusEl = null;
  function updateStatus(message) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.style.opacity = '1';
    setTimeout(() => { if (statusEl) statusEl.style.opacity = '0.6'; }, 1500);
  }

  // 直接驱动 RPG Maker 的 Input 对象，比纯 DOM 事件更可靠
  function pressRpgMakerButton(buttonName, key, code, keyCode) {
    try {
      if (typeof Input !== 'undefined') {
        if (typeof Input._onKeyDown === 'function') Input._onKeyDown({ keyCode, code, key, preventDefault: function(){} });
        if (Input._currentState && typeof Input._currentState === 'object') Input._currentState[buttonName] = true;
      }
    } catch (e) { console.error('[RpgWorkbenchPreviewNotifier] pressRpgMakerButton failed', e); }
  }
  function releaseRpgMakerButton(buttonName, key, code, keyCode) {
    try {
      if (typeof Input !== 'undefined') {
        if (typeof Input._onKeyUp === 'function') Input._onKeyUp({ keyCode, code, key, preventDefault: function(){} });
        if (Input._currentState && typeof Input._currentState === 'object') Input._currentState[buttonName] = false;
      }
    } catch (e) { console.error('[RpgWorkbenchPreviewNotifier] releaseRpgMakerButton failed', e); }
  }

  function simulateKey(key, code, keyCode) {
    try {
      const targets = [window, document, document.body, document.documentElement].filter(Boolean);
      const down = new KeyboardEvent('keydown', { key, code, keyCode, bubbles: true, cancelable: true, view: window });
      const up = new KeyboardEvent('keyup', { key, code, keyCode, bubbles: true, cancelable: true, view: window });
      targets.forEach(function(t) { try { t.dispatchEvent(down); } catch (e) {} });
      setTimeout(function() { targets.forEach(function(t) { try { t.dispatchEvent(up); } catch (e) {} }); }, 80);
    } catch (e) {
      console.error('[RpgWorkbenchPreviewNotifier] simulateKey failed', e);
    }
  }

  function nextSentence() {
    // 下一句：模拟决定键（Enter/Space/Z），推进游戏内文本
    pressRpgMakerButton('ok', 'Enter', 'Enter', 13);
    simulateKey('Enter', 'Enter', 13);
    setTimeout(function() { releaseRpgMakerButton('ok', 'Enter', 'Enter', 13); }, 120);
    updateStatus('下一句');
  }

  function previousSentence() {
    // 上一句：模拟取消键（Escape/Insert/X/0），用于回退或关闭当前消息
    pressRpgMakerButton('cancel', 'Escape', 'Escape', 27);
    simulateKey('Escape', 'Escape', 27);
    setTimeout(function() { releaseRpgMakerButton('cancel', 'Escape', 'Escape', 27); }, 120);
    updateStatus('上一句');
  }

  function returnToTitle() {
    removeOverlay();
    try {
      if (typeof SceneManager !== 'undefined' && typeof Scene_Title !== 'undefined') {
        SceneManager.goto(Scene_Title);
      }
    } catch (e) {
      console.error('[RpgWorkbenchPreviewNotifier] returnToTitle failed', e);
      updateStatus('返回标题失败');
    }
  }

  function removeOverlay() {
    const overlay = document.getElementById('rpg-workbench-preview-overlay');
    if (overlay) overlay.remove();
  }

  function isSceneMap() {
    try {
      return SceneManager._scene && SceneManager._scene.constructor === Scene_Map;
    } catch (e) { return false; }
  }

  function createButton(label, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.style.cssText = 'padding:6px 12px;border:1px solid rgba(255,255,255,0.35);border-radius:6px;background:rgba(124,140,255,0.22);color:#fff;cursor:pointer;font-size:13px;font-weight:600;line-height:1.4;white-space:nowrap;transition:background 0.15s ease,border-color 0.15s ease,text-shadow 0.15s ease;text-shadow:0 1px 2px rgba(0,0,0,0.7);-webkit-tap-highlight-color:transparent;user-select:none;';
    function setHover() { btn.style.background = 'rgba(124,140,255,0.55)'; btn.style.borderColor = 'rgba(255,255,255,0.75)'; btn.style.textShadow = '0 0 6px rgba(255,255,255,0.6)'; }
    function clearHover() { btn.style.background = 'rgba(124,140,255,0.22)'; btn.style.borderColor = 'rgba(255,255,255,0.35)'; btn.style.textShadow = '0 1px 2px rgba(0,0,0,0.7)'; }
    function activate() { btn.style.background = 'rgba(124,140,255,0.85)'; setTimeout(clearHover, 120); }
    btn.addEventListener('mouseenter', setHover);
    btn.addEventListener('mouseleave', clearHover);
    let fired = false;
    function handlePress(event) {
      if (event) { event.preventDefault(); event.stopPropagation(); }
      if (fired) return;
      fired = true;
      activate();
      onClick();
      setTimeout(function() { fired = false; }, 250);
    }
    if (window.PointerEvent) {
      btn.addEventListener('pointerdown', handlePress);
    } else {
      btn.addEventListener('mousedown', handlePress);
      btn.addEventListener('touchstart', handlePress, { passive: false });
    }
    return btn;
  }

  function createOverlay() {
    if (document.getElementById('rpg-workbench-preview-overlay')) return;

    // 确保 body 可接受点击事件（部分 RPG Maker MV/MZ 发行版会重置 body 样式）
    document.body.style.pointerEvents = document.body.style.pointerEvents || 'auto';
    if (document.documentElement) document.documentElement.style.pointerEvents = 'auto';

    const overlay = document.createElement('div');
    overlay.id = 'rpg-workbench-preview-overlay';
    // 使用最大 z-index，强制浮在游戏 canvas 之上；pointer-events 仅作用在浮层自身
    overlay.style.cssText = 'position:fixed;z-index:2147483647;display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(0,0,0,0.78);border:1px solid rgba(124,140,255,0.55);border-radius:10px;color:#fff;font-family:sans-serif;font-size:14px;user-select:none;pointer-events:auto;box-shadow:0 6px 20px rgba(0,0,0,0.55);backdrop-filter:blur(4px);';

    switch (position) {
      case 'top-left': overlay.style.top = '12px'; overlay.style.left = '12px'; break;
      case 'top-center': overlay.style.top = '12px'; overlay.style.left = '50%'; overlay.style.transform = 'translateX(-50%)'; break;
      case 'top-right': overlay.style.top = '12px'; overlay.style.right = '12px'; break;
      case 'bottom-left': overlay.style.bottom = '12px'; overlay.style.left = '12px'; break;
      case 'bottom-center': overlay.style.bottom = '12px'; overlay.style.left = '50%'; overlay.style.transform = 'translateX(-50%)'; break;
      case 'bottom-right': overlay.style.bottom = '12px'; overlay.style.right = '12px'; break;
      default: overlay.style.top = '12px'; overlay.style.left = '50%'; overlay.style.transform = 'translateX(-50%)';
    }

    const label = document.createElement('span');
    label.textContent = text;
    label.style.cssText = 'margin-right:6px;font-weight:600;white-space:nowrap;text-shadow:0 1px 2px rgba(0,0,0,0.8);';
    overlay.appendChild(label);
    overlay.appendChild(createButton(labelPrev, previousSentence));
    overlay.appendChild(createButton(labelNext, nextSentence));
    overlay.appendChild(createButton(labelTitle, returnToTitle));

    statusEl = document.createElement('span');
    statusEl.style.cssText = 'margin-left:6px;font-size:11px;color:rgba(200,208,255,0.9);font-weight:500;min-width:80px;text-align:right;opacity:0.6;transition:opacity 0.2s ease;text-shadow:0 1px 2px rgba(0,0,0,0.8);';
    statusEl.textContent = 'ready';
    overlay.appendChild(statusEl);

    // 挂到 documentElement 而非 body，避免某些 nw.js 发行版在切场景时清空 body 导致浮层丢失
    const rootEl = document.documentElement || document.body;
    rootEl.appendChild(overlay);
    console.log('[RpgWorkbenchPreviewNotifier] overlay created', position);

    // 监听 DOM 变化：若浮层被游戏或 nw.js 意外移除，则重新创建（最多重试 10 次）
    let recreateCount = 0;
    const observerRoot = document.body || document.documentElement;
    const observer = new MutationObserver(function() {
      if (!document.getElementById('rpg-workbench-preview-overlay') && recreateCount < 10) {
        recreateCount += 1;
        createOverlay();
      }
      if (recreateCount >= 10) {
        try { observer.disconnect(); } catch (e) {}
      }
    });
    try { observer.observe(observerRoot, { childList: true, subtree: true }); } catch (e) {}

    if (duration > 0) {
      setTimeout(function() {
        overlay.remove();
      }, duration * 1000);
    }
  }

  // 可靠地挂载到 Scene_Map / Scene_Base：createDisplayObjects/start/terminate 多重保险
  function patchScenes() {
    let ready = false;
    if (typeof Scene_Map !== 'undefined') {
      if (!Scene_Map.prototype.__rpgWorkbenchPatched) {
        Scene_Map.prototype.__rpgWorkbenchPatched = true;

        const _Scene_Map_createDisplayObjects = Scene_Map.prototype.createDisplayObjects;
        Scene_Map.prototype.createDisplayObjects = function() {
          _Scene_Map_createDisplayObjects.call(this);
          createOverlay();
        };

        const _Scene_Map_start = Scene_Map.prototype.start;
        Scene_Map.prototype.start = function() {
          if (_Scene_Map_start) _Scene_Map_start.call(this);
          createOverlay();
        };

        const _Scene_Map_terminate = Scene_Map.prototype.terminate;
        Scene_Map.prototype.terminate = function() {
          removeOverlay();
          if (_Scene_Map_terminate) _Scene_Map_terminate.call(this);
        };
      }
      ready = true;
    }

    if (typeof Scene_Base !== 'undefined' && Scene_Base.prototype && !Scene_Base.prototype.__rpgWorkbenchPatched) {
      Scene_Base.prototype.__rpgWorkbenchPatched = true;
      const _Scene_Base_start = Scene_Base.prototype.start;
      Scene_Base.prototype.start = function() {
        if (_Scene_Base_start) _Scene_Base_start.call(this);
        createOverlay();
      };
      ready = true;
    }

    if (!ready) {
      setTimeout(patchScenes, 100);
      return;
    }

    // 若当前已经在任意场景，立即创建
    if (typeof SceneManager !== 'undefined' && SceneManager._scene) {
      createOverlay();
    }
  }
  patchScenes();

  // 插件加载后尽早尝试创建一次（标题画面等也能看到）
  setTimeout(function() {
    if (!document.getElementById('rpg-workbench-preview-overlay')) {
      createOverlay();
    }
  }, 1500);

  // 兜底：每隔 1 秒检查一次浮层是否存在，不存在就重建，最多 60 秒
  let guardCount = 0;
  const guardInterval = setInterval(function() {
    if (guardCount >= 60) { clearInterval(guardInterval); return; }
    guardCount += 1;
    if (!document.getElementById('rpg-workbench-preview-overlay')) {
      createOverlay();
    }
  }, 1000);

  // 监听命令文件：工作台侧的「退回标题」等指令通过文件下发给插件执行
  (function watchCommandFile() {
    try {
      const fs = require('fs');
      const path = require('path');
      const file = path.resolve(commandFile);
      let lastTimestamp = 0;
      function handle() {
        if (!fs.existsSync(file)) return;
        let raw = '';
        try { raw = fs.readFileSync(file, 'utf8'); } catch { return; }
        if (!raw.trim()) return;
        let payload;
        try { payload = JSON.parse(raw); } catch { return; }
        if (!payload || typeof payload !== 'object' || !payload.command) return;
        const timestamp = Number(payload.timestamp) || 0;
        if (timestamp && timestamp <= lastTimestamp) return;
        lastTimestamp = timestamp || Date.now();
        if (payload.command === 'return-to-title') {
          returnToTitle();
        } else if (payload.command === 'prev-entry') {
          previousSentence();
        } else if (payload.command === 'next-entry') {
          nextSentence();
        }
      }
      setInterval(handle, 150);
    } catch (e) {
      console.error('[RpgWorkbenchPreviewNotifier] watchCommandFile failed', e);
    }
  })();
})();
