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

    // 跟踪编辑器是否已初始化
    const [editorInitialized, setEditorInitialized] = useState(false);
    // 跟踪内容是否已加载
    const contentLoadedRef = useRef(false);
    // 跟踪当前内容
    const currentContentRef = useRef<string>('');

    useEffect(() => {
        if (isPreview) return;
        setHasMinHeight((backlinks?.length ?? 0) <= 0);
    }, [backlinks, isPreview]);
    
    // 修复光标位置问题
    useEffect(() => {
        // 只在编辑模式下处理光标位置
        if (!mounted || !editorEl.current || readOnly || !editMode.isEditing) return;
        
        // 标记编辑器已初始化
        if (!editorInitialized) {
            setEditorInitialized(true);
            return;
        }
        
        // 使用多个时间点尝试设置光标位置，增加成功率
        const attemptToSetCursor = () => {
            try {
                const { view } = editorEl.current;
                if (view) {
                    const { state, dispatch } = view;
                    // 获取文档末尾位置
                    const endPosition = state.doc.content.size;
                    // 创建一个事务，将选择设置到文档末尾
                    const tr = state.tr.setSelection(
                        state.selection.constructor.near(state.doc.resolve(endPosition))
                    );
                    // 分发事务
                    dispatch(tr);
                    // 确保编辑器获得焦点
                    editorEl.current.focus();
                    contentLoadedRef.current = true;
                }
            } catch (error) {
                console.error('设置光标位置失败:', error);
            }
        };
        
        // 立即尝试一次
        attemptToSetCursor();
        
        // 然后在短暂延迟后再次尝试
        const timer1 = setTimeout(attemptToSetCursor, 50);
        // 再次尝试，以防前两次失败
        const timer2 = setTimeout(attemptToSetCursor, 200);
        
        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, [mounted, readOnly, editMode.isEditing, editorInitialized]);

    // 获取编辑器内容
    const getEditorContent = useCallback(() => {
        if (!note?.id) return '';
        
        // 如果有临时内容，优先使用临时内容
        const tempContent = localStorage.getItem(`temp_content_${note.id}`);
        const content = tempContent || note?.content || '';
        
        // 更新当前内容引用
        currentContentRef.current = content;
        return content;
    }, [note?.id, note?.content]);

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
                autoFocus
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
