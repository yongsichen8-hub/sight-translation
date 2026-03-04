/**
 * opencc-js 类型声明
 */
declare module 'opencc-js' {
  interface ConverterOptions {
    from: 'cn' | 'tw' | 'hk' | 'jp';
    to: 'cn' | 'tw' | 'hk' | 'jp';
  }

  type ConverterFunction = (text: string) => string;

  export function Converter(options: ConverterOptions): ConverterFunction;
}
