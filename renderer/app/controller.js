/**
 * @file renderer/app/controller.js
 * @description Renderer 控制器工具层。封装可复用业务动作，供旧 renderer.js 渐进接入。
 */

(function () {
  const store = () => window.RpgAppStore;
  const view = () => window.RpgAppView;

  /**
   * 包装异步动作，统一处理 loading 与错误状态。
   * @param {string} actionName
   * @param {()=>Promise<any>} task
   * @returns {Promise<any>}
   */
  async function runAction(actionName, task) {
    store()?.setState?.({ loading: true, status: actionName, error: null });
    view()?.trace?.('动作开始', actionName, 'pending');
    try {
      const result = await task();
      store()?.setState?.({ loading: false, status: `${actionName}:success` });
      view()?.trace?.('动作完成', actionName, 'success');
      return result;
    } catch (error) {
      store()?.setState?.({ loading: false, status: `${actionName}:error`, error: error.message || '未知错误' });
      view()?.trace?.('动作失败', `${actionName}：${error.message || '未知错误'}`, 'error');
      throw error;
    }
  }

  /**
   * 打开项目目录。
   * @returns {Promise<Object|null>}
   */
  async function pickProjectFolder() {
    return runAction('打开项目目录', async () => window.rpgWorkbench.pickProjectFolder());
  }

  /**
   * 载入项目文本。
   * @param {string} rootDir
   * @returns {Promise<Object>}
   */
  async function loadProjectTexts(rootDir) {
    return runAction('载入项目文本', async () => window.rpgWorkbench.loadProjectTexts(rootDir));
  }

  /**
   * 保存翻译器设置。
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async function saveTranslatorSettings(payload) {
    return runAction('保存翻译设置', async () => window.rpgWorkbench.saveTranslatorSettings(payload));
  }

  /**
   * 测试翻译器设置。
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async function testTranslatorSettings(payload) {
    return runAction('测试翻译设置', async () => window.rpgWorkbench.testTranslatorSettings(payload));
  }

  /**
   * 调用 AI 翻译。
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async function aiTranslate(payload) {
    return runAction('AI 翻译', async () => window.rpgWorkbench.aiTranslate(payload));
  }

  window.RpgAppController = { runAction, pickProjectFolder, loadProjectTexts, saveTranslatorSettings, testTranslatorSettings, aiTranslate };
})();
