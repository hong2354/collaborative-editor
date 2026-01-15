// src/components/SimpleEditor.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import 'quill/dist/quill.snow.css';
import './SimpleEditor.css';
import {setupChineseItalicSupport} from '../utils/ChineseItalicSupport.js';

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
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  // 使用 ref 来存储内容，避免频繁触发状态更新
  const contentRef = useRef('');

  // 更新统计的函数 - 使用 useCallback 并固定依赖
  const updateStats = useCallback(() => {
    if (!quillInstanceRef.current) return;

    // 获取编辑器内容
    const editor = quillInstanceRef.current;


    //从DOM直接获取文本内容
    const textContent = editor.root.textContent || '';

    // 计算字符数（包括中文、英文、数字、标点）
    const charCount = textContent.length;

    // 计算字数（中文通常按字计算）
    // 移除所有空白字符和换行符
    const cleanText = textContent
      .replace(/\s+/g, '')    // 移除所有空白
      .replace(/\n/g, '')     // 移除换行
      .trim();

    // 字数 = 中文字符数 + 英文单词数（简化版）
    const chineseChars = (cleanText.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishText = cleanText.replace(/[\u4e00-\u9fa5]/g, ' ');
    const englishWords = englishText.split(/\s+/).filter(word => word.length > 0).length;

    const wordCount = chineseChars + englishWords;

    setWordCount(wordCount);
    setCharCount(charCount);

    // 调试信息
    console.log('统计详情:', {
      textContent,
      cleanText,
      chineseChars,
      englishWords,
      wordCount,
      charCount
    });
  }, []);

  // 初始化 Quill - 只依赖于必要的 ref，不依赖任何状态
  const initQuill = useCallback(async () => {
    if (quillInstanceRef.current || !editorRef.current) return;

    try {
      const Quill = (await import('quill')).default;

      // 清空容器
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
            container: toolbarContainer, // 使用自定义工具栏容器
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
      // 为自定义保存按钮添加事件
      toolbarContainer.querySelector('.custom-save').addEventListener('click', () => {
        if (quillInstanceRef.current) {
          const content = quillInstanceRef.current.root.innerHTML;
          console.log('保存内容:', content);
          alert('内容已保存！');
          // 这里可以调用保存 API
        }
      });
      // ========== 优化事件监听 ==========

      // 1. 创建防抖的文本变化处理器
      const debouncedTextChange = debounce(() => {
        if (!quillInstanceRef.current) return;

        // 获取当前内容
        const html = quillInstanceRef.current.root.innerHTML;

        // 存储到 ref 而不是 state
        contentRef.current = html;

        // 更新统计
        updateStats();
      }, 300);

      // 2. 添加事件监听器
      quillInstanceRef.current.on('text-change', debouncedTextChange);

      // 3. 简化选区变化监听
      quillInstanceRef.current.on('selection-change', (range) => {
        if (process.env.NODE_ENV === 'development' && range) {
          console.log('光标位置:', range);
        }
      });

      // 设置初始内容
      const initialContent = `
        <h1>欢迎使用实时协作文本编辑器</h1>
        <p>这是你的 <strong>毕业设计项目</strong> 的编辑器组件。</p>
        <p>使用正确的 Quill 配置，避免重复工具栏问题。</p>
        <p>现在工具栏只有一个，布局正常了！</p>
      `;

      quillInstanceRef.current.clipboard.dangerouslyPasteHTML(initialContent);

      // 初始统计
      updateStats();

      // 标记初始化完成
      setIsInitialized(true);

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Quill 编辑器初始化成功');
      }

    } catch (error) {
      console.error('❌ Quill 初始化失败:', error);
    }
  }, [updateStats]); // 只依赖于 updateStats

  // 初始化 useEffect
  useEffect(() => {
    initQuill();
    setupChineseItalicSupport();
    // 组件卸载时清理
    return () => {
      if (quillInstanceRef.current) {
        // 移除事件监听器
        quillInstanceRef.current.off('text-change');
        quillInstanceRef.current.off('selection-change');
        quillInstanceRef.current = null;
      }
      setIsInitialized(false);
    };
  }, [initQuill]);



  return (
    <div className="simple-editor-container">
      <div>

      </div>
      <div ref={editorRef} className="quill-editor-wrapper"></div>
      <div className="editor-trailer">
        <div className="editor-stats">
          <span className="stat-item">字数: {wordCount}</span>
          <span className="stat-item">字符: {charCount}</span>
          <span className="stat-item">状态: {isInitialized ? '✅ 已加载' : '🔄 加载中'}</span>
        </div>
      </div>
    </div>
  );
}

export default SimpleEditor;