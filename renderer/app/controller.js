/**
 * @file renderer/app/controller.js
 * @description Renderer 控制器工具层。封装可复用业务动作，供旧 renderer.js 渐进接入。
 */

(function () {
  const store = () => window.RpgAppStore;
  const view = () => window.RpgAppView;
  const t = (key) => window.RpgView?.t?.(key) || key;

  /**
   * 包装异步动作，统一处理 loading 与错误状态。
   * @param {string} actionName
   * @param {()=>Promise<any>} task
   * @returns {Promise<any>}
   */
  async function runAction(actionName, task) {
    store()?.setState?.({ loading: true, status: actionName, error: null });
    view()?.trace?.(t('trace.actionStart'), actionName, 'pending');
    try {
      const result = await task();
      store()?.setState?.({ loading: false, status: `${actionName}:success` });
      view()?.trace?.(t('trace.actionSuccess'), actionName, 'success');
      return result;
    } catch (error) {
      store()?.setState?.({ loading: false, status: `${actionName}:error`, error: error.message || t('common.unknownError') });
      view()?.trace?.(t('trace.actionFailed'), `${actionName}：${error.message || t('common.unknownError')}`, 'error');
      throw error;
    }
  }

  /**
   * 打开项目目录。
   * @returns {Promise<Object|null>}
   */
  async function pickProjectFolder() {
    return runAction(t('action.openProjectFolder'), async () => window.rpgWorkbench.pickProjectFolder());
  }

  /**
   * 载入项目文本。
   * @param {string} rootDir
   * @returns {Promise<Object>}
   */
  async function loadProjectTexts(rootDir) {
    return runAction(t('action.loadProjectTexts'), async () => window.rpgWorkbench.loadProjectTexts(rootDir));
  }

  /**
   * 载入单个文件条目（懒加载）。
   * @param {string} rootDir
   * @param {string} filePath
   * @returns {Promise<Object>}
   */
  async function loadFileEntries(rootDir, filePath) {
    return runAction(t('action.loadFileEntries'), async () => window.rpgWorkbench.loadFileEntries(rootDir, filePath));
  }

  /**
   * 保存翻译器设置。
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async function saveTranslatorSettings(payload) {
    return runAction(t('action.saveTranslatorSettings'), async () => window.rpgWorkbench.saveTranslatorSettings(payload));
  }

  /**
   * 测试翻译器设置。
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async function testTranslatorSettings(payload) {
    return runAction(t('action.testTranslatorSettings'), async () => window.rpgWorkbench.testTranslatorSettings(payload));
  }

  /**
   * 调用 AI 翻译。
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async function aiTranslate(payload) {
    return runAction(t('action.aiTranslate'), async () => window.rpgWorkbench.aiTranslate(payload));
  }

  async function saveProjectLastPosition(payload) {
    return runAction(t('action.saveProjectLastPosition'), async () => window.rpgWorkbench.saveProjectLastPosition(payload));
  }

  async function loadProjectProgressState(project) {
    return runAction(t('action.loadProjectProgressState'), async () => window.rpgWorkbench.loadProjectProgressState(project));
  }

  async function getUiSettings() {
    return runAction(t('action.getUiSettings'), async () => window.rpgWorkbench.getUiSettings());
  }

  async function saveUiSettings(payload) {
    return runAction(t('action.saveUiSettings'), async () => window.rpgWorkbench.saveUiSettings(payload));
  }

  async function previewInGame(payload) {
    return runAction(t('action.previewInGame'), async () => window.rpgWorkbench.previewInGame(payload));
  }

  async function repreviewInGame(payload) {
    return runAction(t('action.repreviewInGame'), async () => window.rpgWorkbench.repreviewInGame(payload));
  }

  async function returnToTitle(payload) {
    return runAction(t('action.returnToTitle'), async () => window.rpgWorkbench.returnToTitle(payload));
  }

  async function prevPreviewEntry(payload) {
    return runAction(t('action.prevPreviewEntry'), async () => window.rpgWorkbench.prevPreviewEntry(payload));
  }

  async function nextPreviewEntry(payload) {
    return runAction(t('action.nextPreviewEntry'), async () => window.rpgWorkbench.nextPreviewEntry(payload));
  }

  async function stopPreview(rootDir) {
    return runAction(t('action.stopPreview'), async () => window.rpgWorkbench.stopPreview(rootDir));
  }

  window.RpgAppController = { runAction, pickProjectFolder, loadProjectTexts, loadFileEntries, previewInGame, repreviewInGame, returnToTitle, prevPreviewEntry, nextPreviewEntry, stopPreview, saveTranslatorSettings, testTranslatorSettings, aiTranslate, saveProjectLastPosition, loadProjectProgressState, getUiSettings, saveUiSettings };
})();
