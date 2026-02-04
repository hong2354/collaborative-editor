import express from 'express'
import http from 'node:http';
import { Server } from 'socket.io';
import cors from 'cors'



const app = express();
const server = http.createServer(app);
const io = new Server(server,{
  cors:{
    origin:'http://localhost:5173/',
    methods:['GET','POST']
  }
});


app.use(cors());

//客户端信息
const clients = new Map();
let messages =[{ id: 1, username: '系统', content: '欢迎来到聊天室！', timestamp: new Date().toLocaleTimeString() }];
io.on('connect',(socket)=>{
  console.log('新客户连接：',socket.id);

  clients.set(socket.id,{
    id: socket.id,
    username:socket.id.slice(0,8),
    avatar:socket.id.slice(0,1)
  })
  console.log('当前人数：',io.engine.clientsCount);
  console.log(Array.from(clients.values()))
  console.log(messages);
  socket.on('connected',()=>{
    io.emit('user-joined', {
      id:socket.id,
      array:Array.from(clients.values()),
      messages:messages
    });
  });

  socket.on('disconnect',(reason)=>{
    console.log('🔌 客户端断开:', socket.id, '原因:', reason);
    // 从客户端列表移除
    clients.delete(socket.id);

    socket.broadcast.emit('user-left',{
      id:socket.id,
      array:Array.from(clients.values())
    });

    // 打印当前在线客户端
    console.log('📊 当前在线客户端:', Array.from(clients.keys()));
  })

  socket.on('message-change',(data)=>{
    console.log(data);
    data.msg.username=data.user_name;
    console.log(data.msg);
    messages=[...messages,data.msg];
    socket.broadcast.emit('msg-change',data.msg);
  });
});


const PORT = process.env.PORT||5000;
server.listen(PORT)