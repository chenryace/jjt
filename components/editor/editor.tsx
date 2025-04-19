import { FC, useEffect, useState } from 'react';
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
    
    // 修改编辑器内容变化处理函数，将内容存入localStorage而非直接保存到数据库
    const onEditorChange = useCallback((value: () => string): void => {
        // 存储到localStorage中的临时内容键名
        const tempContentKey = `temp_content_${note?.id}`;
        // 将内容存入localStorage
        if (note?.id) {
            localStorage.setItem(tempContentKey, value());
            // 标记有未保存的更改
            editMode.setHasUnsavedChanges(true);
        }
    }, [note?.id, editMode]);
    const height = use100vh();
    const mounted = useMounted();
    const editorTheme = useEditorTheme();
    const [hasMinHeight, setHasMinHeight] = useState(true);
    const toast = useToast();
    const dictionary = useDictionary();
    const embeds = useEmbeds();

    useEffect(() => {
        if (isPreview) return;
        setHasMinHeight((backlinks?.length ?? 0) <= 0);
    }, [backlinks, isPreview]);
    
    // 将光标移动到文档末尾的函数
    const moveCaretToEnd = useCallback(() => {
        if (!editorEl.current || !editorEl.current.view) return;
        
        try {
            const { view } = editorEl.current;
            const { state, dispatch } = view;
            const endPosition = state.doc.content.size;
            const tr = state.tr.setSelection(state.selection.constructor.near(state.doc.resolve(endPosition)));
            dispatch(tr);
            // 确保视图更新并滚动到光标位置
            view.focus();
        } catch (error) {
            console.error('设置光标位置失败:', error);
        }
    }, []);
    
    // 修改编辑器内容变化处理函数，将内容存入localStorage并设置光标位置
    const onEditorChange = useCallback((value: () => string): void => {
        // 存储到localStorage中的临时内容键名
        const tempContentKey = `temp_content_${note?.id}`;
        // 将内容存入localStorage
        if (note?.id) {
            localStorage.setItem(tempContentKey, value());
            // 标记有未保存的更改
            editMode.setHasUnsavedChanges(true);
            // 确保光标在文本末尾
            setTimeout(moveCaretToEnd, 10);
        }
    }, [note?.id, editMode, moveCaretToEnd]);
    
    // 修复光标位置问题，确保光标在文本末尾
    useEffect(() => {
        if (mounted && editorEl.current && !readOnly && editMode.isEditing) {
            // 延迟执行以确保编辑器已完全加载，增加延迟时间
            const timer = setTimeout(moveCaretToEnd, 500); // 增加延迟时间，确保编辑器完全初始化
            
            return () => clearTimeout(timer); // 清理定时器
        }
    }, [mounted, readOnly, editMode.isEditing, note?.id, moveCaretToEnd]); // 添加note?.id作为依赖项，确保笔记切换时重新设置光标

    return (
        <>
            <MarkdownEditor
                readOnly={readOnly || (!editMode.isEditing && !isPreview)}
                id={note?.id}
                ref={editorEl}
                value={mounted ? (() => {
                    // 如果有临时内容，优先使用临时内容
                    if (note?.id) {
                        const tempContent = localStorage.getItem(`temp_content_${note.id}`);
                        return tempContent || note?.content || '';
                    }
                    return note?.content || '';
                })() : ''}
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
                autoFocus={editMode.isEditing} // 只在编辑模式下自动聚焦
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
