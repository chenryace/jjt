import NoteState from 'libs/web/state/note';
import { has } from 'lodash';
import router, { useRouter } from 'next/router';
import { useCallback, useEffect } from 'react';
import NoteTreeState from 'libs/web/state/tree';
import NoteNav from 'components/note-nav';
import UIState from 'libs/web/state/ui';
import noteCache from 'libs/web/cache/note';
import useSettingsAPI from 'libs/web/api/settings';
import dynamic from 'next/dynamic';
import { useToast } from 'libs/web/hooks/use-toast';
import DeleteAlert from 'components/editor/delete-alert';
// 移除直接导入EditorState
// import EditorState from 'libs/web/state/editor';

const MainEditor = dynamic(() => import('components/editor/main-editor'));

export const EditContainer = () => {
    const {
        title: { updateTitle },
        settings: { settings },
    } = UIState.useContainer();
    const { genNewId } = NoteTreeState.useContainer();
    const { fetchNote, abortFindNote, findOrCreateNote, initNote, note } =
        NoteState.useContainer();
    // 移除对EditorState的直接使用
    // const { saveNote, hasLocalChanges } = EditorState.useContainer();
    const { query } = useRouter();
    const pid = query.pid as string;
    const id = query.id as string;
    const isNew = has(query, 'new');
    const { mutate: mutateSettings } = useSettingsAPI();
    const toast = useToast();

    const loadNoteById = useCallback(
        async (id: string) => {
            // daily notes
            if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(id)) {
                await findOrCreateNote(id, {
                    id,
                    title: id,
                    content: '\n',
                    pid: settings.daily_root_id,
                });
            } else if (id === 'new') {
                const url = `/${genNewId()}?new` + (pid ? `&pid=${pid}` : '');

                await router.replace(url, undefined, { shallow: true });
            } else if (id && !isNew) {
                try {
                    const result = await fetchNote(id);
                    if (!result) {
                        await router.replace({ query: { ...router.query, new: 1 } });
                        return;
                    }
                } catch (msg) {
                    const err = msg as Error;
                    if (err.name !== 'AbortError') {
                        toast(err.message, 'error');
                        await router.push('/', undefined, { shallow: true });
                    }
                }
            } else {
                if (await noteCache.getItem(id)) {
                    await router.push(`/${id}`, undefined, { shallow: true });
                    return;
                }

                initNote({
                    id,
                    content: '\n',
                });
            }

            if (!isNew && id !== 'new') {
                await mutateSettings({
                    last_visit: `/${id}`,
                });
            }
        },
        [
            isNew,
            findOrCreateNote,
            settings.daily_root_id,
            genNewId,
            pid,
            fetchNote,
            toast,
            initNote,
            mutateSettings,
        ]
    );

    useEffect(() => {
        abortFindNote();
        loadNoteById(id)
            ?.catch((v) => console.error('Could not load note: %O', v));
    }, [loadNoteById, abortFindNote, id]);

    useEffect(() => {
        updateTitle(note?.title);
    }, [note?.title, updateTitle]);
    
    // 移除键盘快捷键支持，将在MainEditor组件中处理
    // useEffect(() => {
    //     const handleKeyDown = (e: KeyboardEvent) => {
    //         if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    //             e.preventDefault();
    //             if (hasLocalChanges) {
    //                 saveNote()
    //                     .catch(error => console.error('保存失败', error));
    //             }
    //         }
    //     };
    //     
    //     document.addEventListener('keydown', handleKeyDown);
    //     return () => document.removeEventListener('keydown', handleKeyDown);
    // }, [hasLocalChanges, saveNote]);
    
    // 移除页面离开提示，将在MainEditor组件中处理
    // useEffect(() => {
    //     const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    //         if (hasLocalChanges) {
    //             e.preventDefault();
    //             e.returnValue = '';
    //             return '';
    //         }
    //     };
    //     
    //     window.addEventListener('beforeunload', handleBeforeUnload);
    //     return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    // }, [hasLocalChanges]);

    return (
        <>
            <NoteNav />
            <DeleteAlert />
            <section className="h-full">
                <MainEditor note={note} />
            </section>
        </>
    );
};
