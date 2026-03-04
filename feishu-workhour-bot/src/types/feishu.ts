/**
 * 飞书相关类型定义
 * 定义飞书 API 交互所需的数据结构
 */

/**
 * 飞书消息事件
 * 验证: 需求 6.1 - 从飞书消息事件中提取发送者的 open_id 和用户名
 */
export interface MessageEvent {
  /** 事件唯一标识，用于去重 */
  event_id: string;
  /** 事件类型 */
  event_type: string;
  /** 发送者信息 */
  sender: {
    /** 发送者 open_id */
    open_id: string;
    /** 发送者 user_id（可选） */
    user_id?: string;
  };
  /** 消息内容 */
  message: {
    /** 会话 ID */
    chat_id: string;
    /** 消息内容（JSON 字符串） */
    content: string;
    /** 消息类型 */
    message_type: string;
  };
}

/**
 * 飞书卡片交互回调
 */
export interface CardAction {
  /** 操作用户的 open_id */
  open_id: string;
  /** 用户 ID（可选） */
  user_id?: string;
  /** 交互动作信息 */
  action: {
    /** 组件标签类型 */
    tag: string;
    /** 交互值 */
    value: Record<string, any>;
  };
  /** 会话 ID */
  chat_id?: string;
  /** 消息 ID */
  message_id?: string;
  /** 租户 key */
  tenant_key?: string;
}

/**
 * 卡片交互响应
 */
export interface CardActionResponse {
  /** 响应卡片（可选，用于更新卡片） */
  card?: InteractiveCard;
  /** Toast 提示（可选） */
  toast?: {
    type: 'success' | 'error' | 'warning' | 'info';
    content: string;
  };
}

/**
 * 飞书互动卡片
 */
export interface InteractiveCard {
  /** 卡片配置 */
  config: CardConfig;
  /** 卡片头部 */
  header: CardHeader;
  /** 卡片元素列表 */
  elements: CardElement[];
}

/**
 * 卡片配置
 */
export interface CardConfig {
  /** 是否启用宽屏模式 */
  wide_screen_mode: boolean;
  /** 是否允许转发 */
  enable_forward?: boolean;
}

/**
 * 卡片头部
 */
export interface CardHeader {
  /** 标题 */
  title: {
    /** 标签类型 */
    tag: 'plain_text' | 'lark_md';
    /** 标题内容 */
    content: string;
  };
  /** 头部模板颜色 */
  template?: 'blue' | 'wathet' | 'turquoise' | 'green' | 'yellow' | 'orange' | 'red' | 'carmine' | 'violet' | 'purple' | 'indigo' | 'grey';
}

/**
 * 卡片元素（联合类型）
 */
export type CardElement = 
  | DivElement 
  | ActionElement 
  | NoteElement 
  | HrElement;

/**
 * 文本块元素
 */
export interface DivElement {
  tag: 'div';
  text: TextContent;
  fields?: FieldContent[];
}

/**
 * 交互块元素
 */
export interface ActionElement {
  tag: 'action';
  actions: ActionItem[];
}

/**
 * 备注元素
 */
export interface NoteElement {
  tag: 'note';
  elements: TextContent[];
}

/**
 * 分割线元素
 */
export interface HrElement {
  tag: 'hr';
}

/**
 * 文本内容
 */
export interface TextContent {
  tag: 'plain_text' | 'lark_md';
  content: string;
}

/**
 * 字段内容
 */
export interface FieldContent {
  is_short: boolean;
  text: TextContent;
}

/**
 * 交互组件（联合类型）
 */
export type ActionItem = 
  | ButtonAction 
  | SelectAction 
  | InputAction 
  | DatePickerAction;

/**
 * 按钮组件
 */
export interface ButtonAction {
  tag: 'button';
  text: TextContent;
  type: 'default' | 'primary' | 'danger';
  value: Record<string, any>;
  confirm?: ConfirmDialog;
}

/**
 * 下拉选择组件
 */
export interface SelectAction {
  tag: 'select_static';
  placeholder: TextContent;
  options: SelectOption[];
  value: Record<string, any>;
  initial_option?: string;
}

/**
 * 选择项
 */
export interface SelectOption {
  text: TextContent;
  value: string;
}

/**
 * 输入框组件
 */
export interface InputAction {
  tag: 'input';
  name: string;
  placeholder: TextContent;
  default_value?: string;
}

/**
 * 日期选择组件
 */
export interface DatePickerAction {
  tag: 'date_picker';
  placeholder: TextContent;
  value: Record<string, any>;
  initial_date?: string;
}

/**
 * 确认对话框
 */
export interface ConfirmDialog {
  title: TextContent;
  text: TextContent;
}

/**
 * Challenge 验证请求
 */
export interface ChallengeRequest {
  challenge: string;
  token: string;
  type: 'url_verification';
}

/**
 * Challenge 验证响应
 */
export interface ChallengeResponse {
  challenge: string;
}

/**
 * 飞书事件回调请求体
 */
export interface EventCallbackRequest {
  /** 事件 schema 版本 */
  schema?: string;
  /** 事件头部信息 */
  header?: {
    event_id: string;
    event_type: string;
    create_time: string;
    token: string;
    app_id: string;
    tenant_key: string;
  };
  /** 事件内容 */
  event?: MessageEvent;
  /** Challenge 验证（URL 验证时使用） */
  challenge?: string;
  /** 验证 token */
  token?: string;
  /** 请求类型 */
  type?: string;
}

/**
 * 飞书 API 错误响应
 */
export interface FeishuApiError {
  code: number;
  msg: string;
}

/**
 * 多维表格配置
 */
export interface BitableConfig {
  /** 多维表格 app_token */
  appToken: string;
  /** 口译表 table_id */
  interpretationTableId: string;
  /** 笔译表 table_id */
  translationTableId: string;
  /** 状态字段名（承接进度） */
  statusFieldName: string;
  /** 工时统计字段名 */
  workhourFieldName: string;
}

/**
 * 项目类型
 */
export type ProjectType = 'interpretation' | 'translation';

/**
 * Webhook 服务器配置
 */
export interface WebhookServerConfig {
  /** 服务端口 */
  port: number;
  /** 飞书 App ID */
  feishuAppId: string;
  /** 飞书 App Secret */
  feishuAppSecret: string;
  /** 验证 Token */
  verificationToken: string;
  /** 加密 Key */
  encryptKey: string;
}
