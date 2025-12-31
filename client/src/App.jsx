// src/App.jsx
import React from 'react';
import QuillEditor from './components/QuillEditor.jsx';
import './App.css';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>📝 实时协作文本编辑器 - 开发演示</h1>
        <p className="app-subtitle">
          使用原生 Quill 1.3.7 + React + 现代 Web 技术
        </p>
      </header>
        <div className="app-content">
          <QuillEditor />
        </div>
      {/*<main className="app-main">*/}
      {/*  <div className="app-content">*/}
      {/*    <QuillEditor />*/}
      {/*  </div>*/}

      {/*  <aside className="app-sidebar">*/}
      {/*    <div className="sidebar-section">*/}
      {/*      <h3>🎯 本周目标</h3>*/}
      {/*      <ul>*/}
      {/*        <li>✅ 了解技术栈架构</li>*/}
      {/*        <li>✅ 搭建开发环境</li>*/}
      {/*        <li>✅ 集成原生 Quill 编辑器</li>*/}
      {/*        <li>⬜ 添加事件监听</li>*/}
      {/*        <li>⬜ 实现基础功能</li>*/}
      {/*      </ul>*/}
      {/*    </div>*/}

      {/*    <div className="sidebar-section">*/}
      {/*      <h3>📊 学习进度</h3>*/}
      {/*      <div className="progress-bar">*/}
      {/*        <div className="progress-fill" style={{ width: '60%' }}></div>*/}
      {/*      </div>*/}
      {/*      <p>第一周进度：60%</p>*/}
      {/*    </div>*/}

      {/*    <div className="sidebar-section">*/}
      {/*      <h3>💡 使用提示</h3>*/}
      {/*      <ol>*/}
      {/*        <li>打开开发者工具（F12）查看控制台输出</li>*/}
      {/*        <li>尝试使用工具栏的各种格式按钮</li>*/}
      {/*        <li>点击下方按钮测试编辑功能</li>*/}
      {/*        <li>观察"实时预览"区域的变化</li>*/}
      {/*      </ol>*/}
      {/*    </div>*/}
      {/*  </aside>*/}
      {/*</main>*/}

      <footer className="app-footer">
        <p>© 2025 实时协作文本编辑器 - 毕业设计项目 | 技术栈：React + Quill + Socket.IO + ShareDB</p>
      </footer>
    </div>
  );
}

export default App;