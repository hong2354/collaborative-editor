// src/components/SimpleEditor.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import 'quill/dist/quill.snow.css';
import './SimpleEditor.css';
import {setupChineseItalicSupport} from '../utils/ChineseItalicSupport.js';
import ShareDBClient from '../utils/sharedb-client';

//导入socket.io-client
import {io} from 'socket.io-client';


// 自定义图片上传模块
const ImageUploadHandler = {
  clickHandler() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.setAttribute('type', 'file');
      input.setAttribute('accept', 'image/*');
      input.click();

      input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
          const base64Image = e.target.result;
          resolve(base64Image);
        };
        reader.readAsDataURL(file);
      };
    });
  }
};

// 防抖函数
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

function SimpleEditor() {
  const editorRef = useRef(null);
  const quillInstanceRef = useRef(null);

  //Socket 相关状态
  const socketRef = useRef(null);
  const connectionStatusRef = useRef('disconnected');
  const isEditorConnectedRef = useRef(false);

  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [isEditorConnected, setIsEditorConnected] = useState(false);

  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);


  const updateSocket = useCallback((socket) => {
    socketRef.current = socket;
    setSocket(socket);
    console.log(`socket更新: ${socket} (ref: ${socketRef.current})`);
  }, []);

  const updateConnectionStatus = useCallback((status) => {
    connectionStatusRef.current = status;
    setConnectionStatus(status);
    console.log(`连接状态更新: ${status} (ref: ${connectionStatusRef.current})`);
  }, []);

  const updateIsEditorConnected = useCallback((connected) => {
    isEditorConnectedRef.current = connected;
    setIsEditorConnected(connected);
    console.log(`编辑器连接状态更新: ${connected} (ref: ${isEditorConnectedRef.current})`);
  }, []);


  // **初始化 Socket 连接**
  const initSocket = useCallback(() => {
    console.log('正在连接到 Socket.IO 服务器...');

    const newSocket = io('http://localhost:5000', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // 连接成功事件
    newSocket.on('connect', () => {
      console.log('✅ Socket.IO 连接成功！Socket ID:', newSocket.id);
      updateConnectionStatus('connected');
      updateIsEditorConnected(true);
      console.log('ConnectionStatus:',connectionStatusRef.current);
      console.log('isEditorConnected:',isEditorConnectedRef.current);
      // 发送编辑器就绪消息
      newSocket.emit('editor-ready', {
        clientId: newSocket.id,
        type: 'editor',
        timestamp: new Date().toISOString()
      });
    });

    // 🔄 **接收编辑器内容变化**
    newSocket.on('editor-change', (data) => {
      console.log('📩 收到编辑器变化:', data);

      // 应用变化到本地编辑器（如果不是本地触发的）
      if (quillInstanceRef.current && data.clientId !== newSocket.id) {
        console.log('应用远程变化到编辑器');
        applyRemoteChange(data.delta);
      }
    });
    newSocket.on('editor-change-ack',(data)=>{
      console.log(data);
    })
    // 接收测试消息（用于调试）
    newSocket.on('message', (data) => {
      console.log('收到消息:', data);
    });

    // 连接错误
    newSocket.on('connect_error', (error) => {
      console.error('❌ Socket 连接错误:', error);
      setConnectionStatus('error');
      setIsEditorConnected(false);
    });

    // 断开连接
    newSocket.on('disconnect', (reason) => {
      console.warn('⚠️ Socket 断开连接:', reason);
      setConnectionStatus('disconnected');
      setIsEditorConnected(false);
    });

    newSocket.on('test-pong',(data)=>{
      console.log(data)
    })

    newSocket.on('user-joined',(data)=>{
      console.log(data);
    });
    newSocket.on('user-left',(data)=>{
      console.log(data);
    });
    updateSocket(newSocket);

    return () => {
      if (newSocket) {
        console.log('正在断开 Socket 连接...');
        newSocket.disconnect();
      }
    };
  }, []);

  // **应用远程变化到编辑器**
  const applyRemoteChange = useCallback((delta) => {
    if (!quillInstanceRef.current) return;

    try {
      // 保存当前选区
      const currentSelection = quillInstanceRef.current.getSelection();

      // 应用远程变化
      quillInstanceRef.current.updateContents(delta);

      // 恢复选区（如果有）
      if (currentSelection) {
        quillInstanceRef.current.setSelection(currentSelection);
      }

      console.log('✅ 已应用远程变化');
    } catch (error) {
      console.error('❌ 应用远程变化失败:', error);
    }
  }, []);

  // **发送编辑器变化到服务器**
  const sendEditorChange = useCallback((delta, source) => {
    if (!socketRef.current || source !== 'user' || !isEditorConnectedRef.current) {
      console.log('发送失败');
      return;
    }

    const changeData = {
      type: 'editor-change',
      delta: delta,
      clientId: socketRef.current.id,
      timestamp: new Date().toISOString()
    };

    console.log('📤 发送编辑器变化:', changeData);
    socketRef.current.emit('editor-change', changeData);
  }, []);

  // 原有的更新统计函数
  const updateStats = useCallback(() => {
    if (!quillInstanceRef.current) return;

    const editor = quillInstanceRef.current;
    const textContent = editor.root.textContent || '';
    const charCount = textContent.length;

    const cleanText = textContent
      .replace(/\s+/g, '')
      .replace(/\n/g, '')
      .trim();

    const chineseChars = (cleanText.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishText = cleanText.replace(/[\u4e00-\u9fa5]/g, ' ');
    const englishWords = englishText.split(/\s+/).filter(word => word.length > 0).length;
    const wordCount = chineseChars + englishWords;

    setWordCount(wordCount);
    setCharCount(charCount);
  }, []);

  // 初始化 Quill - 修改文本变化事件处理
  const initQuill = useCallback(async () => {
    if (quillInstanceRef.current || !editorRef.current) return;

    try {
      const Quill = (await import('quill')).default;
      editorRef.current.innerHTML = '';

      // 创建容器结构
      const mainContainer = document.createElement('div');
      mainContainer.className = 'quill-main-container';

      // 自定义工具栏容器
      const toolbarContainer = document.createElement('div');
      toolbarContainer.id = 'custom-toolbar-' + Date.now();
      toolbarContainer.className = 'custom-toolbar';

      // 添加自定义工具栏按钮
      toolbarContainer.innerHTML = `
      <div class="toolbar-group">
        <select class="ql-header">
          <option value="1">标题 1</option>
          <option value="2">标题 2</option>
          <option value="3">标题 3</option>
          <option value="4">标题 4</option>
          <option value="5">标题 5</option>
          <option value="6">标题 6</option>
          <option selected>正文</option>
        </select>
        <select class="ql-font">
          <option value="sans-serif">sans-serif</option>
          <option value="serif">serif</option>
          <option value="monospace">monospace</option>
        </select>
        <select class="ql-size">
          <option value="small">小号</option>
          <option value="normal" selected>正常</option>
          <option value="large">大号</option>
          <option value="huge">巨大</option>
        </select>
      </div>
      <div class="toolbar-group">
        <button type="button" class="ql-bold" title="粗体 (Ctrl+B)">
          <span>B</span>
        </button>
        <button type="button" class="ql-italic" title="斜体">
          <span><i>I</i></span>
        </button>
        <button type="button" class="ql-underline" title="下划线">
          <span><u>U</u></span>
        </button>
        <button type="button" class="ql-strike" title="删除线">
          <span>S</span>
        </button>
      </div>

      <div class="toolbar-group">
        <button type="button" class="ql-list" value="ordered" title="有序列表">
          <span>1.</span>
        </button>
        <button type="button" class="ql-list" value="bullet" title="无序列表">
          <span>•</span>
        </button>
        <button type="button" class="ql-indent" value="-1" title="减少缩进">
          <span>←</span>
        </button>
        <button type="button" class="ql-indent" value="+1" title="增加缩进">
          <span>→</span>
        </button>
      </div>
      <div class="toolbar-group">
        <button type="button" class="ql-link" title="链接">
          <span>🔗</span>
        </button>
        <button type="button" class="ql-image" title="插入图片">
          <span>🖼️</span>
        </button>
        <button type="button" class="ql-video" title="插入视频">
          <span>🎬</span>
        </button>
        <button type="button" class="ql-code-block" title="代码块">
          <span>&lt;/&gt;</span>
        </button>
      </div>
      <div class="toolbar-group">
        <button type="button" class="ql-align" value=""></button>
        <button type="button" class="ql-align" value="center"></button>
        <button type="button" class="ql-align" value="right"></button>
        <button type="button" class="ql-align" value="justify"></button>
      </div>
      <div class="toolbar-group">
        <button type="button" class="ql-clean" title="清除格式">
          <span>🗑️</span>
        </button>
        <button type="button" class="custom-save" title="保存">
          <span>💾</span>
        </button>
      </div>
    `;

      mainContainer.appendChild(toolbarContainer);

      const container = document.createElement('div');
      container.className= 'container';
      const editorContainer = document.createElement('div');
      editorContainer.className = 'quill-editor-container';
      container.appendChild(editorContainer);
      mainContainer.appendChild(container);

      editorRef.current.appendChild(mainContainer);
      // 初始化 Quill
      quillInstanceRef.current = new Quill(editorContainer, {
        theme: 'snow',
        modules: {
          toolbar: {
            container: toolbarContainer,
            handlers: {
              image: function() {
                ImageUploadHandler.clickHandler().then((imageUrl) => {
                  if (imageUrl && quillInstanceRef.current) {
                    const range = quillInstanceRef.current.getSelection();
                    const position = range ? range.index : 0;
                    quillInstanceRef.current.insertEmbed(position, 'image', imageUrl);
                    quillInstanceRef.current.setSelection(position + 1);
                  }
                });
              },
              link: function(value) {
                if (value) {
                  const href = prompt('请输入链接地址:');
                  if (href) {
                    const range = quillInstanceRef.current.getSelection();
                    quillInstanceRef.current.format('link', href);
                  }
                } else {
                  quillInstanceRef.current.format('link', false);
                }
              }
            }
          },
          keyboard: {
            bindings: {
              'custom bold': {
                key: 'B',
                shortKey: true,
                handler: function(range, context) {
                  quillInstanceRef.current.format('bold', !quillInstanceRef.current.getFormat(range).bold);
                }
              }
            }
          }
        },
        placeholder: '开始写作...',
        readOnly: false
      });

      // **文本变化监听器**
      quillInstanceRef.current.on('text-change', (delta, oldDelta, source) => {
        console.log('编辑器文本变化:', { delta, source });

        // 更新统计
        updateStats();

        // **如果是用户操作
        if (source === 'user' && socketRef.current) {
          try{
            sendEditorChange(delta,source);
          }catch (error){
            console.error('❌ 提交失败:', error);
          }
        }
      });

      // 简化选区变化监听
      quillInstanceRef.current.on('selection-change', (range) => {
        if (process.env.NODE_ENV === 'development' && range) {
          console.log('光标位置:', range);
        }
      });

      // 初始统计
      updateStats();

      // 标记初始化完成
      setIsInitialized(true);

      console.log('✅ Quill 编辑器初始化成功，Socket 连接:', isEditorConnectedRef.current);

    } catch (error) {
      console.error('❌ Quill 初始化失败:', error);
    }
  }, [updateStats]);

  // 🔌 **组件挂载时初始化**
  useEffect(() => {

    // 先初始化 Socket
    const cleanupSocket = initSocket();

    // 然后初始化 Quill
    initQuill();
    setupChineseItalicSupport();

    return () => {


      //清理 Socket
      if (socket) {
        socket.disconnect();
      }
      cleanupSocket?.();

      // 清理 Quill
      if (quillInstanceRef.current) {
        quillInstanceRef.current.off('text-change');
        quillInstanceRef.current.off('selection-change');
        quillInstanceRef.current = null;

      }
      setIsInitialized(false);
    };
  }, [initSocket, initQuill]);

  return (
    <div className="simple-editor-container">
      {/* 🔌 Socket 连接状态面板 */}
      <div className="socket-panel">
        <div className="socket-status">
          <span className={`status-indicator ${connectionStatus}`}>
            {connectionStatus === 'connected' ? '🟢' :
              connectionStatus === 'disconnected' ? '🔴' : '🟡'}
          </span>
          <span className="status-text">
            {connectionStatus === 'connected' ? '✅ 已连接到服务器' :
              connectionStatus === 'disconnected' ? '❌ 未连接' : '⚠️ 连接错误'}
            {socket && connectionStatus === 'connected' && ` (ID: ${socket.id.slice(0, 8)}...)`}
          </span>

          <div className="editor-status">
            {isEditorConnected ? '📝 编辑器已同步' : '⏸️ 编辑器未同步'}
          </div>
        </div>

        {/* 连接测试区域 */}
        <div className="connection-test-area">
          <div className="test-buttons">
            <button
              onClick={() => {
                if (socket) {
                  console.log('发送测试ping');
                  socket.emit('test-ping', {
                    message: '测试ping',
                    timestamp: new Date().toISOString(),
                  });
                  //console.log('发送测试ping');
                }
              }}
              disabled={!socket || connectionStatus !== 'connected'}
              className="test-btn"
            >
              测试连接
            </button>

            <button
              onClick={() => {
                if (quillInstanceRef.current && socket) {
                  const testText = '\n[测试] 这是一条测试消息，发送时间: ' + new Date().toLocaleTimeString();
                  quillInstanceRef.current.insertText(quillInstanceRef.current.getLength(), testText);
                  console.log('插入测试文本');
                }
              }}
              disabled={!quillInstanceRef.current || !socket}
              className="test-btn"
            >
              插入测试文本
            </button>
          </div>

          {/* 连接信息 */}
          <div className="connection-info">
            <p>🔗 后端地址: <code>http://localhost:5000</code></p>
            <p>📡 通信方式: WebSocket + HTTP 轮询</p>
            <p>🔄 同步模式: ShareDB OT 协同编辑</p>
            <p>📄 当前文档: test-doc-1</p>
            <p>💡 提示: 打开两个浏览器窗口测试协同编辑</p>
          </div>
        </div>
      </div>

      {/* 编辑器区域 */}
      <div ref={editorRef} className="quill-editor-wrapper"></div>

      <div className="editor-trailer">
        <div className="editor-stats">
          <span className="stat-item">字数: {wordCount}</span>
          <span className="stat-item">字符: {charCount}</span>
          <span className="stat-item">
            连接:
            <span className={`connection-dot ${connectionStatus}`}></span>
            {connectionStatus}
          </span>
          <span className="stat-item">同步: {isEditorConnected ? '开启' : '关闭'}</span>
        </div>
      </div>
    </div>
  );
}

export default SimpleEditor;