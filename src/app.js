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
      workersTotalRequests: null
    };

    const APP_VERSION = '0.2.0';
    const REPO_URL = 'https://github.com/Anji-318/cloudflare-manager/tree/main';

    const pages = ['dashboard', 'accounts', 'zones', 'dns', 'workers', 'pages', 'r2', 'kvd1', 'tunnels', 'firewall', 'cache', 'analytics', 'settings'];
    
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
    }

    async function reloadCurrentPage() {
      const pageId = appState.currentPageId || 'dashboard';
      try {
        switch (pageId) {
          case 'dashboard': renderDashboard(); break;
          case 'accounts': await loadAccounts(); break;
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

    function toggleTheme() {
      const html = document.documentElement;
      const toggle = document.getElementById('theme-toggle');
      const icon = document.getElementById('theme-icon');
      if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        html.classList.add('light');
        if (toggle) {
          toggle.classList.remove('bg-cf-orange');
          toggle.classList.add('bg-slate-300');
          toggle.querySelector('span').classList.remove('translate-x-6');
          toggle.querySelector('span').classList.add('translate-x-1');
        }
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>';
      } else {
        html.classList.add('dark');
        html.classList.remove('light');
        if (toggle) {
          toggle.classList.add('bg-cf-orange');
          toggle.classList.remove('bg-slate-300');
          toggle.querySelector('span').classList.add('translate-x-6');
          toggle.querySelector('span').classList.remove('translate-x-1');
        }
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>';
      }
    }

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
          token_encrypted: ''
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
        
        // Auto-select first account if none selected
        if (appState.accounts.length > 0 && !appState.currentAccount) {
          await selectAccount(appState.accounts[0].id);
        }
      } catch (e) {
        console.error('Failed to load accounts:', e);
      }
    }

    function renderAccounts() {
      const tbody = document.getElementById('accounts-tbody');
      if (!tbody) return;
      
      if (appState.accounts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-5 py-8 text-center text-slate-500">暂无账户，请点击右上角添加</td></tr>';
        return;
      }
      
      tbody.innerHTML = appState.accounts.map(acc => {
        const initial = acc.name.charAt(0).toUpperCase();
        return `
          <tr class="hover:bg-slate-100/30 dark:hover:bg-slate-800/30 transition-colors">
            <td class="px-5 py-4">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-cf-orange/10 text-cf-orange flex items-center justify-center font-bold text-xs">${initial}</div>
                <span class="font-medium">${escapeHtml(acc.name)}</span>
              </div>
            </td>
            <td class="px-5 py-4 text-slate-400">${escapeHtml(acc.email || '-')}</td>
            <td class="px-5 py-4"><span class="px-2 py-1 rounded-full text-xs bg-green-500/10 text-green-500">有效</span></td>
            <td class="px-5 py-4">-</td>
            <td class="px-5 py-4">
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
        await loadAccounts();
      } catch (e) {
        alert('删除失败：' + e);
      }
    }

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
        
        // Update sidebar
        const info = document.querySelector('.account-info');
        if (info) {
          info.innerHTML = `
            <div class="text-sm font-medium truncate">${escapeHtml(account.name)}</div>
            <div class="text-xs text-slate-400 truncate">${escapeHtml(account.email || '')}</div>
          `;
        }
        const avatar = document.querySelector('.account-avatar');
        if (avatar) avatar.textContent = account.name.charAt(0).toUpperCase();
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
          '<div class="w-10 h-5 rounded-full bg-cf-orange relative"><div class="absolute right-1 top-1 w-3 h-3 rounded-full bg-white shadow"></div></div>' :
          '<div class="w-10 h-5 rounded-full bg-slate-400 relative"><div class="absolute left-1 top-1 w-3 h-3 rounded-full bg-white shadow"></div></div>';
        
        return `
          <tr class="hover:bg-slate-100/30 dark:hover:bg-slate-800/30 transition-colors">
            <td class="px-5 py-4"><span class="px-2 py-1 rounded-md text-xs ${colorClass} font-medium">${escapeHtml(type)}</span></td>
            <td class="px-5 py-4 font-medium">${escapeHtml(record.name || '')}</td>
            <td class="px-5 py-4 text-slate-400 truncate max-w-xs">${escapeHtml(record.content || '')}</td>
            <td class="px-5 py-4 text-slate-400">${record.ttl || 1}</td>
            <td class="px-5 py-4">${proxied}</td>
            <td class="px-5 py-4">
              <button class="text-cf-blue hover:underline text-xs mr-3">编辑</button>
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
        const debugEl = document.getElementById('dash-req-debug');
        
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
          // 显示调试信息
          if (debugEl) debugEl.textContent = 'Debug: ' + err;
        } else if (appState.workersTotalRequests != null) {
          // 成功状态
          reqCountEl.textContent = appState.workersTotalRequests.toLocaleString();
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
          if (debugEl) debugEl.textContent = appState.workersDebugResponse || '';
        } else if (appState.currentAccount) {
          // 加载中
          reqCountEl.textContent = '加载中...';
          if (quotaEl) quotaEl.textContent = '';
          if (statusEl) {
            statusEl.textContent = '';
            statusEl.className = 'text-xs';
          }
          if (debugEl) debugEl.textContent = '请求中...';
          loadWorkersTotalRequests().then(() => renderDashboard()).catch(() => {
            reqCountEl.textContent = '-';
          });
        } else {
          // 未选择账户
          reqCountEl.textContent = '-';
          if (quotaEl) quotaEl.textContent = '';
          if (statusEl) statusEl.textContent = '';
          if (debugEl) debugEl.textContent = '';
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
      const result = await cfRequest('POST', '/client/v4/graphql', { query, variables });
      if (!result.success) {
        const errorMsg = result.errors?.[0]?.message || result.messages?.[0] || 'GraphQL query failed';
        console.error('GraphQL error:', result.errors);
        throw new Error(errorMsg);
      }
      if (result.data?.errors) {
        const gqlError = result.data.errors[0]?.message || 'GraphQL execution error';
        console.error('GraphQL execution error:', result.data.errors);
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
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const since = today.toISOString();
      const until = new Date().toISOString();
      
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
        
        // 保存原始响应用于调试显示
        appState.workersDebugResponse = JSON.stringify(data).substring(0, 200);
        
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
        
      } catch (e) {
        console.error('Workers analytics load failed:', e);
        appState.workersRequestsError = String(e).substring(0, 100);
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

    function buildWorkerMultipart(code, metadataObj) {
      const boundary = '----WorkerBoundary' + Math.random().toString(36).slice(2);
      const metadata = JSON.stringify(metadataObj || { main_module: 'worker.js' });
      return {
        body: [
          `--${boundary}`,
          'Content-Disposition: form-data; name="metadata"',
          '',
          metadata,
          `--${boundary}`,
          'Content-Disposition: form-data; name="worker.js"; filename="worker.js"',
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
      document.getElementById('pages-deploy-branch').value = 'main';
      document.getElementById('pages-deploy-env').value = 'production';
      appState.pagesDeployEnvVars = [];
      renderPagesDeployEnvVars();
      document.getElementById('pages-deploy-log').classList.add('hidden');
      document.getElementById('pages-deploy-log').textContent = '';
      document.getElementById('modal-pages-deploy').classList.remove('hidden');
    }
    window.openPagesDeployModal = openPagesDeployModal;

    function closePagesDeployModal() {
      document.getElementById('modal-pages-deploy').classList.add('hidden');
    }
    window.closePagesDeployModal = closePagesDeployModal;

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
      if (!appState.currentZone) {
        renderFirewallRules([]);
        return;
      }
      try {
        const result = await cfRequest('GET', `/zones/${appState.currentZone.id}/firewall/rules`);
        appState.firewallRules = result.success ? (result.result || []) : [];
        renderFirewallRules();
      } catch (e) {
        console.error('Firewall load failed:', e);
        renderFirewallRules([]);
      }
    }

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
        
        // Load threat count from analytics
        const until = new Date();
        const since = new Date(until.getTime() - 86400 * 1000);
        const analyticsResult = await cfRequest('GET', `/zones/${appState.currentZone.id}/analytics/dashboard?since=${since.toISOString()}&until=${until.toISOString()}`);
        if (threatEl && analyticsResult.success) {
          const timeseries = analyticsResult.result?.timeseries || [];
          let threats = 0;
          timeseries.forEach(p => { threats += p.requests?.threat || 0; });
          threatEl.textContent = threats.toLocaleString();
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
        const actionClass = r.action === 'block' ? 'bg-red-500/10 text-red-500' : r.action === 'challenge' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-green-500/10 text-green-500';
        const statusClass = r.paused ? 'bg-slate-500/10 text-slate-400' : 'bg-green-500/10 text-green-500';
        return `
          <tr class=\"hover:bg-slate-100/30 dark:hover:bg-slate-800/30 transition-colors\">
            <td class=\"px-5 py-4 font-medium\">${escapeHtml(r.description || '未命名规则')}</td>
            <td class=\"px-5 py-4 text-slate-400\">Firewall Rule</td>
            <td class=\"px-5 py-4\"><span class=\"px-2 py-1 rounded-full text-xs ${actionClass}\">${escapeHtml(r.action || '-')}</span></td>
            <td class=\"px-5 py-4\"><span class=\"px-2 py-1 rounded-full text-xs ${statusClass}\">${r.paused ? '暂停' : '启用'}</span></td>
            <td class=\"px-5 py-4\"><button class=\"text-cf-blue hover:underline text-xs\">编辑</button></td>
          </tr>
        `;
      }).join('');
    }

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
          <td class="px-4 py-3 font-mono text-xs">${escapeHtml(k.name || '')}</td>
          <td class="px-4 py-3 text-slate-400 text-xs truncate max-w-[200px]">${escapeHtml(k.value_preview || '-')}</td>
          <td class="px-4 py-3 text-slate-400 text-xs">${k.expiration ? new Date(k.expiration * 1000).toLocaleString() : '永久'}</td>
          <td class="px-4 py-3 text-slate-400 text-xs">${k.metadata ? JSON.stringify(k.metadata).length + ' B' : '-'}</td>
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
            html += '<table class="w-full text-xs"><thead class="bg-slate-800 text-slate-300"><tr>' + cols.map(c => `<th class="text-left px-2 py-1">${escapeHtml(c)}</th>`).join('') + '</tr></thead><tbody class="divide-y divide-slate-700">';
            html += r.results.map(row => '<tr>' + cols.map(c => `<td class="px-2 py-1 text-slate-300">${escapeHtml(String(row[c] ?? ''))}</td>`).join('') + '</tr>').join('');
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
      if (!tbody) return;
      appState.d1CurrentRows = (result.result && result.result[0] && result.result[0].results) ? result.result[0].results : [];
      if (appState.d1CurrentRows.length === 0) {
        if (thead) thead.innerHTML = '<tr><th class="text-left px-3 py-2">操作</th></tr>';
        tbody.innerHTML = '<tr><td class="px-5 py-8 text-center text-slate-500">暂无数据</td></tr>';
        return;
      }
      const cols = Object.keys(appState.d1CurrentRows[0]);
      if (thead) {
        thead.innerHTML = '<tr>' + cols.map(c => `<th class="text-left px-3 py-2 font-medium">${escapeHtml(c)}</th>`).join('') + '<th class="text-left px-3 py-2 font-medium">操作</th></tr>';
      }
      tbody.innerHTML = appState.d1CurrentRows.map((row, idx) => '<tr>' + cols.map(c => `<td class="px-3 py-2 text-slate-300">${escapeHtml(String(row[c] ?? ''))}</td>`).join('') + `<td class="px-3 py-2"><button onclick="editD1Row(${idx})" class="text-cf-blue hover:underline text-xs mr-2">编辑</button><button onclick="deleteD1Row(${idx})" class="text-red-400 hover:underline text-xs">删除</button></td></tr>`).join('');
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

    // 初始化
    document.addEventListener('DOMContentLoaded', () => {
      const versionEl = document.getElementById('app-version');
      if (versionEl) versionEl.textContent = APP_VERSION;
      loadAccounts();
      // 每 60 秒刷新一次 API 连接状态
      setInterval(() => {
        if (appState.currentAccount) refreshApiStatus();
      }, 60000);
      // 隐藏启动加载动画
      const splash = document.getElementById('splash-screen');
      if (splash) {
        splash.style.opacity = '0';
        splash.style.transition = 'opacity 0.3s ease';
        setTimeout(() => splash.remove(), 300);
      }
    });

    // 键盘快捷键：Ctrl+K 聚焦搜索（仅域名页）
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        const search = document.querySelector('#page-zones input[type="text"]');
        if (search) search.focus();
      }
    });
