import logger from '../utils/logger.js';

import { STORAGE_KEY } from '../utils/constants.js';

try{
      // 调用background.js中的sendMessage函数
      await sendMessage(message, receiverObj);
      logger.info('消息发送成功');
    } catch (error) {
      logger.error('消息发送失败', error, { context: 'sendMessage' });
    }

// 初始化Layui模块
layui.use(['form', 'layer'], function() {
  const form = layui.form;
  const layer = layui.layer;

  // 从chrome.storage.sync获取配置数据
  

  // 加载接收者列表
  loadReceivers();

  // 监听表单提交事件
  // 使用 jQuery 绑定事件
  $('#sendButton').on('click', async function(e){
    e.preventDefault();
    const message = $('textarea[name="message"]').val(); // 使用 jQuery 获取输入框的值
    const selectedReceiverValue = $('select[name="receiver"]').val(); // 使用 jQuery 获取选中的接收者值

    // 消息内容不能为空验证
    if (!message || message.trim() === '') {
        layer.msg('消息内容不能为空！', { icon: 5 });
        return; // 阻止发送空消息
    }

    try {
      let receiverObj = null; // 初始化接收者对象
      let sendModeOverride = null; // 初始化发送模式覆盖标记

      if (selectedReceiverValue === 'default') {
        // 如果选择“默认目标”，则不传递接收者信息和发送模式覆盖标记
        // background.js 将使用其存储的配置（包括发送模式和默认接收者）
        logger.info('使用默认目标发送，交由 background.js 处理配置。');
      } else {
        // 用户选择了特定的群聊或用户
        const [type, id] = selectedReceiverValue.split(':');
        if (!type || !id) {
          // 确保分割后 type 和 id 都存在
          throw new Error('选择的接收者格式无效，无法解析类型或ID。');
        }
        receiverObj = { type, id }; // 构建接收者对象
        sendModeOverride = 'api'; // 强制使用 API 模式
        logger.info('选择特定接收者，强制使用 API 模式发送。', { receiverObj });
      }

      // 调试日志：记录最终准备发送到后台的信息
      logger.info('准备调用 sendToBackground。', { messageContent: message ? '有效' : '空', receiverObj, sendModeOverride });

      // 调用 sendToBackground 函数，传递消息内容、接收者对象和发送模式覆盖标记
      await sendToBackground(message, receiverObj, sendModeOverride);
      layer.msg('消息已成功发送至后台处理。', { icon: 1, time: 2000 }); // 提示用户消息已提交
      
      // 成功发送后清空消息输入框
      $('textarea[name="message"]').val(''); // 使用 jQuery 清空输入框
    
    } catch (error) {
      // 记录并提示错误
      logger.error('发送消息过程中发生错误。', error, { context: 'popupSendButtonHandler' });
      layer.msg(`发送失败: ${error.message}`, { icon: 2 });
      // 失败时不清空输入框，方便用户修改
    }
    
    return false; // 阻止表单默认提交行为，防止页面刷新
  });
});

// 加载接收者列表
async function loadReceivers() {
  try {
    // 记录调试信息
    logger.info('开始加载接收者列表');
    
    // 从chrome.storage.sync获取配置数据
    const settings = await chrome.storage.sync.get([
      STORAGE_KEY.CHAT_LIST,
      STORAGE_KEY.USER_LIST,
      STORAGE_KEY.DEFAULT_RECEIVER,
      STORAGE_KEY.DEFAULT_RECEIVER_TYPE
    ]);
    
    // 验证获取到的数据
    if (!settings) {
      throw new Error('无法从chrome.storage.sync获取设置');
    }

    const chatGroup = $('#chatGroup'); // 使用 jQuery 选择器
    const userGroup = $('#userGroup'); // 使用 jQuery 选择器
    // const defaultOption = $('select[name="receiver"] option[value="default"]'); // 使用 jQuery 选择器, 此行未使用，可注释或删除

    // 清空现有选项
    chatGroup.empty(); // 使用 jQuery 清空选项
    userGroup.empty(); // 使用 jQuery 清空选项

    // 添加群聊选项
    const chatList = settings.chatList || [];
    chatList.forEach(chat => {
      const option = $('<option></option>'); // 使用 jQuery 创建元素
      option.val(`chat:${chat.id}`).text(chat.name); // 使用 jQuery 设置属性和文本
      chatGroup.append(option); // 使用 jQuery 添加选项
    });

    // 添加用户选项
    const userList = settings.userList || [];
    userList.forEach(user => {
      const option = $('<option></option>'); // 使用 jQuery 创建元素
      option.val(`user:${user.id}`).text(user.name); // 使用 jQuery 设置属性和文本
      userGroup.append(option); // 使用 jQuery 添加选项
    });

    // 设置默认选中项
    if (settings.defaultReceiver && settings.defaultReceiverType) {
      const defaultValue = `${settings.defaultReceiverType}:${settings.defaultReceiver}`;
      const select = $('select[name="receiver"]'); // 使用 jQuery 选择器
      select.val(defaultValue); // 使用 jQuery 设置选中值
      if (select.val() !== defaultValue) { // 检查是否成功设置，否则回退到默认
        select.val('default');
      }
    }

    layui.form.render('select');
  } catch (error) {
    // 记录详细错误信息并提示用户
    logger.error('加载接收者列表失败，请检查设置页面是否正确配置', error, { context: 'loadReceivers' });
    
    // 重试机制
    setTimeout(() => {
      logger.info('尝试重新加载接收者列表...', { context: 'loadReceiversRetry' });
      loadReceivers();
    }, 5000);
  }
}

// 重命名 sendMessage 为 sendToBackground 并修改其逻辑
// 功能：将消息数据发送到 background.js 进行处理
async function sendToBackground(message, receiver, sendModeOverride = null) {
    // 参数有效性验证（消息内容已在调用前验证）
    // receiver 和 sendModeOverride 可以为 null，由 background.js 处理默认逻辑

    const messageData = {
      action: 'sendMessage',
      content: message,
      receiver: receiver, // 可能为 null (例如，当选择 "默认目标" 时)
      sendModeOverride: sendModeOverride // 可能为 null (例如，当选择 "默认目标" 时)
    };

    logger.info('向后台发送消息请求。', { messageData });

    // 通过 chrome.runtime.sendMessage 与 background.js 通信
    const response = await chrome.runtime.sendMessage(messageData);

    // 处理后台脚本的响应
    if (response && response.success) {
        logger.info('后台脚本成功处理消息。');
        // 此函数不再负责UI反馈或清空输入框，这些由调用方（如事件处理器）管理
    } else {
        // 构造更详细的错误信息
        const errorMessage = response && response.error ? response.error : '后台未返回成功状态或无响应。';
        logger.error('后台脚本处理消息失败或未正确响应。', new Error(errorMessage), { responseDetails: response });
        throw new Error(`后台处理失败: ${errorMessage}`);
    }
}