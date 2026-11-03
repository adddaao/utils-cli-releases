/* ru 文档渲染：基于本地 marked（assets/js/vendor/marked.umd.js）补充
   标题锚点、文档内链接改写、代码块工具条、表格滚动容器与 HTML 转义。
   纯浏览器脚本，无构建步骤、不请求外部资源。 */
(function (global) {
  'use strict';

  var markedLib = global.marked;

  var ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ESCAPE_MAP[ch];
    });
  }

  /* 行内标记降级为纯文本，用于生成标题锚点与目录文案 */
  function stripInline(text) {
    return String(text == null ? '' : text)
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/`+([^`]*)`+/g, '$1')
      .replace(/\*\*|__|\*|_|~~/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* GitHub 风格锚点：小写、去掉标点与符号、空格转连字符，保留中英文与 - _ */
  function slugify(text) {
    return stripInline(text)
      .toLowerCase()
      .replace(/<[^>]*>/g, '')
      .replace(/[^\p{L}\p{N}\p{M}\-_ ]/gu, '')
      .replace(/ /g, '-');
  }

  function createSlugger() {
    var seen = Object.create(null);
    return function (text) {
      var base = slugify(text) || 'section';
      var id = base;
      var index = 1;
      while (seen[id]) {
        id = base + '-' + index;
        index += 1;
      }
      seen[id] = true;
      return id;
    };
  }

  function headingLink(id) {
    return '<a class="doc-anchor" href="#' + encodeURIComponent(id) +
      '" aria-hidden="true" tabindex="-1">#</a>';
  }

  /* 终端/ASCII 图按“CJK 占两格”排版；浏览器里中文只有约 1.7 格，
     这里把宽字符撑成 2ch，避免架构图、表格线错位 */
  var WIDE_CHAR = /[\u{1100}-\u{115F}\u{2E80}-\u{303E}\u{3041}-\u{33FF}\u{3400}-\u{4DBF}\u{4E00}-\u{9FFF}\u{A000}-\u{A4CF}\u{A960}-\u{A97F}\u{AC00}-\u{D7A3}\u{F900}-\u{FAFF}\u{FE10}-\u{FE19}\u{FE30}-\u{FE6F}\u{FF00}-\u{FF60}\u{FFE0}-\u{FFE6}\u{1F300}-\u{1F64F}\u{1F900}-\u{1F9FF}\u{20000}-\u{3FFFD}]/gu;

  /* 含制表符的图块（编辑器/终端里的框图）单独换用带完整制表符的等宽字体，
     避免 IBM Plex Mono 缺字时回退字体宽度不一致导致边框逐行漂移 */
  var GRID_CHAR = /[─━│┃┌┏┐┓└┗┘┛├┣┤┫┬┳┴┻┼╋═║╔╗╚╝╠╣╦╩╬▼▲◀▶]/g;
  var GRID_TEST = /[─━│┃┌┏┐┓└┗┘┛├┣┤┫┬┳┴┻┼╋═║╔╗╚╝╠╣╦╩╬▼▲◀▶]/;
  var GRID_FONT_CLASS = ' doc-code--grid';

  function codeBlock(token) {
    var lang = String(token.lang || '').trim().split(/\s+/)[0] || '';
    var raw = String(token.text || '').replace(/\n$/, '');
    var body = escapeHtml(raw);
    body = body.replace(WIDE_CHAR, function (ch) {
      return '<span class="doc-cell--wide">' + ch + '</span>';
    });
    /* 制表符在不同字体里的步进可能与 ASCII 略有差异，固定成 1ch 才能逐列对齐 */
    body = body.replace(GRID_CHAR, function (ch) {
      return '<span class="doc-cell--grid">' + ch + '</span>';
    });
    var langLabel = lang
      ? '<span class="doc-code__lang">' + escapeHtml(lang) + '</span>'
      : '<span class="doc-code__lang doc-code__lang--plain">代码</span>';
    /* 缩进代码块没有围栏，单独标记便于测试与样式区分 */
    var kind = token.lang === undefined ? ' doc-code--indented' : '';
    if (GRID_TEST.test(raw)) kind += GRID_FONT_CLASS;
    return '<figure class="doc-code' + kind + '">' +
      '<figcaption class="doc-code__head">' + langLabel +
      '<button class="doc-code__copy" type="button" data-copy-code aria-label="复制代码">复制</button>' +
      '</figcaption>' +
      '<pre><code' + (lang ? ' class="language-' + escapeHtml(lang) + '"' : '') + '>' +
      body + '</code></pre>' +
      '</figure>';
  }


  /* docs 目录内的 Markdown 路径 → 阅读页地址 */
  function docUrl(base, file) {
    return base + String(file).split('/').map(encodeURIComponent).join('/');
  }

  function normalizeDocPath(currentDir, target) {
    var joined = currentDir ? currentDir + '/' + target : target;
    var parts = joined.split('/');
    var stack = [];
    for (var i = 0; i < parts.length; i += 1) {
      var part = parts[i];
      if (!part || part === '.') continue;
      if (part === '..') {
        if (!stack.length) return '';
        stack.pop();
        continue;
      }
      stack.push(part);
    }
    return stack.join('/');
  }

  /* 文档内链接：.md 统一跳到文档阅读页，其余相对路径相对 docs/ 解析 */
  function resolveDocHref(href, currentDir, docsBase) {
    var raw = String(href == null ? '' : href).trim();
    if (!raw) return { href: raw };
    if (raw.charAt(0) === '#') return { href: raw };
    if (/^(?:javascript|vbscript|data):/i.test(raw)) return { href: '#' };
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) || raw.indexOf('//') === 0) {
      return { href: raw, external: true };
    }
    var hashAt = raw.indexOf('#');
    var path = hashAt === -1 ? raw : raw.slice(0, hashAt);
    var hash = hashAt === -1 ? '' : raw.slice(hashAt);
    path = path.replace(/\\/g, '/');
    if (!path) return { href: raw };
    /* 部分文档把仓库内路径写成 docs/xxx 或 ../docs/xxx，统一按 docs 根目录解析 */
    var rootRelative = false;
    var stripped = path.replace(/^(?:\.\.\/)+docs\//, function () {
      rootRelative = true;
      return '';
    });
    if (stripped !== path) {
      path = stripped;
    } else if (/^\.?\/?docs\//.test(path)) {
      rootRelative = true;
      path = path.replace(/^\.?\/?docs\//, '');
    }
    if (/\.md$/i.test(path)) {
      var resolved = rootRelative ? normalizeDocPath('', path) : normalizeDocPath(currentDir || '', path);
      if (!resolved) return { href: raw };
      return {
        href: 'doc.html?file=' + encodeURIComponent(resolved) + hash,
        doc: true
      };
    }
    if (path.charAt(0) === '/') return { href: raw };
    var assetPath = rootRelative ? normalizeDocPath('', path) : normalizeDocPath(currentDir || '', path);
    if (!assetPath) return { href: raw };
    return { href: (docsBase || '') + assetPath + hash };
  }

  function defaultResolveHref(href) {
    var raw = String(href == null ? '' : href);
    var external = /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.indexOf('//') === 0;
    return { href: raw, external: external };
  }

  function createRenderer(ctx) {
    var base = new markedLib.Renderer();
    var renderer = new markedLib.Renderer();

    renderer.heading = function (token) {
      var text = stripInline(token.text);
      var id = ctx.slugger(text || 'section');
      ctx.headings.push({ depth: token.depth, id: id, text: text });
      var tag = 'h' + token.depth;
      return '<' + tag + ' id="' + escapeHtml(id) + '">' +
        this.parser.parseInline(token.tokens) + headingLink(id) +
        '</' + tag + '>\n';
    };

    /* 文档里的裸 HTML（例如占位符 <data_dir>）一律按文本展示，避免被浏览器吞掉 */
    renderer.html = function (token) {
      if (token.block) {
        return '<p class="doc-literal">' + escapeHtml(token.text) + '</p>\n';
      }
      return escapeHtml(token.text);
    };

    renderer.code = function (token) {
      return codeBlock(token);
    };

    renderer.table = function (token) {
      return '<div class="doc-table-wrap">' + base.table.call(this, token) + '</div>\n';
    };

    renderer.link = function (token) {
      var resolved = ctx.resolveHref(token.href);
      var attrs = ' href="' + escapeHtml(resolved.href) + '"';
      if (token.title) attrs += ' title="' + escapeHtml(token.title) + '"';
      if (resolved.external) attrs += ' target="_blank" rel="noopener noreferrer"';
      if (resolved.doc) attrs += ' data-doc-link="1"';
      return '<a' + attrs + '>' + this.parser.parseInline(token.tokens) + '</a>';
    };

    renderer.image = function (token) {
      var resolved = ctx.resolveHref(token.href);
      return '<img src="' + escapeHtml(resolved.href) + '" alt="' +
        escapeHtml(stripInline(token.text)) + '" loading="lazy">';
    };

    return renderer;
  }

  function fallback(text) {
    return '<pre class="doc-source">' + escapeHtml(text) + '</pre>';
  }

  function render(markdown, options) {
    options = options || {};
    var text = String(markdown == null ? '' : markdown);
    var ctx = {
      headings: [],
      slugger: createSlugger(),
      resolveHref: typeof options.resolveHref === 'function'
        ? options.resolveHref
        : defaultResolveHref
    };

    if (!markedLib || typeof markedLib.parse !== 'function') {
      return { html: fallback(text), headings: [] };
    }

    try {
      var instance = new markedLib.Marked({
        gfm: true,
        breaks: false,
        renderer: createRenderer(ctx)
      });
      return { html: instance.parse(text), headings: ctx.headings };
    } catch (error) {
      return { html: fallback(text), headings: [] };
    }
  }

  global.RUMarkdown = {
    render: render,
    escapeHtml: escapeHtml,
    slugify: slugify,
    docUrl: docUrl,
    resolveDocHref: resolveDocHref
  };
})(typeof window !== 'undefined' ? window : globalThis);
