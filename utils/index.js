/**
 * 工具函数模块
 * 提供文件读取和自定义聊天历史记录功能
 */

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

/**
 * 从指定目录读取所有 Markdown 文件内容
 * @param {string} dirPath - 相对于项目根目录的目录路径
 * @returns {string[]} 返回所有 .md 文件的内容数组
 * @throws {Error} 当目录不存在时抛出错误
 */
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

/**
 * 基于 JSON 文件的聊天历史记录类
 * 继承自 LangChain 的 BaseListChatMessageHistory，用于持久化存储对话记录
 */
export class JSONChatHistory extends BaseListChatMessageHistory {
  // LangChain 命名空间，用于序列化识别
  lc_namespace = ["langchain", "store", "message"];
  // 会话唯一标识
  sessionId = '';
  // 存储目录路径
  dir = '';

  /**
   * 构造函数
   * @param {Object} fields - 配置对象
   * @param {string} fields.sessionId - 会话 ID
   * @param {string} fields.dir - 存储目录路径
   */
  constructor(fields) {
    super(fields);
    this.sessionId = fields.sessionId;
    this.dir = fields.dir;
  }

  /**
   * 获取所有历史消息
   * @returns {Promise<BaseMessage[]>} 消息列表
   */
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

  /**
   * 添加单条消息
   * @param {BaseMessage} message - 消息对象
   * @returns {Promise<void>}
   */
  async addMessage(message) {
    const messages = await this.getMessages();
    messages.push(message);
    await this.saveMessagesToFile(messages);
  }

  /**
   * 添加多条消息
   * @param {BaseMessage[]} messages - 消息数组
   * @returns {Promise<void>}
   */
  async addMessages(messages) {
    const existingMessages = await this.getMessages();
    const allMessages = existingMessages.concat(messages);
    await this.saveMessagesToFile(allMessages);
  }

  /**
   * 将消息保存到文件
   * @param {BaseMessage[]} messages - 消息数组
   * @returns {Promise<void>}
   */
  async saveMessagesToFile(messages) {
    const filePath = path.join(this.dir, `${this.sessionId}.json`);
    const serializedMessages = mapChatMessagesToStoredMessages(messages);
    try {
      console.log(`Saving chat history to ${JSON.stringify(serializedMessages, null, 2)}`);
      fs.writeFileSync(filePath, JSON.stringify(serializedMessages, null, 2), {
        encoding: 'utf8',
      });
    } catch(error) {
      console.error(`Failed to save chat history to ${filePath}`, error);
    }
  }

  /**
   * 清空历史记录
   * @returns {Promise<void>}
   */
  async clear() {
    const filePath = path.join(this.dir, `${this.sessionId}.json`);
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      console.error(`Failed to clear chat history from ${filePath}`, error);
    }
  }

  /**
   * 添加 AI 消息（兼容旧版本 BufferMemory 的废弃方法）
   * @param {string} message - 消息内容
   * @returns {Promise<void>}
   * @deprecated 建议使用 addMessage 方法
   */
  async addAIChatMessage(message) {
    return this.addMessage(new AIMessage(message));
  }
}