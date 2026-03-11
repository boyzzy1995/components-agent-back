import express from 'express';
import fs from 'fs';
import path from 'path';
import { chain } from '../agent/index.js';

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

// API 路由
const apiRouter = express.Router();
// 聊天接口
apiRouter.post('/chat', async (req, res) => {
  const { question } = req.body;

  if (!question) {
    return res.status(400).json({ error: 'Question is required' });
  }

  try {
    // 获取请求体
    const result = await chain.invoke({
      target_language: question.target_language,
      text: question.text,
    });
    res.json({ content: result });
  } catch (error) {
    console.error('Error during chat:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// 使用/api路由前缀
app.use('/api', apiRouter);
// 启动服务器
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
