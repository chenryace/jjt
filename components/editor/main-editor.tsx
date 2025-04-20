import EditTitle from './edit-title';
import Editor, { EditorProps } from './editor';
import Backlinks from './backlinks';
import EditorState from 'libs/web/state/editor';
import UIState from 'libs/web/state/ui';
import { FC, useEffect } from 'react';
import { NoteModel } from 'libs/shared/note';
import { EDITOR_SIZE } from 'libs/shared/meta';

const MainEditor: FC<
    EditorProps & {
        note?: NoteModel;
        isPreview?: boolean;
        className?: string;
    }
> = ({ className, note, isPreview, ...props }) => {
    const {
        settings: { settings },
    } = UIState.useContainer();
    let editorWidthClass: string;
    switch (note?.editorsize ?? settings.editorsize) {
        case EDITOR_SIZE.SMALL:
            editorWidthClass = 'max-w-prose';
            break;
        case EDITOR_SIZE.LARGE:
            editorWidthClass = 'max-w-4xl';
            break;
        case EDITOR_SIZE.AS_WIDE_AS_POSSIBLE:
            // until we reach md size, just do LARGE to have consistency
            editorWidthClass = 'max-w-4xl md:max-w-full md:mx-20';
            break;
    }
    const articleClassName =
        className || `pt-16 md:pt-40 px-6 m-auto h-full ${editorWidthClass}`;

    return (
        <EditorState.Provider initialState={note}>
            <EditorContent 
                articleClassName={articleClassName} 
                isPreview={isPreview} 
                readOnly={props.readOnly} 
            />
        </EditorState.Provider>
    );
};

// 创建一个内部组件来使用EditorState
const EditorContent: FC<{
    articleClassName: string;
    isPreview?: boolean;
    readOnly?: boolean;
}> = ({ articleClassName, isPreview, readOnly }) => {
    const { saveNote, hasLocalChanges } = EditorState.useContainer();
    
    // 添加键盘快捷键支持
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // 添加Ctrl+S (或Mac上的Cmd+S)快捷键
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (hasLocalChanges) {
                    saveNote()
                        .catch(error => console.error('保存失败', error));
                }
            }
        };
        
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [hasLocalChanges, saveNote]);
    
    // 添加页面离开提示
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasLocalChanges) {
                // 显示标准的"离开页面"提示
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        };
        
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasLocalChanges]);
    
    return (
        <article className={articleClassName}>
            <EditTitle readOnly={readOnly} />
            <Editor isPreview={isPreview} readOnly={readOnly} />
            {!isPreview && <Backlinks />}
        </article>
    );
};

export default MainEditor;
