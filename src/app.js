    // Tauri backend API wrapper
    const { invoke } = window.__TAURI__?.core || { invoke: async () => { throw new Error('Tauri not ready'); } };

    async function callBackend(cmd, args = {}) {
      try {
        return await invoke(cmd, args);
      } catch (e) {
        console.error(`Backend call ${cmd} failed:`, e);
        throw e;
      }
    }

    // App state
    let appState = {
      accounts: [],
      currentAccount: null,
      newAvatar: null,
      editAvatar: null,
      currentPageId: 'dashboard',
      zones: [],
      currentZone: null,
      dnsRecords: [],
      d1CurrentRows: [],
      editingD1RowIndex: null,
      workerEnvVars: [],
      workerNonEnvBindings: [],
      workerOriginalSecretNames: [],
      pagesDeployEnvVars: [],
      currentWorkerName: null,
      workerCustomDomains: [],
      workerRoutes: [],
      currentPagesProject: null,
      pagesDomains: [],
      accountTotalRequests: null,
      workersTotalRequests: null,
      accountZoneCounts: {},
      editingAccountId: null
    };

    // 版本号不再硬编码，启动时从后端动态读取（编译自 Cargo.toml）
    let APP_VERSION = '';
    async function loadAppVersion() {
      try {
        APP_VERSION = await callBackend('get_app_version');
      } catch (e) {
        console.warn('读取版本号失败:', e);
      }
      const versionEl = document.getElementById('app-version');
      if (versionEl && APP_VERSION) versionEl.textContent = APP_VERSION;
    }
    const REPO_URL = 'https://github.com/Anji-318/cloudflare-manager/tree/main';

    const pages = ['dashboard', 'accounts', 'zones', 'dns', 'workers', 'pages', 'r2', 'kvd1', 'tunnels', 'firewall', 'snippets', 'loadbalancer', 'healthchecks', 'cache', 'analytics', 'settings'];
    
    function showPage(pageId) {
      appState.currentPageId = pageId;
      pages.forEach(p => {
        document.getElementById('page-' + p).classList.add('hidden');
        document.getElementById('nav-' + p).classList.remove('active');
        document.getElementById('nav-' + p).classList.add('text-slate-500', 'dark:text-slate-400');
      });
      document.getElementById('page-' + pageId).classList.remove('hidden');
      document.getElementById('nav-' + pageId).classList.add('active');
      document.getElementById('nav-' + pageId).classList.remove('text-slate-500', 'dark:text-slate-400');

      // Load page-specific data
      if (pageId === 'workers') loadWorkers();
      if (pageId === 'pages') loadPages();
      if (pageId === 'r2') loadR2Buckets();
      if (pageId === 'kvd1') { loadKvNamespaces(); loadD1Databases(); }
      if (pageId === 'tunnels') loadTunnels();
      if (pageId === 'firewall') { loadFirewallRules(); loadFirewallStats(); }
      if (pageId === 'snippets') loadSnippets();
      if (pageId === 'loadbalancer') { loadLoadBalancers(); loadLbPools(); loadLbMonitors(); }
      if (pageId === 'healthchecks') loadHealthChecks();
      if (pageId === 'analytics') loadAnalytics();
      if (pageId === 'cache') loadCacheSettings();
      if (pageId === 'dashboard') renderDashboard();
      
      return false;
    }

    function clearAccountData() {
      appState.zones = [];
      appState.currentZone = null;
      appState.dnsRecords = [];
      appState.analytics = null;
      appState.workers = null;
      appState.pages = null;
      appState.r2Buckets = null;
      appState.kvNamespaces = null;
      appState.kvKeys = null;
      appState.kvValues = null;
      appState.currentKvNamespace = null;
      appState.d1Databases = null;
      appState.d1Tables = null;
      appState.currentD1Database = null;
      appState.d1CurrentRows = [];
      appState.tunnels = null;
      appState.firewallRules = null;
      appState.firewallStats = null;
      appState.workerCustomDomains = [];
      appState.workerRoutes = [];
      appState.currentWorkerName = null;
      appState.currentPagesProject = null;
      appState.pagesDomains = [];
      appState.accountTotalRequests = null;
      appState.workersTotalRequests = null;
      appState.workersQuotaLimit = null;
      appState.workersRequestsError = null;
      appState.snippets = null;
      appState.snippetRules = null;
      appState.lbList = null;
      appState.lbPools = null;
      appState.lbMonitors = null;
      appState.healthChecks = null;
    }

    async function reloadCurrentPage() {
      const pageId = appState.currentPageId || 'dashboard';
      try {
        switch (pageId) {
          case 'dashboard': renderDashboard(); break;
          case 'accounts': 
            await loadAccounts(); 
            loadAccountZoneCounts();
            break;
          case 'zones': await loadZones(); break;
          case 'dns':
            if (appState.currentZone) await loadDnsRecords();
            else renderDnsRecords();
            break;
          case 'workers': await loadWorkers(); break;
          case 'pages': await loadPages(); break;
          case 'r2': await loadR2Buckets(); break;
          case 'kvd1': await loadKvNamespaces(); await loadD1Databases(); break;
          case 'tunnels': await loadTunnels(); break;
          case 'firewall': await loadFirewallRules(); await loadFirewallStats(); break;
          case 'snippets': await loadSnippets(); break;
          case 'loadbalancer': await loadLoadBalancers(); await loadLbPools(); await loadLbMonitors(); break;
          case 'healthchecks': await loadHealthChecks(); break;
          case 'cache': await loadCacheSettings(); break;
          case 'analytics': await loadAnalytics(); break;
          default: renderDashboard();
        }
      } catch (e) {
        console.error('Reload current page failed:', e);
      }
    }

    async function minimizeWindow() {
      console.log('minimizeWindow clicked');
      try { await callBackend('minimize_window'); }
      catch (e) { console.error('minimize failed:', e); alert('最小化失败: ' + e); }
    }

    async function maximizeWindow() {
      console.log('maximizeWindow clicked');
      try { await callBackend('maximize_window'); }
      catch (e) { console.error('maximize failed:', e); alert('最大化失败: ' + e); }
    }

    async function closeWindow() {
      console.log('closeWindow clicked');
      try { await callBackend('close_window'); }
      catch (e) { console.error('close failed:', e); alert('关闭失败: ' + e); }
    }

    // 显式暴露到 window，确保 onclick 可以调用
    window.minimizeWindow = minimizeWindow;
    window.maximizeWindow = maximizeWindow;
    window.closeWindow = closeWindow;

    function openUsage() {
      const panel = document.getElementById('usage-panel');
      if (panel) {
        panel.classList.remove('hidden');
      }
    }
    window.openUsage = openUsage;

    function closeUsage() {
      const panel = document.getElementById('usage-panel');
      if (panel) {
        panel.classList.add('hidden');
      }
    }
    window.closeUsage = closeUsage;

    function openRepoUrl() {
      if (window.__TAURI__ && window.__TAURI__.shell && window.__TAURI__.shell.open) {
        window.__TAURI__.shell.open(REPO_URL).catch(err => console.error('Failed to open repo:', err));
      } else {
        window.open(REPO_URL, '_blank');
      }
    }
    window.openRepoUrl = openRepoUrl;

    // ========== 账户头像 ==========
    // 依据账户名生成稳定颜色（无自定义头像时的兜底）
    function accountHue(name) {
      let hash = 0;
      const s = name || '?';
      for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
      return hash % 360;
    }

    // 头像 HTML：有自定义图片用 <img>，否则首字符 + 按名字着色的圆形底
    function accountAvatarHtml(account, cls) {
      if (account && account.avatar) {
        return `<img src="${account.avatar}" class="${cls} rounded-full object-cover shrink-0" alt="">`;
      }
      const name = (account && account.name) || '?';
      const hue = accountHue(name);
      return `<div class="${cls} rounded-full flex items-center justify-center font-bold shrink-0" style="background:hsl(${hue},55%,22%);color:hsl(${hue},85%,68%)">${escapeHtml(name.charAt(0).toUpperCase())}</div>`;
    }

    // 侧边栏当前账户头像
    function renderSidebarAvatar(account) {
      const avatar = document.querySelector('.account-avatar');
      if (!avatar) return;
      if (account && account.avatar) {
        avatar.innerHTML = `<img src="${account.avatar}" class="w-full h-full rounded-full object-cover" alt="">`;
        avatar.style.background = 'transparent';
      } else {
        const name = (account && account.name) || '-';
        const hue = accountHue(name);
        avatar.innerHTML = `<span style="color:hsl(${hue},85%,68%)">${escapeHtml(name.charAt(0).toUpperCase())}</span>`;
        avatar.style.background = `hsl(${hue},55%,22%)`;
      }
    }

    // 统一写入头像选择结果（预览 + 状态）
    function setPickedAvatar(prefix, dataUrl) {
      if (prefix === 'edit-acc') { appState.editAvatar = dataUrl; } else { appState.newAvatar = dataUrl; }
      const prev = document.getElementById(prefix + '-avatar-preview');
      if (prev) prev.innerHTML = `<img src="${dataUrl}" class="w-full h-full object-cover" alt="">`;
    }

    // 选择头像：居中裁剪并压缩为 96x96 JPEG dataURL；个别格式（如 ico）画布不可解码时存原始 dataURL
    function onAvatarPicked(event, prefix) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          try {
            const size = 96;
            const canvas = document.createElement('canvas');
            canvas.width = size; canvas.height = size;
            const ctx = canvas.getContext('2d');
            const min = Math.min(img.width, img.height) || 1;
            ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
            setPickedAvatar(prefix, canvas.toDataURL('image/jpeg', 0.85));
          } catch (e) {
            setPickedAvatar(prefix, reader.result);
          }
        };
        img.onerror = () => setPickedAvatar(prefix, reader.result);
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
      event.target.value = '';
    }
    window.onAvatarPicked = onAvatarPicked;

    function clearAvatar(prefix) {
      if (prefix === 'edit-acc') { appState.editAvatar = null; } else { appState.newAvatar = null; }
      const prev = document.getElementById(prefix + '-avatar-preview');
      if (prev) prev.innerHTML = '<span class="text-slate-400 text-xs">无</span>';
    }
    window.clearAvatar = clearAvatar;

    // 打开弹窗时重置/回显头像选择器
    function resetAvatarPicker(prefix, account) {
      const dataUrl = account ? (account.avatar || null) : null;
      if (prefix === 'edit-acc') { appState.editAvatar = dataUrl; } else { appState.newAvatar = dataUrl; }
      const prev = document.getElementById(prefix + '-avatar-preview');
      if (prev) prev.innerHTML = dataUrl
        ? `<img src="${dataUrl}" class="w-full h-full object-cover" alt="">`
        : '<span class="text-slate-400 text-xs">无</span>';
      const input = document.getElementById(prefix + '-avatar-input');
      if (input) input.value = '';
    }

    // 拦截所有外部链接，使用系统浏览器打开
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (link && link.href && link.target === '_blank') {
        e.preventDefault();
        const url = link.href;
        if (window.__TAURI__ && window.__TAURI__.shell && window.__TAURI__.shell.open) {
          window.__TAURI__.shell.open(url).catch(err => console.error('Failed to open link:', err));
        } else {
          window.open(url, '_blank');
        }
      }
    });

    function applyTheme(isDark) {
      const html = document.documentElement;
      const toggle = document.getElementById('theme-toggle');
      const icon = document.getElementById('theme-icon');
      if (isDark) {
        html.classList.add('dark');
        html.classList.remove('light');
        html.style.colorScheme = 'dark';
        try { localStorage.setItem('theme', 'dark'); } catch (e) {}
        if (toggle) {
          toggle.classList.add('bg-cf-orange');
          toggle.classList.remove('bg-slate-300');
          const span = toggle.querySelector('span');
          if (span) {
            span.classList.add('translate-x-6');
            span.classList.remove('translate-x-1');
          }
        }
        if (icon) {
          icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>';
        }
      } else {
        html.classList.remove('dark');
        html.classList.add('light');
        html.style.colorScheme = 'light';
        try { localStorage.setItem('theme', 'light'); } catch (e) {}
        if (toggle) {
          toggle.classList.remove('bg-cf-orange');
          toggle.classList.add('bg-slate-300');
          const span = toggle.querySelector('span');
          if (span) {
            span.classList.remove('translate-x-6');
            span.classList.add('translate-x-1');
          }
        }
        if (icon) {
          icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>';
        }
      }
      // 主题切换后刷新文字阴影颜色（深浅色用不同颜色的阴影）
      if (typeof applyBgSettings === 'function') applyBgSettings();
    }

    function toggleTheme() {
      const html = document.documentElement;
      const isDark = html.classList.contains('dark');
      applyTheme(!isDark);
    }
    window.toggleTheme = toggleTheme;
    window.applyTheme = applyTheme;

    // ========== 自定义背景与前景调节 ==========
    const BG_DEFAULTS = { image: '', blur: 0, brightness: 100, fgAlpha: 92, fgBrightness: 100 };

    function loadBgSettings() {
      try {
        const saved = JSON.parse(localStorage.getItem('bgSettings') || '{}');
        return { ...BG_DEFAULTS, ...saved };
      } catch (e) {
        return { ...BG_DEFAULTS };
      }
    }

    function saveBgSettings(s) {
      try {
        localStorage.setItem('bgSettings', JSON.stringify(s));
        return true;
      } catch (e) {
        alert('保存失败：图片过大超出本地存储上限，请换用更小的图片或改用 URL 方式');
        return false;
      }
    }

    function applyBgSettings() {
      const s = loadBgSettings();
      const root = document.documentElement;
      root.style.setProperty('--bg-blur', (s.blur || 0) + 'px');
      root.style.setProperty('--bg-brightness', (s.brightness || 100) + '%');
      root.style.setProperty('--fg-alpha', ((s.fgAlpha != null ? s.fgAlpha : 92) / 100).toString());
      root.style.setProperty('--fg-brightness', (s.fgBrightness || 100) + '%');
      const bg = document.getElementById('app-background');
      if (bg) {
        const img = (s.image || '').replace(/["'\n\r]/g, '');
        bg.style.backgroundImage = img ? `url("${img}")` : 'none';
      }
      applyAutoTextShadow(s.fgAlpha != null ? s.fgAlpha : 92);
    }

    // 前景透明度越低，文字对比越强：强制高对比文字色 + 加阴影（深色主题白字黑影 / 浅色主题黑字白影）
    function applyAutoTextShadow(fgAlpha) {
      const root = document.documentElement;
      const threshold = 75; // 透明度高于此值（底色足够实）不启用增强
      if (fgAlpha >= threshold) {
        root.classList.remove('low-fg');
        root.style.setProperty('--auto-text-shadow', 'none');
        root.style.setProperty('--auto-svg-shadow', 'none');
        return;
      }
      root.classList.add('low-fg');
      const strength = Math.min(1, (threshold - fgAlpha) / threshold * 1.6).toFixed(2);
      const isDark = root.classList.contains('dark');
      const color = isDark ? `2,6,23,${strength}` : `255,255,255,${strength}`;
      root.style.setProperty('--auto-text-shadow', `0 0 3px rgba(${color}), 0 2px 8px rgba(${color})`);
      root.style.setProperty('--auto-svg-shadow', `drop-shadow(0 1px 3px rgba(${color}))`);
    }

    function updateBgSettingLabels() {
      const s = loadBgSettings();
      const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
      setText('bg-blur-val', (s.blur || 0) + 'px');
      setText('bg-brightness-val', (s.brightness || 100) + '%');
      setText('fg-alpha-val', (s.fgAlpha != null ? s.fgAlpha : 92) + '%');
      setText('fg-brightness-val', (s.fgBrightness || 100) + '%');
      setText('bg-image-status', s.image ? '已设置背景图片' : '未设置背景');
    }

    function syncBgSettingsUI() {
      const s = loadBgSettings();
      const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
      setVal('bg-blur-slider', s.blur || 0);
      setVal('bg-brightness-slider', s.brightness || 100);
      setVal('fg-alpha-slider', s.fgAlpha != null ? s.fgAlpha : 92);
      setVal('fg-brightness-slider', s.fgBrightness || 100);
      updateBgSettingLabels();
    }

    function setBgSetting(key, value) {
      const s = loadBgSettings();
      s[key] = value;
      if (!saveBgSettings(s)) return;
      applyBgSettings();
      updateBgSettingLabels();
    }
    window.setBgSetting = setBgSetting;

    // 本地图片：过大时压缩到 1920px JPEG，避免超出 localStorage 上限
    function onBgFilePicked(input) {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        input.value = '';
        if (typeof dataUrl === 'string' && dataUrl.length > 3.5 * 1024 * 1024) {
          const img = new Image();
          img.onload = () => {
            const scale = Math.min(1, 1920 / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(img.width * scale));
            canvas.height = Math.max(1, Math.round(img.height * scale));
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            setBgSetting('image', canvas.toDataURL('image/jpeg', 0.85));
          };
          img.onerror = () => alert('图片解析失败，请换一张图片');
          img.src = dataUrl;
        } else {
          setBgSetting('image', dataUrl);
        }
      };
      reader.onerror = () => { input.value = ''; alert('读取图片失败'); };
      reader.readAsDataURL(file);
    }
    window.onBgFilePicked = onBgFilePicked;

    function applyBgUrl() {
      const input = document.getElementById('bg-url-input');
      const url = input ? input.value.trim() : '';
      if (!url) { alert('请输入图片 URL'); return; }
      setBgSetting('image', url);
    }
    window.applyBgUrl = applyBgUrl;

    function clearBgImage() {
      const input = document.getElementById('bg-url-input');
      if (input) input.value = '';
      setBgSetting('image', '');
    }
    window.clearBgImage = clearBgImage;

    function resetBgSettings() {
      const input = document.getElementById('bg-url-input');
      if (input) input.value = '';
      saveBgSettings({ ...BG_DEFAULTS });
      applyBgSettings();
      syncBgSettingsUI();
    }
    window.resetBgSettings = resetBgSettings;

    function openAddAccount() {
      document.getElementById('modal-add-account').classList.remove('hidden');
      resetTokenVisibility();
    }

    function closeAddAccount() {
      document.getElementById('modal-add-account').classList.add('hidden');
      resetTokenVisibility();
    }

    function toggleTokenVisibility() {
      const input = document.getElementById('acc-token');
      const icon = document.getElementById('token-toggle-icon');
      if (!input || !icon) return;
      if (input.type === 'password') {
        input.type = 'text';
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a10.05 10.05 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.05 10.05 0 01-2.012 3.997"></path>';
      } else {
        input.type = 'password';
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>';
      }
    }
    window.toggleTokenVisibility = toggleTokenVisibility;

    function resetTokenVisibility() {
      const input = document.getElementById('acc-token');
      const icon = document.getElementById('token-toggle-icon');
      if (input) input.type = 'password';
      if (icon) {
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>';
      }
    }

    async function saveAccount() {
      const name = document.getElementById('acc-name').value.trim();
      const email = document.getElementById('acc-email').value.trim();
      const token = document.getElementById('acc-token').value.trim();
      
      if (!name || !token) {
        alert('账户名称和 API Token 不能为空');
        return;
      }
      
      try {
        // Validate token
        const result = await callBackend('validate_token', { token });
        if (!result.success) {
          alert('Token 验证失败：' + (result.errors[0]?.message || '未知错误'));
          return;
        }
        
        const account = {
          id: 'acc_' + Date.now(),
          name,
          email,
          token_encrypted: '',
          avatar: appState.newAvatar || null
        };
        
        const savedAccount = await callBackend('save_account', { account, token });
        await callBackend('set_current_account', { account: savedAccount, token });
        appState.currentAccount = savedAccount;
        closeAddAccount();
        
        // Clear form
        document.getElementById('acc-name').value = '';
        document.getElementById('acc-email').value = '';
        document.getElementById('acc-token').value = '';
        resetTokenVisibility();
        appState.newAvatar = null;
        resetAvatarPicker('acc');
        
        // Clear data belonging to the previous account and reload current page
        clearAccountData();
        try { await loadZones(); } catch (zoneErr) { console.error('loadZones failed:', zoneErr); }
        renderDashboard();
        await reloadCurrentPage();
        await loadAccounts();
        await refreshApiStatus();
        alert('账户保存成功');
      } catch (e) {
        alert('保存失败：' + e);
      }
    }

    async function loadAccounts() {
      try {
        appState.accounts = await callBackend('list_accounts');
        renderAccounts();
        renderDashboard();

        // 无选中账户时，优先恢复上次使用的账户（如页面刷新后），避免自动跳回第一个账户
        if (appState.accounts.length > 0 && !appState.currentAccount) {
          let restoreId = null;
          try { restoreId = localStorage.getItem('currentAccountId'); } catch (e) {}
          const restored = restoreId ? appState.accounts.find(a => a.id === restoreId) : null;
          await selectAccount((restored || appState.accounts[0]).id);
        }

        // 异步加载每个账户的域名数
        loadAccountZoneCounts();
      } catch (e) {
        console.error('Failed to load accounts:', e);
      }
    }

    function openEditAccount(id) {
      const account = appState.accounts.find(a => a.id === id);
      if (!account) return;
      document.getElementById('edit-acc-id').value = account.id;
      document.getElementById('edit-acc-name').value = account.name || '';
      document.getElementById('edit-acc-email').value = account.email || '';
      document.getElementById('edit-acc-token').value = '';
      resetEditTokenVisibility();
      resetAvatarPicker('edit-acc', account);
      document.getElementById('modal-edit-account').classList.remove('hidden');
    }
    window.openEditAccount = openEditAccount;

    function closeEditAccount() {
      document.getElementById('modal-edit-account').classList.add('hidden');
      resetEditTokenVisibility();
    }
    window.closeEditAccount = closeEditAccount;

    function toggleEditTokenVisibility() {
      const input = document.getElementById('edit-acc-token');
      const icon = document.getElementById('edit-token-toggle-icon');
      if (!input || !icon) return;
      if (input.type === 'password') {
        input.type = 'text';
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a10.05 10.05 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.05 10.05 0 01-2.012 3.997"></path>';
      } else {
        input.type = 'password';
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>';
      }
    }
    window.toggleEditTokenVisibility = toggleEditTokenVisibility;

    function resetEditTokenVisibility() {
      const input = document.getElementById('edit-acc-token');
      const icon = document.getElementById('edit-token-toggle-icon');
      if (input) input.type = 'password';
      if (icon) {
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>';
      }
    }

    async function updateAccount() {
      const id = document.getElementById('edit-acc-id').value;
      const name = document.getElementById('edit-acc-name').value.trim();
      const email = document.getElementById('edit-acc-email').value.trim();
      const newToken = document.getElementById('edit-acc-token').value.trim();
      
      if (!id || !name) {
        alert('账户名称不能为空');
        return;
      }
      
      const account = appState.accounts.find(a => a.id === id);
      if (!account) {
        alert('账户不存在');
        return;
      }
      
      let token = newToken;
      
      // 如果 Token 留空，保留原 Token
      if (!token) {
        try {
          token = await callBackend('get_account_token', { id });
        } catch (e) {
          alert('获取原 Token 失败：' + e);
          return;
        }
      } else {
        // 验证新 Token
        try {
          const result = await callBackend('validate_token', { token });
          if (!result.success) {
            alert('Token 验证失败：' + (result.errors[0]?.message || '未知错误'));
            return;
          }
        } catch (e) {
          alert('Token 验证失败：' + e);
          return;
        }
      }
      
      const updatedAccount = {
        id,
        name,
        email,
        token_encrypted: account.token_encrypted || '',
        avatar: appState.editAvatar || null
      };
      
      try {
        const savedAccount = await callBackend('save_account', { account: updatedAccount, token });
        
        // 如果编辑的是当前账户，更新当前账户状态
        if (appState.currentAccount?.id === id) {
          appState.currentAccount = savedAccount;
          const info = document.querySelector('.account-info');
          if (info) {
            info.innerHTML = `
              <div class="text-sm font-medium truncate">${escapeHtml(savedAccount.name)}</div>
              <div class="text-xs text-slate-400 truncate">${escapeHtml(savedAccount.email || '')}</div>
            `;
          }
          renderSidebarAvatar(savedAccount);
        }
        
        closeEditAccount();
        await loadAccounts();
        alert('账户保存成功');
      } catch (e) {
        alert('保存失败：' + e);
      }
    }
    window.updateAccount = updateAccount;

    async function loadAccountZoneCounts() {
      if (!appState.accounts || appState.accounts.length === 0) return;
      appState.accountZoneCounts = {};
      // 初始化所有账户为加载中
      appState.accounts.forEach(acc => {
        appState.accountZoneCounts[acc.id] = null;
      });
      renderAccounts();
      
      // 限制并发数避免过多请求
      const batchSize = 2;
      for (let i = 0; i < appState.accounts.length; i += batchSize) {
        const batch = appState.accounts.slice(i, i + batchSize);
        await Promise.all(batch.map(async acc => {
          try {
            // 临时切换到该账户获取域名数
            const token = await callBackend('get_account_token', { id: acc.id });
            await callBackend('set_current_account', { account: acc, token });
            const result = await callBackend('cloudflare_request', { method: 'GET', path: '/zones', body: null });
            if (result.success) {
              appState.accountZoneCounts[acc.id] = (result.result || []).length;
            } else {
              appState.accountZoneCounts[acc.id] = -1;
            }
          } catch (e) {
            console.error(`加载账户 ${acc.id} 域名数失败:`, e);
            appState.accountZoneCounts[acc.id] = -1;
          }
          renderAccounts();
        }));
      }
      
      // 恢复原来的当前账户
      if (appState.currentAccount) {
        try {
          const token = await callBackend('get_account_token', { id: appState.currentAccount.id });
          await callBackend('set_current_account', { account: appState.currentAccount, token });
        } catch (e) {
          console.error('恢复当前账户失败:', e);
        }
      }
    }
    window.loadAccountZoneCounts = loadAccountZoneCounts;

    function renderAccounts() {
      const tbody = document.getElementById('accounts-tbody');
      if (!tbody) return;
      
      if (appState.accounts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-5 py-8 text-center text-slate-500">暂无账户，请点击右上角添加</td></tr>';
        return;
      }
      
      tbody.innerHTML = appState.accounts.map(acc => {
        const initial = acc.name.charAt(0).toUpperCase();
        const zoneCount = appState.accountZoneCounts?.[acc.id];
        let zoneCountDisplay = '-';
        if (zoneCount === null || zoneCount === undefined) {
          zoneCountDisplay = '...';
        } else if (zoneCount === -1) {
          zoneCountDisplay = '-';
        } else {
          zoneCountDisplay = zoneCount;
        }
        
        // 判断当前行是否处于编辑模式
        const isEditing = appState.editingAccountId === acc.id;
        
        if (isEditing) {
          return `
            <tr class="bg-cf-blue/5 transition-colors">
              <td class="px-5 py-4">
                <div class="flex items-center gap-3">
                  ${accountAvatarHtml(acc, 'w-8 h-8 text-xs')}
                  <input type="text" id="inline-name-${acc.id}" value="${escapeHtml(acc.name)}" class="w-28 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:border-cf-orange">
                </div>
              </td>
              <td class="px-5 py-4">
                <input type="text" id="inline-email-${acc.id}" value="${escapeHtml(acc.email || '')}" placeholder="邮箱/备注" class="w-36 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:border-cf-orange">
              </td>
              <td class="px-5 py-4">
                <div class="relative">
                  <input type="password" id="inline-token-${acc.id}" value="" placeholder="留空则不修改" class="w-40 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:border-cf-orange pr-7">
                  <button type="button" onclick="toggleInlineToken('${acc.id}')" class="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-200">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                  </button>
                </div>
              </td>
              <td class="px-5 py-4 text-slate-400">${zoneCountDisplay}</td>
              <td class="px-5 py-4">
                <button onclick="saveInlineEdit('${acc.id}')" class="text-green-500 hover:underline text-xs mr-3">保存</button>
                <button onclick="cancelInlineEdit()" class="text-slate-400 hover:underline text-xs">取消</button>
              </td>
            </tr>
          `;
        }
        
        return `
          <tr class="hover:bg-slate-100/30 dark:hover:bg-slate-800/30 transition-colors">
            <td class="px-5 py-4">
              <div class="flex items-center gap-3">
                ${accountAvatarHtml(acc, 'w-8 h-8 text-xs')}
                <span class="font-medium">${escapeHtml(acc.name)}</span>
              </div>
            </td>
            <td class="px-5 py-4 text-slate-400">${escapeHtml(acc.email || '-')}</td>
            <td class="px-5 py-4"><span class="px-2 py-1 rounded-full text-xs bg-green-500/10 text-green-500">有效</span></td>
            <td class="px-5 py-4">${zoneCountDisplay}</td>
            <td class="px-5 py-4">
              <button onclick="startInlineEdit('${acc.id}')" class="text-cf-blue hover:underline text-xs mr-3">编辑</button>
              <button onclick="selectAccount('${acc.id}')" class="text-cf-blue hover:underline text-xs mr-3">切换</button>
              <button onclick="deleteAccount('${acc.id}')" class="text-red-400 hover:underline text-xs">删除</button>
            </td>
          </tr>
        `;
      }).join('');
    }

    async function deleteAccount(id) {
      if (!confirm('确定要删除这个账户吗？')) return;
      try {
        await callBackend('delete_account', { id });
        if (appState.currentAccount?.id === id) {
          appState.currentAccount = null;
          clearAccountData();
          try { await callBackend('clear_current_account'); } catch (e) { console.error(e); }
        }
        try { if (localStorage.getItem('currentAccountId') === id) localStorage.removeItem('currentAccountId'); } catch (e) {}
        await loadAccounts();
      } catch (e) {
        alert('删除失败：' + e);
      }
    }

    // 行内编辑账户
    function startInlineEdit(id) {
      appState.editingAccountId = id;
      renderAccounts();
    }
    window.startInlineEdit = startInlineEdit;

    function cancelInlineEdit() {
      appState.editingAccountId = null;
      renderAccounts();
    }
    window.cancelInlineEdit = cancelInlineEdit;

    function toggleInlineToken(id) {
      const input = document.getElementById(`inline-token-${id}`);
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
    }
    window.toggleInlineToken = toggleInlineToken;

    async function saveInlineEdit(id) {
      const name = document.getElementById(`inline-name-${id}`)?.value.trim();
      const email = document.getElementById(`inline-email-${id}`)?.value.trim() || '';
      const newToken = document.getElementById(`inline-token-${id}`)?.value.trim() || '';
      
      if (!name) {
        alert('账户名称不能为空');
        return;
      }
      
      const account = appState.accounts.find(a => a.id === id);
      if (!account) {
        alert('账户不存在');
        return;
      }
      
      let token = newToken;
      
      // 如果 Token 留空，保留原 Token
      if (!token) {
        try {
          token = await callBackend('get_account_token', { id });
        } catch (e) {
          alert('获取原 Token 失败：' + e);
          return;
        }
      } else {
        // 验证新 Token
        try {
          const result = await callBackend('validate_token', { token });
          if (!result.success) {
            alert('Token 验证失败：' + (result.errors[0]?.message || '未知错误'));
            return;
          }
        } catch (e) {
          alert('Token 验证失败：' + e);
          return;
        }
      }
      
      const updatedAccount = {
        id,
        name,
        email,
        account_id: account.account_id,
        token_encrypted: account.token_encrypted || '',
        avatar: account.avatar || null
      };
      
      try {
        const savedAccount = await callBackend('save_account', { account: updatedAccount, token });
        
        // 如果编辑的是当前账户，更新当前账户状态
        if (appState.currentAccount?.id === id) {
          appState.currentAccount = savedAccount;
          const info = document.querySelector('.account-info');
          if (info) {
            info.innerHTML = `
              <div class="text-sm font-medium truncate">${escapeHtml(savedAccount.name)}</div>
              <div class="text-xs text-slate-400 truncate">${escapeHtml(savedAccount.email || '')}</div>
            `;
          }
          renderSidebarAvatar(savedAccount);
        }
        
        appState.editingAccountId = null;
        await loadAccounts();
        alert('账户保存成功');
      } catch (e) {
        alert('保存失败：' + e);
      }
    }
    window.saveInlineEdit = saveInlineEdit;

    async function selectAccount(id) {
      const account = appState.accounts.find(a => a.id === id);
      if (!account) return;
      
      if (!account.account_id) {
        alert('该账户缺少 Cloudflare Account ID，请删除后重新添加，并确保 Token 拥有“帐户 - 帐户（读取）”权限。');
        return;
      }
      
      try {
        const token = await callBackend('get_account_token', { id });
        await callBackend('set_current_account', { account, token });
        appState.currentAccount = account;
        try { localStorage.setItem('currentAccountId', id); } catch (e) {}
        
        // Update sidebar
        const info = document.querySelector('.account-info');
        if (info) {
          info.innerHTML = `
            <div class="text-sm font-medium truncate">${escapeHtml(account.name)}</div>
            <div class="text-xs text-slate-400 truncate">${escapeHtml(account.email || '')}</div>
          `;
        }
        renderSidebarAvatar(account);
        const status = document.querySelector('.account-status');
        if (status) {
          status.className = 'account-status account-info w-2 h-2 rounded-full bg-slate-500 status-dot shrink-0';
        }
        
        // Clear data belonging to the previous account and reload current page
        clearAccountData();
        try {
          await loadZones();
        } catch (zoneErr) {
          console.error('loadZones failed:', zoneErr);
        }
        renderDashboard();
        await reloadCurrentPage();

        // 刷新 API 连接状态
        await refreshApiStatus();
        // alert('已切换到账户：' + account.name);
      } catch (e) {
        alert('切换账户失败：' + e);
        setApiStatus('error', '账户切换失败');
      }
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    async function loadZones() {
      if (!appState.currentAccount) {
        alert('请先选择或添加一个账户');
        return;
      }
      
      try {
        const result = await callBackend('list_zones');
        if (!result.success) {
          alert('加载域名失败：' + (result.errors[0]?.message || '未知错误'));
          return;
        }
        appState.zones = result.result || [];
        appState.accountTotalRequests = null; // 清空缓存，域名列表变化后重新计算
        appState.workersTotalRequests = null; // 清空 Workers 请求缓存
        renderZones();
        renderDashboard();
      } catch (e) {
        console.error('加载域名失败:', e);
        setApiStatus('error', '域名加载失败：' + e);
      }
    }

    function renderZones() {
      const tbody = document.getElementById('zones-tbody');
      if (!tbody) return;
      
      const filter = document.getElementById('zone-search')?.value.toLowerCase() || '';
      const zones = appState.zones.filter(z => {
        const name = z.name || '';
        return name.toLowerCase().includes(filter);
      });
      
      if (zones.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-5 py-8 text-center text-slate-500">暂无域名数据</td></tr>';
        return;
      }
      
      tbody.innerHTML = zones.map(zone => {
        const status = zone.status || 'unknown';
        const plan = zone.plan?.name || 'Free';
        const ns = zone.name_servers?.[0] || '—';
        const statusClass = status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500';
        const planClass = plan.toLowerCase().includes('pro') ? 'bg-cf-orange/10 text-cf-orange' : 'bg-slate-500/10 text-slate-400';
        
        return `
          <tr class="hover:bg-slate-100/30 dark:hover:bg-slate-800/30 transition-colors">
            <td class="px-5 py-4 font-medium">${escapeHtml(zone.name || '')}</td>
            <td class="px-5 py-4 text-slate-400">${escapeHtml(appState.currentAccount?.name || '')}</td>
            <td class="px-5 py-4"><span class="px-2 py-1 rounded-full text-xs ${statusClass}">${escapeHtml(status)}</span></td>
            <td class="px-5 py-4"><span class="px-2 py-1 rounded-full text-xs ${planClass}">${escapeHtml(plan)}</span></td>
            <td class="px-5 py-4 text-slate-400">${escapeHtml(ns)}</td>
            <td class="px-5 py-4">
              <button onclick="selectZone('${zone.id}', '${escapeHtml(zone.name || '')}')" class="text-cf-blue hover:underline text-xs mr-3">DNS</button>
            </td>
          </tr>
        `;
      }).join('');
    }

    async function selectZone(id, name) {
      appState.currentZone = { id, name };
      const nameEl = document.getElementById('dns-zone-name');
      if (nameEl) nameEl.textContent = name;
      showPage('dns');
      await loadDnsRecords();
    }

    async function loadDnsRecords() {
      if (!appState.currentZone) {
        alert('请先选择一个域名');
        return;
      }
      
      try {
        const result = await callBackend('list_dns_records', { zoneId: appState.currentZone.id });
        if (!result.success) {
          alert('加载 DNS 记录失败：' + (result.errors[0]?.message || '未知错误'));
          return;
        }
        appState.dnsRecords = result.result || [];
        renderDnsRecords();
      } catch (e) {
        alert('加载 DNS 记录失败：' + e);
      }
    }

    function renderDnsRecords() {
      const tbody = document.getElementById('dns-tbody');
      if (!tbody) return;
      
      if (appState.dnsRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-5 py-8 text-center text-slate-500">暂无 DNS 记录</td></tr>';
        return;
      }
      
      const typeColors = {
        'A': 'bg-cf-orange/10 text-cf-orange',
        'AAAA': 'bg-cf-orange/10 text-cf-orange',
        'CNAME': 'bg-cf-blue/10 text-cf-blue',
        'MX': 'bg-purple-500/10 text-purple-500',
        'TXT': 'bg-green-500/10 text-green-500',
        'SRV': 'bg-yellow-500/10 text-yellow-500',
        'NS': 'bg-slate-500/10 text-slate-400',
        'CAA': 'bg-pink-500/10 text-pink-500'
      };
      
      tbody.innerHTML = appState.dnsRecords.map(record => {
        const type = record.type || 'A';
        const colorClass = typeColors[type] || 'bg-slate-500/10 text-slate-400';
        const proxied = record.proxied ? 
          `<button onclick="toggleDnsProxy('${record.id}', false)" class="w-10 h-5 rounded-full bg-cf-orange relative transition-colors hover:opacity-90"><div class="absolute right-1 top-1 w-3 h-3 rounded-full bg-white shadow"></div></button>` :
          `<button onclick="toggleDnsProxy('${record.id}', true)" class="w-10 h-5 rounded-full bg-slate-400 relative transition-colors hover:opacity-90"><div class="absolute left-1 top-1 w-3 h-3 rounded-full bg-white shadow"></div></button>`;
        
        return `
          <tr class="hover:bg-slate-100/30 dark:hover:bg-slate-800/30 transition-colors">
            <td class="px-5 py-4"><span class="px-2 py-1 rounded-md text-xs ${colorClass} font-medium">${escapeHtml(type)}</span></td>
            <td class="px-5 py-4 font-medium">${escapeHtml(record.name || '')}</td>
            <td class="px-5 py-4 text-slate-400 truncate max-w-xs">${escapeHtml(record.content || '')}</td>
            <td class="px-5 py-4 text-slate-400">${record.ttl || 1}</td>
            <td class="px-5 py-4">${proxied}</td>
            <td class="px-5 py-4">
              <button onclick="openDnsEditor('${record.id}')" class="text-cf-blue hover:underline text-xs mr-3">编辑</button>
              <button onclick="deleteDnsRecord('${record.id}')" class="text-red-400 hover:underline text-xs">删除</button>
            </td>
          </tr>
        `;
      }).join('');
    }

    async function deleteDnsRecord(recordId) {
      if (!appState.currentZone) return;
      if (!confirm('确定要删除这条 DNS 记录吗？')) return;
      
      try {
        const result = await callBackend('delete_dns_record', {
          zoneId: appState.currentZone.id,
          recordId
        });
        if (!result.success) {
          alert('删除失败：' + (result.errors[0]?.message || '未知错误'));
          return;
        }
        await loadDnsRecords();
      } catch (e) {
        alert('删除失败：' + e);
      }
    }

    function openDnsEditor(recordId) {
      const modal = document.getElementById('modal-dns-editor');
      const title = document.getElementById('dns-editor-title');
      const idInput = document.getElementById('dns-edit-id');
      const typeInput = document.getElementById('dns-edit-type');
      const nameInput = document.getElementById('dns-edit-name');
      const contentInput = document.getElementById('dns-edit-content');
      const ttlInput = document.getElementById('dns-edit-ttl');
      const proxiedInput = document.getElementById('dns-edit-proxied');
      
      if (recordId) {
        const record = appState.dnsRecords.find(r => r.id === recordId);
        if (!record) return;
        title.textContent = '编辑 DNS 记录';
        idInput.value = record.id;
        typeInput.value = record.type || 'A';
        nameInput.value = record.name || '';
        contentInput.value = record.content || '';
        ttlInput.value = record.ttl || 1;
        proxiedInput.checked = !!record.proxied;
      } else {
        title.textContent = '添加 DNS 记录';
        idInput.value = '';
        typeInput.value = 'A';
        nameInput.value = '';
        contentInput.value = '';
        ttlInput.value = 1;
        proxiedInput.checked = true;
      }
      
      modal.classList.remove('hidden');
    }

    function closeDnsEditor() {
      document.getElementById('modal-dns-editor').classList.add('hidden');
    }

    async function saveDnsRecord() {
      if (!appState.currentZone) {
        alert('请先选择一个域名');
        return;
      }
      
      const recordId = document.getElementById('dns-edit-id').value;
      const record = {
        type: document.getElementById('dns-edit-type').value,
        name: document.getElementById('dns-edit-name').value,
        content: document.getElementById('dns-edit-content').value,
        ttl: parseInt(document.getElementById('dns-edit-ttl').value) || 1,
        proxied: document.getElementById('dns-edit-proxied').checked
      };
      
      if (!record.name || !record.content) {
        alert('名称和内容不能为空');
        return;
      }
      
      try {
        let result;
        if (recordId) {
          result = await callBackend('update_dns_record', {
            zoneId: appState.currentZone.id,
            recordId,
            record
          });
        } else {
          result = await callBackend('add_dns_record', {
            zoneId: appState.currentZone.id,
            record
          });
        }
        if (!result.success) {
          alert('保存失败：' + (result.errors[0]?.message || '未知错误'));
          return;
        }
        closeDnsEditor();
        await loadDnsRecords();
      } catch (e) {
        alert('保存失败：' + e);
      }
    }

    async function toggleDnsProxy(recordId, enable) {
      if (!appState.currentZone) return;
      
      const record = appState.dnsRecords.find(r => r.id === recordId);
      if (!record) return;
      
      const updatedRecord = {
        type: record.type,
        name: record.name,
        content: record.content,
        ttl: record.ttl || 1,
        proxied: enable
      };
      
      try {
        const result = await callBackend('update_dns_record', {
          zoneId: appState.currentZone.id,
          recordId,
          record: updatedRecord
        });
        if (!result.success) {
          alert('切换代理失败：' + (result.errors[0]?.message || '未知错误'));
          return;
        }
        await loadDnsRecords();
      } catch (e) {
        alert('切换代理失败：' + e);
      }
    }
    window.toggleDnsProxy = toggleDnsProxy;

    async function purgeCache() {
      if (!appState.currentZone) {
        alert('请先选择一个域名');
        return;
      }
      if (!confirm('确定要清除 ' + appState.currentZone.name + ' 的所有缓存吗？')) return;
      
      try {
        const result = await callBackend('purge_cache', { zoneId: appState.currentZone.id });
        if (!result.success) {
          alert('清除缓存失败：' + (result.errors[0]?.message || '未知错误'));
          return;
        }
        alert('缓存清除成功');
      } catch (e) {
        alert('清除缓存失败：' + e);
      }
    }

    async function loadCacheSettings() {
      if (!appState.currentZone) {
        updateToggle('toggle-argo', false);
        updateToggle('toggle-polish', false);
        updateToggle('toggle-minify', false);
        return;
      }
      
      try {
        const [argoRes, polishRes, minifyRes] = await Promise.all([
          cfRequest('GET', `/zones/${appState.currentZone.id}/settings/argo_smart_routing`),
          cfRequest('GET', `/zones/${appState.currentZone.id}/settings/polish`),
          cfRequest('GET', `/zones/${appState.currentZone.id}/settings/minify`)
        ]);
        
        updateToggle('toggle-argo', argoRes.success && argoRes.result?.value === 'on');
        updateToggle('toggle-polish', polishRes.success && polishRes.result?.value !== 'off');
        updateToggle('toggle-minify', minifyRes.success && (minifyRes.result?.value?.html || minifyRes.result?.value?.css || minifyRes.result?.value?.js));
      } catch (e) {
        console.error('Cache settings load failed:', e);
      }
    }

    function updateToggle(id, on) {
      const btn = document.getElementById(id);
      if (!btn) return;
      const dot = btn.querySelector('div');
      if (on) {
        btn.classList.remove('bg-slate-400');
        btn.classList.add('bg-cf-orange');
        dot.style.left = 'auto';
        dot.style.right = '4px';
      } else {
        btn.classList.remove('bg-cf-orange');
        btn.classList.add('bg-slate-400');
        dot.style.right = 'auto';
        dot.style.left = '4px';
      }
    }

    async function toggleZoneSetting(setting) {
      if (!appState.currentZone) {
        alert('请先选择一个域名');
        return;
      }
      
      const zoneId = appState.currentZone.id;
      let currentValue, newValue;
      
      try {
        const current = await cfRequest('GET', `/zones/${zoneId}/settings/${setting}`);
        if (!current.success) throw new Error('获取设置失败');
        currentValue = current.result.value;
        
        if (setting === 'argo_smart_routing') {
          newValue = currentValue === 'on' ? 'off' : 'on';
        } else if (setting === 'polish') {
          newValue = currentValue === 'off' ? 'lossless' : 'off';
        } else if (setting === 'minify') {
          const anyOn = currentValue.html || currentValue.css || currentValue.js;
          newValue = { html: !anyOn, css: !anyOn, js: !anyOn };
        }
        
        const result = await cfRequest('PATCH', `/zones/${zoneId}/settings/${setting}`, { value: newValue });
        if (!result.success) {
          alert('更新失败：' + (result.errors[0]?.message || '未知错误'));
          return;
        }
        await loadCacheSettings();
      } catch (e) {
        alert('更新失败：' + e);
      }
    }

    function renderDashboard() {
      const accountCountEl = document.getElementById('dash-account-count');
      const zoneCountEl = document.getElementById('dash-zone-count');
      const dnsCountEl = document.getElementById('dash-dns-count');
      const reqCountEl = document.getElementById('dash-req-count');
      const currentAccountEl = document.getElementById('dash-current-account');
      const currentZoneEl = document.getElementById('dash-current-zone');
      
      if (accountCountEl) accountCountEl.textContent = appState.accounts.length;
      if (zoneCountEl) zoneCountEl.textContent = appState.zones.length;
      if (dnsCountEl) dnsCountEl.textContent = appState.dnsRecords.length;
      
      if (reqCountEl) {
        const quotaEl = document.getElementById('dash-req-quota');
        const statusEl = document.getElementById('dash-req-status');
        
        if (appState.workersRequestsError) {
          // 错误状态
          reqCountEl.textContent = '-';
          if (quotaEl) quotaEl.textContent = '';
          if (statusEl) {
            // 根据错误类型显示不同提示
            const err = appState.workersRequestsError;
            if (err.includes('权限')) {
              statusEl.textContent = '权限不足';
              statusEl.className = 'text-xs text-red-400';
            } else if (err.includes('暂无')) {
              statusEl.textContent = '无 Workers';
              statusEl.className = 'text-xs text-slate-500';
            } else if (err.includes('超时')) {
              statusEl.textContent = '网络超时';
              statusEl.className = 'text-xs text-yellow-500';
            } else {
              statusEl.textContent = '数据延迟';
              statusEl.className = 'text-xs text-yellow-500';
            }
            statusEl.title = err;
          }
        } else if (appState.workersTotalRequests != null) {
          // 成功状态
          reqCountEl.textContent = appState.workersTotalRequests.toLocaleString();
          const reqLabel = document.getElementById('dash-req-label');
          if (reqLabel) {
            const pad = n => String(n).padStart(2, '0');
            let updated = '';
            if (appState.workersRequestsUpdatedAt) {
              const t = new Date(appState.workersRequestsUpdatedAt);
              updated = `，更新于 ${pad(t.getHours())}:${pad(t.getMinutes())}`;
            }
            reqLabel.title = `统计范围：UTC 今日 00:00（北京时间 08:00）至当前时刻${updated}\n分析数据入库延迟约 15-60 分钟，数字通常略低于 CF 面板，稍后会逐步追上`;
          }
          if (quotaEl && appState.workersQuotaLimit) {
            const pct = Math.round(appState.workersTotalRequests / appState.workersQuotaLimit * 100);
            quotaEl.textContent = `/ ${appState.workersQuotaLimit.toLocaleString()}`;
            if (statusEl) {
              statusEl.textContent = `${pct}%`;
              if (pct >= 90) statusEl.className = 'text-xs text-red-500 font-medium';
              else if (pct >= 70) statusEl.className = 'text-xs text-yellow-500';
              else statusEl.className = 'text-xs text-green-500';
            }
          }
        } else if (appState.currentAccount) {
          // 加载中
          reqCountEl.textContent = '加载中...';
          if (quotaEl) quotaEl.textContent = '';
          if (statusEl) {
            statusEl.textContent = '';
            statusEl.className = 'text-xs';
          }
          loadWorkersTotalRequests().then(() => renderDashboard()).catch(() => {
            reqCountEl.textContent = '-';
          });
        } else {
          // 未选择账户
          reqCountEl.textContent = '-';
          if (quotaEl) quotaEl.textContent = '';
          if (statusEl) statusEl.textContent = '';
        }
      }
      
      if (currentAccountEl) currentAccountEl.textContent = appState.currentAccount ? escapeHtml(appState.currentAccount.name) : '未选择账户';
      if (currentZoneEl) currentZoneEl.textContent = appState.currentZone ? escapeHtml(appState.currentZone.name) : '未选择域名';
    }

    // Generic Cloudflare API request helper
    async function cfRequest(method, path, body = null) {
      return await callBackend('cloudflare_request', { method, path, body });
    }

    async function cfRequestText(method, path, body = null, contentType = null) {
      return await callBackend('cloudflare_request_text', { method, path, body, contentType });
    }

    // GraphQL Analytics API 查询
    async function cfGraphQL(query, variables = {}) {
      // 注意：后端会自动添加 https://api.cloudflare.com/client/v4 前缀
      // 所以这里只需要传 /graphql，不是 /client/v4/graphql
      const text = await cfRequestText('POST', '/graphql', { query, variables }, 'application/json');
      const result = JSON.parse(text);
      
      // GraphQL 错误处理
      if (result.errors && result.errors.length > 0) {
        const gqlError = result.errors[0]?.message || JSON.stringify(result.errors[0]);
        console.error('GraphQL error:', result.errors);
        throw new Error(gqlError);
      }
      
      return result.data;
    }

    // 侧边栏 API 连接状态
    function setApiStatus(status, text) {
      const dot = document.getElementById('api-status-dot');
      const txt = document.getElementById('api-status-text');
      const accountStatus = document.querySelector('.account-status');
      if (!dot || !txt) return;
      const colorClass = {
        idle: 'bg-slate-500',
        checking: 'bg-yellow-500',
        ok: 'bg-green-500',
        warn: 'bg-yellow-500',
        error: 'bg-red-500'
      }[status] || 'bg-slate-500';
      dot.className = `w-2 h-2 rounded-full ${colorClass} ${status === 'checking' ? 'animate-pulse' : ''}`;
      txt.textContent = text;
      if (accountStatus) {
        accountStatus.className = `account-status account-info w-2 h-2 rounded-full ${colorClass} status-dot shrink-0`;
      }
    }

    async function refreshApiStatus() {
      if (!appState.currentAccount) {
        setApiStatus('idle', '未选择账户');
        return;
      }
      if (!appState.currentAccount.account_id) {
        setApiStatus('warn', '账户未验证');
        return;
      }

      setApiStatus('checking', '检测中...');
      try {
        // 优先使用官方 Token 验证接口
        const result = await cfRequest('GET', '/user/tokens/verify');
        if (result.success) {
          setApiStatus('ok', 'API 连接正常');
          return;
        }
      } catch (e) {
        // 若 verify 接口不可用，回退到账户接口
        try {
          const result = await cfRequest('GET', `/accounts/${appState.currentAccount.account_id}`);
          if (result.success) {
            setApiStatus('ok', 'API 连接正常');
            return;
          }
        } catch (e2) {
          const msg = String(e2).toLowerCase();
          if (msg.includes('timeout') || msg.includes('timed out')) {
            setApiStatus('warn', 'API 响应超时');
          } else if (msg.includes('401') || msg.includes('403') || msg.includes('unauthorized') || msg.includes('invalid')) {
            setApiStatus('error', 'Token 无效');
          } else {
            setApiStatus('error', 'API 连接异常');
          }
          return;
        }
      }
      setApiStatus('error', 'Token 无效');
    }
    window.refreshApiStatus = refreshApiStatus;

    async function loadAccountTotalRequests() {
      if (!appState.currentAccount || appState.zones.length === 0) {
        appState.accountTotalRequests = null;
        return;
      }
      
      const until = new Date();
      const since = new Date(until.getTime() - 86400 * 1000); // 今日
      let totalRequests = 0;
      let loadedCount = 0;
      
      // 并行查询所有 Zone 的 analytics（限制并发数避免请求过多）
      const batchSize = 3;
      for (let i = 0; i < appState.zones.length; i += batchSize) {
        const batch = appState.zones.slice(i, i + batchSize);
        const promises = batch.map(async zone => {
          try {
            const result = await cfRequest('GET', `/zones/${zone.id}/analytics/dashboard?since=${since.toISOString()}&until=${until.toISOString()}`);
            if (result.success && result.result?.timeseries) {
              let zoneRequests = 0;
              result.result.timeseries.forEach(point => {
                zoneRequests += point.requests?.all || 0;
              });
              return zoneRequests;
            }
            return 0;
          } catch (e) {
            console.error(`Zone ${zone.name} analytics failed:`, e);
            return 0;
          }
        });
        
        const batchResults = await Promise.all(promises);
        totalRequests += batchResults.reduce((sum, val) => sum + val, 0);
        loadedCount += batch.length;
      }
      
      appState.accountTotalRequests = totalRequests;
      console.log(`Account total requests: ${totalRequests} (${loadedCount}/${appState.zones.length} zones)`);
    }

    async function loadWorkersTotalRequests() {
      if (!appState.currentAccount) {
        appState.workersTotalRequests = null;
        appState.workersQuotaLimit = null;
        appState.workersRequestsError = null;
        return;
      }
      
      const accountId = appState.currentAccount.account_id;

      // CF 面板"今天的请求"按 UTC 零点起算（账户默认时区为 UTC），与官网保持一致
      const now = new Date();
      const todayUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0));
      const since = todayUtc.toISOString();
      const until = now.toISOString();
      
      console.log('Workers query range:', since, 'to', until);
      
      // 先设置默认配额
      appState.workersQuotaLimit = 100000;
      
      try {
        // 1. 查询 Workers 配额限制
        try {
          const quotaResult = await cfRequest('GET', `/accounts/${accountId}/workers/quotas`);
          if (quotaResult.success && quotaResult.result) {
            appState.workersQuotaLimit = quotaResult.result.daily_requests || 100000;
          }
        } catch (quotaErr) {
          console.log('Quota fetch failed:', quotaErr);
        }
        
        // 2. 尝试 GraphQL 查询 Workers 请求数
        const query = `
          query GetWorkersRequests($accountTag: String!, $since: Time!, $until: Time!) {
            viewer {
              accounts(filter: { accountTag: $accountTag }) {
                workersInvocationsAdaptive(
                  limit: 10000
                  filter: { datetime_geq: $since, datetime_leq: $until }
                ) {
                  sum {
                    requests
                  }
                }
              }
            }
          }
        `;
        
        const data = await cfGraphQL(query, { 
          accountTag: accountId, 
          since, 
          until 
        });
        
        const accounts = data?.viewer?.accounts || [];
        let totalRequests = 0;
        
        accounts.forEach(acc => {
          const invocations = acc.workersInvocationsAdaptive || [];
          invocations.forEach(item => {
            totalRequests += item.sum?.requests || 0;
          });
        });
        
        appState.workersTotalRequests = totalRequests;
        appState.workersRequestsError = null;
        appState.workersRequestsUpdatedAt = Date.now();
        
      } catch (e) {
        console.error('Workers analytics load failed:', e);
        appState.workersRequestsError = String(e);
        appState.workersTotalRequests = null;
      }
    }

    async function refreshWorkersRequests() {
      appState.workersTotalRequests = null;
      appState.workersRequestsError = null;
      renderDashboard();
    }
    window.refreshWorkersRequests = refreshWorkersRequests;

    async function loadAnalytics() {
      if (!appState.currentZone) {
        document.getElementById('analytics-requests').textContent = '-';
        document.getElementById('analytics-threats').textContent = '-';
        document.getElementById('analytics-cache').textContent = '-';
        document.getElementById('analytics-countries').innerHTML = '<div class="text-sm text-slate-500">请先选择一个域名</div>';
        return;
      }
      
      const range = parseInt(document.getElementById('analytics-range')?.value || '86400');
      const until = new Date();
      const since = new Date(until.getTime() - range * 1000);
      
      try {
        const result = await cfRequest('GET', `/zones/${appState.currentZone.id}/analytics/dashboard?since=${since.toISOString()}&until=${until.toISOString()}`);
        if (!result.success) {
          document.getElementById('analytics-countries').innerHTML = '<div class="text-sm text-red-400">加载失败</div>';
          return;
        }
        appState.analytics = result.result || {};
        renderAnalytics();
        renderDashboard();
      } catch (e) {
        console.error('Analytics load failed:', e);
        document.getElementById('analytics-countries').innerHTML = '<div class="text-sm text-red-400">加载失败：' + escapeHtml(String(e)) + '</div>';
      }
    }

    function renderAnalytics() {
      const data = appState.analytics || {};
      const timeseries = data.timeseries || [];
      
      let totalRequests = 0;
      let totalThreats = 0;
      let totalCached = 0;
      let totalUncached = 0;
      
      timeseries.forEach(point => {
        totalRequests += point.requests?.all || 0;
        totalThreats += point.requests?.threat || 0;
        totalCached += point.requests?.cached || 0;
        totalUncached += point.requests?.uncached || 0;
      });
      
      document.getElementById('analytics-requests').textContent = totalRequests.toLocaleString();
      document.getElementById('analytics-threats').textContent = totalThreats.toLocaleString();
      
      const cacheRate = totalRequests > 0 ? Math.round(totalCached / totalRequests * 100) : 0;
      document.getElementById('analytics-cache').textContent = cacheRate + '%';
      
      const countries = data.totals?.country || {};
      const countryList = Object.entries(countries)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      
      const container = document.getElementById('analytics-countries');
      if (countryList.length === 0) {
        container.innerHTML = '<div class="text-sm text-slate-500">暂无地区数据</div>';
        return;
      }
      
      const max = countryList[0][1];
      container.innerHTML = countryList.map(([name, value]) => {
        const pct = max > 0 ? Math.round(value / max * 100) : 0;
        return `
          <div>
            <div class="flex justify-between text-sm mb-1"><span>${escapeHtml(name)}</span><span class="text-slate-400">${value.toLocaleString()}</span></div>
            <div class="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"><div class="h-full bg-cf-orange rounded-full" style="width: ${pct}%"></div></div>
          </div>
        `;
      }).join('');
    }

    async function loadWorkers() {
      if (!appState.currentAccount?.account_id) {
        renderWorkers([]);
        return;
      }
      try {
        const result = await cfRequest('GET', `/accounts/${appState.currentAccount.account_id}/workers/scripts`);
        appState.workers = result.success ? (result.result || []) : [];
        appState.workersLoadError = result.success ? null : (result.errors?.[0]?.message || '加载失败');
        renderWorkers();
      } catch (e) {
        console.error('Workers load failed:', e);
        appState.workersLoadError = String(e);
        renderWorkers([]);
      }
    }

    function renderWorkers() {
      const container = document.getElementById('workers-list');
      if (!container) return;
      const workers = appState.workers || [];
      if (workers.length === 0) {
        container.innerHTML = '<div class=\"p-8 text-center text-slate-500\">暂无 Workers 脚本</div>';
        return;
      }
      container.innerHTML = workers.map(w => `
        <div class=\"flex items-center justify-between p-4 rounded-xl bg-slate-100/50 dark:bg-slate-800/50\">
          <div class=\"flex items-center gap-3\">
            <div class=\"w-10 h-10 rounded-lg bg-cf-orange/10 text-cf-orange flex items-center justify-center\">
              <svg class=\"w-5 h-5\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4\"></path></svg>
            </div>
            <div>
              <div class=\"font-medium\">${escapeHtml(w.id || 'unnamed')}</div>
              <div class=\"text-xs text-slate-500\">${escapeHtml(w.service || '')}</div>
            </div>
          </div>
          <div class=\"flex gap-2\">
            <button onclick=\"openWorkerRoutes('${escapeHtml(w.id || '')}')\" class=\"px-3 py-1.5 rounded-lg bg-cf-orange/10 text-cf-orange text-xs hover:bg-cf-orange/20\">路由 /域名</button>
            <button onclick=\"editWorker('${escapeHtml(w.id || '')}')\" class=\"px-3 py-1.5 rounded-lg bg-cf-blue/10 text-cf-blue text-xs hover:bg-cf-blue/20\">编辑</button>
            <button onclick=\"deleteWorker('${escapeHtml(w.id || '')}')\" class=\"px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20\">删除</button>
          </div>
        </div>
      `).join('');
    }

    function createWorker() {
      document.getElementById('worker-edit-name').value = '';
      document.getElementById('worker-edit-code').value = '';
      appState.workerMetadataText = null;
      appState.workerEnvVars = [];
      appState.workerNonEnvBindings = [];
      appState.workerOriginalSecretNames = [];
      renderWorkerEnvVars();
      document.getElementById('modal-worker-editor').classList.remove('hidden');
      updateWorkerLineNumbers();
    }
    window.createWorker = createWorker;

    function closeWorkerEditor() {
      document.getElementById('modal-worker-editor').classList.add('hidden');
    }
    window.closeWorkerEditor = closeWorkerEditor;

    function updateWorkerLineNumbers() {
      const textarea = document.getElementById('worker-edit-code');
      const numbers = document.getElementById('worker-line-numbers');
      if (!textarea || !numbers) return;
      const lines = textarea.value.split('\n').length || 1;
      numbers.innerHTML = Array.from({ length: lines }, (_, i) => `<div>${i + 1}</div>`).join('');
    }
    window.updateWorkerLineNumbers = updateWorkerLineNumbers;

    function syncWorkerLineNumbers() {
      const textarea = document.getElementById('worker-edit-code');
      const numbers = document.getElementById('worker-line-numbers');
      if (textarea && numbers) {
        numbers.style.transform = `translateY(-${textarea.scrollTop}px)`;
      }
    }
    window.syncWorkerLineNumbers = syncWorkerLineNumbers;

    function updateSnippetLineNumbers() {
      const textarea = document.getElementById('snippet-edit-code');
      const numbers = document.getElementById('snippet-line-numbers');
      if (!textarea || !numbers) return;
      const lines = textarea.value.split('\n').length || 1;
      numbers.innerHTML = Array.from({ length: lines }, (_, i) => `<div>${i + 1}</div>`).join('');
    }
    window.updateSnippetLineNumbers = updateSnippetLineNumbers;

    function syncSnippetLineNumbers() {
      const textarea = document.getElementById('snippet-edit-code');
      const numbers = document.getElementById('snippet-line-numbers');
      if (textarea && numbers) {
        numbers.style.transform = `translateY(-${textarea.scrollTop}px)`;
      }
    }
    window.syncSnippetLineNumbers = syncSnippetLineNumbers;

    function parseWorkerMultipart(text) {
      if (!text || !text.startsWith('--')) return { code: text, metadata: null, metadataText: null };
      
      const firstLineEnd = text.indexOf('\r\n');
      const firstLine = firstLineEnd !== -1 ? text.slice(0, firstLineEnd) : text;
      const boundary = firstLine.slice(2).replace(/--$/, '');
      if (!boundary) return { code: text, metadata: null, metadataText: null };
      
      const startBoundary1 = '--' + boundary + '\r\n';
      const startBoundary2 = '\r\n--' + boundary + '\r\n';
      const endBoundary1 = '--' + boundary + '--';
      const endBoundary2 = '\r\n--' + boundary + '--';
      
      let code = text;
      let metadataText = null;
      let metadata = null;
      
      const partStarts = [];
      let pos = 0;
      while (true) {
        let nextPos = text.indexOf(startBoundary2, pos);
        let isFirst = false;
        if (nextPos === -1 && pos === 0 && text.startsWith(startBoundary1)) {
          nextPos = 0;
          isFirst = true;
        }
        if (nextPos === -1) break;
        partStarts.push({ index: nextPos, isFirst });
        pos = nextPos + (isFirst ? startBoundary1.length : startBoundary2.length);
      }
      
      for (let i = 0; i < partStarts.length; i++) {
        const start = partStarts[i];
        const startLen = start.isFirst ? startBoundary1.length : startBoundary2.length;
        const partStart = start.index + startLen;
        
        let partEnd = text.length;
        if (i < partStarts.length - 1) {
          partEnd = partStarts[i + 1].index;
        } else {
          const endPos1 = text.indexOf(endBoundary1, partStart);
          const endPos2 = text.indexOf(endBoundary2, partStart);
          if (endPos1 !== -1) partEnd = endPos1;
          if (endPos2 !== -1 && endPos2 < partEnd) partEnd = endPos2;
        }
        
        const partText = text.slice(partStart, partEnd);
        const bodySep = partText.indexOf('\r\n\r\n');
        if (bodySep === -1) continue;
        
        const header = partText.slice(0, bodySep);
        let body = partText.slice(bodySep + 4);
        body = body.replace(/\r?\n$/, '');
        
        const nameMatch = header.match(/name="([^"]+)"/);
        const filenameMatch = header.match(/filename="([^"]+)"/);
        const ctMatch = header.match(/Content-Type:\s*([^\r\n]+)/i);
        const name = nameMatch ? nameMatch[1] : '';
        const filename = filenameMatch ? filenameMatch[1] : '';
        const contentType = ctMatch ? ctMatch[1].trim() : '';
        
        if (name === 'metadata') {
          metadataText = body;
          try { metadata = JSON.parse(body); } catch (e) {}
        } else if (
          name === 'worker.js' || filename.endsWith('.js') || name.endsWith('.js') || contentType.includes('javascript')
        ) {
          code = body;
        }
      }
      
      return { code, metadata, metadataText };
    }

    function buildWorkerMultipart(code, metadataObj, fileName = 'worker.js') {
      const boundary = '----WorkerBoundary' + Math.random().toString(36).slice(2);
      const metadata = JSON.stringify(metadataObj || { main_module: fileName });
      return {
        body: [
          `--${boundary}`,
          'Content-Disposition: form-data; name="metadata"',
          '',
          metadata,
          `--${boundary}`,
          `Content-Disposition: form-data; name="${fileName}"; filename="${fileName}"`,
          'Content-Type: application/javascript+module',
          '',
          code,
          `--${boundary}--`
        ].join('\r\n'),
        contentType: `multipart/form-data; boundary=${boundary}`
      };
    }

    function extractWorkerEnvVars(metadata) {
      const envVars = [];
      const nonEnvBindings = [];
      const secretNames = [];
      const bindings = metadata?.bindings || [];
      for (const b of bindings) {
        if (b.type === 'plain_text') {
          envVars.push({ name: b.name || '', value: b.text || '', isSecret: false });
        } else if (b.type === 'secret_text') {
          envVars.push({ name: b.name || '', value: '', isSecret: true });
          secretNames.push(b.name);
        } else {
          nonEnvBindings.push(b);
        }
      }
      return { envVars, nonEnvBindings, secretNames };
    }

    function renderWorkerEnvVars() {
      const container = document.getElementById('worker-env-list');
      if (!container) return;
      if (appState.workerEnvVars.length === 0) {
        container.innerHTML = '<div class="text-xs text-slate-500 text-center py-2">暂无环境变量</div>';
        return;
      }
      container.innerHTML = appState.workerEnvVars.map((v, i) => `
        <div class="worker-env-row flex items-center gap-2">
          <input type="text" placeholder="变量名" value="${escapeHtml(v.name)}" oninput="updateWorkerEnvVar(${i}, 'name', this.value)" class="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-none focus:border-cf-orange font-mono">
          <input type="${v.isSecret ? 'password' : 'text'}" placeholder="${v.isSecret ? '重新输入以更新' : '变量值'}" value="${escapeHtml(v.value)}" oninput="updateWorkerEnvVar(${i}, 'value', this.value)" class="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-none focus:border-cf-orange font-mono">
          <label class="flex items-center gap-1 text-xs text-slate-400 whitespace-nowrap cursor-pointer" title="标记为 Secret">
            <input type="checkbox" ${v.isSecret ? 'checked' : ''} onchange="toggleWorkerEnvSecret(${i})" class="rounded border-slate-500">
            <span>Secret</span>
          </label>
          <button type="button" onclick="removeWorkerEnvVar(${i})" class="text-slate-400 hover:text-red-400 p-1 shrink-0" title="删除">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
          </button>
        </div>
      `).join('');
    }
    window.renderWorkerEnvVars = renderWorkerEnvVars;

    function addWorkerEnvVar() {
      appState.workerEnvVars.push({ name: '', value: '', isSecret: false });
      renderWorkerEnvVars();
    }
    window.addWorkerEnvVar = addWorkerEnvVar;

    function removeWorkerEnvVar(index) {
      appState.workerEnvVars.splice(index, 1);
      renderWorkerEnvVars();
    }
    window.removeWorkerEnvVar = removeWorkerEnvVar;

    function updateWorkerEnvVar(index, field, value) {
      if (appState.workerEnvVars[index]) {
        appState.workerEnvVars[index][field] = value;
      }
    }
    window.updateWorkerEnvVar = updateWorkerEnvVar;

    function toggleWorkerEnvSecret(index) {
      const v = appState.workerEnvVars[index];
      if (v) {
        v.isSecret = !v.isSecret;
        renderWorkerEnvVars();
      }
    }
    window.toggleWorkerEnvSecret = toggleWorkerEnvSecret;

    async function editWorker(name) {
      if (!appState.currentAccount?.account_id || !name) return;
      try {
        const raw = await cfRequestText('GET', `/accounts/${appState.currentAccount.account_id}/workers/scripts/${encodeURIComponent(name)}`);
        const parsed = parseWorkerMultipart(raw);
        const { envVars, nonEnvBindings, secretNames } = extractWorkerEnvVars(parsed.metadata);
        document.getElementById('worker-edit-name').value = name;
        document.getElementById('worker-edit-code').value = parsed.code;
        appState.workerMetadataText = parsed.metadataText;
        appState.workerEnvVars = envVars;
        appState.workerNonEnvBindings = nonEnvBindings;
        appState.workerOriginalSecretNames = secretNames;
        renderWorkerEnvVars();
        document.getElementById('modal-worker-editor').classList.remove('hidden');
        updateWorkerLineNumbers();
      } catch (e) {
        console.error('load worker failed:', e);
        alert('加载失败: ' + e);
      }
    }
    window.editWorker = editWorker;

    async function saveWorker() {
      if (!appState.currentAccount?.account_id) return;
      const name = document.getElementById('worker-edit-name').value.trim();
      const code = document.getElementById('worker-edit-code').value;
      if (!name) { alert('请输入脚本名称'); return; }
      try {
        // 合并元数据：保留兼容性日期、标签、非环境变量 bindings 等
        let metadataObj = { main_module: 'worker.js' };
        if (appState.workerMetadataText) {
          try { metadataObj = JSON.parse(appState.workerMetadataText); } catch (e) {}
        }
        const plainBindings = appState.workerEnvVars
          .filter(v => !v.isSecret && v.name.trim())
          .map(v => ({ type: 'plain_text', name: v.name.trim(), text: v.value }));
        const secretVars = appState.workerEnvVars.filter(v => v.isSecret && v.name.trim());
        metadataObj.main_module = metadataObj.main_module || 'worker.js';
        metadataObj.bindings = [...(appState.workerNonEnvBindings || []), ...plainBindings];

        const { body, contentType } = buildWorkerMultipart(code, metadataObj);
        await cfRequestText('PUT', `/accounts/${appState.currentAccount.account_id}/workers/scripts/${encodeURIComponent(name)}`, body, contentType);

        // 通过 Secrets API 单独上传 Secret（避免把 Secret 明文塞进 metadata）
        for (const s of secretVars) {
          if (!s.value) continue;
          await cfRequest('PUT', `/accounts/${appState.currentAccount.account_id}/workers/scripts/${encodeURIComponent(name)}/secrets/${encodeURIComponent(s.name.trim())}`, {
            name: s.name.trim(),
            type: 'secret_text',
            text: s.value
          });
        }

        // 删除已被移除的 Secret
        const currentSecretNames = new Set(secretVars.map(v => v.name.trim()));
        for (const oldName of (appState.workerOriginalSecretNames || [])) {
          if (!currentSecretNames.has(oldName)) {
            await cfRequest('DELETE', `/accounts/${appState.currentAccount.account_id}/workers/scripts/${encodeURIComponent(name)}/secrets/${encodeURIComponent(oldName)}`);
          }
        }

        closeWorkerEditor();
        await loadWorkers();
      } catch (e) {
        console.error('deploy worker failed:', e);
        alert('部署失败: ' + e);
      }
    }
    window.saveWorker = saveWorker;

    async function deleteWorker(name) {
      if (!appState.currentAccount?.account_id || !name) return;
      if (!confirm(`确定要删除 Worker "${name}" 吗？`)) return;
      try {
        await cfRequest('DELETE', `/accounts/${appState.currentAccount.account_id}/workers/scripts/${encodeURIComponent(name)}`);
        await loadWorkers();
      } catch (e) {
        console.error('delete worker failed:', e);
        alert('删除失败: ' + e);
      }
    }
    window.deleteWorker = deleteWorker;

    async function loadPages() {
      if (!appState.currentAccount?.account_id) {
        renderPages([]);
        return;
      }
      try {
        const result = await cfRequest('GET', `/accounts/${appState.currentAccount.account_id}/pages/projects`);
        appState.pages = result.success ? (result.result || []) : [];
        renderPages();
      } catch (e) {
        console.error('Pages load failed:', e);
        renderPages([]);
      }
    }

    function renderPages() {
      const tbody = document.getElementById('pages-tbody');
      if (!tbody) return;
      const pages = appState.pages || [];
      if (pages.length === 0) {
        tbody.innerHTML = '<tr><td colspan=\"5\" class=\"px-5 py-8 text-center text-slate-500\">暂无 Pages 项目</td></tr>';
        return;
      }
      tbody.innerHTML = pages.map(p => {
        const deployment = p.latest_deployment || {};
        return `
          <tr class=\"hover:bg-slate-100/30 dark:hover:bg-slate-800/30 transition-colors\">
            <td class=\"px-5 py-4 font-medium\">${escapeHtml(p.name || '')}</td>
            <td class=\"px-5 py-4 text-slate-400\">${escapeHtml(p.production_branch || 'main')}</td>
            <td class=\"px-5 py-4 text-slate-400\">${escapeHtml(deployment.created_on ? new Date(deployment.created_on).toLocaleString() : '-')}</td>
            <td class=\"px-5 py-4\"><span class=\"px-2 py-1 rounded-full text-xs bg-green-500/10 text-green-500\">成功</span></td>
            <td class=\"px-5 py-4\">
              <button onclick=\"openPagesDeployModal('${escapeHtml(p.name || '')}')\" class=\"text-cf-orange hover:underline text-xs mr-3\">部署目录</button>
              <button onclick=\"openPagesDomains('${escapeHtml(p.name || '')}')\" class=\"text-cf-blue hover:underline text-xs mr-3\">自定义域名</button>
              <button onclick=\"window.open('https://${escapeHtml(p.subdomain || '')}.pages.dev', '_blank')\" class=\"text-cf-blue hover:underline text-xs mr-3\">查看</button>
              <button onclick=\"deletePagesProject('${escapeHtml(p.name || '')}')\" class=\"text-red-400 hover:underline text-xs\">删除</button>
            </td>
          </tr>
        `;
      }).join('');
    }

    async function createPagesProject() {
      const name = prompt('请输入 Pages 项目名称（仅字母、数字、连字符）：');
      if (!name || !appState.currentAccount?.account_id) return;
      const branch = prompt('请输入生产分支（默认 main）：') || 'main';
      try {
        await cfRequest('POST', `/accounts/${appState.currentAccount.account_id}/pages/projects`, { name, production_branch: branch });
        await loadPages();
      } catch (e) {
        console.error('create pages project failed:', e);
        alert('创建失败: ' + e);
      }
    }
    window.createPagesProject = createPagesProject;

    async function deletePagesProject(name) {
      if (!appState.currentAccount?.account_id || !name) return;
      if (!confirm(`确定要删除 Pages 项目 "${name}" 吗？`)) return;
      try {
        await cfRequest('DELETE', `/accounts/${appState.currentAccount.account_id}/pages/projects/${encodeURIComponent(name)}`);
        await loadPages();
      } catch (e) {
        console.error('delete pages project failed:', e);
        alert('删除失败: ' + e);
      }
    }
    window.deletePagesProject = deletePagesProject;

    function openPagesDeployModal(projectName) {
      document.getElementById('pages-deploy-project').value = projectName;
      document.getElementById('pages-deploy-dir').value = '';
      document.getElementById('pages-deploy-zip').value = '';
      const wranglerDir = document.getElementById('pages-deploy-wrangler-dir');
      const wranglerCmd = document.getElementById('pages-deploy-wrangler-cmd');
      const wranglerArgs = document.getElementById('pages-deploy-wrangler-args');
      const wranglerOutdir = document.getElementById('pages-deploy-wrangler-outdir');
      if (wranglerDir) wranglerDir.value = '';
      if (wranglerCmd) wranglerCmd.value = 'pages deploy';
      if (wranglerArgs) wranglerArgs.value = '';
      if (wranglerOutdir) wranglerOutdir.value = '';
      onWranglerCmdChange();
      document.getElementById('pages-deploy-branch').value = 'main';
      document.getElementById('pages-deploy-env').value = 'production';
      document.getElementById('pages-deploy-mode').value = 'dir';
      switchPagesDeployTab('dir');
      appState.pagesDeployEnvVars = [];
      renderPagesDeployEnvVars();
      document.getElementById('pages-deploy-log').classList.add('hidden');
      document.getElementById('pages-deploy-log').textContent = '';
      updateZipProgress(0, '等待开始');
      document.getElementById('modal-pages-deploy').classList.remove('hidden');
    }
    window.openPagesDeployModal = openPagesDeployModal;

    function closePagesDeployModal() {
      document.getElementById('modal-pages-deploy').classList.add('hidden');
    }
    window.closePagesDeployModal = closePagesDeployModal;

    function switchPagesDeployTab(mode) {
      document.getElementById('pages-deploy-mode').value = mode;
      const dirPanel = document.getElementById('pages-deploy-dir-panel');
      const wranglerPanel = document.getElementById('pages-deploy-wrangler-panel');
      const zipPanel = document.getElementById('pages-deploy-zip-panel');
      const dirTab = document.getElementById('pages-tab-dir');
      const wranglerTab = document.getElementById('pages-tab-wrangler');
      const zipTab = document.getElementById('pages-tab-zip');

      function setActive(tab, panel) {
        tab.classList.remove('bg-slate-100', 'dark:bg-slate-800', 'text-slate-600', 'dark:text-slate-300');
        tab.classList.add('bg-cf-orange', 'text-white');
        panel.classList.remove('hidden');
      }
      function setInactive(tab, panel) {
        tab.classList.remove('bg-cf-orange', 'text-white');
        tab.classList.add('bg-slate-100', 'dark:bg-slate-800', 'text-slate-600', 'dark:text-slate-300');
        panel.classList.add('hidden');
      }

      [dirTab, wranglerTab, zipTab].forEach(t => t.classList.remove('bg-cf-orange', 'text-white', 'bg-slate-100', 'dark:bg-slate-800', 'text-slate-600', 'dark:text-slate-300'));
      [dirPanel, wranglerPanel, zipPanel].forEach(p => p.classList.add('hidden'));

      if (mode === 'zip') {
        setActive(zipTab, zipPanel);
        setInactive(dirTab, dirPanel);
        setInactive(wranglerTab, wranglerPanel);
      } else if (mode === 'wrangler') {
        setActive(wranglerTab, wranglerPanel);
        setInactive(dirTab, dirPanel);
        setInactive(zipTab, zipPanel);
      } else {
        setActive(dirTab, dirPanel);
        setInactive(wranglerTab, wranglerPanel);
        setInactive(zipTab, zipPanel);
      }
    }
    window.switchPagesDeployTab = switchPagesDeployTab;

    function updateZipProgress(percent, text) {
      const bar = document.getElementById('pages-deploy-zip-progress');
      const status = document.getElementById('pages-deploy-zip-status');
      if (bar) bar.style.width = percent + '%';
      if (status) status.textContent = text;
    }
    window.updateZipProgress = updateZipProgress;

    function renderPagesDeployEnvVars() {
      const container = document.getElementById('pages-deploy-env-list');
      if (!container) return;
      if (appState.pagesDeployEnvVars.length === 0) {
        container.innerHTML = '<div class="text-xs text-slate-500 text-center py-2">暂无环境变量</div>';
        return;
      }
      container.innerHTML = appState.pagesDeployEnvVars.map((v, i) => `
        <div class="flex items-center gap-2">
          <input type="text" placeholder="变量名" value="${escapeHtml(v.name)}" oninput="updatePagesDeployEnvVar(${i}, 'name', this.value)" class="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-none focus:border-cf-orange font-mono">
          <input type="${v.isSecret ? 'password' : 'text'}" placeholder="变量值" value="${escapeHtml(v.value)}" oninput="updatePagesDeployEnvVar(${i}, 'value', this.value)" class="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-none focus:border-cf-orange font-mono">
          <label class="flex items-center gap-1 text-xs text-slate-400 whitespace-nowrap cursor-pointer" title="标记为 Secret">
            <input type="checkbox" ${v.isSecret ? 'checked' : ''} onchange="togglePagesDeployEnvSecret(${i})" class="rounded border-slate-500">
            <span>Secret</span>
          </label>
          <button type="button" onclick="removePagesDeployEnvVar(${i})" class="text-slate-400 hover:text-red-400 p-1 shrink-0" title="删除">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
          </button>
        </div>
      `).join('');
    }
    window.renderPagesDeployEnvVars = renderPagesDeployEnvVars;

    function addPagesDeployEnvVar() {
      appState.pagesDeployEnvVars.push({ name: '', value: '', isSecret: false });
      renderPagesDeployEnvVars();
    }
    window.addPagesDeployEnvVar = addPagesDeployEnvVar;

    function removePagesDeployEnvVar(index) {
      appState.pagesDeployEnvVars.splice(index, 1);
      renderPagesDeployEnvVars();
    }
    window.removePagesDeployEnvVar = removePagesDeployEnvVar;

    function updatePagesDeployEnvVar(index, field, value) {
      if (appState.pagesDeployEnvVars[index]) {
        appState.pagesDeployEnvVars[index][field] = value;
      }
    }
    window.updatePagesDeployEnvVar = updatePagesDeployEnvVar;

    function togglePagesDeployEnvSecret(index) {
      const v = appState.pagesDeployEnvVars[index];
      if (v) {
        v.isSecret = !v.isSecret;
        renderPagesDeployEnvVars();
      }
    }
    window.togglePagesDeployEnvSecret = togglePagesDeployEnvSecret;

    async function deployPages() {
      const mode = document.getElementById('pages-deploy-mode').value || 'dir';
      if (mode === 'zip') {
        await deployPagesZip();
      } else if (mode === 'wrangler') {
        await deployPagesWrangler();
      } else {
        await deployPagesLocal();
      }
    }
    window.deployPages = deployPages;

    async function deployPagesLocal() {
      const projectName = document.getElementById('pages-deploy-project').value;
      const directory = document.getElementById('pages-deploy-dir').value.trim();
      const branch = document.getElementById('pages-deploy-branch').value.trim() || 'main';
      const environment = document.getElementById('pages-deploy-env').value;
      if (!directory) {
        alert('请输入本地目录路径');
        return;
      }
      const logEl = document.getElementById('pages-deploy-log');
      const btn = document.getElementById('pages-deploy-btn');
      logEl.classList.remove('hidden');
      logEl.textContent = '正在设置环境变量并启动 wrangler 部署...';
      btn.disabled = true;
      btn.classList.add('opacity-50', 'cursor-not-allowed');
      try {
        const envVars = appState.pagesDeployEnvVars
          .filter(v => v.name.trim())
          .map(v => ({ name: v.name.trim(), value: v.value, is_secret: v.isSecret }));
        const result = await callBackend('deploy_pages_local', {
          project_name: projectName,
          directory,
          branch,
          environment,
          env_vars: envVars
        });
        logEl.textContent = result;
      } catch (e) {
        logEl.textContent = '部署失败：' + e;
      } finally {
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    }
    window.deployPagesLocal = deployPagesLocal;

    async function deployPagesZip() {
      const projectName = document.getElementById('pages-deploy-project').value;
      const zipPath = document.getElementById('pages-deploy-zip').value.trim();
      if (!zipPath) {
        alert('请输入 ZIP 压缩包路径');
        return;
      }
      const logEl = document.getElementById('pages-deploy-log');
      const btn = document.getElementById('pages-deploy-btn');
      logEl.classList.remove('hidden');
      logEl.textContent = '正在通过 Cloudflare Direct Upload API 部署 ZIP...';
      updateZipProgress(10, '正在解析压缩包...');
      btn.disabled = true;
      btn.classList.add('opacity-50', 'cursor-not-allowed');
      try {
        updateZipProgress(30, '正在上传文件...');
        const result = await callBackend('deploy_pages_zip', {
          project_name: projectName,
          zipPath
        });
        updateZipProgress(100, '部署完成');
        logEl.textContent = '部署成功：' + JSON.stringify(result, null, 2);
      } catch (e) {
        updateZipProgress(0, '部署失败');
        logEl.textContent = '部署失败：' + e;
      } finally {
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    }
    window.deployPagesZip = deployPagesZip;

    async function deployPagesWrangler() {
      const projectDir = document.getElementById('pages-deploy-wrangler-dir').value.trim();
      const cmd = document.getElementById('pages-deploy-wrangler-cmd').value.trim();
      const outDirEl = document.getElementById('pages-deploy-wrangler-outdir');
      const outDir = outDirEl ? outDirEl.value.trim() : '';
      const extraArgs = document.getElementById('pages-deploy-wrangler-args').value.trim();
      if (!projectDir) {
        alert('请输入 Wrangler 项目目录');
        return;
      }
      if (!cmd) {
        alert('请选择 Wrangler 命令');
        return;
      }
      // 构建输出目录为可选：wrangler.toml 配了 pages_build_output_dir 或自动探测成功时不填也行，
      // 最终由后端校验并给出明确提示
      const isPages = cmd.startsWith('pages');
      const logEl = document.getElementById('pages-deploy-log');
      const btn = document.getElementById('pages-deploy-btn');
      logEl.classList.remove('hidden');
      logEl.textContent = `正在项目目录执行 wrangler ${cmd}${outDir ? ' ' + outDir : ''} ...`;
      btn.disabled = true;
      btn.classList.add('opacity-50', 'cursor-not-allowed');
      try {
        const result = await callBackend('deploy_pages_wrangler', {
          projectDir,
          cmd,
          outDir,
          extraArgs
        });
        logEl.textContent = result;
      } catch (e) {
        logEl.textContent = '部署失败：' + e;
      } finally {
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    }
    window.deployPagesWrangler = deployPagesWrangler;

    function onWranglerCmdChange() {
      const cmd = document.getElementById('pages-deploy-wrangler-cmd').value;
      const wrap = document.getElementById('pages-deploy-wrangler-outdir-wrap');
      const isPages = cmd.startsWith('pages');
      if (wrap) wrap.classList.toggle('hidden', !isPages);
    }
    window.onWranglerCmdChange = onWranglerCmdChange;

    // ==================== Worker 路由与域名管理 ====================
    async function openWorkerRoutes(name) {
      if (!appState.currentAccount?.account_id || !name) return;
      appState.currentWorkerName = name;
      document.getElementById('worker-routes-name').textContent = name;
      const subdomainHint = document.getElementById('worker-routes-subdomain-hint');
      if (subdomainHint) subdomainHint.textContent = `${name}.<subdomain>.workers.dev`;
      if (!appState.zones || appState.zones.length === 0) {
        await loadZones();
      }
      populateWorkerRoutesZoneSelect();
      await loadWorkerCustomDomains();
      document.getElementById('modal-worker-routes').classList.remove('hidden');
    }
    window.openWorkerRoutes = openWorkerRoutes;

    function closeWorkerRoutes() {
      document.getElementById('modal-worker-routes').classList.add('hidden');
      appState.currentWorkerName = null;
    }
    window.closeWorkerRoutes = closeWorkerRoutes;

    function populateWorkerRoutesZoneSelect() {
      const routeSelect = document.getElementById('worker-routes-zone-select');
      const domainSelect = document.getElementById('worker-routes-domain-zone-select');
      const options = (appState.zones || []).map(z => `<option value="${escapeHtml(z.id)}">${escapeHtml(z.name)}</option>`).join('');
      if (routeSelect) routeSelect.innerHTML = '<option value="">选择 Zone</option>' + options;
      if (domainSelect) domainSelect.innerHTML = '<option value="">选择 Zone</option>' + options;
    }

    async function loadWorkerCustomDomains() {
      const name = appState.currentWorkerName;
      const accountId = appState.currentAccount?.account_id;
      const container = document.getElementById('worker-routes-custom-domain-list');
      if (!container || !accountId || !name) return;
      container.innerHTML = '<tr><td colspan="4" class="px-4 py-6 text-center text-slate-500 text-sm">加载中...</td></tr>';
      try {
        const result = await cfRequest('GET', `/accounts/${accountId}/workers/domains`);
        if (!result.success) throw new Error(result.errors[0]?.message || '加载失败');
        appState.workerCustomDomains = (result.result || []).filter(d => d.service === name);
        renderWorkerCustomDomains();
      } catch (e) {
        container.innerHTML = `<tr><td colspan="4" class="px-4 py-6 text-center text-red-400 text-sm">加载失败：${escapeHtml(String(e))}</td></tr>`;
      }
    }

    function renderWorkerCustomDomains() {
      const container = document.getElementById('worker-routes-custom-domain-list');
      if (!container) return;
      const domains = appState.workerCustomDomains || [];
      if (domains.length === 0) {
        container.innerHTML = '<tr><td colspan="4" class="px-4 py-6 text-center text-slate-500 text-sm">暂无自定义域名</td></tr>';
        return;
      }
      container.innerHTML = domains.map(d => `
        <tr>
          <td class="px-4 py-3 font-mono text-xs">${escapeHtml(d.hostname || '')}</td>
          <td class="px-4 py-3 text-xs text-slate-400">${escapeHtml(d.zone_name || '-')}</td>
          <td class="px-4 py-3 text-xs text-slate-400">${escapeHtml(d.status || 'active')}</td>
          <td class="px-4 py-3 text-right">
            <button onclick="deleteWorkerDomain('${escapeHtml(d.id || '')}')" class="text-red-400 hover:underline text-xs">删除</button>
          </td>
        </tr>
      `).join('');
    }
    window.renderWorkerCustomDomains = renderWorkerCustomDomains;

    async function toggleWorkerSubdomain(enabled) {
      const name = appState.currentWorkerName;
      const accountId = appState.currentAccount?.account_id;
      if (!accountId || !name) return;
      try {
        let result;
        try {
          result = await cfRequest('POST', `/accounts/${accountId}/workers/scripts/${encodeURIComponent(name)}/subdomain`, { enabled });
        } catch (e1) {
          // 回退到 services/environment 端点
          result = await cfRequest('POST', `/accounts/${accountId}/workers/services/${encodeURIComponent(name)}/environments/production/subdomain`, { enabled });
        }
        if (!result.success) throw new Error(result.errors[0]?.message || '操作失败');
        alert(enabled ? '已启用 workers.dev 子域名' : '已禁用 workers.dev 子域名');
      } catch (e) {
        alert('设置失败：' + e);
      }
    }
    window.toggleWorkerSubdomain = toggleWorkerSubdomain;

    async function addWorkerDomain() {
      const name = appState.currentWorkerName;
      const accountId = appState.currentAccount?.account_id;
      const zoneSelect = document.getElementById('worker-routes-domain-zone-select');
      const zoneId = zoneSelect?.value;
      const input = document.getElementById('worker-routes-custom-domain-hostname');
      const hostname = input?.value.trim();
      if (!accountId || !name || !hostname || !zoneId) {
        alert('请选择 Zone 并输入域名');
        return;
      }
      try {
        const result = await cfRequest('PUT', `/accounts/${accountId}/workers/domains`, {
          hostname,
          service: name,
          zone_id: zoneId,
          environment: 'production'
        });
        if (!result.success) throw new Error(result.errors[0]?.message || '添加失败');
        input.value = '';
        await loadWorkerCustomDomains();
      } catch (e) {
        alert('添加失败：' + e);
      }
    }
    window.addWorkerDomain = addWorkerDomain;

    async function deleteWorkerDomain(domainId) {
      const accountId = appState.currentAccount?.account_id;
      if (!accountId || !domainId) return;
      if (!confirm('确定要删除这个自定义域名吗？')) return;
      try {
        const result = await cfRequest('DELETE', `/accounts/${accountId}/workers/domains/${encodeURIComponent(domainId)}`);
        if (!result.success) throw new Error(result.errors[0]?.message || '删除失败');
        await loadWorkerCustomDomains();
      } catch (e) {
        alert('删除失败：' + e);
      }
    }
    window.deleteWorkerDomain = deleteWorkerDomain;

    async function onWorkerRouteZoneChange() {
      const zoneId = document.getElementById('worker-routes-zone-select')?.value;
      const container = document.getElementById('worker-routes-route-list');
      if (!container) return;
      if (!zoneId) {
        container.innerHTML = '<tr><td colspan="3" class="px-4 py-6 text-center text-slate-500 text-sm">请先选择 Zone</td></tr>';
        return;
      }
      container.innerHTML = '<tr><td colspan="3" class="px-4 py-6 text-center text-slate-500 text-sm">加载中...</td></tr>';
      try {
        const result = await cfRequest('GET', `/zones/${encodeURIComponent(zoneId)}/workers/routes`);
        if (!result.success) throw new Error(result.errors[0]?.message || '加载失败');
        appState.workerRoutes = (result.result || []).filter(r => r.script === appState.currentWorkerName);
        renderWorkerRoutes(zoneId);
      } catch (e) {
        container.innerHTML = `<tr><td colspan="3" class="px-4 py-6 text-center text-red-400 text-sm">加载失败：${escapeHtml(String(e))}</td></tr>`;
      }
    }
    window.onWorkerRouteZoneChange = onWorkerRouteZoneChange;

    function renderWorkerRoutes(zoneId) {
      const container = document.getElementById('worker-routes-route-list');
      if (!container) return;
      const routes = appState.workerRoutes || [];
      if (routes.length === 0) {
        container.innerHTML = '<tr><td colspan="3" class="px-4 py-6 text-center text-slate-500 text-sm">该 Zone 下暂无绑定到当前 Worker 的 Route</td></tr>';
        return;
      }
      container.innerHTML = routes.map(r => `
        <tr>
          <td class="px-4 py-3 font-mono text-xs">${escapeHtml(r.pattern || '')}</td>
          <td class="px-4 py-3 text-xs text-slate-400">${escapeHtml(r.script || '')}</td>
          <td class="px-4 py-3 text-right">
            <button onclick="deleteWorkerRoute('${escapeHtml(zoneId)}', '${escapeHtml(r.id || '')}')" class="text-red-400 hover:underline text-xs">删除</button>
          </td>
        </tr>
      `).join('');
    }
    window.renderWorkerRoutes = renderWorkerRoutes;

    async function addWorkerRoute() {
      const zoneId = document.getElementById('worker-routes-zone-select')?.value;
      const pattern = document.getElementById('worker-routes-route-pattern')?.value.trim();
      const script = appState.currentWorkerName;
      if (!zoneId || !pattern || !script) {
        alert('请选择 Zone 并输入 Pattern');
        return;
      }
      try {
        const result = await cfRequest('POST', `/zones/${encodeURIComponent(zoneId)}/workers/routes`, { pattern, script });
        if (!result.success) throw new Error(result.errors[0]?.message || '添加失败');
        document.getElementById('worker-routes-route-pattern').value = '';
        await onWorkerRouteZoneChange();
      } catch (e) {
        alert('添加 Route 失败：' + e);
      }
    }
    window.addWorkerRoute = addWorkerRoute;

    async function deleteWorkerRoute(zoneId, routeId) {
      if (!zoneId || !routeId) return;
      if (!confirm('确定要删除这条 Route 吗？')) return;
      try {
        const result = await cfRequest('DELETE', `/zones/${encodeURIComponent(zoneId)}/workers/routes/${encodeURIComponent(routeId)}`);
        if (!result.success) throw new Error(result.errors[0]?.message || '删除失败');
        await onWorkerRouteZoneChange();
      } catch (e) {
        alert('删除失败：' + e);
      }
    }
    window.deleteWorkerRoute = deleteWorkerRoute;

    // ==================== Pages 自定义域名管理 ====================
    async function openPagesDomains(projectName) {
      if (!appState.currentAccount?.account_id || !projectName) return;
      appState.currentPagesProject = projectName;
      document.getElementById('pages-domains-project').textContent = projectName;
      await loadPagesDomains();
      document.getElementById('modal-pages-domains').classList.remove('hidden');
    }
    window.openPagesDomains = openPagesDomains;

    function closePagesDomains() {
      document.getElementById('modal-pages-domains').classList.add('hidden');
      appState.currentPagesProject = null;
    }
    window.closePagesDomains = closePagesDomains;

    async function loadPagesDomains() {
      const projectName = appState.currentPagesProject;
      const accountId = appState.currentAccount?.account_id;
      const container = document.getElementById('pages-domains-list');
      if (!container || !accountId || !projectName) return;
      container.innerHTML = '<tr><td colspan="4" class="px-4 py-6 text-center text-slate-500 text-sm">加载中...</td></tr>';
      try {
        const result = await cfRequest('GET', `/accounts/${accountId}/pages/projects/${encodeURIComponent(projectName)}/domains`);
        if (!result.success) throw new Error(result.errors[0]?.message || '加载失败');
        appState.pagesDomains = result.result || [];
        renderPagesDomains();
      } catch (e) {
        container.innerHTML = `<tr><td colspan="4" class="px-4 py-6 text-center text-red-400 text-sm">加载失败：${escapeHtml(String(e))}</td></tr>`;
      }
    }

    function renderPagesDomains() {
      const container = document.getElementById('pages-domains-list');
      if (!container) return;
      const domains = appState.pagesDomains || [];
      if (domains.length === 0) {
        container.innerHTML = '<tr><td colspan="4" class="px-4 py-6 text-center text-slate-500 text-sm">暂无自定义域名</td></tr>';
        return;
      }
      container.innerHTML = domains.map(d => {
        const validation = d.validation_data || {};
        return `
          <tr>
            <td class="px-4 py-3 font-mono text-xs">${escapeHtml(d.name || '')}</td>
            <td class="px-4 py-3 text-xs text-slate-400">${escapeHtml(d.status || '-')}</td>
            <td class="px-4 py-3 text-xs text-slate-400">${escapeHtml(validation.method || '-')}</td>
            <td class="px-4 py-3 text-right">
              <button onclick="retryPagesDomain('${escapeHtml(d.name || '')}')" class="text-cf-blue hover:underline text-xs mr-2">重新验证</button>
              <button onclick="deletePagesDomain('${escapeHtml(d.name || '')}')" class="text-red-400 hover:underline text-xs">删除</button>
            </td>
          </tr>
        `;
      }).join('');
    }
    window.renderPagesDomains = renderPagesDomains;

    async function addPagesDomain() {
      const projectName = appState.currentPagesProject;
      const accountId = appState.currentAccount?.account_id;
      const input = document.getElementById('pages-domain-name');
      const name = input?.value.trim();
      if (!accountId || !projectName || !name) return;
      try {
        const result = await cfRequest('POST', `/accounts/${accountId}/pages/projects/${encodeURIComponent(projectName)}/domains`, { name });
        if (!result.success) throw new Error(result.errors[0]?.message || '添加失败');
        input.value = '';
        await loadPagesDomains();
      } catch (e) {
        alert('添加失败：' + e);
      }
    }
    window.addPagesDomain = addPagesDomain;

    async function deletePagesDomain(domainName) {
      const projectName = appState.currentPagesProject;
      const accountId = appState.currentAccount?.account_id;
      if (!accountId || !projectName || !domainName) return;
      if (!confirm(`确定要删除域名 "${domainName}" 吗？`)) return;
      try {
        const result = await cfRequest('DELETE', `/accounts/${accountId}/pages/projects/${encodeURIComponent(projectName)}/domains/${encodeURIComponent(domainName)}`);
        if (!result.success) throw new Error(result.errors[0]?.message || '删除失败');
        await loadPagesDomains();
      } catch (e) {
        alert('删除失败：' + e);
      }
    }
    window.deletePagesDomain = deletePagesDomain;

    async function retryPagesDomain(domainName) {
      const projectName = appState.currentPagesProject;
      const accountId = appState.currentAccount?.account_id;
      if (!accountId || !projectName || !domainName) return;
      try {
        const result = await cfRequest('PATCH', `/accounts/${accountId}/pages/projects/${encodeURIComponent(projectName)}/domains/${encodeURIComponent(domainName)}`);
        if (!result.success) throw new Error(result.errors[0]?.message || '重新验证失败');
        alert('已发起重新验证');
        await loadPagesDomains();
      } catch (e) {
        alert('重新验证失败：' + e);
      }
    }
    window.retryPagesDomain = retryPagesDomain;

    async function loadR2Buckets() {
      if (!appState.currentAccount?.account_id) {
        renderR2Buckets([]);
        return;
      }
      try {
        const result = await cfRequest('GET', `/accounts/${appState.currentAccount.account_id}/r2/buckets`);
        appState.r2Buckets = result.success ? (result.result || []) : [];
        renderR2Buckets();
      } catch (e) {
        console.error('R2 load failed:', e);
        renderR2Buckets([]);
      }
    }

    function renderR2Buckets() {
      const container = document.getElementById('r2-list');
      if (!container) return;
      const buckets = appState.r2Buckets || [];
      if (buckets.length === 0) {
        container.innerHTML = '<div class=\"col-span-full p-8 text-center text-slate-500\">暂无 R2 Bucket</div>';
        return;
      }
      container.innerHTML = buckets.map(b => `
        <div class=\"card glass rounded-2xl p-5\">
          <div class=\"flex items-center gap-3 mb-4\">
            <div class=\"w-10 h-10 rounded-lg bg-cf-blue/10 text-cf-blue flex items-center justify-center\">
              <svg class=\"w-5 h-5\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4\"></path></svg>
            </div>
            <div>
              <div class=\"font-medium\">${escapeHtml(b.name || '')}</div>
              <div class=\"text-xs text-slate-500\">${escapeHtml(b.location || 'ENAM')}</div>
            </div>
          </div>
          <div class=\"flex gap-2\">
            <button class=\"flex-1 py-2 rounded-lg bg-cf-blue/10 text-cf-blue text-xs hover:bg-cf-blue/20\">浏览文件</button>
            <button onclick=\"deleteR2Bucket('${escapeHtml(b.name || '')}')\" class=\"py-2 px-3 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20\">删除</button>
          </div>
        </div>
      `).join('');
    }

    async function createR2Bucket() {
      const name = prompt('请输入 R2 Bucket 名称（仅小写字母、数字、连字符）：');
      if (!name || !appState.currentAccount?.account_id) return;
      try {
        await cfRequest('POST', `/accounts/${appState.currentAccount.account_id}/r2/buckets`, { name });
        await loadR2Buckets();
      } catch (e) {
        console.error('create R2 bucket failed:', e);
        alert('创建失败: ' + e);
      }
    }
    window.createR2Bucket = createR2Bucket;

    async function deleteR2Bucket(name) {
      if (!appState.currentAccount?.account_id || !name) return;
      if (!confirm(`确定要删除 Bucket "${name}" 吗？\nBucket 中的所有文件都会被删除，此操作不可恢复。`)) return;
      try {
        await cfRequest('DELETE', `/accounts/${appState.currentAccount.account_id}/r2/buckets/${encodeURIComponent(name)}`);
        await loadR2Buckets();
      } catch (e) {
        console.error('delete R2 bucket failed:', e);
        alert('删除失败: ' + e);
      }
    }
    window.deleteR2Bucket = deleteR2Bucket;

    async function loadKvNamespaces() {
      if (!appState.currentAccount?.account_id) {
        renderKvNamespaces([]);
        return;
      }
      try {
        const result = await cfRequest('GET', `/accounts/${appState.currentAccount.account_id}/storage/kv/namespaces`);
        appState.kvNamespaces = result.success ? (result.result || []) : [];
        renderKvNamespaces();
      } catch (e) {
        console.error('KV load failed:', e);
        renderKvNamespaces([]);
      }
    }

    function renderKvNamespaces() {
      const container = document.getElementById('kv-ns-list');
      if (!container) return;
      const namespaces = appState.kvNamespaces || [];
      if (namespaces.length === 0) {
        container.innerHTML = '<div class=\"p-4 text-center text-slate-500 text-sm\">暂无 KV 命名空间</div>';
        return;
      }
      container.innerHTML = namespaces.map((ns, idx) => `
        <div class=\"kv-ns-item group cursor-pointer p-3 rounded-xl ${idx === 0 ? 'bg-cf-orange/10 border border-cf-orange/20' : 'bg-slate-100/50 dark:bg-slate-800/50 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'} transition-colors\">
          <div onclick=\"selectKvNs('${ns.id}')\">
            <div class=\"font-medium\">${escapeHtml(ns.title || ns.id)}</div>
            <div class=\"text-xs text-slate-500 mt-1\">ID: ${escapeHtml(ns.id)}</div>
          </div>
          <div class=\"flex justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity\">
            <button onclick=\"deleteKvNamespace('${ns.id}', event)\" class=\"text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10\">删除</button>
          </div>
        </div>
      `).join('');
    }

    async function loadD1Databases() {
      if (!appState.currentAccount?.account_id) {
        renderD1Databases([]);
        return;
      }
      try {
        const result = await cfRequest('GET', `/accounts/${appState.currentAccount.account_id}/d1/database`);
        appState.d1Databases = result.success ? (result.result || []) : [];
        renderD1Databases();
      } catch (e) {
        console.error('D1 load failed:', e);
        renderD1Databases([]);
      }
    }

    function renderD1Databases() {
      const container = document.getElementById('d1-db-list');
      if (!container) return;
      const dbs = appState.d1Databases || [];
      if (dbs.length === 0) {
        container.innerHTML = '<div class=\"p-4 text-center text-slate-500 text-sm\">暂无 D1 数据库</div>';
        return;
      }
      container.innerHTML = dbs.map((db, idx) => `
        <div class=\"d1-db-item group cursor-pointer p-3 rounded-xl ${idx === 0 ? 'bg-cf-orange/10 border border-cf-orange/20' : 'bg-slate-100/50 dark:bg-slate-800/50 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'} transition-colors\">
          <div onclick=\"selectD1Db('${db.uuid}')\">
            <div class=\"font-medium\">${escapeHtml(db.name || db.uuid)}</div>
            <div class=\"text-xs text-slate-500 mt-1\">${escapeHtml(db.uuid)}</div>
          </div>
          <div class=\"flex justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity\">
            <button onclick=\"deleteD1Database('${db.uuid}', '${escapeHtml(db.name || db.uuid)}', event)\" class=\"text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10\">删除</button>
          </div>
        </div>
      `).join('');
    }

    async function loadTunnels() {
      if (!appState.currentAccount?.account_id) {
        renderTunnels([]);
        return;
      }
      try {
        const result = await cfRequest('GET', `/accounts/${appState.currentAccount.account_id}/cfd_tunnel`);
        appState.tunnels = result.success ? (result.result || []) : [];
        renderTunnels();
      } catch (e) {
        console.error('Tunnels load failed:', e);
        renderTunnels([]);
      }
    }

    function renderTunnels() {
      const tbody = document.getElementById('tunnels-tbody');
      if (!tbody) return;
      const tunnels = appState.tunnels || [];
      if (tunnels.length === 0) {
        tbody.innerHTML = '<tr><td colspan=\"5\" class=\"px-5 py-8 text-center text-slate-500\">暂无 Tunnel</td></tr>';
        return;
      }
      tbody.innerHTML = tunnels.map(t => {
        const status = t.status || 'unknown';
        const statusClass = status === 'healthy' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500';
        return `
          <tr class=\"hover:bg-slate-100/30 dark:hover:bg-slate-800/30 transition-colors\">
            <td class=\"px-5 py-4 font-medium\">${escapeHtml(t.name || '')}</td>
            <td class=\"px-5 py-4 text-slate-400\">${t.connections ? t.connections.length + ' online' : '-'}</td>
            <td class=\"px-5 py-4 text-slate-400\">-</td>
            <td class=\"px-5 py-4\"><span class=\"px-2 py-1 rounded-full text-xs ${statusClass}\">${escapeHtml(status)}</span></td>
            <td class=\"px-5 py-4\">
              <button class=\"text-cf-blue hover:underline text-xs mr-3\">配置</button>
            </td>
          </tr>
        `;
      }).join('');
    }

    async function loadFirewallRules() {
      const tbody = document.getElementById('firewall-tbody');
      if (tbody) tbody.innerHTML = tableLoadingRow(5);
      const zoneId = await ensureZoneForPage('firewall-zone-select');
      if (!zoneId) {
        if (tbody) tbody.innerHTML = tableEmptyRow(5, '请先选择域名');
        return;
      }
      try {
        // 优先使用 Rulesets API（WAF Custom Rules）
        const ruleset = await cfGetRulesetEntrypoint(`/zones/${zoneId}`, 'http_request_firewall_custom');
        if (ruleset && Array.isArray(ruleset.rules)) {
          appState.firewallRules = ruleset.rules.map(r => ({ ...r, _ruleset_id: ruleset.id }));
        } else {
          // 回退：旧版 Firewall Rules API
          const result = await cfRequest('GET', `/zones/${zoneId}/firewall/rules`);
          appState.firewallRules = (result.success ? (result.result || []) : []).map(r => ({ ...r, _legacy: true }));
        }
      } catch (e) {
        console.error('Firewall load failed:', e);
        appState.firewallRules = [];
      }
      renderFirewallRules();
    }

    function onFirewallZoneChange() {
      handleZoneSelectChange('firewall-zone-select');
      loadFirewallRules();
      loadFirewallStats();
    }
    window.onFirewallZoneChange = onFirewallZoneChange;

    async function loadFirewallStats() {
      const threatEl = document.getElementById('fw-threat-count');
      const ruleEl = document.getElementById('fw-rule-count');
      const ipRuleEl = document.getElementById('fw-ip-rule-count');
      
      if (!appState.currentZone) {
        if (threatEl) threatEl.textContent = '-';
        if (ruleEl) ruleEl.textContent = '-';
        if (ipRuleEl) ipRuleEl.textContent = '-';
        return;
      }
      
      try {
        // Count firewall rules
        if (ruleEl) ruleEl.textContent = (appState.firewallRules || []).length;
        
        // Load IP access rules
        const ipResult = await cfRequest('GET', `/zones/${appState.currentZone.id}/firewall/access_rules/rules`);
        if (ipRuleEl) ipRuleEl.textContent = ipResult.success ? (ipResult.result || []).length : '-';
        
        // Load threat count from GraphQL（旧 REST /analytics/dashboard 已弃用）
        if (threatEl) {
          threatEl.textContent = '-';
          try {
            const until = new Date();
            const since = new Date(until.getTime() - 86400 * 1000);
            const query = `query ZoneThreats($zoneTag: String!, $since: Time!, $until: Time!) {
              viewer {
                zones(filter: { zoneTag: $zoneTag }) {
                  httpRequestsAdaptiveGroups(limit: 10000, filter: { datetime_geq: $since, datetime_leq: $until }) {
                    sum { threats }
                  }
                }
              }
            }`;
            const data = await cfGraphQL(query, {
              zoneTag: appState.currentZone.id,
              since: since.toISOString(),
              until: until.toISOString()
            });
            const zones = data?.viewer?.zones || [];
            let threats = 0;
            zones.forEach(z => {
              (z.httpRequestsAdaptiveGroups || []).forEach(g => { threats += (g.sum && g.sum.threats) || 0; });
            });
            threatEl.textContent = threats.toLocaleString();
          } catch (e2) {
            console.warn('Threat count GraphQL failed:', e2);
          }
        }
      } catch (e) {
        console.error('Firewall stats load failed:', e);
      }
    }

    function renderFirewallRules() {
      const tbody = document.getElementById('firewall-tbody');
      if (!tbody) return;
      const rules = appState.firewallRules || [];
      if (rules.length === 0) {
        tbody.innerHTML = '<tr><td colspan=\"5\" class=\"px-5 py-8 text-center text-slate-500\">暂无防火墙规则</td></tr>';
        return;
      }
      tbody.innerHTML = rules.map(r => {
        const action = r.action || '-';
        const actionClass = action === 'block' ? 'bg-red-500/10 text-red-500' : (action === 'managed_challenge' || action === 'challenge' || action === 'js_challenge') ? 'bg-yellow-500/10 text-yellow-500' : 'bg-green-500/10 text-green-500';
        const enabled = r.enabled !== false && !r.paused;
        const statusClass = enabled ? 'bg-green-500/10 text-green-500' : 'bg-slate-500/10 text-slate-400';
        return `
          <tr class=\"hover:bg-slate-100/30 dark:hover:bg-slate-800/30 transition-colors\">
            <td class=\"px-5 py-4 font-medium\">${escapeHtml(r.description || '未命名规则')}</td>
            <td class=\"px-5 py-4 text-slate-400 truncate max-w-xs font-mono text-xs\">${escapeHtml(r.expression || '')}</td>
            <td class=\"px-5 py-4\"><span class=\"px-2 py-1 rounded-full text-xs ${actionClass}\">${escapeHtml(action)}</span></td>
            <td class=\"px-5 py-4\"><span class=\"px-2 py-1 rounded-full text-xs ${statusClass}\">${enabled ? '启用' : '暂停'}</span></td>
            <td class=\"px-5 py-4\">
              ${renderEnabledToggle(`toggleFirewallRule('${jsArg(r.id)}', ${!enabled})`, enabled)}
              <button onclick=\"deleteFirewallRule('${jsArg(r.id)}')\" class=\"text-red-400 hover:underline text-xs ml-3\">删除</button>
            </td>
          </tr>
        `;
      }).join('');
    }

    async function addFirewallRule() {
      const zoneId = appState.currentZone && appState.currentZone.id;
      if (!zoneId) { alert('请先选择一个域名'); return; }
      const description = prompt('规则描述：', '新的防火墙规则');
      if (description === null) return;
      const expression = prompt('匹配表达式（WAF 表达式）：', '(ip.src eq 1.2.3.4)');
      if (expression === null) return;
      const action = prompt('动作（block / challenge / js_challenge / managed_challenge / log）：', 'block');
      if (action === null) return;
      const body = { description, expression, action: action.trim() };
      try {
        const ruleset = await cfGetRulesetEntrypoint(`/zones/${zoneId}`, 'http_request_firewall_custom');
        await cfAddRulesetRule(`/zones/${zoneId}`, 'http_request_firewall_custom', ruleset, body);
        await loadFirewallRules();
        await loadFirewallStats();
      } catch (e) {
        alert('添加失败: ' + e);
      }
    }
    window.addFirewallRule = addFirewallRule;

    async function toggleFirewallRule(ruleId, enabled) {
      const zoneId = appState.currentZone && appState.currentZone.id;
      const rule = (appState.firewallRules || []).find(r => r.id === ruleId);
      if (!zoneId || !rule) return;
      try {
        if (rule._ruleset_id) {
          const result = await cfRequest('PATCH', `/zones/${zoneId}/rulesets/${rule._ruleset_id}/rules/${ruleId}`, { enabled });
          if (!result.success) { alert(cfRuleError(result)); return; }
        } else {
          const result = await cfRequest('PATCH', `/zones/${zoneId}/firewall/rules/${ruleId}`, { paused: !enabled });
          if (!result.success) { alert(cfRuleError(result)); return; }
        }
        await loadFirewallRules();
        await loadFirewallStats();
      } catch (e) {
        alert('切换状态失败: ' + e);
      }
    }
    window.toggleFirewallRule = toggleFirewallRule;

    async function deleteFirewallRule(ruleId) {
      const zoneId = appState.currentZone && appState.currentZone.id;
      const rule = (appState.firewallRules || []).find(r => r.id === ruleId);
      if (!zoneId || !rule) return;
      if (!confirm('确定要删除这条防火墙规则吗？')) return;
      try {
        if (rule._ruleset_id) {
          const result = await cfRequest('DELETE', `/zones/${zoneId}/rulesets/${rule._ruleset_id}/rules/${ruleId}`);
          if (!result.success) { alert(cfRuleError(result)); return; }
        } else {
          const result = await cfRequest('DELETE', `/zones/${zoneId}/firewall/rules/${ruleId}`);
          if (!result.success) { alert(cfRuleError(result)); return; }
        }
        await loadFirewallRules();
        await loadFirewallStats();
      } catch (e) {
        alert('删除失败: ' + e);
      }
    }
    window.deleteFirewallRule = deleteFirewallRule;

    // 侧边栏折叠
    let sidebarCollapsed = false;
    function toggleSidebar() {
      sidebarCollapsed = !sidebarCollapsed;
      const sidebar = document.getElementById('sidebar');
      const icon = document.getElementById('sidebar-toggle-icon');
      if (sidebarCollapsed) {
        sidebar.classList.add('sidebar-collapsed');
        icon.style.transform = 'rotate(180deg)';
      } else {
        sidebar.classList.remove('sidebar-collapsed');
        icon.style.transform = 'rotate(0deg)';
      }
    }

    // KV / D1 标签切换
    function switchKvD1Tab(tab) {
      const kvBtn = document.getElementById('btn-tab-kv');
      const d1Btn = document.getElementById('btn-tab-d1');
      const kvView = document.getElementById('kvd1-kv-view');
      const d1View = document.getElementById('kvd1-d1-view');
      if (tab === 'kv') {
        kvBtn.classList.add('bg-cf-orange', 'text-white', 'shadow-lg', 'shadow-cf-orange/25');
        kvBtn.classList.remove('border', 'border-slate-200', 'dark:border-slate-700', 'hover:bg-slate-100', 'dark:hover:bg-slate-800');
        d1Btn.classList.remove('bg-cf-orange', 'text-white', 'shadow-lg', 'shadow-cf-orange/25');
        d1Btn.classList.add('border', 'border-slate-200', 'dark:border-slate-700', 'hover:bg-slate-100', 'dark:hover:bg-slate-800');
        kvView.classList.remove('hidden');
        d1View.classList.add('hidden');
      } else {
        d1Btn.classList.add('bg-cf-orange', 'text-white', 'shadow-lg', 'shadow-cf-orange/25');
        d1Btn.classList.remove('border', 'border-slate-200', 'dark:border-slate-700', 'hover:bg-slate-100', 'dark:hover:bg-slate-800');
        kvBtn.classList.remove('bg-cf-orange', 'text-white', 'shadow-lg', 'shadow-cf-orange/25');
        kvBtn.classList.add('border', 'border-slate-200', 'dark:border-slate-700', 'hover:bg-slate-100', 'dark:hover:bg-slate-800');
        d1View.classList.remove('hidden');
        kvView.classList.add('hidden');
      }
    }

    async function selectKvNs(id) {
      const ns = appState.kvNamespaces.find(n => n.id === id);
      if (!ns) return;
      appState.currentKvNamespace = ns;
      
      document.querySelectorAll('.kv-ns-item').forEach(el => {
        el.classList.remove('bg-cf-orange/10', 'border', 'border-cf-orange/20');
        el.classList.add('bg-slate-100/50', 'dark:bg-slate-800/50');
      });
      if (event && event.currentTarget) {
        event.currentTarget.classList.remove('bg-slate-100/50', 'dark:bg-slate-800/50');
        event.currentTarget.classList.add('bg-cf-orange/10', 'border', 'border-cf-orange/20');
      }
      document.querySelector('#kvd1-kv-view h3.font-semibold').textContent = ns.title || ns.id;
      
      await loadKvKeys(ns.id);
    }

    async function loadKvKeys(namespaceId) {
      const tbody = document.getElementById('kv-keys-tbody');
      if (!tbody) return;
      tbody.innerHTML = '<tr><td colspan="5" class="px-5 py-8 text-center text-slate-500">加载中...</td></tr>';
      
      try {
        const result = await cfRequest('GET', `/accounts/${appState.currentAccount.account_id}/storage/kv/namespaces/${namespaceId}/keys`);
        appState.kvKeys = result.success ? (result.result || []) : [];
        
        // 异步获取前 10 个 key 的 value 预览
        const previewCount = Math.min(appState.kvKeys.length, 10);
        for (let i = 0; i < previewCount; i++) {
          try {
            const v = await cfRequestText('GET', `/accounts/${appState.currentAccount.account_id}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(appState.kvKeys[i].name)}`);
            const preview = String(v || '').substring(0, 60);
            appState.kvKeys[i].value_preview = preview + (v.length > 60 ? '...' : '');
          } catch (e) {
            appState.kvKeys[i].value_preview = '(无法读取)';
          }
        }
        renderKvKeys();
      } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-5 py-8 text-center text-slate-500">加载失败</td></tr>';
      }
    }

    function renderKvKeys() {
      const tbody = document.getElementById('kv-keys-tbody');
      if (!tbody) return;
      const keys = appState.kvKeys || [];
      if (keys.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-5 py-8 text-center text-slate-500">暂无键值</td></tr>';
        return;
      }
      tbody.innerHTML = keys.map(k => `
        <tr class="hover:bg-slate-100/30 dark:hover:bg-slate-800/30 transition-colors">
          <td class="px-4 py-3 font-mono text-xs break-all">${escapeHtml(k.name || '')}</td>
          <td class="px-4 py-3 text-slate-400 text-xs truncate max-w-[200px]">${escapeHtml(k.value_preview || '-')}</td>
          <td class="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">${k.expiration ? new Date(k.expiration * 1000).toLocaleString() : '永久'}</td>
          <td class="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">${k.metadata ? JSON.stringify(k.metadata).length + ' B' : '-'}</td>
          <td class="px-4 py-3">
            <button onclick="editKvKey('${escapeHtml(k.name || '')}')" class="text-cf-blue hover:underline text-xs mr-2">编辑</button>
            <button onclick="deleteKvKey('${escapeHtml(k.name || '')}')" class="text-red-400 hover:underline text-xs">删除</button>
          </td>
        </tr>
      `).join('');
    }

    function openKvEditor(key, value, expiration, metadata) {
      document.getElementById('kv-edit-key').value = key;
      document.getElementById('kv-edit-value').value = value;
      const ttlInput = document.getElementById('kv-edit-ttl');
      const metadataInput = document.getElementById('kv-edit-metadata');
      if (ttlInput) {
        const remaining = expiration ? Math.max(0, Math.floor(expiration - Date.now() / 1000)) : '';
        ttlInput.value = remaining;
      }
      if (metadataInput) {
        metadataInput.value = metadata ? JSON.stringify(metadata) : '';
      }
      document.getElementById('modal-kv-editor').classList.remove('hidden');
    }

    function closeKvEditor() {
      document.getElementById('modal-kv-editor').classList.add('hidden');
    }

    async function createKvNamespace() {
      const title = prompt('请输入 KV 命名空间名称：');
      if (!title || !appState.currentAccount?.account_id) return;
      try {
        await cfRequest('POST', `/accounts/${appState.currentAccount.account_id}/storage/kv/namespaces`, { title });
        await loadKvNamespaces();
      } catch (e) {
        console.error('create KV namespace failed:', e);
        alert('创建失败: ' + e);
      }
    }
    window.createKvNamespace = createKvNamespace;

    async function deleteKvNamespace(id, event) {
      if (event) event.stopPropagation();
      if (!confirm('确定要删除这个 KV 命名空间吗？\n里面的所有键值都会被删除，此操作不可恢复。')) return;
      try {
        await cfRequest('DELETE', `/accounts/${appState.currentAccount.account_id}/storage/kv/namespaces/${id}`);
        appState.currentKvNamespace = null;
        await loadKvNamespaces();
        document.getElementById('kv-keys-tbody').innerHTML = '<tr><td colspan="5" class="px-5 py-8 text-center text-slate-500">请选择一个命名空间</td></tr>';
      } catch (e) {
        console.error('delete KV namespace failed:', e);
        alert('删除失败: ' + e);
      }
    }
    window.deleteKvNamespace = deleteKvNamespace;

    async function editKvKey(key) {
      if (!appState.currentKvNamespace) return;
      let value = '';
      try {
        value = await cfRequestText('GET', `/accounts/${appState.currentAccount.account_id}/storage/kv/namespaces/${appState.currentKvNamespace.id}/values/${encodeURIComponent(key)}`);
      } catch (e) {
        console.error('load KV value failed:', e);
      }
      const meta = appState.kvKeys?.find(k => k.name === key);
      openKvEditor(key, value, meta?.expiration, meta?.metadata);
    }
    window.editKvKey = editKvKey;

    async function saveKvValue() {
      if (!appState.currentKvNamespace) {
        alert('请先选择一个 KV 命名空间');
        return;
      }
      const key = document.getElementById('kv-edit-key').value.trim();
      const value = document.getElementById('kv-edit-value').value;
      const ttlInput = document.getElementById('kv-edit-ttl').value;
      const metadataInput = document.getElementById('kv-edit-metadata').value;
      if (!key) {
        alert('Key 不能为空');
        return;
      }
      
      try {
        const query = [];
        if (ttlInput) query.push(`expiration_ttl=${ttlInput}`);
        let metadata = null;
        if (metadataInput) {
          try { metadata = JSON.parse(metadataInput); } catch (e) { alert('Metadata 必须是合法 JSON'); return; }
        }
        if (metadata) query.push(`metadata=${encodeURIComponent(JSON.stringify(metadata))}`);
        const queryStr = query.length > 0 ? '?' + query.join('&') : '';
        
        await cfRequestText('PUT', `/accounts/${appState.currentAccount.account_id}/storage/kv/namespaces/${appState.currentKvNamespace.id}/values/${encodeURIComponent(key)}${queryStr}`, value, 'text/plain');
        closeKvEditor();
        await loadKvKeys(appState.currentKvNamespace.id);
      } catch (e) {
        console.error('save KV value failed:', e);
        alert('保存失败: ' + e);
      }
    }
    window.saveKvValue = saveKvValue;

    async function deleteKvKey(key) {
      if (!appState.currentKvNamespace) return;
      if (!confirm(`确定要删除 Key "${key}" 吗？`)) return;
      try {
        await cfRequest('DELETE', `/accounts/${appState.currentAccount.account_id}/storage/kv/namespaces/${appState.currentKvNamespace.id}/values/${encodeURIComponent(key)}`);
        await loadKvKeys(appState.currentKvNamespace.id);
      } catch (e) {
        console.error('delete KV key failed:', e);
        alert('删除失败: ' + e);
      }
    }
    window.deleteKvKey = deleteKvKey;

    async function importKvJson() {
      if (!appState.currentKvNamespace) {
        alert('请先选择一个 KV 命名空间');
        return;
      }
      const json = prompt('请输入 JSON 数据（格式：{"key1":"value1","key2":"value2"}）：');
      if (!json) return;
      try {
        const data = JSON.parse(json);
        const entries = Object.entries(data).map(([k, v]) => ({
          key: k,
          value: typeof v === 'string' ? v : JSON.stringify(v)
        }));
        await cfRequest('PUT', `/accounts/${appState.currentAccount.account_id}/storage/kv/namespaces/${appState.currentKvNamespace.id}/bulk`, entries);
        await loadKvKeys(appState.currentKvNamespace.id);
        alert(`成功导入 ${entries.length} 个键值`);
      } catch (e) {
        console.error('import KV JSON failed:', e);
        alert('导入失败: ' + e);
      }
    }
    window.importKvJson = importKvJson;

    async function selectD1Db(uuid) {
      const db = appState.d1Databases.find(d => d.uuid === uuid);
      if (!db) return;
      appState.currentD1Database = db;
      
      document.querySelectorAll('.d1-db-item').forEach(el => {
        el.classList.remove('bg-cf-orange/10', 'border', 'border-cf-orange/20');
        el.classList.add('bg-slate-100/50', 'dark:bg-slate-800/50');
      });
      if (event && event.currentTarget) {
        event.currentTarget.classList.remove('bg-slate-100/50', 'dark:bg-slate-800/50');
        event.currentTarget.classList.add('bg-cf-orange/10', 'border', 'border-cf-orange/20');
      }
      document.querySelector('#kvd1-d1-view h3.font-semibold').textContent = db.name || db.uuid;
      
      await loadD1Tables(db.uuid);
    }

    async function loadD1Tables(uuid) {
      const container = document.getElementById('d1-view-tables');
      if (!container) return;
      container.innerHTML = '<div class="p-4 text-center text-slate-500">加载中...</div>';
      
      try {
        // Cloudflare D1 没有 /tables endpoint，通过 SQL 查询 sqlite_master 获取表名
        const result = await cfRequest('POST', `/accounts/${appState.currentAccount.account_id}/d1/database/${uuid}/query`, { 
          sql: "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name" 
        });
        if (!result.success || !result.result || !result.result[0]) {
          appState.d1Tables = [];
          renderD1Tables();
          return;
        }
        // 获取每个表的列信息（过滤系统表）
        const tables = (result.result[0].results || []).filter(t => {
          const name = t.name || '';
          return !name.startsWith('_') && !name.startsWith('sqlite_');
        });
        const tableInfos = [];
        for (const t of tables) {
          const tableName = t.name;
          try {
            const colResult = await cfRequest('POST', `/accounts/${appState.currentAccount.account_id}/d1/database/${uuid}/query`, { 
              sql: `PRAGMA table_info("${tableName}")` 
            });
            const columns = (colResult.result && colResult.result[0] && colResult.result[0].results) ? colResult.result[0].results : [];
            tableInfos.push({
              name: tableName,
              columns: columns.map(c => ({ name: c.name, type: c.type }))
            });
          } catch (e) {
            tableInfos.push({ name: tableName, columns: [] });
          }
        }
        appState.d1Tables = tableInfos;
        renderD1Tables();
      } catch (e) {
        console.error('load D1 tables failed:', e);
        container.innerHTML = `<div class="p-4 text-center text-slate-500">加载失败: ${escapeHtml(String(e))}</div>`;
      }
    }

    function renderD1Tables() {
      const container = document.getElementById('d1-view-tables');
      if (!container) return;
      const tables = appState.d1Tables || [];
      if (tables.length === 0) {
        container.innerHTML = '<div class="p-8 text-center text-slate-500">暂无表</div>';
        return;
      }
      container.innerHTML = tables.map(t => `
        <div class="p-4 rounded-xl bg-slate-100/50 dark:bg-slate-800/50">
          <div class="flex items-center justify-between mb-2">
            <span class="font-medium">${escapeHtml(t.name || '')}</span>
          </div>
          <div class="text-xs text-slate-400 font-mono">${escapeHtml((t.columns || []).map(c => c.name + ' ' + c.type).join(' | '))}</div>
        </div>
      `).join('');
      
      // 更新数据浏览的表选择器
      const select = document.getElementById('d1-data-table-select');
      if (select) {
        const current = select.value;
        select.innerHTML = '<option value="">选择表</option>' + tables.map(t => `<option value="${escapeHtml(t.name || '')}">${escapeHtml(t.name || '')}</option>`).join('');
        if (current && tables.some(t => t.name === current)) select.value = current;
      }
    }

    async function createD1Database() {
      const name = prompt('请输入 D1 数据库名称：');
      if (!name || !appState.currentAccount?.account_id) return;
      try {
        await cfRequest('POST', `/accounts/${appState.currentAccount.account_id}/d1/database`, { name });
        await loadD1Databases();
      } catch (e) {
        console.error('create D1 database failed:', e);
        alert('创建失败: ' + e);
      }
    }
    window.createD1Database = createD1Database;

    async function deleteD1Database(uuid, name, event) {
      if (event) event.stopPropagation();
      if (!confirm(`确定要删除数据库 "${name}" 吗？\n数据库中的所有表和数据都会被删除，此操作不可恢复。`)) return;
      try {
        await cfRequest('DELETE', `/accounts/${appState.currentAccount.account_id}/d1/database/${uuid}`);
        appState.currentD1Database = null;
        await loadD1Databases();
        document.getElementById('d1-view-tables').innerHTML = '<div class="p-8 text-center text-slate-500 text-sm">请选择一个数据库</div>';
        document.getElementById('d1-query-results').innerHTML = '<div class="text-sm text-slate-500 text-center py-8">执行查询后显示结果</div>';
        document.getElementById('d1-data-tbody').innerHTML = '<tr><td colspan="4" class="px-5 py-8 text-center text-slate-500">请选择一个数据库和表</td></tr>';
      } catch (e) {
        console.error('delete D1 database failed:', e);
        alert('删除失败: ' + e);
      }
    }
    window.deleteD1Database = deleteD1Database;

    async function executeD1Query() {
      if (!appState.currentD1Database) {
        alert('请先选择一个 D1 数据库');
        return;
      }
      const sql = document.querySelector('#d1-view-query textarea').value.trim();
      if (!sql) {
        alert('请输入 SQL 语句');
        return;
      }
      const resultContainer = document.getElementById('d1-query-results');
      resultContainer.innerHTML = '<div class="text-sm text-slate-500 text-center py-8">执行中...</div>';
      try {
        const result = await cfRequest('POST', `/accounts/${appState.currentAccount.account_id}/d1/database/${appState.currentD1Database.uuid}/query`, { sql });
        if (!result.success) {
          resultContainer.innerHTML = `<div class="text-sm text-red-400 p-4">执行失败: ${escapeHtml(JSON.stringify(result.errors))}</div>`;
          return;
        }
        // Cloudflare D1 query result is array of result objects
        const results = Array.isArray(result.result) ? result.result : [result.result];
        let html = '';
        results.forEach((r, idx) => {
          if (r.results && Array.isArray(r.results) && r.results.length > 0) {
            const cols = Object.keys(r.results[0]);
            html += `<div class="mb-4"><div class="text-xs text-slate-500 mb-2">结果 ${idx + 1} (${r.results.length} 行)</div>`;
            html += '<table class="w-full text-xs"><thead class="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300"><tr>' + cols.map(c => `<th class="text-left px-2 py-1">${escapeHtml(c)}</th>`).join('') + '</tr></thead><tbody class="divide-y divide-slate-200 dark:divide-slate-700">';
            html += r.results.map(row => '<tr>' + cols.map(c => `<td class="px-2 py-1 text-slate-700 dark:text-slate-300">${escapeHtml(String(row[c] ?? ''))}</td>`).join('') + '</tr>').join('');
            html += '</tbody></table></div>';
          } else {
            html += `<div class="text-sm text-slate-500 mb-2">结果 ${idx + 1}: ${r.success === false ? '失败' : '成功'} (${r.meta?.rows_read || 0} 行读取, ${r.meta?.rows_written || 0} 行写入)</div>`;
          }
        });
        resultContainer.innerHTML = html || '<div class="text-sm text-slate-500 text-center py-8">执行成功，无返回数据</div>';
        // 刷新表结构和数据
        await loadD1Tables(appState.currentD1Database.uuid);
        if (document.getElementById('d1-data-table-select').value) await loadD1TableData();
      } catch (e) {
        console.error('execute D1 query failed:', e);
        resultContainer.innerHTML = `<div class="text-sm text-red-400 p-4">执行失败: ${escapeHtml(String(e))}</div>`;
      }
    }
    window.executeD1Query = executeD1Query;

    async function loadD1TableData() {
      const select = document.getElementById('d1-data-table-select');
      const tableName = select ? select.value : '';
      const tbody = document.getElementById('d1-data-tbody');
      if (!appState.currentD1Database || !tableName) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="px-5 py-8 text-center text-slate-500">请选择一个数据库和表</td></tr>';
        return;
      }
      if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="px-5 py-8 text-center text-slate-500">加载中...</td></tr>';
      try {
        const result = await cfRequest('POST', `/accounts/${appState.currentAccount.account_id}/d1/database/${appState.currentD1Database.uuid}/query`, { sql: `SELECT * FROM "${tableName}" LIMIT 100` });
        renderD1TableData(result);
      } catch (e) {
        console.error('load D1 table data failed:', e);
        if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="px-5 py-8 text-center text-red-400">加载失败: ${escapeHtml(String(e))}</td></tr>`;
      }
    }
    window.loadD1TableData = loadD1TableData;

    function renderD1TableData(result) {
      const tbody = document.getElementById('d1-data-tbody');
      const thead = document.getElementById('d1-data-thead');
      const headCols = document.getElementById('d1-data-head-cols');
      const bodyCols = document.getElementById('d1-data-body-cols');
      if (!tbody) return;
      appState.d1CurrentRows = (result.result && result.result[0] && result.result[0].results) ? result.result[0].results : [];
      const opCol = '<col style="width:110px">';
      if (appState.d1CurrentRows.length === 0) {
        if (thead) thead.innerHTML = '<tr><th class="text-left px-3 py-2">操作</th></tr>';
        if (headCols) headCols.innerHTML = opCol;
        if (bodyCols) bodyCols.innerHTML = opCol;
        tbody.innerHTML = '<tr><td class="px-5 py-8 text-center text-slate-500">暂无数据</td></tr>';
        return;
      }
      const cols = Object.keys(appState.d1CurrentRows[0]);
      const dataCols = cols.map(() => '<col>').join('');
      if (headCols) headCols.innerHTML = dataCols + opCol;
      if (bodyCols) bodyCols.innerHTML = dataCols + opCol;
      if (thead) {
        thead.innerHTML = '<tr>' + cols.map(c => `<th class="text-left px-3 py-2 font-medium">${escapeHtml(c)}</th>`).join('') + '<th class="text-left px-3 py-2 font-medium">操作</th></tr>';
      }
      tbody.innerHTML = appState.d1CurrentRows.map((row, idx) => '<tr>' + cols.map(c => `<td class="px-3 py-2 text-slate-700 dark:text-slate-300 break-all">${escapeHtml(String(row[c] ?? ''))}</td>`).join('') + `<td class="px-3 py-2"><button onclick="editD1Row(${idx})" class="text-cf-blue hover:underline text-xs mr-2">编辑</button><button onclick="deleteD1Row(${idx})" class="text-red-400 hover:underline text-xs">删除</button></td></tr>`).join('');
    }

    async function refreshD1Data() {
      await loadD1TableData();
    }
    window.refreshD1Data = refreshD1Data;

    function closeD1RowEditor() {
      document.getElementById('modal-d1-row-editor').classList.add('hidden');
      appState.editingD1RowIndex = null;
    }
    window.closeD1RowEditor = closeD1RowEditor;

    function editD1Row(index) {
      const row = appState.d1CurrentRows[index];
      if (!row) return;
      appState.editingD1RowIndex = index;
      const container = document.getElementById('d1-row-edit-fields');
      const cols = Object.keys(row);
      container.innerHTML = cols.map(c => `
        <div>
          <label class="block text-sm font-medium mb-1">${escapeHtml(c)}</label>
          <input id="d1-row-field-${c}" type="text" value="${escapeHtml(String(row[c] ?? ''))}" class="w-full px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:border-cf-orange font-mono">
        </div>
      `).join('');
      document.getElementById('modal-d1-row-editor').classList.remove('hidden');
    }
    window.editD1Row = editD1Row;

    async function saveD1Row() {
      const select = document.getElementById('d1-data-table-select');
      const tableName = select ? select.value : '';
      if (!appState.currentD1Database || !tableName || appState.editingD1RowIndex === null) return;
      const row = appState.d1CurrentRows[appState.editingD1RowIndex];
      const cols = Object.keys(row);
      const updates = [];
      const values = [];
      cols.forEach(c => {
        const val = document.getElementById(`d1-row-field-${c}`).value;
        updates.push(`"${c}" = ?${updates.length + 1}`);
        values.push(val);
      });
      // 简单以第一列作为 WHERE 条件（通常是主键 id）
      const pk = cols[0];
      values.push(row[pk]);
      const sql = `UPDATE "${tableName}" SET ${updates.join(', ')} WHERE "${pk}" = ?${values.length}`;
      try {
        await cfRequest('POST', `/accounts/${appState.currentAccount.account_id}/d1/database/${appState.currentD1Database.uuid}/query`, { sql, params: values });
        closeD1RowEditor();
        await loadD1TableData();
      } catch (e) {
        console.error('save D1 row failed:', e);
        alert('保存失败: ' + e);
      }
    }
    window.saveD1Row = saveD1Row;

    async function deleteD1Row(index) {
      const select = document.getElementById('d1-data-table-select');
      const tableName = select ? select.value : '';
      if (!appState.currentD1Database || !tableName) return;
      const row = appState.d1CurrentRows[index];
      if (!row) return;
      const cols = Object.keys(row);
      const pk = cols[0];
      if (!confirm(`确定要删除这行数据吗？\n${escapeHtml(pk)} = ${escapeHtml(String(row[pk] ?? ''))}`)) return;
      try {
        const sql = `DELETE FROM "${tableName}" WHERE "${pk}" = ?1`;
        await cfRequest('POST', `/accounts/${appState.currentAccount.account_id}/d1/database/${appState.currentD1Database.uuid}/query`, { sql, params: [row[pk]] });
        await loadD1TableData();
      } catch (e) {
        console.error('delete D1 row failed:', e);
        alert('删除失败: ' + e);
      }
    }
    window.deleteD1Row = deleteD1Row;

    async function addD1Row() {
      const select = document.getElementById('d1-data-table-select');
      const tableName = select ? select.value : '';
      if (!appState.currentD1Database || !tableName) {
        alert('请先选择一个数据库和表');
        return;
      }
      const columnsStr = prompt(`请输入要插入的列和值，格式：\ncolumn1=value1, column2=value2`);
      if (!columnsStr) return;
      try {
        const pairs = columnsStr.split(',').map(p => p.trim()).filter(Boolean);
        const cols = [];
        const vals = [];
        pairs.forEach(pair => {
          const idx = pair.indexOf('=');
          if (idx > 0) {
            cols.push(pair.substring(0, idx).trim());
            vals.push(pair.substring(idx + 1).trim());
          }
        });
        if (cols.length === 0) return;
        const placeholders = vals.map((_, i) => `?${i + 1}`).join(', ');
        const sql = `INSERT INTO "${tableName}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`;
        await cfRequest('POST', `/accounts/${appState.currentAccount.account_id}/d1/database/${appState.currentD1Database.uuid}/query`, { sql, params: vals });
        await loadD1TableData();
      } catch (e) {
        console.error('add D1 row failed:', e);
        alert('添加失败: ' + e);
      }
    }
    window.addD1Row = addD1Row;

    function switchD1SubTab(tab) {
      ['tables', 'query', 'data'].forEach(t => {
        document.getElementById('d1-view-' + t).classList.add('hidden');
        const btn = document.getElementById('btn-d1-tab-' + t);
        btn.classList.remove('bg-cf-blue/10', 'text-cf-blue', 'hover:bg-cf-blue/20');
        btn.classList.add('border', 'border-slate-200', 'dark:border-slate-700', 'hover:bg-slate-100', 'dark:hover:bg-slate-800');
      });
      document.getElementById('d1-view-' + tab).classList.remove('hidden');
      const activeBtn = document.getElementById('btn-d1-tab-' + tab);
      activeBtn.classList.remove('border', 'border-slate-200', 'dark:border-slate-700', 'hover:bg-slate-100', 'dark:hover:bg-slate-800');
      activeBtn.classList.add('bg-cf-blue/10', 'text-cf-blue', 'hover:bg-cf-blue/20');
    }

    // ========== 新增功能页通用辅助 ==========
    function isCfNotFoundError(e) {
      const msg = String((e && e.message) || e);
      return msg.includes('HTTP 404') || msg.includes('could not find') || msg.includes('10001') || msg.includes('not find') || msg.includes('not found');
    }

    function cfRuleError(result) {
      const errs = (result && result.errors) || [];
      return '操作失败：' + (errs.map(e => (e && (e.message || e.code)) || '').join('; ') || '未知错误');
    }

    function jsArg(s) {
      return escapeHtml(String(s == null ? '' : s)).replace(/'/g, '&#39;');
    }

    // 确保 appState.zones 已加载，并把 zone select 填充好；返回选中的 zoneId
    async function ensureZoneForPage(selectId) {
      if (!appState.currentAccount) {
        alert('请先选择或添加一个账户');
        return null;
      }
      if (!appState.zones || appState.zones.length === 0) {
        await loadZones();
        if (!appState.zones || appState.zones.length === 0) return null;
      }
      const sel = document.getElementById(selectId);
      if (!sel) return (appState.currentZone && appState.currentZone.id) || null;
      sel.innerHTML = '<option value="">选择域名</option>' + appState.zones.map(z =>
        `<option value="${escapeHtml(z.id)}">${escapeHtml(z.name || '')}</option>`).join('');
      let zoneId = (appState.currentZone && appState.currentZone.id) || '';
      if (!zoneId || !appState.zones.some(z => z.id === zoneId)) {
        zoneId = appState.zones[0].id;
      }
      sel.value = zoneId;
      const zone = appState.zones.find(z => z.id === zoneId);
      appState.currentZone = { id: zone.id, name: zone.name };
      return zoneId;
    }

    function handleZoneSelectChange(selectId) {
      const sel = document.getElementById(selectId);
      const zone = (appState.zones || []).find(z => z.id === sel.value);
      if (zone) appState.currentZone = { id: zone.id, name: zone.name };
    }

    // Ruleset entrypoint 获取；404 / 无 entrypoint 返回 null
    async function cfGetRulesetEntrypoint(scopePath, phase) {
      try {
        const result = await cfRequest('GET', `${scopePath}/rulesets/phases/${phase}/entrypoint`);
        if (result && result.success) return result.result || null;
        return null;
      } catch (e) {
        if (isCfNotFoundError(e)) return null;
        throw e;
      }
    }

    // 向 ruleset 添加规则；没有 ruleset 时用 PUT entrypoint 创建第一个规则
    async function cfAddRulesetRule(scopePath, phase, ruleset, ruleBody) {
      if (ruleset && ruleset.id) {
        const result = await cfRequest('POST', `${scopePath}/rulesets/${ruleset.id}/rules`, ruleBody);
        if (!result.success) throw new Error(cfRuleError(result));
      } else {
        const result = await cfRequest('PUT', `${scopePath}/rulesets/phases/${phase}/entrypoint`, { rules: [ruleBody] });
        if (!result.success) throw new Error(cfRuleError(result));
      }
    }

    function renderEnabledToggle(onclick, enabled) {
      return enabled ?
        `<button onclick="${onclick}" class="w-10 h-5 rounded-full bg-cf-orange relative transition-colors hover:opacity-90"><div class="absolute right-1 top-1 w-3 h-3 rounded-full bg-white shadow"></div></button>` :
        `<button onclick="${onclick}" class="w-10 h-5 rounded-full bg-slate-400 relative transition-colors hover:opacity-90"><div class="absolute left-1 top-1 w-3 h-3 rounded-full bg-white shadow"></div></button>`;
    }

    function tableLoadingRow(colspan, text) {
      return `<tr><td colspan="${colspan}" class="px-5 py-8 text-center text-slate-500">${escapeHtml(text || '加载中...')}</td></tr>`;
    }

    function tableEmptyRow(colspan, text) {
      return `<tr><td colspan="${colspan}" class="px-5 py-8 text-center text-slate-500">${escapeHtml(text || '暂无数据')}</td></tr>`;
    }

    // ========== 3. Snippets ==========
    async function loadSnippets() {
      const tbody = document.getElementById('snippets-tbody');
      if (!tbody) return;
      tbody.innerHTML = tableLoadingRow(3);
      const zoneId = await ensureZoneForPage('snippets-zone-select');
      if (!zoneId) { tbody.innerHTML = tableEmptyRow(3, '请先选择域名'); return; }
      try {
        const result = await cfRequest('GET', `/zones/${zoneId}/snippets`);
        let snippets = [];
        if (result.success) {
          const r = result.result;
          snippets = Array.isArray(r) ? r : (Array.isArray(r && r.snippets) ? r.snippets : []);
        }
        appState.snippets = snippets;
      } catch (e) {
        console.error('load snippets failed:', e);
        alert('加载 Snippets 失败: ' + e);
        appState.snippets = [];
      }
      try {
        const rulesResult = await cfRequest('GET', `/zones/${zoneId}/snippets/snippet_rules`);
        const r = rulesResult.success ? rulesResult.result : null;
        appState.snippetRules = Array.isArray(r) ? r : ((r && Array.isArray(r.rules)) ? r.rules : []);
      } catch (e) {
        console.warn('load snippet rules failed:', e);
        appState.snippetRules = [];
      }
      renderSnippets();
    }
    window.loadSnippets = loadSnippets;

    function onSnippetsZoneChange() {
      handleZoneSelectChange('snippets-zone-select');
      loadSnippets();
    }
    window.onSnippetsZoneChange = onSnippetsZoneChange;

    function renderSnippets() {
      const tbody = document.getElementById('snippets-tbody');
      if (!tbody) return;
      const snippets = appState.snippets || [];
      const rules = appState.snippetRules || [];
      if (snippets.length === 0) {
        tbody.innerHTML = tableEmptyRow(3, '暂无 Snippets');
        return;
      }
      tbody.innerHTML = snippets.map(s => {
        const name = s.name || s.snippet_name || '';
        const ruleCount = rules.filter(r => {
          const rn = r.script_name || r.snippet_name || (r.action_parameters && r.action_parameters.script_name) || '';
          return rn === name;
        }).length;
        return `
          <tr class="hover:bg-slate-100/30 dark:hover:bg-slate-800/30 transition-colors">
            <td class="px-5 py-4 font-medium font-mono text-xs break-all">${escapeHtml(name)}</td>
            <td class="px-5 py-4 text-slate-400">${ruleCount}</td>
            <td class="px-5 py-4">
              <button onclick="openSnippetEditor('${jsArg(name)}')" class="text-cf-blue hover:underline text-xs mr-3">查看 / 编辑</button>
              <button onclick="deleteSnippet('${jsArg(name)}')" class="text-red-400 hover:underline text-xs">删除</button>
            </td>
          </tr>
        `;
      }).join('');
    }

    // 去除 Cloudflare 返回的 multipart 包装（边界行、Content-Disposition / Content-Type 头），只保留纯源码
    function stripSnippetMultipart(text) {
      if (typeof text !== 'string') return text;
      let t = text.replace(/^\uFEFF/, '');
      const lines = t.split(/\r?\n/);
      if (lines.length < 2 || !/^--[^\s]+/.test(lines[0])) return text;
      // 第二行必须是 multipart 部件头，否则不是包装格式
      if (!/^Content-Disposition:\s*form-data/i.test(lines[1] || '')) return text;
      const boundary = lines[0];
      let end = lines.length;
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === boundary + '--' || lines[i].trim() === boundary) { end = i; break; }
      }
      // 跳过部件头（到第一个空行），尾部去掉空行和边界行
      let body = lines.slice(2, end);
      while (body.length && body[0].trim() !== '') body.shift();
      while (body.length && body[0].trim() === '') body.shift();
      while (body.length && body[body.length - 1].trim() === '') body.pop();
      return body.join('\n');
    }

    async function openSnippetEditor(name) {
      const nameInput = document.getElementById('snippet-edit-name');
      const codeInput = document.getElementById('snippet-edit-code');
      nameInput.value = name || '';
      nameInput.readOnly = !!name;
      codeInput.value = '// 加载中...';
      appState.editingSnippetName = name || null;
      document.getElementById('modal-snippet-editor').classList.remove('hidden');
      if (!name) {
        codeInput.value = "export default {\n  async fetch(request) {\n    return new Response('Hello from snippet');\n  }\n};\n";
        snippetEditRules = [];
        renderSnippetRuleRows();
        updateSnippetLineNumbers();
        syncSnippetLineNumbers();
        return;
      }
      // 填充该 Snippet 的触发规则
      snippetEditRules = (appState.snippetRules || [])
        .filter(r => snippetRuleScriptName(r) === name)
        .map(r => ({
          expression: r.expression || '',
          description: r.description || '',
          enabled: r.enabled !== false && !r.paused
        }));
      renderSnippetRuleRows();
      const zoneId = appState.currentZone && appState.currentZone.id;
      if (!zoneId) return;
      try {
        const raw = await cfRequestText('GET', `/zones/${zoneId}/snippets/${encodeURIComponent(name)}/content`);
        codeInput.value = stripSnippetMultipart(raw);
      } catch (e) {
        console.error('load snippet content failed:', e);
        codeInput.value = '';
        alert('加载代码失败: ' + e);
      }
      updateSnippetLineNumbers();
      syncSnippetLineNumbers();
    }
    window.openSnippetEditor = openSnippetEditor;

    // 规则中引用的脚本名（不同 API 版本字段可能不同）
    function snippetRuleScriptName(rule) {
      return rule.script_name || rule.snippet_name || (rule.action_parameters && rule.action_parameters.script_name) || '';
    }

    // 当前弹窗中正在编辑的规则列表
    let snippetEditRules = [];

    function renderSnippetRuleRows() {
      const container = document.getElementById('snippet-rules-list');
      if (!container) return;
      if (!snippetEditRules.length) {
        container.innerHTML = '<div class="text-xs text-slate-500 text-center py-3 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">暂无规则，点击右上角“+ 添加规则”创建</div>';
        return;
      }
      container.innerHTML = snippetEditRules.map((r, i) => `
        <div class="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
          <div class="flex items-center justify-between gap-2">
            <input type="text" value="${escapeHtml(r.description)}" placeholder="规则描述（可选）" oninput="updateSnippetRule(${i}, 'description', this.value)"
              class="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs outline-none focus:border-cf-orange">
            <label class="flex items-center gap-1.5 text-xs text-slate-400 shrink-0 cursor-pointer">
              <input type="checkbox" ${r.enabled ? 'checked' : ''} onchange="updateSnippetRule(${i}, 'enabled', this.checked)" class="rounded border-slate-500">
              启用
            </label>
            <button type="button" onclick="removeSnippetRuleRow(${i})" class="text-red-400 hover:text-red-300 shrink-0 p-1" title="删除规则">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
          </div>
          <textarea rows="2" spellcheck="false" placeholder="表达式，例如：http.request.uri.path contains &quot;/api/&quot;" oninput="updateSnippetRule(${i}, 'expression', this.value)"
            class="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono outline-none focus:border-cf-orange">${escapeHtml(r.expression)}</textarea>
        </div>
      `).join('');
    }
    window.renderSnippetRuleRows = renderSnippetRuleRows;

    function addSnippetRuleRow() {
      snippetEditRules.push({ expression: '', description: '', enabled: true });
      renderSnippetRuleRows();
    }
    window.addSnippetRuleRow = addSnippetRuleRow;

    function removeSnippetRuleRow(index) {
      snippetEditRules.splice(index, 1);
      renderSnippetRuleRows();
    }
    window.removeSnippetRuleRow = removeSnippetRuleRow;

    function updateSnippetRule(index, field, value) {
      if (!snippetEditRules[index]) return;
      snippetEditRules[index][field] = value;
    }
    window.updateSnippetRule = updateSnippetRule;

    function closeSnippetEditor() {
      document.getElementById('modal-snippet-editor').classList.add('hidden');
    }
    window.closeSnippetEditor = closeSnippetEditor;

    async function saveSnippet() {
      const zoneId = appState.currentZone && appState.currentZone.id;
      if (!zoneId) { alert('请先选择一个域名'); return; }
      const name = document.getElementById('snippet-edit-name').value.trim();
      const code = stripSnippetMultipart(document.getElementById('snippet-edit-code').value);
      if (!name) { alert('请输入 Snippet 名称'); return; }
      if (!/^[a-z0-9_-]+$/.test(name)) { alert('名称只能包含小写字母、数字、_ 和 -'); return; }
      // 过滤掉未填表达式的空规则
      const myRules = snippetEditRules
        .filter(r => (r.expression || '').trim())
        .map(r => ({
          expression: r.expression.trim(),
          action: 'execute',
          action_parameters: { script_name: name },
          ...(r.description ? { description: r.description } : {}),
          enabled: r.enabled !== false
        }));
      try {
        const { body, contentType } = buildWorkerMultipart(code, { main_module: 'snippet.js' }, 'snippet.js');
        await cfRequestText('PUT', `/zones/${zoneId}/snippets/${encodeURIComponent(name)}`, body, contentType);
        // 保存触发规则：保留其他 Snippet 的规则，替换当前 Snippet 的规则
        if (!Array.isArray(appState.snippetRules)) {
          const rulesResult = await cfRequest('GET', `/zones/${zoneId}/snippets/snippet_rules`);
          const r = rulesResult.success ? rulesResult.result : null;
          appState.snippetRules = Array.isArray(r) ? r : ((r && Array.isArray(r.rules)) ? r.rules : []);
        }
        const otherRules = appState.snippetRules.filter(r => snippetRuleScriptName(r) !== name);
        const putBody = { rules: otherRules.concat(myRules) };
        const putResult = await cfRequest('PUT', `/zones/${zoneId}/snippets/snippet_rules`, putBody);
        if (!putResult.success) { alert('Snippet 已保存，但规则保存失败: ' + cfRuleError(putResult)); }
        closeSnippetEditor();
        await loadSnippets();
      } catch (e) {
        alert('保存失败: ' + e);
      }
    }
    window.saveSnippet = saveSnippet;

    async function deleteSnippet(name) {
      const zoneId = appState.currentZone && appState.currentZone.id;
      if (!zoneId || !name) return;
      if (!confirm(`确定要删除 Snippet "${name}" 吗？`)) return;
      try {
        await cfRequest('DELETE', `/zones/${zoneId}/snippets/${encodeURIComponent(name)}`);
        await loadSnippets();
      } catch (e) {
        alert('删除失败: ' + e);
      }
    }
    window.deleteSnippet = deleteSnippet;

    // ========== 6. 负载均衡 (Load Balancer) ==========
    async function loadLoadBalancers() {
      const tbody = document.getElementById('lb-tbody');
      if (!tbody) return;
      tbody.innerHTML = tableLoadingRow(5);
      const zoneId = await ensureZoneForPage('loadbalancer-zone-select');
      if (!zoneId) { tbody.innerHTML = tableEmptyRow(5, '请先选择域名'); return; }
      try {
        const result = await cfRequest('GET', `/zones/${zoneId}/load_balancers`);
        appState.lbList = result.success ? (result.result || []) : [];
        if (!result.success) alert(cfRuleError(result));
      } catch (e) {
        console.error('load load balancers failed:', e);
        alert('加载负载均衡器失败: ' + e);
        appState.lbList = [];
      }
      renderLoadBalancers();
    }
    window.loadLoadBalancers = loadLoadBalancers;

    function onLoadBalancerZoneChange() {
      handleZoneSelectChange('loadbalancer-zone-select');
      loadLoadBalancers();
    }
    window.onLoadBalancerZoneChange = onLoadBalancerZoneChange;

    function renderLoadBalancers() {
      const tbody = document.getElementById('lb-tbody');
      if (!tbody) return;
      const lbs = appState.lbList || [];
      if (lbs.length === 0) {
        tbody.innerHTML = tableEmptyRow(5, '暂无负载均衡器');
        return;
      }
      tbody.innerHTML = lbs.map(lb => `
        <tr class="hover:bg-slate-100/30 dark:hover:bg-slate-800/30 transition-colors">
          <td class="px-5 py-4 font-medium">${escapeHtml(lb.name || '')}</td>
          <td class="px-5 py-4 text-slate-400">${(lb.default_pools || []).length}</td>
          <td class="px-5 py-4 text-slate-400">${lb.proxied ? '是' : '否'}</td>
          <td class="px-5 py-4">${renderEnabledToggle(`toggleLoadBalancer('${jsArg(lb.id)}', ${lb.enabled === false})`, lb.enabled !== false)}</td>
          <td class="px-5 py-4">
            <button onclick="deleteLoadBalancer('${jsArg(lb.id)}', '${jsArg(lb.name)}')" class="text-red-400 hover:underline text-xs">删除</button>
          </td>
        </tr>
      `).join('');
    }

    async function toggleLoadBalancer(lbId, enabled) {
      const zoneId = appState.currentZone && appState.currentZone.id;
      if (!zoneId) return;
      try {
        const result = await cfRequest('PATCH', `/zones/${zoneId}/load_balancers/${lbId}`, { enabled });
        if (!result.success) { alert(cfRuleError(result)); }
        await loadLoadBalancers();
      } catch (e) {
        alert('切换状态失败: ' + e);
      }
    }
    window.toggleLoadBalancer = toggleLoadBalancer;

    async function createLoadBalancer() {
      const zoneId = appState.currentZone && appState.currentZone.id;
      if (!zoneId) { alert('请先选择一个域名'); return; }
      let pools = appState.lbPools;
      if (!pools) await loadLbPools();
      pools = appState.lbPools || [];
      if (pools.length === 0) {
        alert('当前账户没有可用的 Pool，请先创建 Pool。');
        return;
      }
      const name = prompt('负载均衡器名称（例如 lb.example.com）：');
      if (!name) return;
      const poolListText = pools.map((p, i) => `${i + 1}. ${p.name} (${(p.origins || []).map(o => o.address || o.name || '').join(', ') || '无 origin'})`).join('\n');
      const idx = parseInt(prompt(`选择默认 Pool（输入序号）：\n${poolListText}`, '1'), 10);
      const pool = pools[idx - 1];
      if (!pool) { alert('无效的 Pool 序号'); return; }
      try {
        const result = await cfRequest('POST', `/zones/${zoneId}/load_balancers`, {
          name,
          default_pools: [pool.id],
          fallback_pool: pool.id,
          proxied: true
        });
        if (!result.success) { alert(cfRuleError(result)); return; }
        await loadLoadBalancers();
      } catch (e) {
        alert('创建失败: ' + e);
      }
    }
    window.createLoadBalancer = createLoadBalancer;

    async function deleteLoadBalancer(lbId, name) {
      const zoneId = appState.currentZone && appState.currentZone.id;
      if (!zoneId) return;
      if (!confirm(`确定要删除负载均衡器 "${name}" 吗？`)) return;
      try {
        const result = await cfRequest('DELETE', `/zones/${zoneId}/load_balancers/${lbId}`);
        if (!result.success) { alert(cfRuleError(result)); return; }
        await loadLoadBalancers();
      } catch (e) {
        alert('删除失败: ' + e);
      }
    }
    window.deleteLoadBalancer = deleteLoadBalancer;

    async function loadLbPools() {
      const tbody = document.getElementById('lb-pools-tbody');
      if (!tbody) return;
      if (!appState.currentAccount?.account_id) {
        tbody.innerHTML = tableEmptyRow(4, '请先选择或添加一个账户');
        return;
      }
      tbody.innerHTML = tableLoadingRow(4);
      try {
        const result = await cfRequest('GET', `/accounts/${appState.currentAccount.account_id}/load_balancers/pools`);
        appState.lbPools = result.success ? (result.result || []) : [];
        if (!result.success) alert(cfRuleError(result));
      } catch (e) {
        console.error('load LB pools failed:', e);
        alert('加载 Pools 失败: ' + e);
        appState.lbPools = [];
      }
      renderLbPools();
    }
    window.loadLbPools = loadLbPools;

    function renderLbPools() {
      const tbody = document.getElementById('lb-pools-tbody');
      if (!tbody) return;
      const pools = appState.lbPools || [];
      if (pools.length === 0) {
        tbody.innerHTML = tableEmptyRow(4, '暂无 Pools');
        return;
      }
      tbody.innerHTML = pools.map(p => {
        const origins = (p.origins || []).map(o => o.address || o.name || '').filter(Boolean).join(', ');
        const healthClass = p.health === 'healthy' ? 'bg-green-500/10 text-green-500' : p.health === 'unhealthy' ? 'bg-red-500/10 text-red-500' : 'bg-slate-500/10 text-slate-400';
        return `
          <tr class="hover:bg-slate-100/30 dark:hover:bg-slate-800/30 transition-colors">
            <td class="px-5 py-4 font-medium">${escapeHtml(p.name || '')}</td>
            <td class="px-5 py-4 text-slate-400 font-mono text-xs truncate max-w-xs">${escapeHtml(origins || '-')}</td>
            <td class="px-5 py-4"><span class="px-2 py-1 rounded-full text-xs ${healthClass}">${escapeHtml(p.health || (p.enabled ? 'unknown' : 'disabled'))}</span></td>
            <td class="px-5 py-4">
              <button onclick="deleteLbPool('${jsArg(p.id)}', '${jsArg(p.name)}')" class="text-red-400 hover:underline text-xs">删除</button>
            </td>
          </tr>
        `;
      }).join('');
    }

    async function createLbPool() {
      if (!appState.currentAccount?.account_id) return;
      const name = prompt('Pool 名称：');
      if (!name) return;
      const address = prompt('Origin 地址（IP 或域名，例如 1.2.3.4）：');
      if (!address) return;
      try {
        const result = await cfRequest('POST', `/accounts/${appState.currentAccount.account_id}/load_balancers/pools`, {
          name,
          origins: [{ name: address.replace(/[^a-zA-Z0-9.-]/g, '_'), address }]
        });
        if (!result.success) { alert(cfRuleError(result)); return; }
        await loadLbPools();
      } catch (e) {
        alert('创建失败: ' + e);
      }
    }
    window.createLbPool = createLbPool;

    async function deleteLbPool(poolId, name) {
      if (!appState.currentAccount?.account_id) return;
      if (!confirm(`确定要删除 Pool "${name}" 吗？`)) return;
      try {
        const result = await cfRequest('DELETE', `/accounts/${appState.currentAccount.account_id}/load_balancers/pools/${poolId}`);
        if (!result.success) { alert(cfRuleError(result)); return; }
        await loadLbPools();
      } catch (e) {
        alert('删除失败: ' + e);
      }
    }
    window.deleteLbPool = deleteLbPool;

    async function loadLbMonitors() {
      const tbody = document.getElementById('lb-monitors-tbody');
      if (!tbody) return;
      if (!appState.currentAccount?.account_id) {
        tbody.innerHTML = tableEmptyRow(4, '请先选择或添加一个账户');
        return;
      }
      tbody.innerHTML = tableLoadingRow(4);
      try {
        const result = await cfRequest('GET', `/accounts/${appState.currentAccount.account_id}/load_balancers/monitors`);
        appState.lbMonitors = result.success ? (result.result || []) : [];
        if (!result.success) alert(cfRuleError(result));
      } catch (e) {
        console.error('load LB monitors failed:', e);
        alert('加载 Monitors 失败: ' + e);
        appState.lbMonitors = [];
      }
      renderLbMonitors();
    }
    window.loadLbMonitors = loadLbMonitors;

    function renderLbMonitors() {
      const tbody = document.getElementById('lb-monitors-tbody');
      if (!tbody) return;
      const monitors = appState.lbMonitors || [];
      if (monitors.length === 0) {
        tbody.innerHTML = tableEmptyRow(4, '暂无 Monitors');
        return;
      }
      tbody.innerHTML = monitors.map(m => `
        <tr class="hover:bg-slate-100/30 dark:hover:bg-slate-800/30 transition-colors">
          <td class="px-5 py-4 font-medium">${escapeHtml(m.type || '-')}</td>
          <td class="px-5 py-4 text-slate-400 font-mono text-xs">${escapeHtml(m.path || '/')}</td>
          <td class="px-5 py-4 text-slate-400">${escapeHtml(m.expected_codes || '2xx')}</td>
          <td class="px-5 py-4">
            <button onclick="deleteLbMonitor('${jsArg(m.id)}')" class="text-red-400 hover:underline text-xs">删除</button>
          </td>
        </tr>
      `).join('');
    }

    async function createLbMonitor() {
      if (!appState.currentAccount?.account_id) return;
      const type = prompt('监控类型（http / https / tcp）：', 'https') || 'https';
      const path = prompt('监控路径：', '/health') || '/health';
      const expectedCodes = prompt('期望状态码：', '2xx') || '2xx';
      try {
        const result = await cfRequest('POST', `/accounts/${appState.currentAccount.account_id}/load_balancers/monitors`, {
          type, expected_codes: expectedCodes, path
        });
        if (!result.success) { alert(cfRuleError(result)); return; }
        await loadLbMonitors();
      } catch (e) {
        alert('创建失败: ' + e);
      }
    }
    window.createLbMonitor = createLbMonitor;

    async function deleteLbMonitor(monitorId) {
      if (!appState.currentAccount?.account_id) return;
      if (!confirm('确定要删除这个 Monitor 吗？')) return;
      try {
        const result = await cfRequest('DELETE', `/accounts/${appState.currentAccount.account_id}/load_balancers/monitors/${monitorId}`);
        if (!result.success) { alert(cfRuleError(result)); return; }
        await loadLbMonitors();
      } catch (e) {
        alert('删除失败: ' + e);
      }
    }
    window.deleteLbMonitor = deleteLbMonitor;

    // ========== 7. 健康检查 (Health Checks) ==========
    async function loadHealthChecks() {
      const tbody = document.getElementById('healthchecks-tbody');
      if (!tbody) return;
      tbody.innerHTML = tableLoadingRow(7);
      const zoneId = await ensureZoneForPage('healthchecks-zone-select');
      if (!zoneId) { tbody.innerHTML = tableEmptyRow(7, '请先选择域名'); return; }
      try {
        const result = await cfRequest('GET', `/zones/${zoneId}/healthchecks`);
        appState.healthChecks = result.success ? (result.result || []) : [];
        if (!result.success) alert(cfRuleError(result));
      } catch (e) {
        console.error('load health checks failed:', e);
        alert('加载健康检查失败: ' + e);
        appState.healthChecks = [];
      }
      renderHealthChecks();
    }
    window.loadHealthChecks = loadHealthChecks;

    function onHealthChecksZoneChange() {
      handleZoneSelectChange('healthchecks-zone-select');
      loadHealthChecks();
    }
    window.onHealthChecksZoneChange = onHealthChecksZoneChange;

    function renderHealthChecks() {
      const tbody = document.getElementById('healthchecks-tbody');
      if (!tbody) return;
      const checks = appState.healthChecks || [];
      if (checks.length === 0) {
        tbody.innerHTML = tableEmptyRow(7, '暂无健康检查');
        return;
      }
      tbody.innerHTML = checks.map(c => {
        const suspended = !!c.suspended;
        const statusClass = suspended ? 'bg-yellow-500/10 text-yellow-500' : 'bg-green-500/10 text-green-500';
        return `
          <tr class="hover:bg-slate-100/30 dark:hover:bg-slate-800/30 transition-colors">
            <td class="px-5 py-4 font-medium">${escapeHtml(c.name || '')}</td>
            <td class="px-5 py-4 text-slate-400 font-mono text-xs">${escapeHtml(c.address || '')}</td>
            <td class="px-5 py-4 text-slate-400">${escapeHtml(c.type || '-')}</td>
            <td class="px-5 py-4 text-slate-400">${c.port != null ? c.port : '-'}</td>
            <td class="px-5 py-4 text-slate-400">${c.interval != null ? c.interval + 's' : '-'}</td>
            <td class="px-5 py-4"><span class="px-2 py-1 rounded-full text-xs ${statusClass}">${suspended ? '已暂停' : '运行中'}</span></td>
            <td class="px-5 py-4">
              <button onclick="toggleHealthCheck('${jsArg(c.id)}', ${!suspended})" class="text-cf-blue hover:underline text-xs mr-3">${suspended ? '恢复' : '暂停'}</button>
              <button onclick="deleteHealthCheck('${jsArg(c.id)}')" class="text-red-400 hover:underline text-xs">删除</button>
            </td>
          </tr>
        `;
      }).join('');
    }

    async function toggleHealthCheck(checkId, suspended) {
      const zoneId = appState.currentZone && appState.currentZone.id;
      if (!zoneId) return;
      try {
        const result = await cfRequest('PATCH', `/zones/${zoneId}/healthchecks/${checkId}`, { suspended });
        if (!result.success) { alert(cfRuleError(result)); }
        await loadHealthChecks();
      } catch (e) {
        alert('操作失败: ' + e);
      }
    }
    window.toggleHealthCheck = toggleHealthCheck;

    async function deleteHealthCheck(checkId) {
      const zoneId = appState.currentZone && appState.currentZone.id;
      if (!zoneId) return;
      if (!confirm('确定要删除这条健康检查吗？')) return;
      try {
        const result = await cfRequest('DELETE', `/zones/${zoneId}/healthchecks/${checkId}`);
        if (!result.success) { alert(cfRuleError(result)); return; }
        await loadHealthChecks();
      } catch (e) {
        alert('删除失败: ' + e);
      }
    }
    window.deleteHealthCheck = deleteHealthCheck;

    async function createHealthCheck() {
      const zoneId = appState.currentZone && appState.currentZone.id;
      if (!zoneId) { alert('请先选择一个域名'); return; }
      const name = prompt('检查名称：');
      if (!name) return;
      const address = prompt('目标地址（例如 origin.example.com）：');
      if (!address) return;
      const type = (prompt('类型（HTTPS / HTTP / TCP）：', 'HTTPS') || 'HTTPS').toUpperCase();
      const port = parseInt(prompt('端口：', '443'), 10) || 443;
      const interval = parseInt(prompt('检查间隔（秒）：', '60'), 10) || 60;
      try {
        const result = await cfRequest('POST', `/zones/${zoneId}/healthchecks`, {
          name, address, type, port, interval
        });
        if (!result.success) { alert(cfRuleError(result)); return; }
        await loadHealthChecks();
      } catch (e) {
        alert('创建失败: ' + e);
      }
    }
    window.createHealthCheck = createHealthCheck;

    // 初始化
    document.addEventListener('DOMContentLoaded', () => {
      // 启动时强制同步主题，避免半透明 glass 叠在错误底色上发灰
      let saved = null;
      try { saved = localStorage.getItem('theme'); } catch (e) {}
      const isDark = saved ? saved === 'dark' : true; // 默认深色
      applyTheme(isDark);

      loadAppVersion();
      loadAccounts();
      applyBgSettings();
      syncBgSettingsUI();
      // 每 60 秒刷新一次 API 连接状态
      setInterval(() => {
        if (appState.currentAccount) refreshApiStatus();
      }, 60000);
      // 每 5 分钟重新拉取 Workers 今日请求数，让数字随分析数据入库追上 CF 面板
      setInterval(() => {
        if (appState.currentAccount) loadWorkersTotalRequests().then(() => renderDashboard()).catch(() => {});
      }, 5 * 60 * 1000);
      // 隐藏启动加载动画
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const splash = document.getElementById('splash-screen');
          if (splash) {
            splash.style.opacity = '0';
            splash.style.transition = 'opacity 0.3s ease';
            setTimeout(() => {
              splash.remove();
              document.documentElement.classList.add('ready');
            }, 300);
          } else {
            document.documentElement.classList.add('ready');
          }
        });
      });
    });

    // 键盘快捷键：Ctrl+K 聚焦搜索（仅域名页）
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        const search = document.querySelector('#page-zones input[type="text"]');
        if (search) search.focus();
      }
    });