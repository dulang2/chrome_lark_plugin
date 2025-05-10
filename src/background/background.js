// background.js中的代码在浏览器中是独立一个域的，不能直接通过路径访问其他文件。
// 常量定义
const POPUP_WIDTH = 400;
const POPUP_MARGIN = 100;

// 常量定义
const STORAGE_KEY = {
  DEFAULT_RECEIVER: 'defaultReceiver',
  DEFAULT_RECEIVER_TYPE: 'defaultReceiverType',
  MESSAGE_FORMAT: 'messageFormat',
  SEND_MODE: 'sendMode',
  APP_ID: 'appId',
  APP_SECRET: 'appSecret',
  WEBHOOK_URL: 'webhookUrl',
  CHAT_LIST: 'chatList',
  USER_LIST: 'userList'
};

// 获取主显示器信息
async function getPrimaryDisplayInfo() {
  try {
    const displays = await chrome.system.display.getInfo();
    return displays.find(d => d.isPrimary) || displays[0];
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ERROR - 获取显示器信息失败 | 上下文: getPrimaryDisplayInfo`, error);
    return { workArea: { width: 1024, left: 0 } }; // 默认值
  }
}

// 计算窗口位置
async function calculateWindowPosition(width) {
  const display = await getPrimaryDisplayInfo();
  return Math.max(display.workArea.left + display.workArea.width - width - POPUP_MARGIN, 0);
}

// 初始化上下文菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'sendCustomMessage',
    title: '发送自定义消息到飞书',
    contexts: ['page', 'action']
  });
});

// 处理上下文菜单点击
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'sendCustomMessage') {
    // 打开自定义消息窗口
    // 调整自定义消息窗口大小并添加调试日志
    console.log(`[${new Date().toISOString()}] INFO - 正在创建自定义消息窗口`);
    const windowSize = { width: 500, height: 400 };
    console.log(`[${new Date().toISOString()}] INFO - 窗口尺寸: ${JSON.stringify(windowSize)}`);
    const windowPosition = await calculateWindowPosition(windowSize.width);
    console.log(`[${new Date().toISOString()}] INFO - 窗口位置: ${windowPosition}`);
    chrome.windows.create({
      url: 'src/popup/popup.html',
      type: 'popup',
      width: windowSize.width,
      height: windowSize.height,
      top: 100,
      left: windowPosition
    });
  }
});

// 处理来自popup页面的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sendMessage') {
    // 从 request 中获取 content, receiver, 和新增的 sendModeOverride
    // receiver 可能为 null (如果 popup 选择的是默认目标)
    // sendModeOverride 可能为 'api' 或 null
    console.log(`[${new Date().toISOString()}] INFO - 收到 sendMessage 请求 | 内容: ${request.content ? '有' : '无'} | 接收者: ${JSON.stringify(request.receiver)} | 模式覆盖: ${request.sendModeOverride}`);
    sendMessage(request.content, request.receiver, request.sendModeOverride)
      .then(() => {
        console.log(`[${new Date().toISOString()}] INFO - sendMessage 成功响应 popup.js`);
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error(`[${new Date().toISOString()}] ERROR - sendMessage 失败响应 popup.js | 错误: ${error.message}`);
        sendResponse({ success: false, error: error.message });
      });
    return true; // 保持消息通道开启以支持异步响应
  }
  // 对于未明确处理的 action，最好返回 false 或 undefined，以允许其他监听器处理（如果存在）
  // 如果这是唯一的监听器，或者其他 action 不应在此处理，则可以省略 else 或显式返回 false。
  return false; 
});

// 处理工具栏图标点击
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // 添加调试日志
    console.log(`[${new Date().toISOString()}] INFO - 工具栏图标被点击 | TabID: ${tab.id} | URL: ${tab.url}`);

    // 获取配置信息，确保包含 defaultReceiverType
    const config = await chrome.storage.sync.get([
      STORAGE_KEY.SEND_MODE,
      STORAGE_KEY.DEFAULT_RECEIVER,
      STORAGE_KEY.DEFAULT_RECEIVER_TYPE, // 确保获取默认接收者类型
      STORAGE_KEY.MESSAGE_FORMAT
    ]);
    console.log(`[${new Date().toISOString()}] INFO - 获取配置信息成功 | 上下文: actionOnClicked | 配置: ${JSON.stringify(config)}`);

    // 验证配置信息
    if (!config) {
      console.error(`[${new Date().toISOString()}] ERROR - 无法获取配置信息 | 上下文: actionOnClicked`);
      return;
    }

    // Webhook模式不需要默认接收者，但API模式需要
    if (config.sendMode === 'api' && (!config.defaultReceiver || !config.defaultReceiverType)) {
      console.error(`[${new Date().toISOString()}] ERROR - API模式下未设置默认接收者或类型 | 上下文: actionOnClickedValidation | 配置: ${JSON.stringify(config)}`);
      // 此处可以添加用户通知逻辑，例如打开选项页
      chrome.runtime.openOptionsPage();
      return;
    }

    const messageFormat = config.messageFormat || 'text';
    const message = messageFormat === 'markdown' 
      ? `[${tab.title}](${tab.url})`
      : tab.url;

    // 根据模式发送消息
    // 从工具栏图标点击发送时，总是遵循后台配置，不覆盖发送模式 (sendModeOverride = null)
    if (config.sendMode === 'api') {
      const defaultApiReceiver = {
        type: config.defaultReceiverType,
        id: config.defaultReceiver
      };
      await sendMessage(message, defaultApiReceiver, null); // explicitReceiver, sendModeOverride = null
    } else {
      // Webhook模式，不需要接收者信息
      await sendMessage(message, null, null); // explicitReceiver = null, sendModeOverride = null
    }
  } catch (error) {
    const errorMessage = error.message || '未知错误';
    const stackTrace = error.stack || '无堆栈信息';
    console.error(`[${new Date().toISOString()}] ERROR - 发送消息失败 (action.onClicked) | 错误: ${errorMessage}\n堆栈: ${stackTrace}`);
    // 创建并显示通知
    chrome.notifications.create({
      type: 'basic',
      iconUrl: '../icons/icon48.png', // 确保图标路径正确
      title: '发送消息失败',
      message: `错误详情: ${errorMessage}。请检查配置或联系开发者。`,
      priority: 2
    });
  }
});

// 发送消息到飞书 (重构版本)
// 常量定义
const BADGE_DISPLAY_TIME = 3000; // 徽章显示时间3秒

async function sendMessage(content, explicitReceiverFromPopup = null, sendModeOverrideFromPopup = null) {
  try {
    console.log(`[${new Date().toISOString()}] INFO - sendMessage 调用 | 内容: ${content ? '有' : '无'} | explicitReceiver: ${JSON.stringify(explicitReceiverFromPopup)} | sendModeOverride: ${sendModeOverrideFromPopup}`);
    // 获取所有相关配置，包括默认接收者信息
    const config = await chrome.storage.sync.get([
      STORAGE_KEY.SEND_MODE,
      STORAGE_KEY.APP_ID,
      STORAGE_KEY.APP_SECRET,
      STORAGE_KEY.WEBHOOK_URL,
      STORAGE_KEY.DEFAULT_RECEIVER, // Default receiver ID
      STORAGE_KEY.DEFAULT_RECEIVER_TYPE // Default receiver type
    ]);

    let determinedSendMode = config.sendMode; // 默认使用存储的发送模式
    let targetReceiver = null; // 最终用于发送的接收者对象

    // 步骤 1: 确定最终的发送模式
    if (sendModeOverrideFromPopup === 'api') {
      determinedSendMode = 'api';
      console.log(`[${new Date().toISOString()}] INFO - 发送模式被 popup.js 强制指定为 API`);
    }
    console.log(`[${new Date().toISOString()}] INFO - 最终发送模式确定为: ${determinedSendMode}`);

    // 步骤 2: 如果是 API 模式，确定接收者
    if (determinedSendMode === 'api') {
      if (sendModeOverrideFromPopup === 'api' && explicitReceiverFromPopup) {
        // 情况 A: Popup 指定了接收者并强制 API 模式 (例如，从下拉框选择特定用户/群组)
        targetReceiver = explicitReceiverFromPopup;
        console.log(`[${new Date().toISOString()}] INFO - 使用 popup.js 提供的特定接收者: ${JSON.stringify(targetReceiver)}`);
      } else if (explicitReceiverFromPopup && determinedSendMode === 'api') {
        // 情况 B: 调用方提供了接收者 (如 action.onClicked)，且最终模式是 API (可能是默认或被其他逻辑设定，虽然当前场景下 override 为 null)
        targetReceiver = explicitReceiverFromPopup;
        console.log(`[${new Date().toISOString()}] INFO - 使用调用方提供的接收者 (模式: API): ${JSON.stringify(targetReceiver)}`);
      } else {
        // 情况 C: API 模式 (无论是默认还是被强制)，但未提供特定接收者 (例如，popup选择了“默认目标”或 action.onClicked 且其默认接收者未被视为 explicitReceiverFromPopup)
        // 此时使用后台配置的默认接收者
        if (!config.defaultReceiver || !config.defaultReceiverType) {
          const errorMsg = 'API模式下未配置默认接收者或类型，请先在设置页面配置。';
          console.error(`[${new Date().toISOString()}] ERROR - ${errorMsg} | 上下文: sendMessage`);
          chrome.runtime.openOptionsPage(); // 提示用户配置
          throw new Error(errorMsg);
        }
        targetReceiver = {
          type: config.defaultReceiverType,
          id: config.defaultReceiver
        };
        console.log(`[${new Date().toISOString()}] INFO - 使用后台配置的默认接收者: ${JSON.stringify(targetReceiver)}`);
      }

      // API 模式下，对最终确定的 targetReceiver 进行验证
      if (!targetReceiver || typeof targetReceiver !== 'object' || !targetReceiver.type || !targetReceiver.id) {
        const errorMsg = `API模式下接收者信息无效或不完整。接收者: ${JSON.stringify(targetReceiver)}`;
        console.error(`[${new Date().toISOString()}] ERROR - ${errorMsg} | 上下文: sendMessage`);
        throw new Error(errorMsg);
      }
    }
    // 如果 determinedSendMode 不是 'api' (即 'webhook'), targetReceiver 将保持 null，sendViaWebhook 不需要它。

    // 步骤 3: 执行发送操作
    if (determinedSendMode === 'api') {
      await sendViaApi(content, targetReceiver, config);
    } else {
      await sendViaWebhook(content, config);
    }

    // 发送成功状态提示
    await chrome.action.setBadgeText({ text: '√' });
    await chrome.action.setBadgeBackgroundColor({ color: '#00ff00' });
    console.log(`[${new Date().toISOString()}] INFO - 消息发送成功状态已更新`);

  } catch (error) {
    // 发送失败状态提示
    await chrome.action.setBadgeText({ text: '×' });
    await chrome.action.setBadgeBackgroundColor({ color: '#ff0000' });
    console.error(`[${new Date().toISOString()}] ERROR - 消息发送失败状态已更新`);
    
    // 保持错误抛出以便上层处理
    throw error;
  } finally {
    // 添加自动清除状态的定时器
    setTimeout(async () => {
      await chrome.action.setBadgeText({ text: '' });
      console.log(`[${new Date().toISOString()}] INFO - 清除状态徽章`);
    }, BADGE_DISPLAY_TIME);
  }
}

// 通过API发送消息
async function sendViaApi(content, receiver, config) {
  // 获取tenant_access_token
  const tokenResponse = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      'app_id': config.appId,
      'app_secret': config.appSecret
    })
  });

  const tokenData = await tokenResponse.json();
  if (tokenData.code !== 0) {
    throw new Error(`获取token失败: ${tokenData.msg}`);
  }

  // 发送消息
  // 验证receive_id格式
const validateReceiveId = (id, type) => {
  // 添加调试信息
  console.log('Validating ID', { context: 'validateReceiveId', id, type });
  
  // 确保type和id格式匹配
  if (type === 'chat_id') {
    if (!/^oc_/.test(id)) {
      throw new Error(`群聊ID格式错误，应以oc_开头，当前ID: ${id}`);
    }
  } else if (type === 'open_id') {
    if (!/^ou_/.test(id)) {
      throw new Error(`用户ID格式错误，应以ou_开头，当前ID: ${id}`);
    }
  } else {
    throw new Error(`未知的ID类型: ${type}`);
  }
};

// 验证接收者ID格式
if (!receiver || !receiver.id) {
  throw new Error('接收者ID不能为空');
}
validateReceiveId(receiver.id, receiver.type === 'chat' ? 'chat_id' : 'open_id');

const messageBody = {
    receive_id: receiver.id,
    msg_type: 'text',
    content: JSON.stringify({ text: content }),
    receive_id_type: receiver.type === 'chat' ? 'chat_id' : 'open_id',
    uuid: Math.random().toString(36).slice(2, 15) // 添加唯一标识符
  };
  // 确保receive_id_type与receive_id匹配
  if (!messageBody.receive_id_type) {
    throw new Error('receive_id_type字段不能为空');
  }

  const response = await fetch('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=' + messageBody.receive_id_type, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenData.tenant_access_token}`
    },
    body: JSON.stringify(messageBody)
  });

  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(`发送消息失败: ${data.msg} (错误代码: ${data.code}, 请求ID: ${data.request_id || '未知'})`);
  }
}

