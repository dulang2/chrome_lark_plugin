import logger from '../utils/logger.js';
import { loadSettings, validateSettings, saveOnlySendSettings, toggleConfigDisplay, updateDefaultReceiverOptions } from './func/settings_manager.js';
import { addItemToList } from './func/dom_updater.js';
import { openAddItemModal, addItem, deleteItem } from './func/item_service.js';
import { STORAGE_KEY } from '../utils/constants.js';

// 初始化layui模块
window.layui.use(['form', 'layer', 'element'], function () {
  const form = layui.form;
  const layer = layui.layer;

  // 初始化菜单功能 - 改用直接的 jQuery 点击事件处理
  // 为 #optionsMenu 元素下的每个 li 元素（菜单项）绑定点击事件
  $('#optionsMenu').on('click', 'li', function (event) {
    // this 指向被点击的 li DOM 元素
    const $clickedLi = $(this);

    // 从被点击的 li 元素上直接获取 data-menu 属性值，该值对应内容面板的 ID
    const targetContentId = $clickedLi.attr('data-menu');

    // 更新菜单项的选中状态：为当前点击的 li 添加选中样式，并移除其他兄弟 li 元素的选中样式
    $clickedLi.addClass('layui-menu-item-checked')
      .siblings('li').removeClass('layui-menu-item-checked');

    // 根据获取到的 targetContentId 切换内容面板的显示状态
    if (targetContentId) {
      $('.menu-content-panel').hide(); // 首先隐藏所有的内容面板
      $('#' + targetContentId).show(); // 然后显示与点击菜单项对应的内容面板
    } else {
      // 如果无法获取 targetContentId，记录错误日志，提示检查 HTML 结构中 data-menu 属性的配置
      logger.error('菜单项点击处理失败：无法获取 targetContentId。请检查HTML中 <li> 元素的 data-menu 属性是否正确设置。',
        { context: 'optionsMenuNavigation', clickedElementHtml: $clickedLi.html() });
    }
  });

  // 默认显示第一个菜单项对应的内容
  $('#sendSettingsContent').show();

  // 加载保存的设置
  loadSettings();

  // 监听发送模式切换
  form.on('radio(sendMode)', function (data) {
    toggleConfigDisplay(data.value);
  });

  // 监听默认接收者类型切换
  form.on('select(defaultReceiverType)', function (data) {
    updateDefaultReceiverOptions(data.value);
  });

  // 监听保存设置
  form.on('submit(saveSettings)', function (data) {
    // 只保存发送设置相关的内容
    console.log('保存发送设置', data); // 打印完整的表单数据，用于调试和分析
    const settingsToSave = {
      sendMode: data.field.sendMode,
      appId: data.field.appId,
      appSecret: data.field.appSecret,
      webhookUrl: data.field.webhookUrl,
      messageFormat: data.field.messageFormat,
      // API模式下才保存默认接收者设置
      defaultReceiverType: data.field.sendMode === 'api' ? data.field.defaultReceiverType : undefined,
      defaultReceiver: data.field.sendMode === 'api' ? data.field.defaultReceiver : undefined
    };

    // 在实际保存前进行校验
    if (validateSettings(data.field)) {
      saveOnlySendSettings(settingsToSave); // 调用新的保存函数
    } else {
      // 校验失败的提示已在 validateSettings 中处理
    }
    return false; // 阻止表单默认提交
  });

  // 保存多维表格设置
  form.on('submit(saveBitableSettings)', function (data) {
    console.log('多维表格设置保存', data);
    const bitableSettings = {
      bitableAppToken: data.field.bitableAppToken,
      bitableTableId: data.field.bitableTableId,
      bitableUrlFieldName: data.field.bitableUrlFieldName || 'URL',
      bitableTitleFieldName: data.field.bitableTitleFieldName || '标题'
    };

    // 验证必填项
    if (!bitableSettings.bitableAppToken || !bitableSettings.bitableTableId || !bitableSettings.bitableUrlFieldName || !bitableSettings.bitableTitleFieldName) {
      layer.msg('App Token、Table ID、URL字段名和标题字段名不能为空', { icon: 2 });
      return false;
    }

    // 保存到chrome.storage
    chrome.storage.sync.set(bitableSettings , function() {
      layer.msg('多维表格设置保存成功', { icon: 1 });
    });

    return false; // 阻止表单提交
  });

  // 添加 App ID 和 App Secret 可见性切换逻辑
  // 使用 jQuery 绑定事件
  $(document).on('click', '.toggle-visibility', function () {
    const targetInputName = $(this).data('target');
    const targetInput = $(`input[name="${targetInputName}"]`);
    if (targetInput.length) {
      if (targetInput.attr('type') === 'password') {
        targetInput.attr('type', 'text');
        $(this).removeClass('layui-icon-eye-invisible').addClass('layui-icon-eye'); // 切换为睁眼图标
      } else {
        targetInput.attr('type', 'password');
        $(this).removeClass('layui-icon-eye').addClass('layui-icon-eye-invisible'); // 切换为闭眼图标
      }
    }
  });

  // 添加群聊按钮点击事件
  // 使用 jQuery 绑定事件
  $('#addChat').on('click', () => {
    openAddItemModal('chat'); // 调用通用添加项目弹窗函数
  });

  // 添加用户按钮点击事件 (如果addUser按钮存在并且有类似逻辑，也应修改)
  // 假设 addUser 按钮的 ID 是 'addUser'
  $('#addUser').on('click', () => {
    openAddItemModal('user'); // 调用通用添加项目弹窗函数
  });

  // 添加删除事件监听 (通用删除处理器)
  document.addEventListener('click', async (e) => {
    const deleteButton = e.target.closest('.delete-btn'); // 查找最近的 .delete-btn 元素
    if (deleteButton) {
      e.preventDefault(); // 阻止按钮可能触发的默认行为（例如，如果它在表单中）
      e.stopPropagation(); // 阻止事件冒泡，避免触发其他父级元素的监听器

      const btn = deleteButton;
      const type = btn.dataset.type; // 获取数据类型 'chat' 或 'user'
      const listItem = btn.closest('.list-item'); // 获取包含此按钮的列表项
      const itemId = listItem?.dataset.id; // 从列表项获取被删除项的ID

      if (!itemId) {
        // logger.warn('删除操作中止：未能从DOM元素获取 itemId。'); // 注释掉此行，排查logger问题
        layui.layer.msg('无法确定要删除的项目，请重试。', { icon: 2 });
        return; // 提前返回，因为没有itemId无法继续
      }

      const itemNameElement = listItem?.querySelector('span');
      const itemName = itemNameElement?.textContent?.trim() || '该项目'; // 获取项目名称用于提示，提供默认值

      // 使用 LayUI 的 confirm 对话框进行删除确认
      layui.layer.confirm(`确定删除 "${itemName}" (${type === 'chat' ? '群聊' : '用户'}) 吗？`, {
        icon: 3, // 询问图标
        title: '确认删除',
        btn: ['确定', '取消'] // 按钮文本
      }, async function (index) {
        layui.layer.close(index); // 用户点击确定后，关闭确认框

        try {
          // logger.info(`开始删除 ${type} (通过通用删除按钮触发)`, { itemId });
          await deleteItem(itemId, type); // 调用新的通用删除函数
          // deleteItem 函数内部会处理DOM元素的移除和默认接收者更新
          layui.layer.msg('删除成功', { icon: 1, time: 1500 }); // 显示成功提示
        } catch (error) {
          // logger.error(`删除${type === 'chat' ? '群聊' : '用户'} "${itemName}" (ID: ${itemId}) 时发生错误（通用删除按钮）`, error);
          const specificErrorMessage = error && error.message ? error.message : '未知错误';
          layui.layer.msg(`删除失败: ${specificErrorMessage}`, { icon: 2, time: 3000 }); // 显示失败提示
        }
      });
      return false; // 显式返回 false，进一步尝试阻止任何可能的默认行为或事件传播
    }
  });

  // 通用编辑按钮事件监听
  document.addEventListener('click', async (e) => {
    const editButton = e.target.closest('.edit-btn');
    if (!editButton) return;

    e.preventDefault();
    e.stopPropagation();

    const type = editButton.dataset.type; // 'chat' or 'user'
    const listItem = editButton.closest('.list-item');
    if (!listItem) {
      logger.warn('Edit button clicked but no parent .list-item found.');
      return;
    }
    const currentId = listItem.dataset.id;
    const currentName = listItem.dataset.name;

    if (typeof currentId === 'undefined' || typeof currentName === 'undefined') {
      logger.warn('Edit action aborted: currentId or currentName is undefined.', { listItem });
      layer.msg('无法编辑项目：缺少必要信息。', { icon: 2 });
      return;
    }

    const title = type === 'chat' ? '编辑群聊' : '编辑用户';
    const idLabel = type === 'chat' ? '群聊ID' : '用户ID';
    const idPlaceholder = type === 'chat' ? '请输入chat_id' : '请输入open_id';
    const nameLabel = type === 'chat' ? '群聊名称' : '用户名称';
    const storageKey = type === 'chat' ? STORAGE_KEY.CHAT_LIST : STORAGE_KEY.USER_LIST;

    layer.open({
      type: 1,
      title: title,
      area: ['450px', 'auto'],
      content: `
      <div class="layui-form" lay-filter="editForm" style="padding: 20px;">
        <div class="layui-form-item">
          <label class="layui-form-label">${nameLabel}</label>
          <div class="layui-input-block">
            <input type="text" name="editName" class="layui-input" value="${currentName}" placeholder="请输入名称">
          </div>
        </div>
        <div class="layui-form-item">
          <label class="layui-form-label">${idLabel}</label>
          <div class="layui-input-block">
            <input type="text" name="editId" class="layui-input" value="${currentId}" placeholder="${idPlaceholder}">
          </div>
        </div>
      </div>
    `,
      btn: ['确定', '取消'],
      yes: async function (index, layero) {
        const newName = layero.find('input[name="editName"]').val().trim();
        const newId = layero.find('input[name="editId"]').val().trim();

        if (!newName || !newId) {
          layer.msg('名称和ID均不能为空！', { icon: 5 });
          return;
        }

        try {
          const settings = await chrome.storage.sync.get(storageKey);
          let list = settings[storageKey] || [];

          if (newName !== currentName && list.some(item => item.name === newName)) {
            layer.msg('该名称已存在！', { icon: 5 });
            return;
          }
          if (newId !== currentId && list.some(item => item.id === newId)) {
            layer.msg('该ID已存在！', { icon: 5 });
            return;
          }

          let itemFoundAndUpdated = false;
          list = list.map(item => {
            if (item.id === currentId) {
              itemFoundAndUpdated = true;
              return { name: newName, id: newId };
            }
            return item;
          });

          if (!itemFoundAndUpdated) {
            logger.error('编辑时未找到要更新的原始项目。', { currentId, list });
            layer.msg('编辑失败：未找到原始项目。', { icon: 2 });
            return;
          }

          await chrome.storage.sync.set({ [storageKey]: list });

          listItem.dataset.name = newName;
          listItem.dataset.id = newId;
          // 修正选择器，确保能正确找到显示名称的span元素
          const nameSpan = listItem.querySelector('.list-item-text');
          if (nameSpan) {
            nameSpan.textContent = newName;
          } else {
            logger.error('在更新列表项时未找到 .list-item-text 元素', { listItem, newName });
          }

          const defaultReceiverSettings = await chrome.storage.sync.get([STORAGE_KEY.DEFAULT_RECEIVER, STORAGE_KEY.DEFAULT_RECEIVER_TYPE]);
          let idToSelect = defaultReceiverSettings.defaultReceiver;

          if (defaultReceiverSettings.defaultReceiverType === type && defaultReceiverSettings.defaultReceiver === currentId) {
            if (currentId !== newId) {
              await chrome.storage.sync.set({ [STORAGE_KEY.DEFAULT_RECEIVER]: newId });
              idToSelect = newId;
            } else {
              idToSelect = currentId;
            }
          }

          updateDefaultReceiverOptions(type, idToSelect);
          layer.msg('信息更新成功！', { icon: 1 });
          layer.close(index);
        } catch (error) {
          logger.error(`编辑${type}失败`, error, { context: `edit${type.charAt(0).toUpperCase() + type.slice(1)}Handler` });
          layer.msg(`编辑失败，请稍后重试: ${error.message}`, { icon: 2 });
        }
      },
      success: function (layero, index) {
        layui.form.render(null, 'editForm');
      }
    });
  });
});