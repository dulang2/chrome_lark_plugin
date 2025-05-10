import logger from '../../utils/logger.js';

// 创建列表项的 DOM 元素
function createItemElement(item, type) {
  const listItem = document.createElement('div');
  listItem.className = 'list-item';
  listItem.setAttribute('data-id', item.id);
  listItem.setAttribute('data-name', item.name); // 存储原始名称，便于编辑

  const nameSpan = document.createElement('span');
  nameSpan.className = 'list-item-text'; // 更新类名为 list-item-text 以匹配 CSS
  nameSpan.textContent = item.name;
  listItem.appendChild(nameSpan);

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'list-item-actions'; // 移除内联样式，交由 CSS 控制
  // actionsDiv.style.marginLeft = '10px'; // 由 CSS 控制
  // actionsDiv.style.display = 'inline-flex'; // 由 CSS 控制
  // actionsDiv.style.gap = '5px'; // 由 CSS 控制

  // 编辑按钮
  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.className = 'layui-btn layui-btn-normal layui-btn-xs edit-btn'; // 通用编辑按钮类
  editButton.innerHTML = '<i class="layui-icon layui-icon-edit"></i>';
  editButton.dataset.type = type; // 标记类型
  editButton.dataset.id = item.id; // 标记ID，方便事件处理
  editButton.title = '编辑';
  actionsDiv.appendChild(editButton);

  // 删除按钮
  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'layui-btn layui-btn-danger layui-btn-xs delete-btn'; // 通用删除按钮类
  deleteButton.innerHTML = '<i class="layui-icon layui-icon-delete"></i>';
  deleteButton.dataset.type = type; // 标记类型
  deleteButton.dataset.id = item.id; // 标记ID，方便事件处理
  deleteButton.title = '删除';
  actionsDiv.appendChild(deleteButton);

  listItem.appendChild(actionsDiv);
  return listItem;
}

// 将项目添加到对应的列表显示
function addItemToList(item, type) {
  const listElementId = type === 'chat' ? 'chatList' : 'userList';
  const listEl = document.getElementById(listElementId);
  if (listEl) {
    const itemElement = createItemElement(item, type);
    listEl.appendChild(itemElement);
  } else {
    logger.error(`列表元素 #${listElementId} 未找到。`, { context: 'addItemToList' });
  }
}

export {
  createItemElement,
  addItemToList
};