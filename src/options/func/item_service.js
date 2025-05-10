import logger from '../../utils/logger.js';
import { STORAGE_KEY } from '../../utils/constants.js';
import { addItemToList } from './dom_updater.js';
import { updateDefaultReceiverOptions } from './settings_manager.js';

// 打开添加项目（群聊或用户）的弹窗
function openAddItemModal(type) {
  const title = type === 'chat' ? '添加群聊' : '添加用户';
  const nameLabel = type === 'chat' ? '群聊名称' : '用户名称';
  const idLabel = type === 'chat' ? '群聊ID' : '用户ID';
  const namePlaceholder = type === 'chat' ? '请输入群聊名称' : '请输入用户名称';
  const idPlaceholder = type === 'chat' ? '请输入chat_id' : '请输入open_id';
  const inputNameId = type === 'chat' ? 'itemName' : 'itemName'; // 可以统一ID，或者根据类型区分
  const inputIdId = type === 'chat' ? 'itemId' : 'itemId';

  layui.layer.open({
    type: 1,
    title: title,
    content: `
        <div class="layui-form" style="padding: 20px;">
          <div class="layui-form-item">
            <label class="layui-form-label">${nameLabel}</label>
            <div class="layui-input-block">
              <input type="text" id="${inputNameId}" class="layui-input" placeholder="${namePlaceholder}">
            </div>
          </div>
          <div class="layui-form-item">
            <label class="layui-form-label">${idLabel}</label>
            <div class="layui-input-block">
              <input type="text" id="${inputIdId}" class="layui-input" placeholder="${idPlaceholder}">
            </div>
          </div>
        </div>
      `,
    btn: ['确定', '取消'],
    yes: async function (index) {
      const name = $('#' + inputNameId).val();
      const id = $('#' + inputIdId).val();

      if (!name || !id) {
        layui.layer.msg(`${nameLabel}和${idLabel}不能为空！`, { icon: 5 });
        return;
      }

      try {
        await addItem(type, { name, id }); // 调用通用添加项目函数
        layui.layer.close(index);
      } catch (error) {
        // addItem 函数内部已经处理了日志和部分UI提示，这里可以根据需要添加更多
        // logger.error(`添加${title}失败（弹窗回调）`, error, { context: 'openAddItemModalYesCallback', type });
        // layui.layer.msg(`添加${title}失败，请稍后重试。`, { icon: 2 });
      }
    }
  });
}

// 添加项目（群聊或用户）到存储并更新UI
async function addItem(type, item) {
  const storageKey = type === 'chat' ? STORAGE_KEY.CHAT_LIST : STORAGE_KEY.USER_LIST;
  const itemName = type === 'chat' ? '群聊' : '用户';

  try {
    const settings = await chrome.storage.sync.get(storageKey);
    const list = settings[storageKey] || [];

    // 前端校验：名称不能重复
    if (list.some(existingItem => existingItem.name === item.name)) {
      layui.layer.msg(`${itemName}名称已存在！`, { icon: 5 });
      throw new Error(`${itemName}名称已存在`);
    }
    // 前端校验：ID不能重复
    if (list.some(existingItem => existingItem.id === item.id)) {
      layui.layer.msg(`${itemName}ID已存在！`, { icon: 5 });
      throw new Error(`${itemName}ID已存在`);
    }

    list.push(item);
    await chrome.storage.sync.set({ [storageKey]: list });
    addItemToList(item, type); // 更新UI列表
    // 注意：此处调用 updateDefaultReceiverOptions 时没有传递参数，它会根据当前选中的类型来更新
    // 如果需要更精确的控制，可能需要调整 updateDefaultReceiverOptions 的逻辑或传递参数
    await updateDefaultReceiverOptions(layui.form.val('settingsForm').defaultReceiverType, layui.form.val('settingsForm').defaultReceiver);
    layui.layer.msg(`添加${itemName}成功`, { icon: 1 });
    logger.info(`成功添加${itemName}`, { type, item });
  } catch (error) {
    logger.error(`添加${itemName}失败`, error, { context: 'addItem', type, item });
    // 如果不是因为名称或ID重复导致的错误，则显示通用错误信息
    if (error.message && !error.message.includes('已存在')) {
      layui.layer.msg(`添加${itemName}失败，请检查日志或稍后重试。`, { icon: 2 });
    }
    throw error; // 将错误向上抛出，以便弹窗的yes回调可以捕获
  }
}

// 删除项目（群聊或用户）
async function deleteItem(itemId, itemType) {
  const typeDisplay = itemType === 'chat' ? '群聊' : '用户';
  const listKey = itemType === 'chat' ? STORAGE_KEY.CHAT_LIST : STORAGE_KEY.USER_LIST;
  const listElementId = itemType === 'chat' ? 'chatList' : 'userList';

  try {
    logger.info(`开始删除 ${typeDisplay}`, { itemId });

    let [settings, defaultStorageValues] = await Promise.all([
      chrome.storage.sync.get(listKey),
      chrome.storage.sync.get([STORAGE_KEY.DEFAULT_RECEIVER, STORAGE_KEY.DEFAULT_RECEIVER_TYPE])
    ]);

    const currentList = settings[listKey] || [];
    const newList = currentList.filter(item => item.id !== itemId);
    await chrome.storage.sync.set({ [listKey]: newList });
    logger.info(`${typeDisplay}列表更新完成`, { count: newList.length });

    const itemToRemove = document.querySelector(`#${listElementId} [data-id='${itemId}']`);
    if (itemToRemove) {
      itemToRemove.remove();
      logger.info('DOM元素移除成功');
    } else {
      logger.warn('未找到对应的DOM元素', { itemId });
    }

    let finalDefaultReceiverId = defaultStorageValues.defaultReceiver;
    let finalDefaultReceiverType = defaultStorageValues.defaultReceiverType;

    if (defaultStorageValues.defaultReceiverType === itemType && defaultStorageValues.defaultReceiver === itemId) {
      await chrome.storage.sync.remove([
        STORAGE_KEY.DEFAULT_RECEIVER,
        STORAGE_KEY.DEFAULT_RECEIVER_TYPE
      ]);
      logger.info(`已清除被删除${typeDisplay}的默认接收者设置`);
      finalDefaultReceiverId = null; 
      finalDefaultReceiverType = null;
      // 清空表单中的默认接收者选择
      layui.form.val('settingsForm', {
        defaultReceiverType: '',
        defaultReceiver: ''
      });
    }
    
    // 更新下拉列表，即使删除的不是当前默认，也需要刷新列表以移除已删除项
    // 如果删除了当前默认项，则传入 null 或 undefined 作为预选ID，让 updateDefaultReceiverOptions 正确处理
    const idToSelect = (finalDefaultReceiverType === itemType) ? finalDefaultReceiverId : undefined;
    await updateDefaultReceiverOptions(finalDefaultReceiverType || '', idToSelect);

  } catch (error) {
    logger.error(`删除${typeDisplay}时发生错误`, error, { itemId });
    layui.layer.msg(`删除${typeDisplay}失败: ${error.message || '未知错误'}`, { icon: 2 });
    throw error; 
  }
}

export {
  openAddItemModal,
  addItem,
  deleteItem
};