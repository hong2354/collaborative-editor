// src/components/SimpleEditor.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import 'quill/dist/quill.snow.css';
import './SimpleEditor.css';
import {setupChineseItalicSupport} from '../utils/ChineseItalicSupport.js';
import { sharedbClient } from '../utils/sharedb-client';
import CursorManager from '../utils/cursor-manager.js'   // 导入光标管理
//导入socket.io-client
import {io} from 'socket.io-client';
import DocList from './DocList.jsx';



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
  const cursorManagerRef = useRef(null);// 光标管理器引用

  // ✅ 当前文档ID状态（默认 richtext）
  const [currentDocId, setCurrentDocId] = useState('richtext');

  // ShareDB 状态
  const [shareDBStatus, setShareDBStatus] = useState('disconnected');
  const [isDocLoaded, setIsDocLoaded] = useState(false);

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

  // 当前用户信息
  const [userInfo] = useState(()=>({
    id:Math.random().toString().substr(2,9),
    name:`用户${Math.floor(Math.random() * 1000)}`,
    color:`hsl(${Math.random() * 360}, 70%, 50%)`
  }));
  const [onlineUsers,setOnlineUsers] = useState([]);


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

  // ==================== ShareDB 连接====================

  const initShareDB = useCallback(async (docId) => {
    try{
      console.log(`正在连接 ShareDB，文档: ${docId}`);
    // 如果已有连接，先断开
      sharedbClient.disconnect();
      setIsDocLoaded(false);

      //设置状态回调
      sharedbClient.onStatusChange((status)=>{
        console.log('ShareDB 状态:', status);
        setShareDBStatus(status);
      });

      //设置内容变更回调（远程操作）
      sharedbClient.onContentChange((op,source)=>{
        console.log('📥 收到远程变更:', op);
        console.log('📥 onContentChange 回调触发:', { op, source });


        if(!quillInstanceRef.current) return;
        const quill = quillInstanceRef.current;

        // // 简化：只保存选区起点，应用后恢复近似位置
        // const selection = quill.getSelection();
        // const oldIndex = selection ? selection.index : 0;
        // const oldLength = selection ? selection.length : 0;

        try{
          // 应用远程 Delta 到 Quill
          // op 是数组格式，Quill 需要对象格式 { ops: [...] }
          const delta = Array.isArray(op) ? {op:op} : op;
          console.log('  应用 delta:', delta);
          quill.updateContents(delta,'silent');// 'silent' 不触发 text-change
          console.log('✅ Delta 已应用');

          // // 简单恢复：保持原位（实际项目中可以用 quill-delta 库做精确变换）
          // setTimeout(() => {
          //   quill.setSelection(oldIndex, oldLength, 'silent');
          // }, 0);

          updateStats();
        }catch (error){
          console.error('❌ 应用远程变化失败:', error);
        }
      });

      // 连接并订阅文档
      const doc = await sharedbClient.connect(docId);
      console.log('📄 文档连接成功:', doc.id);

      //加载文档内容到Quill
      if(quillInstanceRef.current && doc.data) {
        // 清空并加载新文档内容
        quillInstanceRef.current.setContents([{ insert: '\n' }], 'silent');

        if (doc.data) {
          quillInstanceRef.current.setContents(doc.data, 'silent');
        }
        setIsDocLoaded(true);
        console.log(`✅ 文档 ${docId} 加载完成`);
      }
    }catch (error){
      console.log('❌ ShareDB 连接失败:', error);
    }
  },[]);



  // ==================== Socket.IO（保留用于通知）====================
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
        userInfo: userInfo,
        timestamp: new Date().toISOString()
      });
    });
    // ✅ 监听用户列表更新
    newSocket.on('users-update',(users)=>{
      console.log('👥 在线用户更新:', users);
      setOnlineUsers(users.filter(u => u.id !== newSocket.id));
    });

    // ✅ 监听远程光标位置
    newSocket.on('cursor-update', (data) => {
      if (data.clientId === newSocket.id) return; // 忽略自己
      console.log("光标更新：",data);
      if (cursorManagerRef.current) {
        cursorManagerRef.current.updateCursor(
          data.clientId,
          data.range,
          data.userInfo
        );
      }
    });

    // ✅ 用户离开，移除光标
    newSocket.on('user-left', (data) => {
      if (cursorManagerRef.current) {
        cursorManagerRef.current.removeCursor(data.clientId);
      }
    });

    // // 🔄 **接收编辑器内容变化**
    // newSocket.on('editor-change', (data) => {
    //   console.log('📩 收到编辑器变化:', data);
    //
    //   // 应用变化到本地编辑器（如果不是本地触发的）
    //   if (quillInstanceRef.current && data.clientId !== newSocket.id) {
    //     console.log('应用远程变化到编辑器');
    //     applyRemoteChange(data.delta);
    //   }
    // });
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
    // newSocket.on('user-left',(data)=>{
    //   console.log(data);
    // });
    updateSocket(newSocket);

    return () => {
      if (newSocket) {
        console.log('正在断开 Socket 连接...');
        newSocket.disconnect();
      }
    };
  }, [userInfo]);

  // ✅ 发送本地光标位置（防抖）
  const sendCursorUpdate = useCallback(
    debounce((range) => {
      if (socketRef.current && range) {
        socketRef.current.emit('cursor-update', {
          clientId: socketRef.current.id,
          userInfo: userInfo,
          range: range,
          timestamp: new Date().toISOString()
        });
      }
    }, 50), // 50ms 防抖
    [userInfo]
  );

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

  // ==================== Quill 初始化====================
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

      // 初始化光标管理器
      cursorManagerRef.current = new CursorManager(quillInstanceRef.current);

      // **文本变化监听器**
      quillInstanceRef.current.on('text-change', (delta, oldDelta, source) => {
        console.log('编辑器文本变化:', { delta, source });
        sendCursorUpdate(quillInstanceRef.current.getSelection());
        // 更新统计
        updateStats();

        // 用户操作时，提交到 ShareDB
        if (source === 'user' ||  source === 'api') {
          // delta 格式: { ops: [...] }，直接提交
          const success = sharedbClient.submitOp(delta);
          if(!success){
            console.warn('⚠️ 操作提交失败，可能未连接');
          }
        }
      });

      // 选区变化监听
      quillInstanceRef.current.on('selection-change', (range, oldRange, source) => {
        if (source === 'user' && range) {
          sendCursorUpdate(range);
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
  }, [updateStats,sendCursorUpdate]);

  // ==================== 切换文档 ====================

  // ✅ 切换文档处理
  const handleSelectDoc = useCallback((docId) => {
    if (docId === currentDocId) return;
    console.log(`📄 切换文档: ${currentDocId} → ${docId}`);
    setCurrentDocId(docId);
    // 重新连接 ShareDB
    initShareDB(docId);
  }, [currentDocId, initShareDB]);

  // ==================== 组件挂载====================
  useEffect(() => {

    // 1. 先初始化 Quill
    initQuill();
    setupChineseItalicSupport();

    // 2. 然后连接 ShareDB（编辑同步）
    initShareDB();

    // 3. Socket.IO（通知）
    const cleanupSocket = initSocket();

    return () => {
      //清理
      if (socket) {
        socket.disconnect();
      }
      cleanupSocket?.();

      sharedbClient.disconnect(); // 断开 ShareDB
      // 清理 Quill
      if (quillInstanceRef.current) {
        quillInstanceRef.current.off('text-change');
        quillInstanceRef.current.off('selection-change');
        quillInstanceRef.current = null;

      }
      setIsInitialized(false);
      setIsDocLoaded(false);
    };
  }, [initSocket ,initShareDB, initQuill]);

  return (
    <div className="simple-editor-container">
      {/* 顶部工具栏 */}
      <div className="toolbar">
        <DocList
          currentDocId={currentDocId}
          onSelectDoc={handleSelectDoc}
        />

        <div className="current-doc-info">
          当前文档: <strong>{currentDocId}</strong>
        </div>

        <div className="socket-status">
          {/* ✅ ShareDB 连接状态 */}
          <span className={`status-indicator ${shareDBStatus}`}>
            {shareDBStatus === 'connected' ? '🟢' :
              shareDBStatus === 'disconnected' ? '🔴' : '🟡'}
          </span>
          <span className="status-text">
            ShareDB: {shareDBStatus === 'connected' ? '✅ 已同步' :
            shareDBStatus === 'disconnected' ? '❌ 未连接' : '⚠️ 错误'}
            {isDocLoaded && ' (文档已加载)'}
          </span>
        </div>

        {/* 在线用户列表 */}
        <div className="online-users">
          {console.log('渲染 onlineUsers:', onlineUsers)}
          {onlineUsers.length === 0 && <span style={{ color: '#999' }}>暂无其他用户</span>}
          {onlineUsers.map(user => (
            <span
              key={user.id}
              className="user-badge"
              style={{ backgroundColor: user.color }}
            >
              {user.name}
            </span>
          ))}
        </div>

        {/* 连接信息 */}
        <div className="connection-info">
          <p>📡 ShareDB: ws://localhost:5000/sharedb</p>
          <p>💡 提示: 打开两个浏览器窗口测试协同编辑</p>
          <p>🔄 同步模式: <strong>OT 协同编辑</strong></p>
        </div>

      </div>

      {/* 编辑器区域 */}
      <div ref={editorRef} className="quill-editor-wrapper"></div>

      <div className="editor-trailer">
        <div className="editor-stats">
          <span className="stat-item">字数: {wordCount}</span>
          <span className="stat-item">字符: {charCount}</span>
          <span className="stat-item">
            ShareDB:
            <span className={`connection-dot ${shareDBStatus}`}></span>
            {shareDBStatus}
          </span>
        </div>
      </div>
    </div>
  );
}

export default SimpleEditor;