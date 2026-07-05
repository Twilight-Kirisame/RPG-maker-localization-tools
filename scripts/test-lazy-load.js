/**
 * @file scripts/test-lazy-load.js
 * @description 验证 RPG Maker 项目的文件级懒加载逻辑，无需启动 Electron GUI。
 * 用法：node scripts/test-lazy-load.js <项目根目录>
 */

const path = require('path');
const { collectProjectFiles, collectFileTexts } = require('../src/main/services/project/ProjectTextService');

async function main() {
  const rootDir = process.argv[2] || path.resolve(__dirname, '..', 'assets', 'test-projects', 'mv-mini');
  console.log(`测试目录：${rootDir}`);

  const start = Date.now();
  const project = collectProjectFiles(rootDir);
  const listTime = Date.now() - start;

  console.log(`\n[文件索引扫描]`);
  console.log(`  引擎：${project.engine || 'unknown'}`);
  console.log(`  文件数：${project.files.length}`);
  console.log(`  总大小：${(project.totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  是否启用懒加载：${project.useLazyLoad}`);
  console.log(`  耗时：${listTime} ms`);

  const largeFiles = (project.files || []).filter((f) => (f.size || 0) >= 512 * 1024);
  if (largeFiles.length) {
    console.log(`\n[大文件列表，>=512KB]`);
    largeFiles.forEach((f) => console.log(`  ${f.file} (${(f.size / 1024).toFixed(0)} KB)`));
  }

  const sampleFiles = project.useLazyLoad
    ? [project.files[0], largeFiles[0] || project.files[1]].filter(Boolean)
    : project.files.slice(0, 2);

  if (sampleFiles.length) {
    console.log(`\n[单文件提取测试]`);
    for (const fileInfo of sampleFiles) {
      const s = Date.now();
      const result = collectFileTexts(rootDir, fileInfo.file);
      console.log(`  ${fileInfo.file}: ${result.entries.length} 条，耗时 ${Date.now() - s} ms${result.warnings.length ? '，警告：' + result.warnings.join('; ') : ''}`);
    }
  }

  console.log(`\n总耗时：${Date.now() - start} ms`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
