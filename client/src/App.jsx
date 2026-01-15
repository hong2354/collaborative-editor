// src/App.jsx
import React from 'react';
import SimpleEditor from './components/SimpleEditor.jsx';
import './App.css';
function App() {
  return (
    <div className="app">
      {/*<header className="app-header">*/}
      {/*  <h1>📝 实时协作文本编辑器 - 开发演示</h1>*/}
      {/*  <p className="app-subtitle">*/}
      {/*    使用原生 Quill 1.3.7 + React + 现代 Web 技术*/}
      {/*  </p>*/}
      {/*</header>*/}
        <div className="app-content">
          <SimpleEditor />

        </div>


      {/*<div className="app-footer">*/}
      {/*  <p>© 2025 实时协作文本编辑器 - 毕业设计项目 | 技术栈：React + Quill + Socket.IO + ShareDB</p>*/}
      {/*</div>*/}
    </div>
  );
}

export default App;