/**
 * 统一日志处理模块（支持多级日志与UI反馈）
 * 集成控制台日志记录与用户提示功能
 */

// 日志级别枚举
const LOG_LEVEL = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR'
};

// 日志颜色配置（控制台输出）
const CONSOLE_COLORS = {
  [LOG_LEVEL.INFO]: '#909399',
  [LOG_LEVEL.WARN]: '#e6a23c',
  [LOG_LEVEL.ERROR]: '#f56c6c'
};

// UI提示配置
const UI_CONFIG = {
  [LOG_LEVEL.INFO]: { icon: 1, time: 2000 },
  [LOG_LEVEL.WARN]: { icon: 0, time: 3000 },
  [LOG_LEVEL.ERROR]: { icon: 2, time: 5000 }
};

/**
 * 生成带上下文的日志信息
 * @param {string} level - 日志级别
 * @param {string} message - 日志信息
 * @param {Object} [context] - 上下文对象
 * @param {Error} [error] - 错误对象
 */
function log(level, message, context = {}, error = null) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context: JSON.parse(JSON.stringify(context)),
    error: error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : null
  };

  // 控制台输出
  console.log(`%c[${logEntry.timestamp}] ${level} - ${message}`, `color: ${CONSOLE_COLORS[level]};`, logEntry);

  // UI反馈（仅ERROR级别显示完整堆栈）
  const displayMsg = level === LOG_LEVEL.ERROR 
    ? `${message}: ${error?.message || '未知错误'}` 
    : message;
}

// 快捷方法
const logger = {
  info: (msg, ctx) => log(LOG_LEVEL.INFO, msg, ctx),
  warn: (msg, ctx) => log(LOG_LEVEL.WARN, msg, ctx),
  error: (msg, error, ctx) => log(LOG_LEVEL.ERROR, msg, ctx, error)
};

export default logger;