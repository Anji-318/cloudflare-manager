/**
 * KV 管理模块 - 完善键值对浏览和管理功能
 */

(function() {
  'use strict';

  // KV Manager 状态
  const KVState = {
    currentNamespace: null,
    keys: [],
    currentKey: null,
    keyValue: null,
    keyMetadata: null,
    loading: false
  };

  // 初始化 KV 管理器
  function initKvManager() {
    // 绑定事件
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-action="kv-browse"]')) {
        const nsId = e.target.dataset.nsId;
        const nsTitle = e.target.dataset.nsTitle;
        openKvBrowser(nsId, nsTitle);
      }
    });
  }

  // 打开 KV 浏览器
  async function openKvBrowser(nsId, nsTitle) {
    KVState.currentNamespace = { id: nsId, title: nsTitle };
    KVState.keys = [];
    KVState.currentKey = null;
    KVState.keyValue = null;

    // 创建/显示 KV 浏览器模态框
    let modal = document.getElementById('kv-browser-modal');
    if (!modal) {
      modal = createKvBrowserModal();
      document.body.appendChild(modal);
    }
    modal.classList.remove('hidden');

    // 加载键列表
    await loadKvKeys(nsId);
  }

  // 创建 KV 浏览器模态框
  function createKvBrowserModal() {
    const modal = document.createElement('div');
    modal.id = 'kv-browser-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm hidden';
    modal.innerHTML = `
      <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col m-4">
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <svg class="w-5 h-5 text-cf-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"></path>
            </svg>
            KV 浏览器 <span id="kv-ns-title" class="text-sm font-normal text-slate-500 dark:text-slate-400"></span>
          </h3>
          <button onclick="document.getElementById('kv-browser-modal').classList.add('hidden')" class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <div class="flex flex-1 overflow-hidden">
          <!-- 键列表面板 -->
          <div class="w-64 border-r border-slate-200 dark:border-slate-700 flex flex-col">
            <div class="p-3 border-b border-slate-200 dark:border-slate-700">
              <div class="relative">
                <input type="text" id="kv-key-search" placeholder="搜索键..." 
                  class="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-cf-orange focus:border-transparent outline-none">
                <svg class="w-4 h-4 absolute left-3 top-2.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
              </div>
            </div>
            <div id="kv-keys-list" class="flex-1 overflow-y-auto p-2 space-y-1">
              <div class="text-center text-sm text-slate-400 py-8">加载中...</div>
            </div>
            <div class="p-3 border-t border-slate-200 dark:border-slate-700">
              <button onclick="KvManager.showAddKey()" class="w-full py-2 px-3 rounded-lg bg-cf-orange text-white text-sm font-medium hover:bg-orange-600 transition-colors flex items-center justify-center gap-1">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                添加键值
              </button>
            </div>
          </div>
          <!-- 值编辑面板 -->
          <div class="flex-1 flex flex-col min-w-0">
            <div id="kv-value-panel" class="flex-1 flex flex-col p-4 overflow-hidden">
              <div class="flex-1 flex items-center justify-center text-slate-400">
                <div class="text-center">
                  <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"></path>
                  </svg>
                  <p>选择左侧键查看或编辑</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    return modal;
  }

  // 加载 KV 键列表
  async function loadKvKeys(nsId, prefix = '', cursor = '') {
    try {
      KVState.loading = true;
      const accountId = window.appState?.currentAccount?.account_id;
      if (!accountId) throw new Error('未选择账户');

      // 使用 Cloudflare API 获取键列表
      const result = await window.cfRequest('GET', 
        `/accounts/${accountId}/storage/kv/namespaces/${nsId}/keys?limit=1000${prefix ? '&prefix=' + encodeURIComponent(prefix) : ''}${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`
      );

      if (!result.success) {
        throw new Error(result.errors?.[0]?.message || '加载失败');
      }

      KVState.keys = result.result || [];
      renderKvKeys();
    } catch (e) {
      console.error('Load KV keys failed:', e);
      if (window.Toast) Toast.error('加载 KV 键列表失败: ' + e.message);
    } finally {
      KVState.loading = false;
    }
  }

  // 渲染键列表
  function renderKvKeys() {
    const container = document.getElementById('kv-keys-list');
    if (!container) return;

    if (KVState.keys.length === 0) {
      container.innerHTML = '<div class="text-center text-sm text-slate-400 py-8">暂无键值</div>';
      return;
    }

    container.innerHTML = KVState.keys.map(key => {
      const isSelected = KVState.currentKey === key.name;
      return `
        <button onclick="KvManager.selectKey('${escapeHtml(key.name)}')" 
          class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
            isSelected 
              ? 'bg-cf-orange/10 text-cf-orange border border-cf-orange/30' 
              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
          }">
          <div class="font-mono truncate">${escapeHtml(key.name)}</div>
          ${key.expiration ? `<div class="text-xs text-slate-400 mt-0.5">过期: ${new Date(key.expiration).toLocaleString()}</div>` : ''}
        </button>
      `;
    }).join('');
  }

  // 选择键
  async function selectKey(keyName) {
    KVState.currentKey = keyName;
    renderKvKeys();
    await loadKvValue(keyName);
  }

  // 加载键值
  async function loadKvValue(keyName) {
    try {
      const accountId = window.appState?.currentAccount?.account_id;
      const nsId = KVState.currentNamespace?.id;
      if (!accountId || !nsId) return;

      const result = await window.cfRequest('GET',
        `/accounts/${accountId}/storage/kv/namespaces/${nsId}/values/${encodeURIComponent(keyName)}`
      );

      // KV value API 直接返回字符串
      KVState.keyValue = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      renderKvValuePanel();
    } catch (e) {
      console.error('Load KV value failed:', e);
      KVState.keyValue = '';
      if (window.Toast) Toast.error('加载键值失败: ' + e.message);
    }
  }

  // 渲染值面板
  function renderKvValuePanel() {
    const panel = document.getElementById('kv-value-panel');
    if (!panel) return;

    const keyName = KVState.currentKey;
    const value = KVState.keyValue || '';

    // 尝试格式化 JSON
    let formattedValue = value;
    let isJson = false;
    try {
      const parsed = JSON.parse(value);
      formattedValue = JSON.stringify(parsed, null, 2);
      isJson = true;
    } catch (e) {
      // 不是 JSON，保持原样
    }

    panel.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <div class="font-mono text-sm text-slate-600 dark:text-slate-400 truncate flex-1 mr-4">
          <span class="text-cf-orange">${escapeHtml(keyName)}</span>
        </div>
        <div class="flex gap-2 shrink-0">
          <button onclick="KvManager.copyValue()" class="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" title="复制值">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
          </button>
          <button onclick="KvManager.saveValue()" class="p-2 rounded-lg bg-cf-orange text-white hover:bg-orange-600 transition-colors" title="保存">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
          </button>
          <button onclick="KvManager.deleteKey()" class="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors" title="删除">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
          </button>
        </div>
      </div>
      <div class="flex-1 relative">
        <textarea id="kv-value-editor" 
          class="w-full h-full min-h-[300px] p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-sm resize-none focus:ring-2 focus:ring-cf-orange/50 focus:border-cf-orange outline-none"
          spellcheck="false"
          placeholder="键值内容...">${escapeHtml(formattedValue)}</textarea>
        ${isJson ? '<span class="absolute top-2 right-2 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded-full">JSON</span>' : ''}
      </div>
      <div class="mt-3 flex items-center justify-between text-xs text-slate-400">
        <span>${value.length} 字符</span>
        <span>${isJson ? '自动格式化 JSON' : '纯文本'}</span>
      </div>
    `;
  }

  // 保存值
  async function saveValue() {
    try {
      const textarea = document.getElementById('kv-value-editor');
      if (!textarea) return;

      const value = textarea.value;
      const accountId = window.appState?.currentAccount?.account_id;
      const nsId = KVState.currentNamespace?.id;
      const keyName = KVState.currentKey;

      if (!accountId || !nsId || !keyName) return;

      await window.cfRequest('PUT',
        `/accounts/${accountId}/storage/kv/namespaces/${nsId}/values/${encodeURIComponent(keyName)}`,
        value,
        { 'Content-Type': 'text/plain' }
      );

      KVState.keyValue = value;
      if (window.Toast) Toast.success('保存成功');
    } catch (e) {
      console.error('Save KV value failed:', e);
      if (window.Toast) Toast.error('保存失败: ' + e.message);
    }
  }

  // 复制值
  function copyValue() {
    const textarea = document.getElementById('kv-value-editor');
    if (!textarea) return;
    navigator.clipboard.writeText(textarea.value).then(() => {
      if (window.Toast) Toast.success('已复制到剪贴板');
    });
  }

  // 删除键
  async function deleteKey() {
    if (!confirm('确定要删除这个键吗？')) return;
    try {
      const accountId = window.appState?.currentAccount?.account_id;
      const nsId = KVState.currentNamespace?.id;
      const keyName = KVState.currentKey;
      if (!accountId || !nsId || !keyName) return;

      await window.cfRequest('DELETE',
        `/accounts/${accountId}/storage/kv/namespaces/${nsId}/values/${encodeURIComponent(keyName)}`
      );

      KVState.currentKey = null;
      KVState.keyValue = null;
      await loadKvKeys(nsId);
      document.getElementById('kv-value-panel').innerHTML = `
        <div class="flex-1 flex items-center justify-center text-slate-400">
          <div class="text-center">
            <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"></path>
            </svg>
            <p>选择左侧键查看或编辑</p>
          </div>
        </div>
      `;
      if (window.Toast) Toast.success('删除成功');
    } catch (e) {
      console.error('Delete KV key failed:', e);
      if (window.Toast) Toast.error('删除失败: ' + e.message);
    }
  }

  // 显示添加键对话框
  function showAddKey() {
    const keyName = prompt('请输入键名：');
    if (!keyName) return;
    KVState.currentKey = keyName;
    KVState.keyValue = '';
    renderKvValuePanel();
  }

  // 辅助函数
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 暴露 API
  window.KvManager = {
    init: initKvManager,
    open: openKvBrowser,
    selectKey,
    saveValue,
    copyValue,
    deleteKey,
    showAddKey,
    state: KVState
  };

  // 初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initKvManager);
  } else {
    initKvManager();
  }

})();
