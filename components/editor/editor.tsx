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
    
    // 使用状态来存储编辑器内容，避免每次渲染时从localStorage重新读取
    const [editorContent, setEditorContent] = useState<string>('');
    // 使用ref跟踪是否已经初始化内容
    const contentInitializedRef = useRef(false);
    
    const height = use100vh();
    const mounted = useMounted();
    const editorTheme = useEditorTheme();
    const [hasMinHeight, setHasMinHeight] = useState(true);
    const toast = useToast();
    const dictionary = useDictionary();
    const embeds = useEmbeds();
    
    // 初始化编辑器内容
    useEffect(() => {
        if (!mounted || !note?.id || contentInitializedRef.current) return;
        
        // 从localStorage获取内容或使用note.content
        const tempContentKey = `temp_content_${note.id}`;
        const tempContent = localStorage.getItem(tempContentKey);
        const initialContent = tempContent || note.content || '';
        
        // 设置编辑器内容
        setEditorContent(initialContent);
        
        // 标记内容已初始化
        contentInitializedRef.current = true;
    }, [mounted, note?.id, note?.content]);
    
    // 编辑器内容变化处理函数
    const onEditorChange = useCallback((value: () => string): void => {
        if (!note?.id) return;
        
        const newContent = value();
        
        // 更新状态中的内容
        setEditorContent(newContent);
        
        // 存储到localStorage
        const tempContentKey = `temp_content_${note.id}`;
        localStorage.setItem(tempContentKey, newContent);
        
        // 标记有未保存的更改
        editMode.setHasUnsavedChanges(true);
    }, [note?.id, editMode]);
    
    // 处理背景链接
    useEffect(() => {
        if (isPreview) return;
        setHasMinHeight((backlinks?.length ?? 0) <= 0);
    }, [backlinks, isPreview]);
    
    // 处理笔记切换
    useEffect(() => {
        if (!note?.id) return;
        
        // 笔记ID变化时，重置初始化标志
        contentInitializedRef.current = false;
        
        // 从localStorage获取内容或使用note.content
        const tempContentKey = `temp_content_${note.id}`;
        const tempContent = localStorage.getItem(tempContentKey);
        const initialContent = tempContent || note.content || '';
        
        // 设置编辑器内容
        setEditorContent(initialContent);
        
        // 标记内容已初始化
        contentInitializedRef.current = true;
    }, [note?.id, note?.content]);

    return (
        <>
            <MarkdownEditor
                readOnly={readOnly || (!editMode.isEditing && !isPreview)}
                id={note?.id}
                ref={editorEl}
                value={editorContent} // 使用状态中的内容，避免每次渲染时重新计算
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
