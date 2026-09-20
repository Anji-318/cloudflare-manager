/**
 * D1 数据库管理模块 - 完善数据浏览、查询和编辑功能
 */

(function() {
  'use strict';

  const D1State = {
    currentDatabase: null,
    tables: [],
    currentTable: null,
    rows: [],
    columns: [],
    loading: false,
    pageSize: 50,
    currentPage: 1,
    totalRows: 0
  };

  // 初始化
  function init() {
    // 可以在这里添加全局事件监听
  }

  // 获取 D1 数据库详情
  async function getDatabaseDetails(dbId) {
    try {
      const accountId = window.appState?.currentAccount?.account_id;
      if (!accountId) throw new Error('未选择账户');

      const result = await window.cfRequest('GET',
        `/accounts/${accountId}/d1/database/${dbId}`
      );

      if (!result.success) {
        throw new Error(result.errors?.[0]?.message || '获取数据库详情失败');
      }

      return result.result;
    } catch (e) {
      console.error('Get D1 database details failed:', e);
      throw e;
    }
  }

  // 执行 SQL 查询
  async function executeQuery(dbId, query) {
    try {
      const accountId = window.appState?.currentAccount?.account_id;
      if (!accountId) throw new Error('未选择账户');

      const result = await window.cfRequest('POST',
        `/accounts/${accountId}/d1/database/${dbId}/query`,
        { sql: query }
      );

      if (!result.success) {
        throw new Error(result.errors?.[0]?.message || '查询执行失败');
      }

      return result.result;
    } catch (e) {
      console.error('Execute D1 query failed:', e);
      throw e;
    }
  }

  // 获取表列表
  async function getTables(dbId) {
    try {
      // 通过查询 sqlite_master 获取表列表
      const result = await executeQuery(dbId,
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      );

      if (result && result[0] && result[0].results) {
        return result[0].results.map(r => r.name);
      }
      return [];
    } catch (e) {
      console.error('Get D1 tables failed:', e);
      return [];
    }
  }

  // 获取表结构
  async function getTableSchema(dbId, tableName) {
    try {
      const result = await executeQuery(dbId, `PRAGMA table_info(${escapeIdentifier(tableName)})`);
      if (result && result[0] && result[0].results) {
        return result[0].results;
      }
      return [];
    } catch (e) {
      console.error('Get table schema failed:', e);
      return [];
    }
  }

  // 分页查询表数据
  async function queryTableData(dbId, tableName, options = {}) {
    const { page = 1, pageSize = 50, orderBy = 'rowid', orderDir = 'ASC', where = '' } = options;
    const offset = (page - 1) * pageSize;

    try {
      // 先获取总数
      const countResult = await executeQuery(dbId,
        `SELECT COUNT(*) as total FROM ${escapeIdentifier(tableName)}${where ? ' WHERE ' + where : ''}`
      );
      const total = countResult?.[0]?.results?.[0]?.total || 0;

      // 分页查询
      const query = `SELECT * FROM ${escapeIdentifier(tableName)}${where ? ' WHERE ' + where : ''} ORDER BY ${escapeIdentifier(orderBy)} ${orderDir} LIMIT ${pageSize} OFFSET ${offset}`;
      const result = await executeQuery(dbId, query);

      return {
        rows: result?.[0]?.results || [],
        total,
        page,
        pageSize
      };
    } catch (e) {
      console.error('Query table data failed:', e);
      throw e;
    }
  }

  // 插入数据
  async function insertRow(dbId, tableName, data) {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map(() => '?').join(',');

    const query = `INSERT INTO ${escapeIdentifier(tableName)} (${columns.map(escapeIdentifier).join(',')}) VALUES (${placeholders})`;
    return await executeQuery(dbId, query);
  }

  // 更新数据
  async function updateRow(dbId, tableName, data, primaryKey, primaryKeyValue) {
    const setClause = Object.keys(data)
      .filter(k => k !== primaryKey)
      .map(k => `${escapeIdentifier(k)} = ?`)
      .join(', ');

    const values = Object.keys(data)
      .filter(k => k !== primaryKey)
      .map(k => data[k]);

    const query = `UPDATE ${escapeIdentifier(tableName)} SET ${setClause} WHERE ${escapeIdentifier(primaryKey)} = ?`;
    values.push(primaryKeyValue);

    return await executeQuery(dbId, query);
  }

  // 删除数据
  async function deleteRow(dbId, tableName, primaryKey, primaryKeyValue) {
    const query = `DELETE FROM ${escapeIdentifier(tableName)} WHERE ${escapeIdentifier(primaryKey)} = ?`;
    return await executeQuery(dbId, query);
  }

  // SQL 标识符转义
  function escapeIdentifier(identifier) {
    return '`' + String(identifier).replace(/`/g, '``') + '`';
  }

  // 创建数据库备份 (导出为 SQL)
  async function exportDatabase(dbId) {
    try {
      const tables = await getTables(dbId);
      let sql = '-- D1 Database Export\n';
      sql += `-- Generated: ${new Date().toISOString()}\n\n`;

      for (const tableName of tables) {
        sql += `\n-- Table: ${tableName}\n`;

        // 获取表结构
        const schema = await getTableSchema(dbId, tableName);

        // 获取所有数据
        const result = await executeQuery(dbId, `SELECT * FROM ${escapeIdentifier(tableName)}`);
        const rows = result?.[0]?.results || [];

        for (const row of rows) {
          const columns = Object.keys(row);
          const values = Object.values(row).map(v => {
            if (v === null) return 'NULL';
            if (typeof v === 'number') return v;
            return `'${String(v).replace(/'/g, "''")}'`;
          });

          sql += `INSERT INTO ${escapeIdentifier(tableName)} (${columns.map(escapeIdentifier).join(', ')}) VALUES (${values.join(', ')});\n`;
        }
      }

      return sql;
    } catch (e) {
      console.error('Export database failed:', e);
      throw e;
    }
  }

  // 创建查询历史存储
  function saveQueryHistory(query) {
    try {
      const history = JSON.parse(localStorage.getItem('d1_query_history') || '[]');
      history.unshift({
        query: query.substring(0, 500),
        timestamp: Date.now()
      });
      // 保留最近 50 条
      if (history.length > 50) history.length = 50;
      localStorage.setItem('d1_query_history', JSON.stringify(history));
    } catch (e) {
      console.error('Save query history failed:', e);
    }
  }

  function getQueryHistory() {
    try {
      return JSON.parse(localStorage.getItem('d1_query_history') || '[]');
    } catch (e) {
      return [];
    }
  }

  // 暴露 API
  window.D1Manager = {
    init,
    getDatabaseDetails,
    executeQuery,
    getTables,
    getTableSchema,
    queryTableData,
    insertRow,
    updateRow,
    deleteRow,
    exportDatabase,
    saveQueryHistory,
    getQueryHistory,
    state: D1State
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
