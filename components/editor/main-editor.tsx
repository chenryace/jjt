import EditTitle from './edit-title';
import Editor, { EditorProps } from './editor';
import Backlinks from './backlinks';
import EditorState from 'libs/web/state/editor';
import UIState from 'libs/web/state/ui';
import { FC, useCallback, useEffect } from 'react';
import { NoteModel } from 'libs/shared/note';
import { EDITOR_SIZE } from 'libs/shared/meta';
import NoteState from 'libs/web/state/note';
import { Button } from '@material-ui/core';

const MainEditor: FC<
    EditorProps & {
        note?: NoteModel;
        isPreview?: boolean;
        className?: string;
    }
> = ({ className, note, isPreview, ...props }) => {
    const {
        settings: { settings },
        editMode,
    } = UIState.useContainer();
    const { updateNote } = NoteState.useContainer();
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

    // 保存笔记内容到数据库
    const saveNote = useCallback(async () => {
        if (!note?.id) return;
        
        // 从localStorage获取临时内容
        const editorContentKey = `editor_content_${note.id}`;
        const tempContent = localStorage.getItem(editorContentKey);
        
        if (tempContent) {
            try {
                // 保存到数据库
                await updateNote({ content: tempContent });
                // 清除临时内容标记
                // 注意：我们不删除localStorage中的内容，这样可以避免保存后光标位置重置
                // 只是标记没有未保存的更改
                editMode.setHasUnsavedChanges(false);
            } catch (error) {
                console.error('保存笔记失败:', error);
            }
        }
    }, [note?.id, updateNote, editMode]);

    // 进入编辑模式
    const enterEditMode = useCallback(() => {
        editMode.setEditMode();
    }, [editMode]);
    
    // 保存并返回预览模式
    const saveAndReturnToPreview = useCallback(() => {
        saveNote();
        editMode.setPreviewMode();
    }, [editMode, saveNote]);
    
    // 自动保存功能 - 每30秒自动保存一次
    useEffect(() => {
        if (!note?.id || !editMode.isEditing || !editMode.hasUnsavedChanges) return;
        
        const autoSaveInterval = 30000; // 30秒
        const timerId = setInterval(() => {
            if (editMode.hasUnsavedChanges) {
                saveNote();
            }
        }, autoSaveInterval);
        
        return () => clearInterval(timerId);
    }, [note?.id, editMode.isEditing, editMode.hasUnsavedChanges, saveNote]);

    return (
        <EditorState.Provider initialState={note}>
            <article className={articleClassName}>
                <div className="flex justify-between items-center mb-4">
                    <EditTitle readOnly={props.readOnly} />
                    {!props.readOnly && !isPreview && (
                        <div className="flex space-x-2">
                            {!editMode.isEditing ? (
                                <Button 
                                    onClick={enterEditMode}
                                    size="small"
                                    variant="outlined"
                                    color="primary"
                                >
                                    编辑
                                </Button>
                            ) : (
                                <>
                                    <Button 
                                        onClick={saveAndReturnToPreview}
                                        size="small"
                                        color="primary"
                                        variant="contained"
                                        disabled={!editMode.hasUnsavedChanges}
                                    >
                                        保存
                                    </Button>
                                    <Button 
                                        onClick={editMode.setPreviewMode}
                                        size="small"
                                        variant="outlined"
                                    >
                                        取消
                                    </Button>
                                </>
                            )}
                        </div>
                    )}
                </div>
                <Editor isPreview={isPreview} {...props} />
                {!isPreview && <Backlinks />}
            </article>
        </EditorState.Provider>
    );
};

export default MainEditor;
