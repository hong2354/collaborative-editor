// src/utils/sharedb-client.js
import * as ShareDBModule from 'sharedb-client';
import ReconnectingWebSocket from 'reconnecting-websocket';
// 注册 rich-text 类型（Quill 用的 Delta 格式）
import richText from 'rich-text';

const ShareDB = ShareDBModule.default || ShareDBModule;
ShareDB.types.register(richText.type);

//ShareDB连接工具类
class ShareDBClient{
  constructor() {
    this.connection = null;
    this.doc = null;
    this.ws = null;
    this.status = 'disconnected';
    this.callbacks = {
      onStatusChange: null,
      onContentChange: null,
      onError: null
    };
  }

  /**
   * 连接到 ShareDB 服务器
   */

  connect(docId = 'richtext') {
    return new Promise((resolve,reject)=>{
      try {
        //创建 WebSocket 连接（自动重连）
        this.ws = new ReconnectingWebSocket('ws://localhost:5001/sharedb', [], {
          maxReconnectionDelay: 10000,
          minReconnectionDelay: 1000,
          reconnectionDelayGrowFacter: 1.3,
          connectionTimeout: 4000,
          maxRetries: Infinity
        });

        //WebSocket状态监听
        this.ws.addEventListener('open', () => {
          console.log('✅ ShareDB WebSocket 已连接');
          this.status = 'connected';
          this.callbacks.onStatusChange?.('connected');
        });

        this.ws.addEventListener('close', () => {
          console.warn('⚠️ ShareDB WebSocket 断开');
          this.status = 'disconnected';
          this.callbacks.onStatusChange?.('disconnected');
        });

        this.ws.addEventListener('error', (err) => {
          console.error('❌ ShareDB WebSocket 错误:', err);
          this.status = 'error';
          this.callbacks.onStatusChange?.('error');
          this.callbacks.onError?.(err);
        });

        //创建ShareDB 连接
        this.connection = new ShareDB.Connection(this.ws);
        //获取/订阅文档
        this.doc = this.connection.get('examples', docId);
        //订阅文档
        this.doc.subscribe((err) => {
          if (err) {
            console.error('❌ 订阅文档失败:', err);
            reject(err);
            return;

          }
          console.log('📄 文档订阅成功，当前内容:', this.doc.data);

          this.doc.on('op', (op, source) => {
            console.log('📥 doc.on("op") 触发:', { op, source });

            if (source === true) {
              console.log('  ↳ 自己提交的操作，忽略');
              return; // 自己提交的，忽略
            }

            console.log('  ↳ 远程操作，触发回调');
            this.callbacks.onContentChange?.(op, 'remote');
          });
          resolve(this.doc);
        });
      }catch (error){
        reject(error);
      }
    });
  }
  //设置回调函数
  onStatusChange(callback){
    this.callbacks.onStatusChange = callback;
  }
  onContentChange(callback) {
    this.callbacks.onContentChange = callback;

    //监听远程操作
    if(this.doc){
      this.doc.on('op',(op,source)=>{
        //source === true 表示是自己提交的操作，忽略
        if(source !== true){
          console.log('📥 收到远程操作:', op);
          callback(op,'remote');
        }
      });
    }
  }
  //提交本地操作到 ShareDB
  submitOp(delta){
    if(!this.doc || this.status !== 'connected'){
      console.warn('⚠️ 无法提交操作：未连接');
      return false;
    }
    try{
      // delta 是 Quill 的 Delta 格式，直接提交
      this.doc.submitOp(delta,(err)=>{
        if(err){
          console.error('❌ 提交操作失败:', err);
          this.callbacks.onError?.(err);
        }else{
          console.log('📤 操作已提交:', delta);
        }
      });
      return true;
    }catch (error){
      console.error('❌ 提交操作异常:', error);
      return false;
    }
  }

  // 获取文档当前内容
  getContent() {
    return this.doc ? this.doc.data : null;
  }

  // 断开连接
  disconnect() {
    if (this.connection) {
      this.connection.close();
    }
    if (this.ws) {
      this.ws.close();
    }
    this.status = 'disconnected';
  }

      // // 创建WebSocket连接
      // const ws = new WebSocket(this.serverUrl);
      // // 等待WebSocket连接
      // await new Promise((resolve, reject) => {
      //   ws.onopen = () => {
      //     console.log('✅ WebSocket 连接成功');
      //     resolve();
      //   };
      //
      //   ws.onerror = (error) => {
      //     console.error('❌ WebSocket 连接错误:', error);
      //     reject(error);
      //   };
      //
      //   // 设置超时
      //   setTimeout(() => {
      //     reject(new Error('WebSocket 连接超时'));
      //   }, 5000);
      // });
      //
      //
      // // 创建WebSocket流
      // const stream = {
      //   send: (message) => {
      //     ws.send(JSON.stringify(message));
      //   },
      //   on: (event, callback) => {
      //     if (event === 'data') {
      //       ws.onmessage = (event) => {
      //         try {
      //           const message = JSON.parse(event.data);
      //           callback(message);
      //         } catch (error) {
      //           console.error('❌ 解析ShareDB消息失败:', error);
      //         }
      //       };
      //     }
      //   }
      // };
      //
      // // 创建 ShareDB 连接
      // this.connection = new Connection(stream);
      //
      // console.log('✅ ShareDB 连接建立成功');
      // return this.connection;
    // } catch (error) {
    //   console.error('❌ ShareDB 连接失败:', error);
    //   throw error;
    // }

