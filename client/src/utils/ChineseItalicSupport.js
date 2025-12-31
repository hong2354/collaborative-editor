export const setupChineseItalicSupport = () => {
  // 添加全局样式
  if (!document.querySelector('#chinese-font-support')) {
    const style = document.createElement('style');
    style.id = 'chinese-font-support';
    style.textContent = `
      /* 为中文指定支持斜体的字体栈 */
      .ql-editor {
        font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", 
                     "WenQuanYi Micro Hei", "Helvetica Neue", Arial, sans-serif;
      }
      
      /* 中文斜体效果 */
      .ql-editor em,
      .ql-editor i {
        font-style: oblique 14deg;
        transform: skewX(-8deg);
        display: inline-block;
      }
      
      /* 更优雅的中文倾斜效果 */
      .chinese-slant {
        font-style: normal !important;
        display: inline-block !important;
        transform: matrix(1, 0, -0.25, 1, 0, 0) !important;
      }
    `;
    document.head.appendChild(style);
  }
};