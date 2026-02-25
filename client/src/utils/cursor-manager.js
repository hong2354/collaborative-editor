// src/utils/cursor-manager.js

import randomColor from 'randomcolor';


class CursorManager{
  constructor(quill) {
    this.quill = quill;
    this.cursors = new Map();// clientId -> cursor info
    this.container = document.createElement('div');
    this.container.className = 'cursor-container';
    this.quill.container.appendChild(this.container);
  }

  // 添加/更新远程光标
  updateCursor(clientId,range,userInfo = {}){
    let cursor = this.cursors.get(clientId);
    if(!cursor){
      // 创建新光标
      const color = userInfo.color || randomColor({luminosity:'dark'});
      const name = userInfo.name || `用户${clientId.slice(0,4)}`;
      cursor = {
        clientId,
        color,
        name,
        element:this.createCursorElement(color,name),
        selectionElement: null
      };
      this.cursors.set(clientId,cursor);
      this.container.appendChild(cursor.element);
    }

    // 更新位置
    this.positionCursor(cursor,range);

  }
  // 创建光标 DOM 元素
  createCursorElement(color,name){
    const el = document.createElement('div');
    el.className = `remote-cursor`;
    el.innerHTML = `
      <div class = 'cursor-flag' style="background: ${color}">
        ${name}
       </div>
       <div class = 'cursor-caret' style="background: ${color}"></div>
    `;
    return el;
  }

  // 定位光标
  positionCursor(cursor,range){
    if(!range)return;
    const bounds = this.quill.getBounds(range.index);
    if(!bounds) return;
    cursor.element.style.left = `${bounds.left}px`;
    cursor.element.style.top = `${bounds.top}px`;
    cursor.element.style.height = `${bounds.height}px`;
  }

  hideSelection(cursor){
    if(cursor.selectionElement){
      cursor.selectionElement.remove();
      cursor.selectionElement = null;
    }
  }
  // 显示选区背景
  showSelection(cursor,range){
    // 移出旧的选区
    this.hideSelection(cursor);

    const start = range.index;
    const end = range.index = range.length;

    // 创建选区元素（简化版：实际应该分段处理多行选区）
    const selectionEl = document.createElement('div');
    selectionEl.className = 'remote-selection';
    selectionEl.style.backgroundColor = `${cursor.color}30`;// 20% 透明度

    // 获取选区范围
    const startBounds = this.quill.getBounds(start);
    const endBounds = this.quill.getBounds(end);

    // 简化处理：假设单行（实际项目需要处理多行选区）
    selectionEl.style.left = `${startBounds.left}px`;
    selectionEl.style.top = `${startBounds.top}px`;
    selectionEl.style.width = `${endBounds.left - startBounds.left}px`;
    selectionEl.style.height = `${startBounds.height}px`;

    this.container.appendChild(selectionEl);
    cursor.selectionElement = selectionEl;
  }

  // 显示活动指示（闪烁效果）
  showActivity(cursor){
    cursor.element.classList.add('active');
    clearTimeout(cursor.activityTimeout);
    cursor.activityTimeout = setTimeout(()=>{
      cursor.element.classList.remove('active',);
    },2000);
  }

  // 移除光标（用户离开）
  removeCursor(clientId){
    const cursor = this.cursors.get(clientId);
    if(cursor){
      cursor.element.remove();
      this.hideSelection(cursor);
      this.cursors.delete(clientId);
    }
  }

  // 清理所有光标
  destroy(){
    this.cursors.forEach(cursor=>{
      cursor.element.remove();
      if(cursor.selectionElement){
        cursor.selectionElement.remove();
      }
    });
    this.cursors.clear();
    this.container.remove();
  }
}

export default CursorManager;