/* ru 展示站交互：主题、TUI 预览、命令行切换、命令面板、文档索引与截图查看 */
(function () {
  'use strict';

  var docs = window.RU_DOCS || { total: 0, groups: [] };
  var root = document.documentElement;
  var THEME_KEY = 'ru-showcase:theme';

  function $(sel, ctx) {
    return (ctx || document).querySelector(sel);
  }
  function $$(sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  }
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function debounce(fn, wait) {
    var timer;
    return function () {
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(null, args);
      }, wait);
    };
  }
  function isEditable(target) {
    if (!target) return false;
    var tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  /* ---------------- 提示 ---------------- */
  var toastTimer;
  function toast(message) {
    var el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('is-visible');
    }, 1900);
  }

  /* ---------------- 主题 ---------------- */
  var themeToggle = $('#themeToggle');
  function currentTheme() {
    return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }
  function applyTheme(theme, persist) {
    root.setAttribute('data-theme', theme);
    if (persist) {
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch (e) {}
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f5f6f9' : '#06070a');
    if (themeToggle) themeToggle.setAttribute('aria-pressed', String(theme === 'light'));
  }
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var next = currentTheme() === 'light' ? 'dark' : 'light';
      applyTheme(next, true);
      toast(next === 'light' ? '已切换到浅色' : '已切换到深色');
    });
  }
  applyTheme(currentTheme(), false);

  /* ---------------- 移动端菜单 ---------------- */
  var navToggle = $('#navToggle');
  var mobilePanel = $('#mobilePanel');
  function closeMobile() {
    if (!mobilePanel) return;
    mobilePanel.classList.remove('is-open');
    if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
  if (navToggle && mobilePanel) {
    navToggle.addEventListener('click', function () {
      var open = !mobilePanel.classList.contains('is-open');
      mobilePanel.classList.toggle('is-open', open);
      navToggle.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
    });
    $$('a', mobilePanel).forEach(function (link) {
      link.addEventListener('click', closeMobile);
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 1000) closeMobile();
    });
  }

  /* ---------------- TUI 预览视图 ---------------- */
  function setupTui() {
    var buttons = $$('[data-tui-view]');
    var panels = $$('[data-tui-panel]');
    var navItems = $$('[data-nav-for]');
    if (!buttons.length) return;
    function select(view) {
      buttons.forEach(function (btn) {
        btn.setAttribute('aria-selected', String(btn.getAttribute('data-tui-view') === view));
      });
      panels.forEach(function (panel) {
        panel.hidden = panel.getAttribute('data-tui-panel') !== view;
      });
      navItems.forEach(function (item) {
        item.classList.toggle('is-active', item.getAttribute('data-nav-for') === view);
      });
    }
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        select(btn.getAttribute('data-tui-view'));
      });
    });
    navItems.forEach(function (item) {
      var view = item.getAttribute('data-nav-for');
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      item.addEventListener('click', function () {
        select(view);
      });
      item.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        select(view);
      });
    });
    select('docker');
  }

  /* ---------------- CLI / 安装切换 ---------------- */
  function setupPanelTabs(tabAttr, panelAttr, defaultTab) {
    var tabs = $$('[' + tabAttr + ']');
    var panels = $$('[' + panelAttr + ']');
    if (!tabs.length) return null;
    function select(name) {
      tabs.forEach(function (tab) {
        tab.setAttribute('aria-selected', String(tab.getAttribute(tabAttr) === name));
      });
      panels.forEach(function (panel) {
        panel.hidden = panel.getAttribute(panelAttr) !== name;
      });
    }
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        select(tab.getAttribute(tabAttr));
      });
    });
    select(defaultTab || tabs[0].getAttribute(tabAttr));
    return select;
  }
  setupPanelTabs('data-cli-tab', 'data-cli-panel', 'docker');
  setupPanelTabs('data-install-tab', 'data-install-panel', 'unix');

  /* ---------------- 复制 ---------------- */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(
        function () {
          return true;
        },
        function () {
          return legacyCopy(text);
        }
      );
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }
    document.body.removeChild(area);
    return ok;
  }
  function cleanCommands(text) {
    return String(text || '')
      .split('\n')
      .map(function (line) {
        return line.replace(/^\s*\$\s?/, '').replace(/^\s*PS>\s?/, '').replace(/^\s*PS&gt;\s?/, '');
      })
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  function visiblePanel(selector) {
    return $$(selector).filter(function (el) {
      return !el.hidden;
    })[0];
  }
  function handleCopy(trigger) {
    var text = '';
    if (trigger.hasAttribute('data-copy-text')) {
      text = trigger.getAttribute('data-copy-text');
    } else if (trigger.hasAttribute('data-copy-cli')) {
      var cli = visiblePanel('[data-cli-panel]');
      text = cli ? cleanCommands(cli.textContent) : '';
    } else if (trigger.hasAttribute('data-copy-install')) {
      var install = visiblePanel('[data-install-panel]');
      text = install ? cleanCommands(install.textContent) : '';
    }
    if (!text) return;
    copyText(text).then(function (ok) {
      toast(ok ? '已复制到剪贴板' : '复制失败，请手动选择');
    });
  }
  $$('[data-copy-cli], [data-copy-install], [data-copy-text]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      handleCopy(btn);
    });
  });

  /* 文档渲染页的代码块由 Markdown 渲染器动态生成，使用事件委托复制 */
  document.addEventListener('click', function (event) {
    var trigger = event.target && event.target.closest ? event.target.closest('[data-copy-code]') : null;
    if (!trigger) return;
    var block = trigger.closest('.doc-code');
    var code = block ? block.querySelector('code') : null;
    if (!code) return;
    copyText(code.textContent).then(function (ok) {
      toast(ok ? '代码已复制' : '复制失败，请手动选择');
    });
  });

  /* ---------------- 截图查看 ---------------- */
  var lightbox = $('#lightbox');
  function setupLightbox() {
    if (!lightbox) return;
    var image = $('#lightboxImage');
    var title = $('#lightboxTitle');
    var caption = $('#lightboxCaption');
    $$('.shot').forEach(function (shot) {
      shot.addEventListener('click', function () {
        var src = shot.getAttribute('data-lightbox');
        if (!src) return;
        image.src = src;
        image.alt = shot.getAttribute('data-title') || 'TUI 截图';
        title.textContent = shot.getAttribute('data-title') || 'TUI 截图';
        caption.textContent = shot.getAttribute('data-caption') || '';
        if (typeof lightbox.showModal === 'function') lightbox.showModal();
        else lightbox.setAttribute('open', '');
      });
    });
    $('#lightboxClose').addEventListener('click', function () {
      lightbox.close();
    });
    lightbox.addEventListener('click', function (event) {
      if (event.target === lightbox) lightbox.close();
    });
  }
  setupLightbox();

  /* ---------------- 命令面板 ---------------- */
  var sections = [
    { kind: '页面', title: '首页', desc: 'ru 本地系统管理工作台', href: 'index.html' },
    { kind: '页面', title: '功能模块', desc: 'Docker、清理、Find、数据库、部署、防火墙、文件中转、工具', href: 'index.html#modules' },
    { kind: '页面', title: '界面截图', desc: '三张真实 TUI 渲染帧', href: 'index.html#screens' },
    { kind: '页面', title: '命令行', desc: 'Docker / 数据库 / AIOps / 诊断 / 工具', href: 'index.html#cli' },
    { kind: '页面', title: '安装', desc: 'Unix / Windows 安装器与离线安装', href: 'index.html#install' },
    { kind: '页面', title: '平台支持', desc: 'Linux、macOS、Windows、WSL 能力矩阵', href: 'index.html#platform' },
    { kind: '页面', title: '技术文档', desc: '52 篇文档的索引与筛选', href: 'docs.html' }
  ];
  var modules = [
    { title: 'Docker 管理', desc: '镜像、容器、网络、磁盘、服务与离线安装' },
    { title: '文件清理', desc: 'Maven、macOS、压缩包、临时文件与自定义规则' },
    { title: 'Find 文件查找', desc: '条件构建器、模板与历史记录' },
    { title: '数据库管理', desc: 'PostgreSQL 导入导出、备份、校验与权限' },
    { title: '部署', desc: 'AIOps 远程部署与简单部署' },
    { title: '防火墙', desc: 'Linux 与 Windows 防火墙规则管理' },
    { title: '文件中转', desc: '特权文件交付与 Shell 别名' },
    { title: '工具与诊断', desc: '随机密码、ru doctor 与版本辅助' }
  ];
  var cliGroups = [
    { title: 'CLI · Docker', desc: 'ru list / ru save / ru load / ru docker ...', href: 'index.html#cli' },
    { title: 'CLI · 数据库', desc: 'ru database backup ...', href: 'index.html#cli' },
    { title: 'CLI · AIOps', desc: 'ru aiops servers / deploy / inspect', href: 'index.html#cli' },
    { title: 'CLI · 诊断', desc: 'ru doctor --json / --strict / --fix-plan', href: 'index.html#cli' },
    { title: 'CLI · 工具', desc: 'ru tools password / ru install / ru git tag', href: 'index.html#cli' }
  ];
  var items = sections.map(function (item) {
    return Object.assign({}, item, { featured: true });
  });
  modules.forEach(function (mod) {
    items.push({ kind: '模块', title: mod.title, desc: mod.desc, href: 'index.html#modules', featured: true });
  });
  cliGroups.forEach(function (group) {
    items.push({ kind: '命令', title: group.title, desc: group.desc, href: group.href, featured: true });
  });
  (docs.groups || []).forEach(function (group) {
    group.docs.forEach(function (doc) {
      items.push({
        kind: '文档',
        title: doc.title,
        desc: (group.title + ' · docs/' + doc.file + ' · ' + (doc.desc || '')).replace(/\s+$/, ''),
        href: doc.href,
        external: true
      });
    });
  });

  var palette = $('#palette');
  var paletteInput = $('#paletteInput');
  var paletteResults = $('#paletteResults');
  var paletteOpen = false;
  var paletteIndex = 0;
  var paletteFiltered = [];
  var lastFocused = null;
  var hideTimer;

  function normalize(value) {
    return String(value == null ? '' : value).toLowerCase();
  }
  function matchItems(query) {
    var terms = normalize(query).trim().split(/\s+/).filter(Boolean);
    if (!terms.length) {
      return items.filter(function (item) {
        return item.featured;
      });
    }
    return items
      .filter(function (item) {
        var hay = normalize(item.title + ' ' + item.desc);
        return terms.every(function (term) {
          return hay.indexOf(term) > -1;
        });
      })
      .slice(0, 40);
  }
  function highlight(text, query) {
    var safe = escapeHtml(text);
    var raw = String(query || '').trim();
    if (!raw) return safe;
    try {
      return safe.replace(new RegExp(raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), function (match) {
        return '<mark>' + match + '</mark>';
      });
    } catch (e) {
      return safe;
    }
  }
  function renderPalette() {
    if (!paletteResults) return;
    var query = paletteInput ? paletteInput.value : '';
    paletteFiltered = matchItems(query);
    if (!paletteFiltered.length) {
      paletteResults.innerHTML = '<div class="palette-empty">没有匹配内容，试试「备份」「按键」或「平台」。</div>';
      paletteIndex = 0;
      return;
    }
    if (paletteIndex >= paletteFiltered.length) paletteIndex = 0;
    var html = '';
    var lastKind = '';
    paletteFiltered.forEach(function (item, index) {
      if (item.kind !== lastKind) {
        html += '<div class="palette-group-label">' + escapeHtml(item.kind) + '</div>';
        lastKind = item.kind;
      }
      html +=
        '<a class="palette-item" role="option" id="palette-item-' +
        index +
        '" data-index="' +
        index +
        '" aria-selected="' +
        String(index === paletteIndex) +
        '" href="' +
        escapeHtml(item.href) +
        '"' +
        (item.external ? ' target="_blank" rel="noopener"' : '') +
        '>' +
        '<span class="palette-item__kind" aria-hidden="true">' +
        (item.kind === '文档' ? 'DOC' : item.kind === '模块' ? 'MOD' : item.kind === '命令' ? 'CLI' : 'PAGE') +
        '</span>' +
        '<span class="palette-item__main"><span class="palette-item__title">' +
        highlight(item.title, query) +
        '</span><span class="palette-item__desc">' +
        escapeHtml(item.desc) +
        '</span></span>' +
        '<span class="palette-item__enter" aria-hidden="true">↵</span>' +
        '</a>';
    });
    paletteResults.innerHTML = html;
    var selected = paletteResults.querySelector('.palette-item[aria-selected="true"]');
    if (selected && selected.scrollIntoView) selected.scrollIntoView({ block: 'nearest' });
  }
  function setPaletteIndex(next) {
    if (!paletteFiltered.length) return;
    paletteIndex = (next + paletteFiltered.length) % paletteFiltered.length;
    $$('.palette-item', paletteResults).forEach(function (el) {
      el.setAttribute('aria-selected', String(Number(el.getAttribute('data-index')) === paletteIndex));
    });
    var selected = paletteResults.querySelector('.palette-item[aria-selected="true"]');
    if (selected && selected.scrollIntoView) selected.scrollIntoView({ block: 'nearest' });
  }
  function activatePalette() {
    var item = paletteResults && paletteResults.querySelector('.palette-item[data-index="' + paletteIndex + '"]');
    if (!item) return;
    closePalette();
    item.click();
  }
  function openPalette(query) {
    if (!palette) return;
    closeMobile();
    lastFocused = document.activeElement;
    clearTimeout(hideTimer);
    palette.hidden = false;
    paletteOpen = true;
    paletteInput.value = query || '';
    paletteIndex = 0;
    renderPalette();
    requestAnimationFrame(function () {
      palette.classList.add('is-open');
      paletteInput.focus();
    });
    paletteInput.select();
    document.body.style.overflow = 'hidden';
  }
  function closePalette() {
    if (!palette || !paletteOpen) return;
    paletteOpen = false;
    palette.classList.remove('is-open');
    document.body.style.overflow = '';
    hideTimer = setTimeout(function () {
      palette.hidden = true;
    }, 150);
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }
  if (palette) {
    palette.addEventListener('click', function (event) {
      if (event.target === palette) closePalette();
    });
    paletteInput.addEventListener('input', function () {
      paletteIndex = 0;
      renderPalette();
    });
    paletteInput.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setPaletteIndex(paletteIndex + 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setPaletteIndex(paletteIndex - 1);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        activatePalette();
      }
    });
    paletteResults.addEventListener('mousemove', function (event) {
      var item = event.target.closest('.palette-item');
      if (!item) return;
      var index = Number(item.getAttribute('data-index'));
      if (Number.isFinite(index) && index !== paletteIndex) {
        paletteIndex = index;
        $$('.palette-item', paletteResults).forEach(function (el) {
          el.setAttribute('aria-selected', String(Number(el.getAttribute('data-index')) === index));
        });
      }
    });
    paletteResults.addEventListener('click', function (event) {
      if (event.target.closest('.palette-item')) closePalette();
    });
  }
  $$('[data-open-palette]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openPalette('');
    });
  });

  /* ---------------- 文档索引 ---------------- */
  var docFilterState = { query: '' };
  function renderDocs() {
    var host = $('#docsContent');
    if (!host) return;
    var groups = docs.groups || [];
    if (!groups.length) {
      host.innerHTML = '<p class="muted">文档数据加载失败，请直接访问 <a href="../docs/README.md">docs/README.md</a>。</p>';
      return;
    }
    host.innerHTML = groups
      .map(function (group) {
        var cards = group.docs
          .map(function (doc) {
            var searchText = [doc.title, doc.desc, doc.file, group.title].join(' ').toLowerCase();
            return (
              '<a class="doc-link" href="' +
              escapeHtml(doc.href) +
              '" target="_blank" rel="noopener" data-search="' +
              escapeHtml(searchText) +
              '">' +
              '<span class="doc-link__title">' +
              escapeHtml(doc.title) +
              '</span>' +
              '<span class="doc-link__desc">' +
              escapeHtml(doc.desc) +
              '</span>' +
              '<span class="doc-link__path">docs/' +
              escapeHtml(doc.file) +
              '</span>' +
              '</a>'
            );
          })
          .join('');
        return (
          '<section class="doc-section" id="group-' +
          escapeHtml(group.id) +
          '">' +
          '<div class="doc-section__head"><div class="doc-section__title"><h2>' +
          escapeHtml(group.title) +
          '</h2><span>' +
          group.count +
          ' 篇</span></div><a class="doc-section__official" href="doc.html?file=README.md" target="_blank" rel="noopener">docs/README.md ↗</a></div>' +
          '<p class="doc-section__desc">' +
          escapeHtml(group.desc) +
          '</p>' +
          '<div class="doc-cards">' +
          cards +
          '</div></section>'
        );
      })
      .join('');

    var total = docs.total || 0;
    var countEl = $('#docsCount');
    var empty = $('#docEmpty');
    if (countEl) countEl.textContent = '共 ' + total + ' 篇';
    var totalEls = $$('#docsTotal');
    totalEls.forEach(function (el) {
      el.textContent = String(total);
    });

    function applyFilter() {
      var query = docFilterState.query.trim().toLowerCase();
      var visible = 0;
      $$('.doc-section', host).forEach(function (section) {
        var sectionVisible = 0;
        $$('.doc-link', section).forEach(function (link) {
          var hit = !query || (link.getAttribute('data-search') || '').indexOf(query) > -1;
          link.classList.toggle('doc-hidden', !hit);
          if (hit) sectionVisible += 1;
        });
        section.classList.toggle('doc-hidden', sectionVisible === 0);
        visible += sectionVisible;
      });
      if (countEl) countEl.textContent = query ? '显示 ' + visible + ' / ' + total + ' 篇' : '共 ' + total + ' 篇';
      if (empty) empty.classList.toggle('is-visible', visible === 0);
      updateScrollState();
    }
    var search = $('#docSearch');
    if (search) {
      search.addEventListener('input', function () {
        docFilterState.query = search.value;
        applyFilter();
      });
      applyFilter();
    }

    if (location.hash && location.hash.indexOf('#group-') === 0) {
      var target = document.querySelector(location.hash);
      if (target) {
        requestAnimationFrame(function () {
          target.scrollIntoView({ block: 'start' });
        });
      }
    }
  }

  /* ---------------- 滚动状态 ---------------- */
  var progress = $('#progress');
  var ticking = false;
  function updateScrollState() {
    ticking = false;
    var scrollTop = window.pageYOffset || root.scrollTop;
    var height = root.scrollHeight - window.innerHeight;
    if (progress) progress.style.transform = 'scaleX(' + (height > 0 ? Math.min(1, scrollTop / height) : 0) + ')';

    if (document.body.getAttribute('data-page') === 'home') {
      var navLinks = $$('.nav a');
      var activeId = '';
      var ids = ['modules', 'screens', 'cli', 'install'];
      ids.forEach(function (id) {
        var section = document.getElementById(id);
        if (section && section.getBoundingClientRect().top <= 140) activeId = id;
      });
      navLinks.forEach(function (link) {
        var hash = (link.getAttribute('href') || '').split('#')[1];
        link.classList.toggle('is-active', !!hash && hash === activeId);
      });
    }

    var sideLinks = $$('.docs-side a');
    if (sideLinks.length) {
      var current = '';
      var firstVisible = '';
      $$('.doc-section').forEach(function (section) {
        if (section.classList.contains('doc-hidden')) return;
        if (!firstVisible) firstVisible = section.id;
        if (section.getBoundingClientRect().top <= 160) current = section.id;
      });
      if (!current) current = firstVisible;
      sideLinks.forEach(function (link) {
        link.classList.toggle('is-active', link.getAttribute('href') === '#' + current);
      });
    }
  }
  window.addEventListener(
    'scroll',
    function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateScrollState);
    },
    { passive: true }
  );

  /* ---------------- 进场与数字 ---------------- */
  function setupReveal() {
    var els = $$('.reveal');
    if (!els.length) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!('IntersectionObserver' in window) || reduce) {
      els.forEach(function (el) {
        el.classList.add('is-visible');
      });
      return;
    }
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -34px 0px' }
    );
    els.forEach(function (el) {
      observer.observe(el);
    });
  }
  function setupCounters() {
    var counters = $$('[data-count]');
    if (!counters.length) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function animate(el) {
      var target = parseInt(el.getAttribute('data-count'), 10);
      if (!Number.isFinite(target)) return;
      if (reduce) {
        el.textContent = String(target);
        return;
      }
      var start = performance.now();
      function frame(now) {
        var ratio = Math.min(1, (now - start) / 900);
        var eased = 1 - Math.pow(1 - ratio, 3);
        el.textContent = String(Math.round(target * eased));
        if (ratio < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }
    if (!('IntersectionObserver' in window)) {
      counters.forEach(animate);
      return;
    }
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          animate(entry.target);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.5 }
    );
    counters.forEach(function (counter) {
      observer.observe(counter);
    });
  }

  /* ---------------- 全局快捷键 ---------------- */
  document.addEventListener('keydown', function (event) {
    var target = event.target;
    var editable = isEditable(target);
    var mod = event.metaKey || event.ctrlKey;

    if (mod && (event.key === 'k' || event.key === 'K')) {
      event.preventDefault();
      if (paletteOpen) closePalette();
      else openPalette('');
      return;
    }
    if (paletteOpen) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePalette();
      }
      return;
    }
    if (event.key === 'Escape') {
      if (lightbox && lightbox.open) lightbox.close();
      closeMobile();
      return;
    }
    if (editable) return;
    if (event.key === '/') {
      var search = document.getElementById('docSearch');
      if (search) {
        event.preventDefault();
        search.focus();
        search.select();
      } else {
        event.preventDefault();
        openPalette('');
      }
      return;
    }
    if ((event.key === 't' || event.key === 'T') && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      var next = currentTheme() === 'light' ? 'dark' : 'light';
      applyTheme(next, true);
      toast(next === 'light' ? '已切换到浅色' : '已切换到深色');
    }
  });

  /* ---------------- 文档阅读器 ---------------- */
  function setupReader() {
    if (document.body.getAttribute('data-page') !== 'reader') return;
    var params = new URLSearchParams(location.search);
    var file = params.get('file') || '';
    var contentEl = $('#readerContent');
    var sourceEl = $('#readerSource');
    var tocEl = $('#readerToc');
    var titleEl = $('#readerTitle');
    var pathEl = $('#readerPath');
    var crumbEl = $('#readerCrumb');
    var rawLink = $('#readerRaw');
    var sourceToggle = $('#readerSourceToggle');
    if (!contentEl) return;

    var docsBase = document.body.getAttribute('data-docs-base') || '../docs/';
    if (docsBase.charAt(docsBase.length - 1) !== '/') docsBase += '/';
    var markdown = window.RUMarkdown;

    function docHref(target) {
      if (markdown && markdown.docUrl) return markdown.docUrl(docsBase, target);
      return docsBase + String(target).split('/').map(encodeURIComponent).join('/');
    }

    var normalized = String(file).replace(/\\/g, '/');
    var segments = normalized.split('/');
    /* 只允许读取 docs/ 目录下的 Markdown：拒绝绝对路径与目录穿越 */
    var valid = /\.md$/i.test(normalized) && normalized.charAt(0) !== '/' &&
      segments.every(function (part) {
        return part && part !== '.' && part !== '..';
      });
    if (!valid) {
      document.title = '文档不存在 · ru';
      titleEl.textContent = '文档不存在';
      pathEl.textContent = 'docs/…';
      contentEl.textContent = '没有找到要打开的文档。请返回文档地图重新选择。';
      sourceEl.hidden = true;
      if (sourceToggle) sourceToggle.hidden = true;
      return;
    }

    var doc = null;
    (docs.groups || []).forEach(function (group) {
      group.docs.forEach(function (item) {
        if (item.file === normalized) doc = item;
      });
    });
    var title = doc ? doc.title : normalized.replace(/\.md$/i, '').split('/').pop();
    document.title = title + ' · ru 文档';
    titleEl.textContent = title;
    pathEl.textContent = 'docs/' + normalized;
    crumbEl.textContent = normalized.split('/').pop();
    if (rawLink) {
      rawLink.href = docHref(normalized);
      rawLink.setAttribute('download', normalized.split('/').pop());
    }

    var currentDir = normalized.split('/').slice(0, -1).join('/');
    var loaded = false;
    var sourceMode = false;
    var tocItems = [];
    var tocLinks = [];
    var tocHeadingEls = [];
    var tocActiveIndex = -1;
    var scrollScheduled = false;

    function setTocVisible(visible) {
      if (!tocEl) return;
      tocEl.hidden = !(visible && tocItems.length >= 3);
    }

    function setActiveToc(index) {
      if (index === tocActiveIndex) return;
      tocActiveIndex = index;
      tocLinks.forEach(function (link, i) {
        link.classList.toggle('is-active', i === index);
      });
    }

    function updateTocActive() {
      if (!tocItems.length || sourceMode) return;
      var current = -1;
      for (var i = 0; i < tocHeadingEls.length; i += 1) {
        var heading = tocHeadingEls[i];
        if (!heading) continue;
        if (heading.getBoundingClientRect().top <= 120) current = i;
        else break;
      }
      setActiveToc(current);
    }

    function onScrollForToc() {
      if (scrollScheduled) return;
      scrollScheduled = true;
      requestAnimationFrame(function () {
        scrollScheduled = false;
        updateTocActive();
      });
    }
    window.addEventListener('scroll', onScrollForToc, { passive: true });

    function renderToc(headings) {
      tocItems = (headings || []).filter(function (item) {
        return item.depth >= 2 && item.depth <= 3;
      });
      tocLinks = [];
      tocHeadingEls = [];
      tocActiveIndex = -1;
      if (!tocEl || tocItems.length < 3) {
        setTocVisible(false);
        return;
      }
      var html = '<div class="reader-toc__title">本文目录</div><ol class="reader-toc__list">';
      tocItems.forEach(function (item) {
        html += '<li class="reader-toc__item reader-toc__item--h' + item.depth + '">' +
          '<a href="#' + encodeURIComponent(item.id) + '">' + escapeHtml(item.text) + '</a></li>';
      });
      html += '</ol>';
      tocEl.innerHTML = html;
      tocLinks = $$('a', tocEl);
      tocHeadingEls = tocItems.map(function (item) {
        return document.getElementById(item.id);
      });
      setTocVisible(true);
      updateTocActive();
    }

    function setSourceMode(enabled) {
      sourceMode = enabled;
      contentEl.hidden = enabled;
      sourceEl.hidden = !enabled;
      setTocVisible(!enabled);
      if (sourceToggle) {
        sourceToggle.textContent = enabled ? '查看渲染' : '查看源码';
        sourceToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      }
      if (enabled) {
        sourceEl.scrollTop = 0;
      } else {
        requestAnimationFrame(updateTocActive);
      }
    }

    if (sourceToggle) {
      sourceToggle.addEventListener('click', function () {
        if (!loaded) {
          toast('文档仍在加载…');
          return;
        }
        setSourceMode(!sourceMode);
      });
    }

    fetch(docHref(normalized), { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.text();
      })
      .then(function (text) {
        sourceEl.textContent = text;
        loaded = true;
        if (!markdown) {
          setSourceMode(true);
          if (sourceToggle) sourceToggle.hidden = true;
          return;
        }
        var result = markdown.render(text, {
          resolveHref: function (href) {
            return markdown.resolveDocHref(href, currentDir, docsBase);
          }
        });
        contentEl.innerHTML = result.html;
        renderToc(result.headings);
        if (!doc) {
          var firstHeading = contentEl.querySelector('h1, h2');
          if (firstHeading) {
            var headingText = firstHeading.textContent.replace(/#\s*$/, '').trim();
            if (headingText) {
              title = headingText;
              document.title = title + ' · ru 文档';
              titleEl.textContent = title;
            }
          }
        }
        if (location.hash) {
          var targetId = decodeURIComponent(location.hash.slice(1));
          var target = document.getElementById(targetId);
          if (target) {
            requestAnimationFrame(function () {
              target.scrollIntoView();
            });
          }
        }
        updateTocActive();
      })
      .catch(function () {
        titleEl.textContent = doc ? doc.title : '文档读取失败';
        contentEl.textContent = '无法读取 Markdown 原文。请确认预览服务器从仓库根目录启动，或直接使用右上角的「下载 Markdown」。';
        sourceEl.textContent = '';
        sourceEl.hidden = true;
        setTocVisible(false);
        if (sourceToggle) sourceToggle.hidden = true;
      });
  }

  /* ---------------- 启动 ---------------- */
  setupReader();
  setupTui();
  setupReveal();
  setupCounters();
  renderDocs();
  updateScrollState();
})();
