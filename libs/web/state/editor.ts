import NoteState from 'libs/web/state/note';
import { useRouter } from 'next/router';
import {
    useCallback,
    MouseEvent as ReactMouseEvent,
    useState,
    useRef,
    useEffect,
} from 'react';
import { searchNote, searchRangeText } from 'libs/web/utils/search';
import useFetcher from 'libs/web/api/fetcher';
import { NOTE_DELETED } from 'libs/shared/meta';
import { isNoteLink, NoteModel } from 'libs/shared/note';
import { useToast } from 'libs/web/hooks/use-toast';
import PortalState from 'libs/web/state/portal';
import { NoteCacheItem } from 'libs/web/cache';
import noteCache from 'libs/web/cache/note';
import { createContainer } from 'unstated-next';
import MarkdownEditor from '@notea/rich-markdown-editor';
import { useDebouncedCallback } from 'use-debounce';
import { ROOT_ID } from 'libs/shared/tree';
import { has } from 'lodash';
import UIState from './ui';
import NoteTreeState from './tree';

const onSearchLink = async (keyword: string) => {
    const list = await searchNote(keyword, NOTE_DELETED.NORMAL);

    return list.map((item) => ({
        title: item.title,
        // todo 路径
        subtitle: searchRangeText({
            text: item.rawContent || '',
            keyword,
            maxLen: 40,
        }).match,
        url: `/${item.id}`,
    }));
};

