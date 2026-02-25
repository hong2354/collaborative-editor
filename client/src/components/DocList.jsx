// src/components/DocList.jsx
import React, { useState } from 'react';
import './DocList.css';

// 硬编码的文档列表
const HARDCODED_DOCS = [
  { id: 'doc1', title: '欢迎使用', lastModified: '2025-02-25' },
  { id: 'doc2', title: '项目计划书', lastModified: '2025-02-24' },
  { id: 'doc3', title: '会议记录', lastModified: '2025-02-23' },
  { id: 'richtext', title: '实时协作测试', lastModified: '2025-02-25' },
];

function DocList({ currentDocId, onSelectDoc }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="doc-list-container">
      <button
        className="doc-list-btn"
        onClick={() => setIsOpen(!isOpen)}
      >
        📄 文档列表 {isOpen ? '▼' : '▶'}
      </button>

      {isOpen && (
        <div className="doc-list-panel">
          <h4>我的文档</h4>
          <ul>
            {HARDCODED_DOCS.map(doc => (
              <li
                key={doc.id}
                className={doc.id === currentDocId ? 'active' : ''}
                onClick={() => {
                  onSelectDoc(doc.id);
                  setIsOpen(false);
                }}
              >
                <span className="doc-title">{doc.title}</span>
                <span className="doc-date">{doc.lastModified}</span>
                {doc.id === currentDocId && <span className="current-badge">当前</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default DocList;