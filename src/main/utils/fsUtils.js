/**
 * @file src/main/utils/fsUtils.js
 * @description 文件系统通用工具。
 */

const fs = require('fs');
const path = require('path');

/**
 * 确保目录存在。
 * @param {string} dirPath
 */
function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * 将任意名称转换为 Windows 文件系统安全名称。
 * @param {string} value
 * @returns {string}
 */
function toSafeFileName(value) {
  return String(value || 'default').replace(/[\\/:*?"<>|]/g, '_');
}

/**
 * 读取 JSON 文件。
 * @param {string} filePath
 * @param {any} fallback
 * @returns {any}
 */
function readJsonSync(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

/**
 * 写入 JSON 文件。
 * @param {string} filePath
 * @param {any} payload
 */
function writeJsonSync(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

module.exports = { ensureDir, toSafeFileName, readJsonSync, writeJsonSync };
