import dotenv from 'dotenv';
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

import { readFromMDFiles, JSONChatHistory } from '../utils/index.js';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from "@langchain/core/documents";

import { OllamaEmbeddings } from '@langchain/ollama';
import { FaissStore } from '@langchain/community/vectorstores/faiss';
import { RunnableSequence, RunnablePassthrough, RunnableWithMessageHistory } from "@langchain/core/runnables";
import { MessagesPlaceholder } from "@langchain/core/prompts";
import path from 'path';
import fs from 'fs';


dotenv.config();

const embeddings = new OllamaEmbeddings({
  model: 'qllama/bge-m3:latest',
  baseUrl: 'http://localhost:11434',
});

// 保存向量库
async function saveVectorStore() {
  // 读取docs目录下的所有md文件内容
  const docsContents = readFromMDFiles('docs');
  // 创建分词器
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,      // 每个文本块的最大字符数
    chunkOverlap: 20,    // 相邻块之间的重叠字符数
  });
  // 将所有文档内容合并后进行分割, 并生成向量
  const allText = docsContents.join('\n\n');
  const docs = [new Document({ pageContent: allText })];
  const splitDocs = await splitter.splitDocuments(docs);
  // 使用FaissStore保存向量库
  const vectorStore = await FaissStore.fromDocuments(splitDocs, embeddings);
  // 保存向量库
  await vectorStore.save(path.join(process.cwd(), './db'));
}

export async function getChain() {
  // 增加一个方法判断db目录是否存在，不存在则先创建文件夹再执行保存向量库
  const dbDirectory = path.join(process.cwd(), './db');
  if (!fs.existsSync(dbDirectory)) {
    fs.mkdirSync(dbDirectory);
    await saveVectorStore();
  }
  // 加载向量库
  const vectorStore = await FaissStore.load(path.join(process.cwd(), './db'), embeddings);
  // 创建检索器
  const retriever = vectorStore.asRetriever(10);
  // 将检索到的文档转换为字符串
  const convertDocsToString = (docs) =>
    docs.map((doc) => doc.pageContent).join('\n\n');
  // 创建检索chain，用于将检索到的文档转换为字符串
  const contextRetrieverChain = RunnableSequence.from([
    (input) => input.question,
    retriever,
    convertDocsToString,
  ]);
  const model = new ChatOpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: 'deepseek-chat',
    configuration: {
      baseURL: 'https://api.deepseek.com',
    },
  });
  const SYSTEM_TEMPLATE = `
    你是一个熟读组件库的专家，精通根据组件库的文档详细解释和回答问题，你在回答时会引用组件库的文档。
    并且回答时仅根据原文，尽可能回答用户问题，如果原文中没有相关内容，你可以回答“原文中没有相关内容”，

    以下是原文中跟用户回答相关的内容：
    {context}
  `;
  // 创建一个聊天提示模板，用于生成问题回答的提示
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', SYSTEM_TEMPLATE],
    new MessagesPlaceholder('history'),
    ['human', '现在，你需要基于原文，回答以下问题：\n{question}`'],
  ]);
  const ragChain = RunnableSequence.from([
    RunnablePassthrough.assign({
      context: contextRetrieverChain,
    }),
    prompt,
    model,
    new StringOutputParser(),
  ]);
  const chatHistoryDir = process.cwd() + '/chat-history';
  // 创建一个 RunnableWithMessageHistory 对象，用于将聊天历史记录与检索链结合起来
  const ragChainWithHistory = new RunnableWithMessageHistory({
    runnable: ragChain,           // 被包装的 RAG 链
    getMessageHistory: (sessionId) =>
      new JSONChatHistory({ sessionId, dir: chatHistoryDir }),  // 获取历史记录的方式
    historyMessagesKey: 'history', // 历史消息在 prompt 中的变量名
    inputMessagesKey: 'question',  // 用户输入的变量名
  });
  return ragChainWithHistory;
}