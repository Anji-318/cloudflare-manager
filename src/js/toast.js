/**
 * Toast 通知系统 - 替代原生 alert()
 * 提供美观、非阻塞的用户反馈
 */

(function() {
  'use strict';

  const Toast = {
    container: null,
    defaults: {
      duration: 3000,
      position: 'top-right',
      maxVisible: 5
    },
    queue: [],
    visible: [],

    init() {
      if (this.container) return;
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      this.container.className = 'fixed z-[9999] flex flex-col gap-2 pointer-events-none';
      this.container.style.cssText = 'top: 20px; right: 20px; max-width: 400px;';
      document.body.appendChild(this.container);
    },

    create(options) {
      this.init();
      const { message, type = 'info', duration = this.defaults.duration } = options;

      const toast = document.createElement('div');
      toast.className = `toast-item pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-lg border backdrop-blur-sm transform transition-all duration-300 translate-x-full opacity-0`;

      const colors = {
        success: 'bg-emerald-50/90 dark:bg-emerald-900/90 border-emerald-200 dark:border-emerald-700 text-emerald-800 dark:text-emerald-100',
        error: 'bg-red-50/90 dark:bg-red-900/90 border-red-200 dark:border-red-700 text-red-800 dark:text-red-100',
        warning: 'bg-amber-50/90 dark:bg-amber-900/90 border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-100',
        info: 'bg-blue-50/90 dark:bg-blue-900/90 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-100'
      };

      const icons = {
        success: '<svg class="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>',
        error: '<svg class="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>',
        warning: '<svg class="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.054 0 1.67-1.207 1.024-2.063L13.024 3.72c-.553-.79-1.495-.79-2.048 0L4.122 18.937C3.476 19.793 4.092 21 5.146 21H18z"></path></svg>',
        info: '<svg class="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
      };

      toast.className += ' ' + (colors[type] || colors.info);
      toast.innerHTML = `
        ${icons[type] || icons.info}
        <div class="flex-1 text-sm leading-relaxed">${this.escapeHtml(message)}</div>
        <button onclick="Toast.dismiss(this.parentElement)" class="shrink-0 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors -mr-1 -mt-1">
          <svg class="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      `;

      this.container.appendChild(toast);
      this.visible.push(toast);

      // Animate in
      requestAnimationFrame(() => {
        toast.classList.remove('translate-x-full', 'opacity-0');
      });

      // Auto dismiss
      const timer = setTimeout(() => this.dismiss(toast), duration);
      toast._timer = timer;

      // Limit visible toasts
      while (this.visible.length > this.defaults.maxVisible) {
        this.dismiss(this.visible[0]);
      }

      return toast;
    },

    dismiss(toast) {
      if (!toast || toast._dismissing) return;
      toast._dismissing = true;
      clearTimeout(toast._timer);

      toast.classList.add('translate-x-full', 'opacity-0');
      setTimeout(() => {
        if (toast.parentElement) {
          toast.parentElement.removeChild(toast);
        }
        const idx = this.visible.indexOf(toast);
        if (idx > -1) this.visible.splice(idx, 1);
      }, 300);
    },

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },

    // Convenience methods
    success(msg, duration) { return this.create({ message: msg, type: 'success', duration }); },
    error(msg, duration) { return this.create({ message: msg, type: 'error', duration }); },
    warning(msg, duration) { return this.create({ message: msg, type: 'warning', duration }); },
    info(msg, duration) { return this.create({ message: msg, type: 'info', duration }); }
  };

  // Expose globally
  window.Toast = Toast;

  // Override native alert for a smoother experience (optional, can be enabled)
  window.showToast = function(message, type = 'info', duration = 3000) {
    return Toast.create({ message, type, duration });
  };

})();
