import dotenv from 'dotenv';
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

dotenv.config();

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
  const vectorStore = await FaissStore.fromDocuments(splitDocs, embeddings);
  await vectorStore.save(path.join(process.cwd(), './db'));
}

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
