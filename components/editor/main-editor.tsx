import EditTitle from './edit-title';
import Editor, { EditorProps } from './editor';
import Backlinks from './backlinks';
import EditorState from 'libs/web/state/editor';
import UIState from 'libs/web/state/ui';
import { FC, useCallback } from 'react';
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
        const tempContentKey = `temp_content_${note.id}`;
        const tempContent = localStorage.getItem(tempContentKey);
        
        if (tempContent) {
            // 保存到数据库
            await updateNote({ content: tempContent });
            // 清除临时内容
            localStorage.removeItem(tempContentKey);
            // 标记没有未保存的更改
            editMode.setHasUnsavedChanges(false);
        }
    }, [note?.id, updateNote, editMode]);

    // 切换编辑/预览模式
    const toggleMode = useCallback(() => {
        // 如果从编辑模式切换到预览模式，自动保存
        if (editMode.isEditing && editMode.hasUnsavedChanges) {
            saveNote();
        }
        editMode.toggleEditMode();
    }, [editMode, saveNote]);

    return (
        <EditorState.Provider initialState={note}>
            <article className={articleClassName}>
                <div className="flex justify-between items-center mb-4">
                    <EditTitle readOnly={props.readOnly} />
                    {!props.readOnly && !isPreview && (
                        <div className="flex space-x-2">
                            <Button 
                                onClick={toggleMode}
                                size="small"
                                variant="outlined"
                                color="primary"
                            >
                                {editMode.isEditing ? '预览' : '编辑'}
                            </Button>
                            {editMode.isEditing && editMode.hasUnsavedChanges && (
                                <Button 
                                    onClick={saveNote}
                                    size="small"
                                    color="primary"
                                    variant="contained"
                                >
                                    保存
                                </Button>
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