// 通过Webhook发送消息
async function sendViaWebhook(content, config) {
  const response = await fetch(config.webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      msg_type: 'text',
      content: {
        text: content
      }
    })
  });

  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(`发送消息失败: ${data.msg} (错误代码: ${data.code}, 请求ID: ${data.request_id || '未知'})`);
  }
}

// 新增屏幕信息获取函数
async function getScreenInfo() {
  try {
    const displays = await chrome.system.display.getInfo();
    return displays[0].bounds; // 返回主显示器信息
  } catch (error) {
    console.error('获取屏幕信息失败', error, { context: 'getScreenInfo' });
    return { width: 1920, height: 1080 }; // 默认值
  }
}

// 修改后的窗口创建函数
async function createPopupWindow(url) {
  try {
    // 获取主显示器信息
    const displays = await chrome.system.display.getInfo();
    const primaryDisplay = displays.find(d => d.isPrimary) || displays[0];
    
    // 窗口尺寸常量
    const WINDOW_WIDTH = 400;
    const WINDOW_HEIGHT = 600;
    
    // 计算窗口位置（右下角）带容错机制
    const left = Math.max(
      (primaryDisplay?.workArea?.left || 0) + 
      (primaryDisplay?.workArea?.width || 1920) - WINDOW_WIDTH - 10,
      0
    );
    const top = Math.max(
      (primaryDisplay?.workArea?.top || 0) +
      (primaryDisplay?.workArea?.height || 1080) - WINDOW_HEIGHT - 50,
      0
    );

    return await chrome.windows.create({
      url: url,
      type: 'popup',
      width: WINDOW_WIDTH,
      height: WINDOW_HEIGHT,
      left: Math.max(left, 0),
      top: Math.max(top, 0),
      focused: true
    });
  } catch (error) {
    console.error('创建窗口失败', error, { context: 'createPopupWindow' });
    throw new Error('窗口创建失败: ' + error.message);
  }
}