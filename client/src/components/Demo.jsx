import './Demo.css'

import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export default function Demo() {
  const [messages, setMessages] = useState([
    { id: 1, username: '系统', content: '欢迎来到聊天室！', timestamp: new Date().toLocaleTimeString() }
  ]);
  const [onlineUsers, setOnlineUsers] = useState(null);
  const [inputMessage, setInputMessage] = useState('');
  const [currentUser] = useState('我');
  const messagesEndRef = useRef(null);
  const messagesRef = new useRef(messages);
  //server连接状态
  const socketRef = new useRef(null);
  const connectStatusRef = new useRef('disconnected');
  const isConnectRef = new useRef(false);

  const [socket, setSocket] = useState(null);

  const updateMessages = useCallback((message)=>{
    messagesRef.current = [...messagesRef.current,message];
    console.log(messagesRef.current);
  },[])

  const updateSocket = useCallback((socket)=>{
    socketRef.current = socket;
    setSocket(socket);
    console.log('socket:',socketRef.current);
  },[]);
  const updateConnectStatus = useCallback((status)=>{
    connectStatusRef.current = status;
    console.log('connectStatusRef:',connectStatusRef.current);
  },[]);
  const updateConnect = useCallback((connect)=>{
    isConnectRef.current = connect;
    console.log('isConnectRef:',isConnectRef.current);
  },[]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const initSocket = useCallback(() => {
    console.log('正在连接server...');
    const newSocket = io('http://localhost:5000',{
      transports:['websocket','polling'],
      reconnection:true,
      reconnectionAttempts:5,
      reconnectionDelay:1000
    });

    newSocket.on('connect',()=>{
      console.log('连接成功');
      updateConnect(true);
      updateConnectStatus('connected');
      console.log('connectStatusRef:',connectStatusRef.current);
      console.log('isConnectRef:',isConnectRef.current);
      newSocket.emit('connected', {
          clientId: newSocket.id,
          timeStamp: new Date().toLocaleTimeString()
        });
      });

    newSocket.on('connect_error',(error)=>{
      console.error('连接错误：',error);
      updateConnect(false);
      updateConnectStatus('connect_error');
    });

    newSocket.on('disconnect',(reason)=>{
      console.warn('断开连接:',reason);
      updateConnect(false);
      updateConnectStatus('disconnected');
    });
    newSocket.on('user-joined',(data)=>{
      console.log('新客户连接：',data.id);
      console.log(data.array);
      setOnlineUsers(data.array);
      setMessages(data.messages);
      messagesRef.current=data.messages;
    });
    newSocket.on('user-left',(data)=>{
      console.log('🔌 客户端断开:',data.id);
      console.log(data.array);
      setOnlineUsers(data.array);
    });
    newSocket.on('msg-change',(data)=>{
      console.log(data);
      setMessages([...messages,data]);
      updateMessages(data);
    });
    updateSocket(newSocket);
    return () => {
      if (newSocket) {
        console.log('正在断开 Socket 连接...');
        newSocket.disconnect();
      }
    };
  },[]);


  useEffect(() => {
    scrollToBottom();
    // 初始化 Socket
    const cleanupSocket = initSocket();
    console.log(`socket更新:  (ref: ${socketRef.current})`);
    console.log(`连接状态更新: } (ref: ${connectStatusRef.current})`);
    console.log(`编辑器连接状态更新:  (ref: ${isConnectRef.current})`);
    return ()=>{
      if (socket) {
        socket.disconnect();
      }
      cleanupSocket?.();
    }
  }, [initSocket]);

  const handleSendMessage = () => {
    if (inputMessage.trim()) {
      const newMessage = {
        id: messages.length + 1,
        username: currentUser,
        content: inputMessage,
        timestamp: new Date().toLocaleTimeString()
      };
      socketRef.current.emit('message-change',{
        msg:newMessage,
        user_name:socket.id.slice(0,8)
      });
      setMessages([...messages, newMessage]);
      updateMessages(newMessage);
      console.log(messages);
      setInputMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>简易聊天室</h2>
        <div className="online-count">
          在线人数: <span>{onlineUsers===null ? 0 : onlineUsers.length}</span>
        </div>
      </div>

      <div className="chat-main">
        <div className="messages-area">
          <div className="messages-list">
            {messagesRef.current.map((msg) => (
              <div key={msg.id} className="message-item">
                <div className="message-header">
                  <span className="username">{msg.username}</span>
                  <span className="timestamp">{msg.timestamp}</span>
                </div>
                <div className="message-content">{msg.content}</div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="input-area">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="输入消息..."
              className="message-input"
            />
            <button onClick={handleSendMessage} className="send-btn">
              发送
            </button>
          </div>
        </div>

        <div className="online-users-panel">
          <h3>在线列表</h3>
          <div className="users-list">
            {onlineUsers===null?<div></div> : onlineUsers.map((user) => (
              <div key={user.id} className="user-item">
                <div className="user-avatar">{user.avatar}</div>
                <span className="username">{user.username}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}