import logger from '../../utils/logger.js';
import { STORAGE_KEY } from '../../utils/constants.js';
import { addItemToList } from './dom_updater.js'; // 假设 addItemToList 会被移到 dom_updater.js

// 加载保存的设置
async function loadSettings() {
  const settings = await chrome.storage.sync.get(null);

  // 设置发送模式和消息格式等
  const form = layui.form;
  form.val('settingsForm', {
    sendMode: settings.sendMode || 'webhook', // 默认webhook
    appId: settings.appId || '',
    appSecret: settings.appSecret || '',
    webhookUrl: settings.webhookUrl || '',
    messageFormat: settings.messageFormat || 'text', // 默认text
    // 只有当API模式时，才加载默认接收者类型和ID
    defaultReceiverType: settings.sendMode === 'api' ? (settings.defaultReceiverType || '') : '',
    defaultReceiver: settings.sendMode === 'api' ? (settings.defaultReceiver || '') : '',
    // 多维表格配置项
    bitableAppToken: settings.bitableAppToken || '',
    bitableTableId: settings.bitableTableId || '',
    bitableUrlFieldName: settings.bitableUrlFieldName || '链接',
    bitableTitleFieldName: settings.bitableTitleFieldName || '标题'
  });

  // 显示对应的配置区域 (API/Webhook)
  toggleConfigDisplay(settings.sendMode || 'webhook');

  // 加载群聊和用户列表 (这些不受菜单切换影响，始终加载)
  const chatList = settings.chatList || [];
  const userList = settings.userList || [];

  $('#chatList').empty(); // 清空旧列表，防止重复添加
  $('#userList').empty(); // 清空旧列表，防止重复添加

  // 使用通用函数加载列表项
  chatList.forEach(chat => addItemToList(chat, 'chat'));
  userList.forEach(user => addItemToList(user, 'user'));

  // 更新默认接收者选项 (仅当API模式时，且有类型时才加载)
  if (settings.sendMode === 'api' && (settings.defaultReceiverType || '')) {
    await updateDefaultReceiverOptions(settings.defaultReceiverType, settings.defaultReceiver);
  } else if (settings.sendMode === 'api') {
    // API模式但没有默认类型，也需要清空并准备好下拉框
    await updateDefaultReceiverOptions('', '');
  }

  // 初始化时，根据输入框类型设置正确的图标
  ['appId', 'appSecret'].forEach(fieldName => {
    const input = $(`input[name="${fieldName}"]`);
    const icon = $(`.toggle-visibility[data-target="${fieldName}"]`);
    if (input.length && icon.length) {
      if (input.attr('type') === 'text') {
        icon.removeClass('layui-icon-eye-invisible').addClass('layui-icon-eye');
      } else {
        icon.removeClass('layui-icon-eye').addClass('layui-icon-eye-invisible');
      }
    }
  });

  // 确保LayUI表单元素被正确渲染，特别是select和radio
  form.render();
}

// 校验设置项
function validateSettings(data) {
  const errorMessageDiv = $('#errorMessage');
  errorMessageDiv.empty().hide();
  const errorMessages = [];

  // 校验发送设置菜单下的内容
  if ($('#sendSettingsContent').is(':visible')) {
    if (data.sendMode === 'api') {
      if (!data.appId) {
        errorMessages.push('API模式下，App ID 不能为空。');
      }
      if (!data.appSecret) {
        errorMessages.push('API模式下，App Secret 不能为空。');
      }
      // 默认接收者类型和ID现在只在API模式下校验
      if (!data.defaultReceiverType) {
        errorMessages.push('API模式下，默认接收者类型 不能为空。');
      }
      if (!data.defaultReceiver) {
        errorMessages.push('API模式下，默认接收者 不能为空。');
      }
    } else if (data.sendMode === 'webhook') {
      if (!data.webhookUrl) {
        errorMessages.push('Webhook模式下，Webhook 地址 不能为空。');
      }
    }
    // 消息格式通常有默认值，但如果需要也可以添加校验
  }

  if (errorMessages.length > 0) {
    errorMessageDiv.find('.layui-input-block').html(errorMessages.join('<br>'));
    errorMessageDiv.show();
    return false;
  } else {
    errorMessageDiv.hide();
    errorMessageDiv.find('.layui-input-block').html('');
    return true;
  }
}

