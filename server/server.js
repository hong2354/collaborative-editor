// server/server.js
import express from 'express'
import http from 'node:http';
import { Server } from 'socket.io';
import cors from 'cors'
import { WebSocketServer } from 'ws';
import ShareDB from 'sharedb';
import WebSocketJSONStream from '@teamwork/websocket-json-stream';
import richText from 'rich-text';

// ==================== ShareDB 配置 ====================
const backend = new ShareDB();
// 创建 ShareDB 连接（用于服务器端操作文档）
const connection = backend.connect();
ShareDB.types.register(richText.type);

// ==================== ShareDB 服务器（端口 5001）====================
const shareDBApp = express();
const shareDBServer = http.createServer(shareDBApp);
const shareDBWSS = new WebSocketServer({
  server: shareDBServer,
  path: '/sharedb'
});

shareDBWSS.on('connection', (ws,req) => {
  console.log('📡 ShareDB WebSocket 连接:',req.socket.remoteAddress);
  const stream = new WebSocketJSONStream(ws);
  backend.listen(stream);

  ws.on('close', () => console.log('🔌 ShareDB 断开'));
});

shareDBApp.use(cors());
shareDBApp.get('/', (req, res) => {
  res.json({ service: 'ShareDB', port: 5001 });
});

// 初始化示例文档
async function initDocs() {
  const doc = connection.get('examples', 'richtext');
  try {
    await new Promise((resolve, reject) => {
      doc.fetch((err) => {
        if (err) return reject(err);
        if (doc.type === null) {
          console.log('文档不存在')
          // 文档不存在，创建初始内容
          doc.create(
            [{ insert: '\n' }],
            'rich-text',
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        } else {
          resolve();
        }
      });
    });
    console.log('✅ 示例文档初始化完成');
  } catch (err) {
    console.log('⚠️ 示例文档已存在或初始化跳过');
  }
}

// // ==================== WebSocket 服务器（给 ShareDB 用） ====================
// const wss = new WebSocketServer({
//   server: server,  // 挂载在同一个 HTTP 服务器上
//   path: '/sharedb' // WebSocket 路径：ws://localhost:5000/sharedb
// });
//
// wss.on('connection', (ws, req) => {
//   console.log('🔌 ShareDB WebSocket 连接:', req.socket.remoteAddress);
//
//   const stream = new WebSocketJSONStream(ws);
//   backend.listen(stream);
//
//   ws.on('close', () => {
//     console.log('🔌 ShareDB WebSocket 断开');
//   });
// });

// ==================== Socket.IO 服务器（端口 5000）====================
const mainApp = express();
const mainServer = http.createServer(mainApp);
const io = new Server(mainServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});


// 存储客户端信息
const clients = new Map();

// 🔄 **处理编辑器连接和变化**
io.on('connection', (socket) => {
  console.log('🔌 新客户端连接:', socket.id);


  // 📝 **编辑器就绪**
  socket.on('editor-ready', (data) => {
    console.log('📝 编辑器就绪:', socket.id);

    clients.set(socket.id, {
      id: socket.id,
      userInfo: data.userInfo,
      connectedAt: new Date()
    });

    // 广播用户列表
    // ✅ 广播给所有客户端（包括自己）
    const usersList = Array.from(clients.values()).map(c => ({
      id: c.id,
      name: c.userInfo?.name || '匿名',
      color: c.userInfo?.color || '#999'
    }));

    console.log('👥 广播用户列表:', usersList);
    io.emit('users-update', usersList);

    socket.broadcast.emit('user-joined', {
      clientId: socket.id,
      userInfo: data.userInfo
    });
  });

  // ✅ 转发光标位置
  socket.on('cursor-update', (data) => {
    console.log("光标更新：",data);
    socket.broadcast.emit('cursor-update', data);
  });

  socket.on('disconnect', () => {
    clients.delete(socket.id);
    // 广播更新后的列表
    const usersList = Array.from(clients.values()).map(c => ({
      id: c.id,
      name: c.userInfo?.name || '匿名',
      color: c.userInfo?.color || '#999'
    }));
    io.emit('users-update', usersList);
    socket.broadcast.emit('user-left', { clientId: socket.id });
  });

  // // 🔄 **处理编辑器内容变化**
  // socket.on('editor-change', (data) => {
  //   console.log('📤 收到编辑器变化:', {
  //     from: socket.id,
  //     deltaLength: data.delta?.ops?.length || 0,
  //     timestamp: data.timestamp
  //   });
  //
  //   // 广播给其他所有客户端
  //   socket.broadcast.emit('editor-change', {
  //     ...data,
  //     serverReceivedAt: new Date().toISOString()
  //   });
  //
  //   // 调试：发送确认回执
  //   socket.emit('editor-change-ack', {
  //     status: 'received',
  //     message: '变化已接收并广播',
  //     timestamp: new Date().toISOString()
  //   });
  // });

  // 🧪 **测试消息**
  socket.on('test-ping', (data) => {
    console.log('🧪 收到测试ping:', socket.id);
    socket.emit('test-pong', {
      ...data,
      serverTime: new Date().toISOString(),
      message: '服务器已收到ping'
    });
  });

  // 📨 **普通消息**
  socket.on('message', (data) => {
    console.log('📨 收到消息:', data);
    io.emit('message', {
      ...data,
      broadcast: true,
      serverTimestamp: new Date().toISOString()
    });
  });

  // ⚠️ **连接错误**
  socket.on('error', (error) => {
    console.error('❌ Socket 错误:', socket.id, error);
  });

  // 🔌 **断开连接**
  socket.on('disconnect', (reason) => {
    console.log('🔌 客户端断开:', socket.id, '原因:', reason);

    // 通知其他客户端
    socket.broadcast.emit('user-left', {
      clientId: socket.id,
      reason: reason,
      timestamp: new Date().toISOString()
    });

    // 从客户端列表移除
    clients.delete(socket.id);

    // 打印当前在线客户端
    console.log('📊 当前在线客户端:', Array.from(clients.keys()));
  });

  // 发送欢迎消息
  socket.emit('welcome', {
    message: '欢迎连接到实时协作服务器',
    clientId: socket.id,
    serverTime: new Date().toISOString(),
    onlineClients: Array.from(clients.keys()).length
  });

  // 打印当前连接状态
  console.log('📊 当前连接数:', io.engine.clientsCount);
});

// ==================== Express 路由 ====================

mainApp.use(cors());
mainApp.use(express.json());
mainApp.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    timestamp: new Date().toISOString(),
    connections: io.engine.clientsCount,
    clients: Array.from(clients.entries()).map(([id, info]) => ({
      id,
      ...info
    }))
  });
});

// 🏠 **根路由**
mainApp.get('/', (req, res) => {
  res.json({
    message: '实时协作服务器正在运行',
    endpoints: {
      status: '/api/status',
      websocket: 'ws://localhost:5000'
    },
    timestamp: new Date().toISOString()
  });
});

// 🚀 **启动服务器**
const SHAREDB_PORT = 5001;
const MAIN_PORT = 5000;
shareDBServer.listen(SHAREDB_PORT, () => {
  console.log(`📡 ShareDB 运行在 ws://localhost:${SHAREDB_PORT}/sharedb`);
  initDocs();
});

mainServer.listen(MAIN_PORT, () => {
  console.log(`🚀 主服务器运行在 http://localhost:${MAIN_PORT}`);
  console.log(`💬 Socket.IO 可用`);
});