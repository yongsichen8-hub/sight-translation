/**
 * FormValidator 单元测试
 * 验证表单验证逻辑的正确性
 */

import { describe, it, expect } from 'vitest';
import {
  isPositiveInteger,
  validateProjectTimePair,
  hasAtLeastOneEntry,
  validateWorkhourForm,
  FormValidator,
  WorkhourFormData
} from '../../src/validators/FormValidator';

describe('FormValidator', () => {
  describe('isPositiveInteger', () => {
    // 验证: 需求 3.3 - 工时必须为正整数
    
    it('should return true for positive integers', () => {
      expect(isPositiveInteger(1)).toBe(true);
      expect(isPositiveInteger(100)).toBe(true);
      expect(isPositiveInteger(999999)).toBe(true);
    });

    it('should return true for positive integer strings', () => {
      expect(isPositiveInteger('1')).toBe(true);
      expect(isPositiveInteger('100')).toBe(true);
      expect(isPositiveInteger('999999')).toBe(true);
      expect(isPositiveInteger(' 42 ')).toBe(true); // 带空格
    });

    it('should return false for zero', () => {
      expect(isPositiveInteger(0)).toBe(false);
      expect(isPositiveInteger('0')).toBe(false);
    });

    it('should return false for negative numbers', () => {
      expect(isPositiveInteger(-1)).toBe(false);
      expect(isPositiveInteger(-100)).toBe(false);
      expect(isPositiveInteger('-1')).toBe(false);
      expect(isPositiveInteger('-100')).toBe(false);
    });

    it('should return false for decimals', () => {
      expect(isPositiveInteger(1.5)).toBe(false);
      expect(isPositiveInteger(0.1)).toBe(false);
      expect(isPositiveInteger('1.5')).toBe(false);
      expect(isPositiveInteger('0.1')).toBe(false);
    });

    it('should return false for non-numeric strings', () => {
      expect(isPositiveInteger('abc')).toBe(false);
      expect(isPositiveInteger('12abc')).toBe(false);
      expect(isPositiveInteger('abc12')).toBe(false);
      expect(isPositiveInteger('1 2')).toBe(false);
    });

    it('should return false for empty values', () => {
      expect(isPositiveInteger('')).toBe(false);
      expect(isPositiveInteger('   ')).toBe(false);
      expect(isPositiveInteger(undefined)).toBe(false);
      expect(isPositiveInteger(null)).toBe(false);
    });

    it('should return false for special numeric values', () => {
      expect(isPositiveInteger(NaN)).toBe(false);
      expect(isPositiveInteger(Infinity)).toBe(false);
      expect(isPositiveInteger(-Infinity)).toBe(false);
    });
  });

  describe('validateProjectTimePair', () => {
    // 验证: 需求 3.4, 3.5 - 项目和工时必须配对完整

    it('should return no errors when both project and time are provided correctly', () => {
      const errors = validateProjectTimePair('proj_001', '60', 'interpretation');
      expect(errors).toHaveLength(0);
    });

    it('should return no errors when both are empty', () => {
      const errors = validateProjectTimePair(undefined, undefined, 'interpretation');
      expect(errors).toHaveLength(0);
    });

    it('should return error when project is selected but time is missing', () => {
      const errors = validateProjectTimePair('proj_001', undefined, 'interpretation');
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('interpretationTime');
      expect(errors[0].message).toContain('请填写口译工时');
    });

    it('should return error when time is provided but project is missing', () => {
      const errors = validateProjectTimePair(undefined, '60', 'translation');
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('translationProject');
      expect(errors[0].message).toContain('请选择笔译项目');
    });

    it('should return error when time is not a positive integer', () => {
      const errors = validateProjectTimePair('proj_001', '-5', 'interpretation');
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('interpretationTime');
      expect(errors[0].message).toContain('必须为正整数');
    });

    it('should handle empty string project as missing', () => {
      const errors = validateProjectTimePair('', '60', 'interpretation');
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('interpretationProject');
    });

    it('should handle empty string time as missing', () => {
      const errors = validateProjectTimePair('proj_001', '', 'translation');
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('translationTime');
    });
  });

  describe('hasAtLeastOneEntry', () => {
    // 验证: 需求 3.2 - 至少需填写其中一项

    it('should return true when interpretation is filled', () => {
      const formData: WorkhourFormData = {
        interpretationProject: 'proj_001',
        interpretationTime: '60'
      };
      expect(hasAtLeastOneEntry(formData)).toBe(true);
    });

    it('should return true when translation is filled', () => {
      const formData: WorkhourFormData = {
        translationProject: 'proj_002',
        translationTime: '120'
      };
      expect(hasAtLeastOneEntry(formData)).toBe(true);
    });

    it('should return true when both are filled', () => {
      const formData: WorkhourFormData = {
        interpretationProject: 'proj_001',
        interpretationTime: '60',
        translationProject: 'proj_002',
        translationTime: '120'
      };
      expect(hasAtLeastOneEntry(formData)).toBe(true);
    });

    it('should return false when nothing is filled', () => {
      const formData: WorkhourFormData = {};
      expect(hasAtLeastOneEntry(formData)).toBe(false);
    });

    it('should return false when only project is filled without time', () => {
      const formData: WorkhourFormData = {
        interpretationProject: 'proj_001'
      };
      expect(hasAtLeastOneEntry(formData)).toBe(false);
    });

    it('should return false when only time is filled without project', () => {
      const formData: WorkhourFormData = {
        translationTime: '60'
      };
      expect(hasAtLeastOneEntry(formData)).toBe(false);
    });
  });

  describe('validateWorkhourForm', () => {
    // 综合验证 Property 6, 7, 8

    it('should pass validation for valid interpretation only', () => {
      const formData: WorkhourFormData = {
        interpretationProject: 'proj_001',
        interpretationTime: '60'
      };
      const result = validateWorkhourForm(formData);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass validation for valid translation only', () => {
      const formData: WorkhourFormData = {
        translationProject: 'proj_002',
        translationTime: '120'
      };
      const result = validateWorkhourForm(formData);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass validation for both filled correctly', () => {
      const formData: WorkhourFormData = {
        interpretationProject: 'proj_001',
        interpretationTime: '60',
        translationProject: 'proj_002',
        translationTime: '120'
      };
      const result = validateWorkhourForm(formData);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for empty form', () => {
      const formData: WorkhourFormData = {};
      const result = validateWorkhourForm(formData);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('form');
      expect(result.errors[0].message).toContain('至少填写');
    });

    it('should fail validation for invalid time format', () => {
      const formData: WorkhourFormData = {
        interpretationProject: 'proj_001',
        interpretationTime: 'abc'
      };
      const result = validateWorkhourForm(formData);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('正整数'))).toBe(true);
    });

    it('should fail validation for missing project', () => {
      const formData: WorkhourFormData = {
        interpretationTime: '60'
      };
      const result = validateWorkhourForm(formData);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('选择'))).toBe(true);
    });

    it('should fail validation for missing time', () => {
      const formData: WorkhourFormData = {
        translationProject: 'proj_002'
      };
      const result = validateWorkhourForm(formData);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('填写'))).toBe(true);
    });

    it('should collect multiple errors', () => {
      const formData: WorkhourFormData = {
        interpretationProject: 'proj_001',
        // missing interpretationTime
        translationTime: '-5' // invalid and missing project
      };
      const result = validateWorkhourForm(formData);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('should accept numeric time values', () => {
      const formData: WorkhourFormData = {
        interpretationProject: 'proj_001',
        interpretationTime: 60
      };
      const result = validateWorkhourForm(formData);
      expect(result.valid).toBe(true);
    });
  });

  describe('FormValidator class', () => {
    it('should expose static methods', () => {
      expect(FormValidator.isPositiveInteger).toBe(isPositiveInteger);
      expect(FormValidator.validateProjectTimePair).toBe(validateProjectTimePair);
      expect(FormValidator.hasAtLeastOneEntry).toBe(hasAtLeastOneEntry);
      expect(FormValidator.validateWorkhourForm).toBe(validateWorkhourForm);
    });
  });
});
