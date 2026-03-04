/**
 * ChineseConverter 服务
 * 繁体中文转简体中文
 */

import * as OpenCC from 'opencc-js';

// 创建繁体到简体的转换器（台湾繁体 -> 简体中文）
const converterT2S = OpenCC.Converter({ from: 'tw', to: 'cn' });

/**
 * 检测文本是否包含繁体中文
 * 通过检查常见繁体字来判断
 */
export function hasTraditionalChinese(text: string): boolean {
  // 常见繁体字列表（这些字在简体中有不同写法）
  const traditionalChars = /[國學習說話語這個們來時會對發現問題經過關於應該實際體驗機會電腦網絡資訊處理開發設計圖書館學術研究報導雜誌廣告營銷業務經濟貿易財務會計統計數據資料檔案記錄歷史傳統藝術創作設備儀器實驗觀察測量計算結果報告論文發表評論討論參與組織協調管理領導決策執行監督檢查評估改進優化調整規劃預算撥款資金投資收益風險控制審計稽核合規遵從標準規範準則指南手冊說明書操作維護保養修理更換升級擴展延伸拓展開拓創新變革轉型過渡適應調適整合協同配合支持援助幫助服務諮詢顧問專家學者教授講師導師輔導培訓教育學習訓練練習實踐應用運用發揮展現呈現表達溝通交流互動參與貢獻奉獻犧牲付出努力奮鬥拼搏堅持毅力決心信心勇氣膽識智慧聰明機智靈活敏捷迅速快速高效優質精品卓越傑出優秀出色突出顯著明顯清晰準確精確嚴謹認真負責盡責專業專注專心致志全力以赴竭盡全力]/;
  
  // 检查是否有繁体字
  return traditionalChars.test(text);
}

/**
 * 将繁体中文转换为简体中文
 * @param text 输入文本
 * @returns 转换后的简体中文文本
 */
export function convertToSimplified(text: string): string {
  if (!text) return text;
  return converterT2S(text);
}

/**
 * 智能转换：如果检测到繁体中文则转换，否则返回原文
 * @param text 输入文本
 * @returns 转换后的文本
 */
export function smartConvert(text: string): string {
  if (!text) return text;
  
  // 检测是否包含繁体中文
  if (hasTraditionalChinese(text)) {
    return convertToSimplified(text);
  }
  
  return text;
}

/**
 * 默认导出转换函数
 */
export default {
  hasTraditionalChinese,
  convertToSimplified,
  smartConvert,
};
