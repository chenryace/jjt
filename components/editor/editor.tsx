import { FC, useEffect, useState, useCallback, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { use100vh } from 'react-div-100vh';
import { useMarkdownEditor, MarkdownEditorView } from '@gravity-ui/markdown-editor';
import useMounted from 'libs/web/hooks/use-mounted';
import { NoteModel } from 'libs/shared/note';

// 移除configure调用，因为它只用于语言配置，不是必需的

export interface EditorProps {
  note?: {
    id: string;
    content?: string;  // 修改为可选属性，与NoteModel保持一致
  } & Partial<NoteModel>;
  localContent?: string;
  readOnly?: boolean;
  className?: string;
  minHeight?: number;
  onSave?: (content: string) => void;
  onCtrlEnter?: (content: string) => void;
  onEscape?: () => void;
  onBlur?: () => void;
  onFocus?: () => void;
  onUploadImage?: (file: File) => Promise<string>;
  onNeedSave?: (content: string) => void;
  onContentChange?: (content: string) => void;
}

const Editor: FC<EditorProps> = ({
  note,
  localContent,
  className,
  minHeight,
  onSave,
  onCtrlEnter,
  onEscape,
  onBlur,
  onFocus,
  onNeedSave,
  onContentChange,
}) => {
  const height = use100vh();
  const mounted = useMounted();
  const [hasMinHeight] = useState(true);
  
  // 创建编辑器实例，确保content不为undefined
  const editor = useMarkdownEditor({
    initial: {
      markup: mounted ? (localContent || note?.content || '') : '',
      mode: 'wysiwyg',
      toolbarVisible: true,
      splitModeEnabled: false,
    },
    md: {
      html: true,
      linkify: true,
      breaks: true,
    },
    handlers: {
      // 可以添加文件上传等处理程序
    },
  });

  // 监听内容变化
  useEffect(() => {
    if (!editor) return;

    // 监听内容变化
    editor.on('change', (value) => {
      const content = value || '';
      if (onContentChange) {
        onContentChange(content);
      }
      
      // 通知需要保存
      if (onNeedSave) {
        onNeedSave(content);
      }
    });

    // 不需要显式取消订阅，编辑器实例会处理清理工作
    return () => {
      // 清理工作由编辑器实例自行处理
    };
  }, [editor, onContentChange, onNeedSave]);

  // 处理键盘事件
  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      // Ctrl+Enter 处理
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && onCtrlEnter) {
        e.preventDefault();
        const content = editor.getValue();
        onCtrlEnter(content);
        return;
      }

      // Escape 处理
      if (e.key === 'Escape' && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }

      // Ctrl+S 处理
      if (e.key === 's' && (e.ctrlKey || e.metaKey) && onSave) {
        e.preventDefault();
        const content = editor.getValue();
        onSave(content);
        return;
      }
    },
    [editor, onCtrlEnter, onEscape, onSave]
  );

  // 注意：由于MarkdownEditorView不支持onBlur和onFocus属性，
  // 我们需要在父级div上处理这些事件
  const handleDivBlur = useCallback(() => {
    if (onBlur) {
      onBlur();
    }
  }, [onBlur]);

  const handleDivFocus = useCallback(() => {
    if (onFocus) {
      onFocus();
    }
  }, [onFocus]);

  // 计算编辑器高度
  const editorHeight = minHeight
    ? hasMinHeight
      ? `${minHeight}px`
      : 'auto'
    : height
    ? `${height - 50}px`
    : '100vh';

  return (
    <div
      className={`editor-container ${className || ''}`}
      style={{ height: editorHeight }}
    >
      <div 
        onKeyDown={handleKeyDown}
        onBlur={handleDivBlur}
        onFocus={handleDivFocus}
      >
        <MarkdownEditorView
          editor={editor}
          stickyToolbar={true}
        />
      </div>
    </div>
  );
};

export default Editor;
