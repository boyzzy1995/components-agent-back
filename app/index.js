import express from 'express';
import fs from 'fs';
import path from 'path';
import { getChain } from '../agent/index.js';
import { JSONChatHistory } from '../utils/index.js';

const app = express();
const port = process.env.PORT || 3000;

// 解析 JSON 请求体
app.use(express.json());

// 跨域设置
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const chain = await getChain();

// API 路由
const apiRouter = express.Router();
// 聊天接口
apiRouter.get('/chat', async (req, res) => {
  const { question, sessionId = 'default' } = req.query;

  if (!question) {
    return res.status(400).json({ error: 'Question is required' });
  }

  try {
    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 使用 stream 模式调用 chain
    const stream = await chain.stream(
      { question },
      { configurable: { sessionId } }
    );

    // 逐块返回数据
    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }

    // 发送结束标记
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Error during chat:', error);
    res.write(`data: ${JSON.stringify({ error: 'Internal server error' })}\n\n`);
    res.end();
  }
});

// 新增读取agent历史记录的接口
apiRouter.get('/history', async (req, res) => {
  const { sessionId = 'default' } = req.query;
  const chatHistoryDir = process.cwd() + '/chat-history';

  try {
    const chatHistory = new JSONChatHistory({ sessionId, dir: chatHistoryDir });
    const messages = await chatHistory.getMessages();

    // 将消息转换为前端友好的格式
    const formattedMessages = messages.map(msg => ({
      type: msg._getType(), // 'human' 或 'ai'
      content: msg.content,
      timestamp: msg.additional_kwargs?.timestamp || null
    }));

    res.json({
      sessionId,
      messages: formattedMessages,
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});


// 使用/api路由前缀
app.use('/api', apiRouter);
// 启动服务器
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
