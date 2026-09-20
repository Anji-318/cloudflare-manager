/**
 * Tunnels 管理模块 - 完善隧道配置和监控
 */

(function() {
  'use strict';

  const TunnelsState = {
    tunnels: [],
    currentTunnel: null,
    tunnelToken: null,
    loading: false
  };

  // Cloudflare Tunnel API 封装
  const TunnelAPI = {
    // 获取账户下的所有隧道
    async listTunnels(accountId, params = {}) {
      const { name, status, per_page = 50, page = 1 } = params;
      let url = `/accounts/${accountId}/cfd_tunnel?per_page=${per_page}&page=${page}`;
      if (name) url += `&name=${encodeURIComponent(name)}`;
      if (status) url += `&status=${status}`;

      const result = await window.cfRequest('GET', url);
      if (!result.success) throw new Error(result.errors?.[0]?.message || '获取隧道列表失败');
      return result.result || [];
    },

    // 获取隧道详情
    async getTunnel(accountId, tunnelId) {
      const result = await window.cfRequest('GET', `/accounts/${accountId}/cfd_tunnel/${tunnelId}`);
      if (!result.success) throw new Error(result.errors?.[0]?.message || '获取隧道详情失败');
      return result.result;
    },

    // 创建新隧道
    async createTunnel(accountId, name) {
      const result = await window.cfRequest('POST', `/accounts/${accountId}/cfd_tunnel`, {
        name,
        config_src: 'cloudflare'
      });
      if (!result.success) throw new Error(result.errors?.[0]?.message || '创建隧道失败');
      return result.result;
    },

    // 删除隧道
    async deleteTunnel(accountId, tunnelId) {
      const result = await window.cfRequest('DELETE', `/accounts/${accountId}/cfd_tunnel/${tunnelId}`);
      if (!result.success) throw new Error(result.errors?.[0]?.message || '删除隧道失败');
      return result.result;
    },

    // 获取隧道的 Token
    async getTunnelToken(accountId, tunnelId) {
      const result = await window.cfRequest('GET', `/accounts/${accountId}/cfd_tunnel/${tunnelId}/token`);
      if (!result.success) throw new Error(result.errors?.[0]?.message || '获取隧道 Token 失败');
      return result.result;
    },

    // 获取隧道的连接信息
    async getTunnelConnections(accountId, tunnelId) {
      const result = await window.cfRequest('GET', `/accounts/${accountId}/cfd_tunnel/${tunnelId}/connections`);
      if (!result.success) throw new Error(result.errors?.[0]?.message || '获取连接信息失败');
      return result.result || [];
    },

    // 获取隧道的路由配置
    async getTunnelRoutes(accountId, tunnelId) {
      // cloudflared 隧道路由在 DNS 记录中配置
      const result = await window.cfRequest('GET', `/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`);
      if (!result.success) throw new Error(result.errors?.[0]?.message || '获取路由配置失败');
      return result.result || [];
    },

    // 获取隧道的 DNS 记录
    async getTunnelDnsRecords(zoneId, tunnelId) {
      const result = await window.cfRequest('GET', `/zones/${zoneId}/dns_records?type=CNAME`);
      if (!result.success) throw new Error(result.errors?.[0]?.message || '获取 DNS 记录失败');
      return (result.result || []).filter(r => r.content && r.content.includes(tunnelId));
    }
  };

  // 生成 cloudflared 配置文件
  function generateCloudflaredConfig(tunnel, token) {
    return `tunnel: ${tunnel.id}
credentials-file: /etc/cloudflared/${tunnel.id}.json

# 示例 ingress 规则
# ingress:
#   - hostname: app.example.com
#     service: http://localhost:8080
#   - service: http_status:404
`;
  }

  // 生成 Docker 运行命令
  function generateDockerCommand(tunnelToken) {
    return `docker run --rm cloudflare/cloudflared:latest tunnel --no-autoupdate run --token ${tunnelToken}`;
  }

  // 生成 systemd 服务配置
  function generateSystemdService(tunnelId, token) {
    return `[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=cloudflared
ExecStart=/usr/bin/cloudflared tunnel --no-autoupdate run --token ${token}
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target`;
  }

  // 格式化隧道状态
  function formatTunnelStatus(status) {
    const statusMap = {
      healthy: { text: '健康', color: 'text-emerald-500', bg: 'bg-emerald-500' },
      degraded: { text: '降级', color: 'text-amber-500', bg: 'bg-amber-500' },
      down: { text: '离线', color: 'text-red-500', bg: 'bg-red-500' },
      inactive: { text: '未激活', color: 'text-slate-400', bg: 'bg-slate-400' }
    };
    return statusMap[status] || { text: status, color: 'text-slate-400', bg: 'bg-slate-400' };
  }

  // 复制命令到剪贴板
  async function copyCommand(command) {
    try {
      await navigator.clipboard.writeText(command);
      if (window.Toast) Toast.success('命令已复制到剪贴板');
    } catch (e) {
      console.error('Copy failed:', e);
    }
  }

  // 暴露 API
  window.TunnelsManager = {
    api: TunnelAPI,
    generateCloudflaredConfig,
    generateDockerCommand,
    generateSystemdService,
    formatTunnelStatus,
    copyCommand,
    state: TunnelsState
  };

})();
