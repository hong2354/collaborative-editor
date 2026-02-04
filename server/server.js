// server/server.js
import express from 'express'
import http from 'node:http';
import { Server } from 'socket.io';
import cors from 'cors'
import ShareDB from 'sharedb'
import richText from 'rich-text'

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

//创建 ShareDB 后端
const backend = new ShareDB();

//注册 rich-text 类型
ShareDB.types.register(richText.type);


// 启用 CORS
app.use(cors());

// 存储客户端信息
const clients = new Map();

// 🔄 **处理编辑器连接和变化**
io.on('connection', (socket) => {
  console.log('🔌 新客户端连接:', socket.id);

  // 创建 ShareDB 代理（Agent）来处理这个连接
  const agent = backend.connect();

  // 监听客户端发送的 ShareDB 消息
  socket.on('share-db',(message)=>{
    console.log('📩 收到 ShareDB 消息:', message);
    agent.receive(message,(err)=>{
      if(err){
        console.error('❌ ShareDB 处理消息错误:', err);
      }
    });
  });

  // 将 ShareDB 的消息发送回客户端
  const sendToClient = (message)=>{
    socket.emit('share-db',message);
  };
  // 监听 ShareDB 代理的发送事件
  agent.on('send',sendToClient);

  // 存储客户端信息
  clients.set(socket.id, {
    id: socket.id,
    connectedAt: new Date(),
    type: 'unknown'
  });

  // 📝 **编辑器就绪**
  socket.on('editor-ready', (data) => {
    console.log('📝 编辑器就绪:', socket.id);
    clients.set(socket.id, { ...clients.get(socket.id), type: 'editor' });

    // 通知其他客户端有新编辑器加入
    socket.broadcast.emit('user-joined', {
      clientId: socket.id,
      type: 'editor',
      timestamp: new Date().toISOString()
    });
  });

  // 🔄 **处理编辑器内容变化**
  socket.on('editor-change', (data) => {
    console.log('📤 收到编辑器变化:', {
      from: socket.id,
      deltaLength: data.delta?.ops?.length || 0,
      timestamp: data.timestamp
    });

    // 广播给其他所有客户端
    socket.broadcast.emit('editor-change', {
      ...data,
      serverReceivedAt: new Date().toISOString()
    });

    // 调试：发送确认回执
    socket.emit('editor-change-ack', {
      status: 'received',
      message: '变化已接收并广播',
      timestamp: new Date().toISOString()
    });
  });

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

// 🛠️ **服务器状态 API**
app.get('/api/status', (req, res) => {
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
app.get('/', (req, res) => {
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
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
  console.log(`📡 WebSocket 端点: ws://localhost:${PORT}`);
  console.log(`📊 状态检查: http://localhost:${PORT}/api/status`);
});