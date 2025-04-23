import { FC, useEffect, useState, useCallback, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { use100vh } from 'react-div-100vh';
import { useMarkdownEditor, MarkdownEditorView } from '@gravity-ui/markdown-editor';
import { configure } from '@gravity-ui/markdown-editor';
import useMounted from 'libs/web/hooks/use-mounted';
import EditorState from 'libs/web/state/editor';
import { useDictionary } from './dictionary';

// 配置编辑器
configure({
  lang: 'en',
});

export interface EditorProps {
    readOnly?: boolean;
    isPreview?: boolean;
}

const Editor: FC<EditorProps> = ({ readOnly = false, isPreview = false }) => {
    const {
        onSearchLink,
        onCreateLink,
        onClickLink,
        onUploadImage,
        onHoverLink,
        onEditorChange,
        backlinks,
        editorEl,
        note,
        localContent,
        hasLocalChanges,
        editorKey,
    } = EditorState.useContainer();
    const height = use100vh();
    const mounted = useMounted();
    const [hasMinHeight, setHasMinHeight] = useState(true);
    const dictionary = useDictionary();
    
    // 创建编辑器实例
    const editor = useMarkdownEditor({
        initialContent: mounted ? (localContent || note?.content || '') : '',
        readOnly: readOnly,
        autofocus: !isPreview && !readOnly,
        autoFocus: !isPreview && !readOnly,
        spellCheck: false,
        placeholder: dictionary.editorPlaceholder,
    });
    
    // 保存编辑器引用
    useEffect(() => {
        if (editorEl && editorEl.current !== editor) {
            editorEl.current = editor;
        }
    }, [editor, editorEl]);
    
    // 设置最小高度
    useEffect(() => {
        if (isPreview) return;
        setHasMinHeight((backlinks?.length ?? 0) <= 0);
    }, [backlinks, isPreview]);
    
    // 监听编辑器内容变化
    useEffect(() => {
        function changeHandler() {
            const value = editor.getValue();
            onEditorChange(() => value);
        }
        
        editor.on('change', changeHandler);
        return () => {
            editor.off('change', changeHandler);
        };
    }, [editor, onEditorChange]);
    
    // 监听链接点击
    useEffect(() => {
        function linkClickHandler(url: string) {
            onClickLink(url);
        }
        
        editor.on('link-click', linkClickHandler);
        return () => {
            editor.off('link-click', linkClickHandler);
        };
    }, [editor, onClickLink]);
    
    // 监听链接悬停
    useEffect(() => {
        function linkHoverHandler(event: MouseEvent) {
            onHoverLink(event);
        }
        
        editor.on('link-hover', linkHoverHandler);
        return () => {
            editor.off('link-hover', linkHoverHandler);
        };
    }, [editor, onHoverLink]);
    
    // 处理链接搜索
    useEffect(() => {
        async function searchLinkHandler(keyword: string) {
            return await onSearchLink(keyword);
        }
        
        editor.on('search-link', searchLinkHandler);
        return () => {
            editor.off('search-link', searchLinkHandler);
        };
    }, [editor, onSearchLink]);
    
    // 处理链接创建
    useEffect(() => {
        async function createLinkHandler(title: string) {
            return await onCreateLink(title);
        }
        
        editor.on('create-link', createLinkHandler);
        return () => {
            editor.off('create-link', createLinkHandler);
        };
    }, [editor, onCreateLink]);
    
    // 处理图片上传
    useEffect(() => {
        async function uploadImageHandler(file: File) {
            return await onUploadImage(file, note?.id);
        }
        
        editor.on('upload-image', uploadImageHandler);
        return () => {
            editor.off('upload-image', uploadImageHandler);
        };
    }, [editor, onUploadImage, note?.id]);
    
    // 更新编辑器内容
    useEffect(() => {
        if (mounted && !hasLocalChanges && note?.content !== undefined) {
            editor.setContent(note.content);
        }
    }, [editor, mounted, note?.content, hasLocalChanges, editorKey]);
    
    // 处理键盘快捷键
    const handleKeyDown = useCallback((e: ReactKeyboardEvent) => {
        // 保存快捷键 (Ctrl+S 或 Cmd+S)
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            const saveButton = document.querySelector('[data-save-button="true"]') as HTMLButtonElement;
            if (saveButton) {
                saveButton.click();
            }
        }
    }, []);
    
    return (
        <>
            <div onKeyDown={handleKeyDown} key={`editor-${editorKey}`}>
                <MarkdownEditorView 
                    editor={editor}
                    stickyToolbar
                />
            </div>
            <style jsx global>{`
                .md-editor {
                    ${hasMinHeight
                        ? `min-height: calc(${
                              height ? height + 'px' : '100vh'
                          } - 14rem);`
                        : ''}
                    padding-bottom: 10rem;
                }
                
                .md-editor h1 {
                    font-size: 2.8em;
                }
                .md-editor h2 {
                    font-size: 1.8em;
                }
                .md-editor h3 {
                    font-size: 1.5em;
                }
                .md-editor a {
                    text-decoration: underline;
                }
                
                .md-editor ul {
                    list-style-type: disc;
                }
                
                .md-editor ol {
                    list-style-type: decimal;
                }
                
                .md-editor__toolbar {
                    background-color: var(--bg-primary);
                    border-bottom: 1px solid var(--border-primary);
                }
                
                .md-editor__content {
                    background-color: var(--bg-primary);
                    color: var(--text-primary);
                }
            `}</style>
        </>
    );
};

export default Editor;
