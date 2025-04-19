import { FC, useEffect, useState, useRef } from 'react';
import { use100vh } from 'react-div-100vh';
import MarkdownEditor, { Props } from '@notea/rich-markdown-editor';
import { useEditorTheme } from './theme';
import useMounted from 'libs/web/hooks/use-mounted';
import Tooltip from './tooltip';
import extensions from './extensions';
import EditorState from 'libs/web/state/editor';
import { useToast } from 'libs/web/hooks/use-toast';
import { useDictionary } from './dictionary';
import { useEmbeds } from './embeds';
import UIState from 'libs/web/state/ui';
import { useCallback } from 'react';

export interface EditorProps extends Pick<Props, 'readOnly'> {
    isPreview?: boolean;
}

const Editor: FC<EditorProps> = ({ readOnly, isPreview }) => {
    const {
        onSearchLink,
        onCreateLink,
        onClickLink,
        onUploadImage,
        onHoverLink,
        backlinks,
        editorEl,
        note,
    } = EditorState.useContainer();
    
    const { editMode } = UIState.useContainer();
    
    // 状态管理
    const height = use100vh();
    const mounted = useMounted();
    const editorTheme = useEditorTheme();
    const [hasMinHeight, setHasMinHeight] = useState(true);
    const toast = useToast();
    const dictionary = useDictionary();
    const embeds = useEmbeds();
    
    // 跟踪编辑器状态
    const isInitializedRef = useRef(false);
    const lastContentRef = useRef<string>('');
    const shouldSetCursorRef = useRef(true);
    const editorContentKey = `editor_content_${note?.id}`;
    
    // 获取编辑器内容
    const getEditorContent = useCallback(() => {
        if (!note?.id) return '';
        
        // 如果有临时内容，优先使用临时内容
        const tempContent = localStorage.getItem(editorContentKey);
        const content = tempContent || note?.content || '';
        
        // 更新内容引用
        lastContentRef.current = content;
        return content;
    }, [note?.id, note?.content, editorContentKey]);
    
    // 设置光标到文档末尾
    const setCursorToEnd = useCallback(() => {
        if (!editorEl.current || !shouldSetCursorRef.current) return;
        
        try {
            // 使用类型断言访问编辑器内部属性
            const view = (editorEl.current as any).view;
            if (!view) return;
            
            // 获取文档末尾位置
            const { state, dispatch } = view;
            const endPosition = state.doc.content.size;
            
            // 创建事务设置光标位置
            const tr = state.tr.setSelection(
                state.selection.constructor.near(state.doc.resolve(endPosition))
            );
            
            // 分发事务
            dispatch(tr);
            
            // 确保编辑器获得焦点
            (editorEl.current as any).focus();
            
            // 防止重复设置光标
            shouldSetCursorRef.current = false;
        } catch (error) {
            console.error('设置光标位置失败:', error);
        }
    }, [editorEl]);
    
    // 编辑器内容变化处理
    const onEditorChange = useCallback((value: () => string): void => {
        if (!note?.id) return;
        
        const content = value();
        
        // 只有内容真正变化时才保存
        if (content !== lastContentRef.current) {
            // 保存到localStorage
            localStorage.setItem(editorContentKey, content);
            
            // 更新内容引用
            lastContentRef.current = content;
            
            // 标记有未保存的更改
            editMode.setHasUnsavedChanges(true);
            
            // 内容变化时不应重置光标位置
            shouldSetCursorRef.current = false;
        }
    }, [note?.id, editMode, editorContentKey]);
    
    // 处理背景链接
    useEffect(() => {
        if (isPreview) return;
        setHasMinHeight((backlinks?.length ?? 0) <= 0);
    }, [backlinks, isPreview]);
    
    // 处理编辑模式变化
    useEffect(() => {
        if (!mounted || !note?.id) return;
        
        // 当进入编辑模式时
        if (editMode.isEditing) {
            // 允许设置光标位置
            shouldSetCursorRef.current = true;
            
            // 使用setTimeout确保DOM已更新
            const timerId = window.setTimeout(() => {
                if (shouldSetCursorRef.current) {
                    setCursorToEnd();
                }
            }, 100);
            
            return () => window.clearTimeout(timerId);
        }
    }, [mounted, editMode.isEditing, note?.id, setCursorToEnd]);
    
    // 初始化后设置光标位置
    useEffect(() => {
        if (!mounted || isInitializedRef.current || !note?.id || !editMode.isEditing) return;
        
        // 标记编辑器已初始化
        isInitializedRef.current = true;
        
        // 延迟设置光标位置，确保编辑器完全加载
        const timerId = window.setTimeout(() => {
            setCursorToEnd();
        }, 300);
        
        return () => window.clearTimeout(timerId);
    }, [mounted, note?.id, editMode.isEditing, setCursorToEnd]);
    
    // 监听窗口获得焦点事件，确保从其他标签页返回时光标位置正确
    useEffect(() => {
        if (!mounted || !editMode.isEditing) return;
        
        const handleFocus = () => {
            shouldSetCursorRef.current = true;
            setCursorToEnd();
        };
        
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [mounted, editMode.isEditing, setCursorToEnd]);

    return (
        <>
            <MarkdownEditor
                readOnly={readOnly || (!editMode.isEditing && !isPreview)}
                id={note?.id}
                ref={editorEl}
                value={mounted ? getEditorContent() : ''}
                onChange={onEditorChange}
                placeholder={dictionary.editorPlaceholder}
                theme={editorTheme}
                uploadImage={(file) => onUploadImage(file, note?.id)}
                onSearchLink={onSearchLink}
                onCreateLink={onCreateLink}
                onClickLink={onClickLink}
                onHoverLink={onHoverLink}
                onShowToast={toast}
                dictionary={dictionary}
                tooltip={Tooltip}
                extensions={extensions}
                className="px-4 md:px-0"
                embeds={embeds}
                defaultValue=""
                autoFocus={editMode.isEditing}
            />
            <style jsx global>{`
                .ProseMirror ul {
                    list-style-type: disc;
                }

                .ProseMirror ol {
                    list-style-type: decimal;
                }

                .ProseMirror {
                    ${hasMinHeight
                        ? `min-height: calc(${
                              height ? height + 'px' : '100vh'
                          } - 14rem);`
                        : ''}
                    padding-bottom: 10rem;
                }

                .ProseMirror h1 {
                    font-size: 2.8em;
                }
                .ProseMirror h2 {
                    font-size: 1.8em;
                }
                .ProseMirror h3 {
                    font-size: 1.5em;
                }
                .ProseMirror a:not(.bookmark) {
                    text-decoration: underline;
                }

                .ProseMirror .image .ProseMirror-selectednode img {
                    pointer-events: unset;
                }
            `}</style>
        </>
    );
};

export default Editor;
