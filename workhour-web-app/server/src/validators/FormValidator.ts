/**
 * 表单验证器
 * 实现工时填报表单的验证逻辑
 * 
 * 验证: 需求 3.2 - 允许译员仅填写口译或仅填写笔译，两者均为可选，但至少需填写其中一项
 * 验证: 需求 3.3 - 工时不为正整数时，提示输入格式错误，并阻止提交
 * 验证: 需求 3.4 - 选择了项目但未填写对应工时时，提示该字段为必填，并阻止提交
 * 验证: 需求 3.5 - 填写了工时但未选择对应项目时，提示需选择对应项目，并阻止提交
 */

/**
 * 表单数据接口
 */
export interface WorkhourFormData {
  /** 口译项目 ID（可选） */
  interpretationProject?: string;
  /** 口译工时（可选） */
  interpretationTime?: string | number;
  /** 笔译项目 ID（可选） */
  translationProject?: string;
  /** 笔译工时（可选） */
  translationTime?: string | number;
}

/**
 * 验证结果接口
 */
export interface ValidationResult {
  /** 是否验证通过 */
  valid: boolean;
  /** 错误信息列表 */
  errors: ValidationError[];
}

/**
 * 验证错误接口
 */
export interface ValidationError {
  /** 错误字段 */
  field: string;
  /** 错误消息 */
  message: string;
}

/**
 * 验证值是否为正整数
 * 
 * Property 7: 工时正整数验证
 * 对于任意工时输入值，当值不是正整数（包括负数、零、小数、非数字字符串）时，
 * 系统应拒绝提交并提示格式错误。
 * 
 * @param value - 待验证的值
 * @returns 是否为正整数
 */
export function isPositiveInteger(value: string | number | undefined | null): boolean {
  // 空值不是正整数
  if (value === undefined || value === null || value === '') {
    return false;
  }

  // 如果是字符串，尝试转换为数字
  if (typeof value === 'string') {
    // 去除首尾空格
    const trimmed = value.trim();
    
    // 空字符串不是正整数
    if (trimmed === '') {
      return false;
    }
    
    // 检查是否只包含数字字符（不允许小数点、负号等）
    if (!/^\d+$/.test(trimmed)) {
      return false;
    }
    
    // 转换为数字
    const num = parseInt(trimmed, 10);
    
    // 检查是否为正整数（大于 0）
    return num > 0 && Number.isFinite(num);
  }

  // 如果是数字类型
  if (typeof value === 'number') {
    // 检查是否为正整数：大于 0、是整数、是有限数
    return value > 0 && Number.isInteger(value) && Number.isFinite(value);
  }

  return false;
}


/**
 * 检查字段是否有值（非空）
 * 
 * @param value - 待检查的值
 * @returns 是否有值
 */
function hasValue(value: string | number | undefined | null): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  
  if (typeof value === 'string') {
    return value.trim() !== '';
  }
  
  return true;
}

/**
 * 验证项目-工时配对
 * 
 * Property 8: 项目-工时配对验证
 * 对于任意表单提交，当选择了项目但未填写对应工时时，或填写了工时但未选择对应项目时，
 * 系统应拒绝提交并提示配对不完整。
 * 
 * @param project - 项目 ID
 * @param time - 工时值
 * @param type - 类型标识（用于错误消息）
 * @returns 验证错误列表
 */
export function validateProjectTimePair(
  project: string | undefined,
  time: string | number | undefined,
  type: 'interpretation' | 'translation'
): ValidationError[] {
  const errors: ValidationError[] = [];
  const typeLabel = type === 'interpretation' ? '口译' : '笔译';
  
  const hasProject = hasValue(project);
  const hasTime = hasValue(time);
  
  // 情况 1: 选择了项目但未填写工时
  if (hasProject && !hasTime) {
    errors.push({
      field: `${type}Time`,
      message: `请填写${typeLabel}工时`
    });
  }
  
  // 情况 2: 填写了工时但未选择项目
  if (hasTime && !hasProject) {
    errors.push({
      field: `${type}Project`,
      message: `请选择${typeLabel}项目`
    });
  }
  
  // 情况 3: 都填写了，验证工时是否为正整数
  if (hasProject && hasTime && !isPositiveInteger(time)) {
    errors.push({
      field: `${type}Time`,
      message: `${typeLabel}工时必须为正整数`
    });
  }
  
  return errors;
}

/**
 * 验证表单至少填写一项
 * 
 * Property 6: 表单至少填写一项验证
 * 对于任意表单提交，当口译和笔译都未填写时，系统应拒绝提交；
 * 当至少填写了其中一项（项目+工时配对完整）时，系统应接受提交。
 * 
 * @param formData - 表单数据
 * @returns 是否至少填写了一项完整的配对
 */
export function hasAtLeastOneEntry(formData: WorkhourFormData): boolean {
  const hasInterpretation = hasValue(formData.interpretationProject) && 
                           hasValue(formData.interpretationTime);
  const hasTranslation = hasValue(formData.translationProject) && 
                        hasValue(formData.translationTime);
  
  return hasInterpretation || hasTranslation;
}

/**
 * 验证完整的工时填报表单
 * 
 * 综合验证 Property 6、7、8：
 * - 至少填写一项（口译或笔译）
 * - 工时必须为正整数
 * - 项目和工时必须配对完整
 * 
 * @param formData - 表单数据
 * @returns 验证结果
 */
export function validateWorkhourForm(formData: WorkhourFormData): ValidationResult {
  const errors: ValidationError[] = [];
  
  // 验证口译配对
  const interpretationErrors = validateProjectTimePair(
    formData.interpretationProject,
    formData.interpretationTime,
    'interpretation'
  );
  errors.push(...interpretationErrors);
  
  // 验证笔译配对
  const translationErrors = validateProjectTimePair(
    formData.translationProject,
    formData.translationTime,
    'translation'
  );
  errors.push(...translationErrors);
  
  // 如果配对验证都通过，检查是否至少填写了一项
  if (errors.length === 0 && !hasAtLeastOneEntry(formData)) {
    errors.push({
      field: 'form',
      message: '请至少填写口译或笔译工时中的一项'
    });
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * FormValidator 类
 * 提供面向对象的验证接口
 */
export class FormValidator {
  /**
   * 验证值是否为正整数
   */
  static isPositiveInteger = isPositiveInteger;
  
  /**
   * 验证项目-工时配对
   */
  static validateProjectTimePair = validateProjectTimePair;
  
  /**
   * 验证表单至少填写一项
   */
  static hasAtLeastOneEntry = hasAtLeastOneEntry;
  
  /**
   * 验证完整的工时填报表单
   */
  static validateWorkhourForm = validateWorkhourForm;
}

export default FormValidator;