const useEditor = (initNote?: NoteModel) => {
    const {
        createNoteWithTitle,
        updateNote,
        createNote,
        note: noteProp,
    } = NoteState.useContainer();
    const note = initNote ?? noteProp;
    const {
        ua: { isBrowser },
    } = UIState.useContainer();
    const router = useRouter();
    const { request, error } = useFetcher();
    const toast = useToast();
    const editorEl = useRef<MarkdownEditor>(null);
    const treeState = NoteTreeState.useContainer();
    
    // 添加本地更改状态
    const [hasLocalChanges, setHasLocalChanges] = useState<boolean>(false);
    const [localContent, setLocalContent] = useState<string>('');
    const [localTitle, setLocalTitle] = useState<string>('');
    
    // 初始化本地内容
    useEffect(() => {
        if (note) {
            setLocalContent(note.content || '');
            setLocalTitle(note.title || '');
            setHasLocalChanges(false);
            
            // 检查localStorage中是否有未保存的内容
            if (note.id) {
                const savedContent = localStorage.getItem(`note_content_${note.id}`);
                const savedTitle = localStorage.getItem(`note_title_${note.id}`);
                
                if (savedContent && savedContent !== note.content) {
                    setLocalContent(savedContent);
                    setHasLocalChanges(true);
                }
                
                if (savedTitle && savedTitle !== note.title) {
                    setLocalTitle(savedTitle);
                    setHasLocalChanges(true);
                }
            }
        }
    }, [note]);

    const onNoteChange = useDebouncedCallback(
        async (data: Partial<NoteModel>) => {
            const isNew = has(router.query, 'new');

            if (isNew) {
                data.pid = (router.query.pid as string) || ROOT_ID;
                const item = await createNote({ ...note, ...data });
                const noteUrl = `/${item?.id}`;

                if (router.asPath !== noteUrl) {
                    await router.replace(noteUrl, undefined, { shallow: true });
                }
            } else {
                await updateNote(data);
            }
        },
        500
    );

    const onCreateLink = useCallback(
        async (title: string) => {
            const result = await createNoteWithTitle(title);

            if (!result) {
                throw new Error('todo');
            }

            return `/${result.id}`;
        },
        [createNoteWithTitle]
    );

    const onClickLink = useCallback(
        (href: string) => {
            if (isNoteLink(href.replace(location.origin, ''))) {
                router.push(href, undefined, { shallow: true })
                    .catch((v) => console.error('Error whilst pushing href to router: %O', v));
            } else {
                window.open(href, '_blank');
            }
        },
        [router]
    );

    const onUploadImage = useCallback(
        async (file: File, id?: string) => {
            const data = new FormData();
            data.append('file', file);
            const result = await request<FormData, { url: string }>(
                {
                    method: 'POST',
                    url: `/api/upload?id=${id}`,
                },
                data
            );
            if (!result) {
                toast(error, 'error');
                throw Error(error);
            }
            return result.url;
        },
        [error, request, toast]
    );

    const { preview, linkToolbar } = PortalState.useContainer();

    const onHoverLink = useCallback(
        (event: MouseEvent | ReactMouseEvent) => {
            if (!isBrowser || editorEl.current?.props.readOnly) {
                return true;
            }
            const link = event.target as HTMLLinkElement;
            const href = link.getAttribute('href');
            if (link.classList.contains('bookmark')) {
                return true;
            }
            if (href) {
                if (isNoteLink(href)) {
                    preview.close();
                    preview.setData({ id: href.slice(1) });
                    preview.setAnchor(link);
                } else {
                    linkToolbar.setData({ href, view: editorEl.current?.view });
                    linkToolbar.setAnchor(link);
                }
            } else {
                preview.setData({ id: undefined });
            }
            return true;
        },
        [isBrowser, preview, linkToolbar]
    );

    const [backlinks, setBackLinks] = useState<NoteCacheItem[]>();

    const getBackLinks = useCallback(async () => {
        console.log(note?.id);
        const linkNotes: NoteCacheItem[] = [];
        if (!note?.id) return linkNotes;
        setBackLinks([]);
        await noteCache.iterate<NoteCacheItem, void>((value) => {
            if (value.linkIds?.includes(note.id)) {
                linkNotes.push(value);
            }
        });
        setBackLinks(linkNotes);
    }, [note?.id]);

    // 修改为不再自动保存的版本
    const onEditorChange = useCallback(
        (value: () => string): void => {
            const newContent = value();
            // 只更新本地状态，不调用保存
            setLocalContent(newContent);
            setHasLocalChanges(true);
            
            // 保存到localStorage作为备份
            if (note?.id) {
                localStorage.setItem(`note_content_${note.id}`, newContent);
            }
        },
        [note]
    );
    
    // 添加标题变更处理
    const onTitleChange = useCallback(
        (title: string): void => {
            // 只更新本地状态，不调用保存
            setLocalTitle(title);
            setHasLocalChanges(true);
            
            // 保存到localStorage作为备份
            if (note?.id) {
                localStorage.setItem(`note_title_${note.id}`, title);
            }
        },
        [note]
    );
    
    // 添加手动保存函数，确保更新元数据和树结构
    const saveNote = useCallback(async () => {
        if (!note?.id) return false;
        
        try {
            console.log('保存笔记', { id: note?.id, localContent, localTitle });
            
            // 对于新笔记的特殊处理
            const isNew = has(router.query, 'new');
            if (isNew) {
                // 确保包含必要的元数据，特别是日期和pid
                const data = {
                    content: localContent,
                    title: localTitle,
                    pid: (router.query.pid as string) || ROOT_ID,
                    date: new Date().toISOString() // 添加日期元数据
                };
                
                console.log('创建新笔记', data);
                const item = await createNote({ ...note, ...data });
                const noteUrl = `/${item?.id}`;
                
                if (router.asPath !== noteUrl) {
                    await router.replace(noteUrl, undefined, { shallow: true });
                }
            } else {
                // 保存现有笔记，确保包含日期元数据
                console.log('更新现有笔记', { content: localContent, title: localTitle });
                await updateNote({
                    content: localContent,
                    title: localTitle,
                    date: new Date().toISOString() // 添加日期元数据
                });
            }
            
            // 清除本地更改标记
            setHasLocalChanges(false);
            
            // 清除localStorage
            if (note.id) {
                localStorage.removeItem(`note_content_${note.id}`);
                localStorage.removeItem(`note_title_${note.id}`);
            }
            
            // 保存成功后，刷新树结构以确保侧栏正确显示
            if (treeState && typeof treeState.initTree === 'function') {
                console.log('刷新树结构');
                await treeState.initTree();
            }
            
            // 显示保存成功提示
            toast('保存成功', 'success');
            
            return true;
        } catch (error) {
            console.error('保存失败', error);
            toast('保存失败，请重试', 'error');
            return false;
        }
    }, [note, localContent, localTitle, updateNote, createNote, router, toast, treeState]);
    
    // 添加带重试的保存函数
    const saveNoteWithRetry = useCallback(async (retryCount = 3) => {
        for (let i = 0; i < retryCount; i++) {
            try {
                const result = await saveNote();
                if (result) return true;
            } catch (error) {
                console.error(`保存失败，尝试重试 (${i+1}/${retryCount})`, error);
                if (i === retryCount - 1) {
                    toast('保存失败，请手动刷新页面后重试', 'error');
                    return false;
                }
                // 等待一段时间后重试
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        return false;
    }, [saveNote, toast]);
    
    // 添加丢弃更改函数
    const discardChanges = useCallback(() => {
        if (!note) return;
        
        // 恢复到原始内容
        setLocalContent(note.content || '');
        setLocalTitle(note.title || '');
        setHasLocalChanges(false);
        
        // 清除localStorage
        if (note.id) {
            localStorage.removeItem(`note_content_${note.id}`);
            localStorage.removeItem(`note_title_${note.id}`);
        }
        
        toast('已丢弃更改', 'info');
    }, [note, toast]);

    return {
        onCreateLink,
        onSearchLink,
        onClickLink,
        onUploadImage,
        onHoverLink,
        getBackLinks,
        onEditorChange,
        onNoteChange,
        backlinks,
        editorEl,
        note,
        // 新增的手动保存相关函数和状态
        saveNote,
        saveNoteWithRetry,
        discardChanges,
        hasLocalChanges,
        localContent,
        localTitle,
        onTitleChange
    };
};

const EditorState = createContainer(useEditor);

export default EditorState;
