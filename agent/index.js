import dotenv from 'dotenv';
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

dotenv.config();

// 1. 初始化模型
const model = new ChatOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: 'deepseek-chat',
  configuration: {
    baseURL: 'https://api.deepseek.com',
  },
});

// 2. 创建提示词模板
const promptTemplate = ChatPromptTemplate.fromMessages([
  ["system", "你是一个专业的翻译助手。请将用户输入的语言翻译成 {target_language}。"],
  ["human", "{text}"],
]);

// 3. 创建输出解析器
const outputParser = new StringOutputParser();

// 4. 组装链
export const chain = promptTemplate.pipe(model).pipe(outputParser);
