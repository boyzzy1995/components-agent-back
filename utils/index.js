import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import {
  BaseMessage,
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
  AIMessage,
  HumanMessage,
} from "@langchain/core/messages";
import fs from 'fs';
import path from 'path';

export const readFromMDFiles = (dirPath) => {
  const fullDirPath = path.join(process.cwd(), dirPath);

  // 校验目录存在性
  if (!fs.existsSync(fullDirPath)) {
    throw new Error(`Directory does not exist: ${fullDirPath}`);
  }

  const files = fs.readdirSync(fullDirPath);
  return files
    .filter((file) => file.endsWith('.md'))
    .map((file) => {
      const filePath = path.join(fullDirPath, file);
      return fs.readFileSync(filePath, 'utf8');
    });
}

export class JSONChatHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "store", "messsage"];
  sessionId = '';
  dir = '';
  constructor(fields) {
    super(fields);
    this.sessionId = fields.sessionId;
    this.dir = fields.dir;
  }
  async getMessages() {
    const filePath = path.join(this.dir, `${this.sessionId}.json`);
    try {
      if (!fs.existsSync(filePath)) {
        this.saveMessagesToFile([]);
        return [];
      }

      const data = fs.readFileSync(filePath, { encoding: 'utf8' });
      const storedMessages = JSON.parse(data);
      return mapStoredMessagesToChatMessages(storedMessages);
    } catch(error) {
      console.error(`Failed to read chat history from ${filePath}`, error);
      return [];
    }
  }

  async addMessage(message) {
    const messages = await this.getMessages();
    messages.push(message);
    await this.saveMessagesToFile(messages);
  }

  async addMessages(messages) {
    const existingMessages = await this.getMessages();
    const allMessages = existingMessages.concat(messages);
    await this.saveMessagesToFile(allMessages);
  }
  /*
    这行代码的作用是序列化聊天消息。
    在 LangChain 中，聊天消息（如 `HumanMessage`、`AIMessage`）是包含复杂逻辑和属性的对象。
    当你需要将这些消息保存到文件（如 JSON 文件）中时，不能直接对它们使用 `JSON.stringify`，
    因为对象可能包含无法直接转为字符串的属性。

    具体作用如下：
      1.  格式转换：它将 LangChain 的消息对象数组转换为一种通用的、可序列化的存储格式（`StoredMessage` 结构）。
      2.  提取核心数据：它会提取消息的关键信息（如 `type`: "human"/"ai" 和 `content`: "消息内容"），并将其转化为简单的普通对象。
      3.  支持持久化：转换后的 `serializedMessages` 是一个简单的对象数组，可以安全地通过 `JSON.stringify` 写入到磁盘上的 JSON 文件中。

    简而言之，它是为了能把内存中的消息对象安全地存入文件系统而进行的“格式预处理”。
  */
  async saveMessagesToFile(messages) {
    const filePath = path.join(this.dir, `${this.sessionId}.json`);
    const serializedMessages = mapChatMessagesToStoredMessages(messages);
    try {
      fs.writeFileSync(filePath, JSON.stringify(serializedMessages, null, 2), {
        encoding: 'utf8',
      });
    } catch(error) {
      console.error(`Failed to save chat history to ${filePath}`, error);
    }
  }

  async clear() {
    const filePath = path.join(this.dir, `${this.sessionId}.json`);
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      console.error(`Failed to clear chat history from ${filePath}`, error);
    }
  }

  // 为了兼容旧版本的 BufferMemory，添加已废弃的方法
  async addAIChatMessage(message) {
    return this.addMessage(new AIMessage(message));
  }
}