// 修改后的保存设置函数，只保存发送设置相关内容
async function saveOnlySendSettings(data) {
  try {
    const settingsToStore = {
      sendMode: data.sendMode,
      messageFormat: data.messageFormat
    };
    if (data.sendMode === 'api') {
      settingsToStore.appId = data.appId;
      settingsToStore.appSecret = data.appSecret;
      settingsToStore.defaultReceiverType = data.defaultReceiverType;
      settingsToStore.defaultReceiver = data.defaultReceiver;
      // 清除 webhookUrl，因为当前是 API 模式
      await chrome.storage.sync.remove(STORAGE_KEY.WEBHOOK_URL);
    } else if (data.sendMode === 'webhook') {
      settingsToStore.webhookUrl = data.webhookUrl;
      // 清除 API 相关设置，因为当前是 Webhook 模式
      await chrome.storage.sync.remove([STORAGE_KEY.APP_ID, STORAGE_KEY.APP_SECRET, STORAGE_KEY.DEFAULT_RECEIVER_TYPE, STORAGE_KEY.DEFAULT_RECEIVER]);
    }

    await chrome.storage.sync.set(settingsToStore);
    layer.msg('发送设置已保存', { icon: 1 });
  } catch (error) {
    logger.error('保存发送设置失败', error, { context: 'saveOnlySendSettings' });
    layui.layer.msg('保存失败，请查看控制台日志。', { icon: 2 });
  }
}

// 切换配置显示 (API/Webhook 和 默认接收者)
function toggleConfigDisplay(mode) {
  const apiConfig = $('#apiConfig'); // 使用 jQuery 对象
  const webhookConfig = $('#webhookConfig'); // 使用 jQuery 对象
  // API模式下的默认接收者类型和默认接收者表单项
  const defaultReceiverTypeItem = $('select[name="defaultReceiverType"]').closest('.layui-form-item');
  const defaultReceiverItem = $('select[name="defaultReceiver"]').closest('.layui-form-item');

  if (mode === 'api') {
    apiConfig.show();
    webhookConfig.hide();
    defaultReceiverTypeItem.show();
    defaultReceiverItem.show();
  } else {
    apiConfig.hide();
    webhookConfig.show();
    defaultReceiverTypeItem.hide();
    defaultReceiverItem.hide();
  }
  layui.form.render(); // 确保切换后表单元素状态正确渲染
}

// 更新默认接收者下拉列表的选项
async function updateDefaultReceiverOptions(type, newlySelectedIdAfterUpdate) {
  try {
    logger.info(`开始更新默认接收者下拉列表。类型: ${type}, 预选ID: ${newlySelectedIdAfterUpdate}`);
    const settings = await chrome.storage.sync.get([STORAGE_KEY.CHAT_LIST, STORAGE_KEY.USER_LIST]);
    const select = $('select[name="defaultReceiver"]');

    if (!select.length) {
      logger.error('无法找到名为 "defaultReceiver" 的 select 元素。渲染中止。');
      return;
    }

    select.empty();
    select.append($('<option value="">请选择一个接收者</option>'));

    // 只有当提供了有效的 type (chat 或 user) 时才填充列表
    if (type === 'chat' || type === 'user') {
      const list = type === 'chat' ? (settings.chatList || []) : (settings.userList || []);
      logger.info('获取到的列表数据:', list);
      let anOptionIsSelected = false;
      if (list.length > 0) {
        list.forEach(item => {
          const option = $('<option></option>');
          option.val(item.id).text(item.name);
          if (newlySelectedIdAfterUpdate && item.id === newlySelectedIdAfterUpdate) {
            option.prop('selected', true);
            anOptionIsSelected = true;
            logger.info(`选项 ${item.name} (ID: ${item.id}) 已被预选。`);
          }
          select.append(option);
        });
      } else {
        logger.info('列表为空，无法填充选项。类型:', type);
      }

      if (!anOptionIsSelected && newlySelectedIdAfterUpdate && list.length > 0) {
        logger.warn(`预选ID ${newlySelectedIdAfterUpdate} 在类型为 "${type}" 的列表中未找到。`);
      }

      if (!anOptionIsSelected) {
        select.val("");
        logger.info('没有有效预选ID或列表为空，默认接收者下拉列表将显示“请选择”。');
      }
    } else {
      // 如果类型不是 'chat' 或 'user' (例如，初始加载时类型为空字符串)，则不填充任何特定列表项
      logger.info('未指定有效的接收者类型 (chat/user)，默认接收者下拉列表将仅包含“请选择”。');
      select.val(""); // 确保选中“请选择”
    }

    layui.form.render('select', 'settingsForm'); // 重新渲染指定的select，确保更新生效
    logger.info('默认接收者下拉列表更新完成。');
  } catch (error) {
    logger.error('更新默认接收者选项失败', error, { context: 'updateDefaultReceiverOptions' });
    layui.layer.msg('加载默认接收者列表失败，请稍后再试。', { icon: 2 });
  }
}

export {
  loadSettings,
  validateSettings,
  saveOnlySendSettings,
  toggleConfigDisplay,
  updateDefaultReceiverOptions
};