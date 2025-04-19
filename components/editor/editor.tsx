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
    
    // 将光标移动到文档末尾的函数，添加防抖逻辑避免频繁触发
    const moveCaretToEnd = useCallback(() => {
        if (!editorEl.current || !editorEl.current.view) return;
        
        try {
            // 获取当前光标位置
            const { view } = editorEl.current;
            const { state, dispatch } = view;
            
            // 如果当前已经在编辑中，不要干扰用户的光标位置
            if (document.activeElement === view.dom) {
                return;
            }
            
            const endPosition = state.doc.content.size;
            const tr = state.tr.setSelection(state.selection.constructor.near(state.doc.resolve(endPosition)));
            dispatch(tr);
            // 确保视图更新并滚动到光标位置
            view.focus();
        } catch (error) {
            console.error('设置光标位置失败:', error);
        }
    }, []);

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
    
    // 修改编辑器内容变化处理函数，将内容存入localStorage但不设置光标位置
    const onEditorChange = useCallback((value: () => string): void => {
        // 存储到localStorage中的临时内容键名
        const tempContentKey = `temp_content_${note?.id}`;
        // 将内容存入localStorage
        if (note?.id) {
            localStorage.setItem(tempContentKey, value());
            // 标记有未保存的更改
            editMode.setHasUnsavedChanges(true);
            // 不再在每次内容变化时设置光标位置，避免光标跳动
        }
    }, [note?.id, editMode]);
    
    // 只在编辑器初始化或笔记切换时设置一次光标位置
    useEffect(() => {
        // 只在以下条件都满足时设置光标位置：
        // 1. 组件已挂载 2. 编辑器引用存在 3. 不是只读模式 4. 处于编辑模式 5. 有笔记ID
        if (mounted && editorEl.current && !readOnly && editMode.isEditing && note?.id) {
            // 使用较长的延迟确保编辑器完全初始化后再设置光标
            const timer = setTimeout(moveCaretToEnd, 800);
            return () => clearTimeout(timer);
        }
    }, [mounted, readOnly, editMode.isEditing, note?.id, moveCaretToEnd]); // 只在这些依赖项变化时触发

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