  // async connect(){
  //   if(!this.socket){
  //     throw new Error('需要先建立 Socket.IO 连接');
  //   }
  //   try{
  //     //引入ShareDB 客户端库
  //     const ShareDB = (await import('sharedb/lib/client'));
  //
  //     // 创建自定义的 Socket 包装器，用于与 Socket.IO 通信
  //     const socketWrapper = {
  //       send:(message)=>{
  //         // 通过 Socket.IO 发送消息
  //         this.socket.emit('share-db', message);
  //       },
  //       close:()=>{
  //         //关闭连接
  //         this.socket.off('share-db',this.handleIncomingMessage);
  //       }
  //     };
  //
  //     // 创建 ShareDB 连接（复用现有的 Socket.IO socket）
  //     this.connection = new ShareDB.Connection(socketWrapper);
  //     // 监听来自服务器的消息
  //     this.handleIncomingMessage = (message)=>{
  //       if(this.connection) {
  //         this.connection.receive(message);
  //       }
  //     };
  //     this.socket.on('share-db',this.handleIncomingMessage);
  //     console.log('✅ ShareDB 连接建立成功');
  //     return this.connection;
  //   }catch (error) {
  //     console.error('❌ ShareDB 连接失败:', error)
  //     throw error
  //   }
  // }

  // /**
  //  * 获取或创建文档
  //  * @param {string} docId - 文档ID
  //  * @param {string} collection - 集合名称（默认 'documents'）
  //  * @returns {Promise} ShareDB 文档对象
  //  */
  // async getDocument(docId = 'test-doc',collection = 'documents'){
  //   if(!this.connection){
  //     await this.connect();
  //   }
  //   try{
  //     //获取文档引用
  //     this.doc = this.connection.get(collection,docId);
  //     this.docId = docId;
  //
  //     //订阅文档 (获取初始数据并开始接收更新)
  //     await new Promise((resolve,reject)=>{
  //       this.doc.subscribe((err)=>{
  //         if(err){
  //           console.error('❌ 文档订阅失败:', err)
  //           reject(err);
  //           return;
  //         }
  //         console.log('✅ 文档订阅成功');
  //
  //         resolve(this.doc);
  //
  //       });
  //
  //       // 检查文档是否已存在
  //       if(this.doc.type === null){
  //         // 文档不存在，需要创建
  //         console.log('📄 文档不存在，正在创建...');
  //
  //         // 创建文档
  //         this.doc.create('', (createErr) => {
  //           if (createErr) {
  //             console.error('❌ 文档创建失败:', createErr);
  //             reject(createErr);
  //             return;
  //           }
  //           console.log('✅ 文档创建成功，数据:', this.doc.data);
  //           resolve(this.doc);
  //         });
  //       }else {
  //         // 文档已存在
  //         console.log('📄 文档已存在，数据:', this.doc.data);
  //         resolve(this.doc);
  //       }
  //     });
  //
  //     return this.doc;
  //   }catch (error) {
  //     console.error('❌ 获取文档失败:', error);
  //     throw error;
  //   }
  // }
  //
  // /**
  //  * 监听文档变化
  //  * @param {Function} callback - 变化回调函数
  //  */
  // onDocChange(callback){
  //   if(!this.doc){
  //     console.warn('⚠️ 文档未初始化，无法监听变化');
  //     return;
  //   }
  //   this.doc.on('op',(op,source)=>{
  //     console.log('📩 ShareDB 文档变化:', { op, source });
  //     callback(op,source);
  //   });
  // }
  //
  // /**
  //  * 提交操作到 ShareDB
  //  * @param {Object} op - Delta 操作
  //  */
  //
  // submitOp(op){
  //   console.log('doc:',this.doc.type);
  //   if(!this.doc){
  //     console.warn('⚠️ 文档未初始化，无法提交操作');
  //     return;
  //   }
  //   this.doc.submitOp(op,(err)=>{
  //     if(err){
  //       console.error('❌ 提交操作失败:', err);
  //       throw err;
  //     }else {
  //       console.log('✅ 操作提交成功');
  //     }
  //   });
  // }
  //
  // /**
  //  * 获取文档当前数据
  //  */
  // getData(){
  //   return this.doc ? this.doc.data : null;
  // }
  //
  // /**
  //  * 断开连接
  //  */
  // disconnect(){
  //   if(this.doc){
  //     this.doc.unsubscribe();
  //     this.doc = null;
  //   }
  //
  //   if(this.connection){
  //     this.connection.close();
  //     this.connection = null;
  //   }
  //
  //   console.log('🔌 ShareDB 连接已断开');
  // }
}

// 导出单例
export const sharedbClient = new ShareDBClient();
