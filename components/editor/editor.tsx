import { FC, useEffect, useState, useCallback, KeyboardEvent as ReactKeyboardEvent, useRef } from 'react';
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
        onEditorChange,
        backlinks,
        editorEl,
        note,
    } = EditorState.useContainer();
    const height = use100vh();
    const mounted = useMounted();
    const editorTheme = useEditorTheme();
    const [hasMinHeight, setHasMinHeight] = useState(true);
    const toast = useToast();
    const dictionary = useDictionary();
    const embeds = useEmbeds();
    
    // 使用本地状态跟踪组合输入
    const [isComposing, setIsComposing] = useState(false);
    // 跟踪是否有待处理的斜杠命令
    const [slashCommandPending, setSlashCommandPending] = useState(false);
    // 跟踪组合输入期间的特殊字符
    const pendingSpecialChars = useRef<string[]>([]);
    // 跟踪组合输入的位置
    const compositionPosition = useRef<{from: number, to: number} | null>(null);

    useEffect(() => {
        if (isPreview) return;
        setHasMinHeight((backlinks?.length ?? 0) <= 0);
    }, [backlinks, isPreview]);

    // 添加组合事件处理函数
    const handleCompositionStart = useCallback(() => {
        console.log('输入法组合开始');
        setIsComposing(true);
        
        // 记录当前光标位置
        if (editorEl.current && editorEl.current.view) {
            const { state } = editorEl.current.view;
            const { from, to } = state.selection;
            compositionPosition.current = { from, to };
        }
        
        // 清空待处理特殊字符
        pendingSpecialChars.current = [];
    }, [editorEl]);

    const handleCompositionEnd = useCallback(() => {
        console.log('输入法组合结束');
        setIsComposing(false);
        
        // 组合结束后，处理待处理的斜杠命令和特殊字符
        if (editorEl.current && editorEl.current.view) {
            setTimeout(() => {
                if (!editorEl.current || !editorEl.current.view) return;
                
                const { state, dispatch } = editorEl.current.view;
                
                // 处理斜杠命令
                if (slashCommandPending) {
                    dispatch(state.tr.insertText('/'));
                    setSlashCommandPending(false);
                    
                    // 强制更新视图以触发斜杠命令菜单
                    setTimeout(() => {
                        if (editorEl.current && editorEl.current.view) {
                            editorEl.current.view.dispatch(editorEl.current.view.state.tr);
                        }
                    }, 10);
                } 
                
                // 处理其他待处理的特殊字符
                if (pendingSpecialChars.current.length > 0) {
                    const specialChars = pendingSpecialChars.current.join('');
                    if (specialChars) {
                        dispatch(state.tr.insertText(specialChars));
                    }
                    pendingSpecialChars.current = [];
                }
                
                // 无论如何都强制更新视图，确保编辑器状态正确
                editorEl.current.view.dispatch(editorEl.current.view.state.tr);
            }, 10);
        }
        
        // 重置组合位置
        compositionPosition.current = null;
    }, [editorEl, slashCommandPending]);

    // 添加编辑器DOM引用的事件监听
    useEffect(() => {
        if (!editorEl.current || isPreview || readOnly) return;

        // 获取编辑器的DOM元素
        const editorDom = editorEl.current.element;
        if (!editorDom) return;

        // 添加组合事件监听
        editorDom.addEventListener('compositionstart', handleCompositionStart);
        editorDom.addEventListener('compositionend', handleCompositionEnd);

        return () => {
            // 清理事件监听
            editorDom.removeEventListener('compositionstart', handleCompositionStart);
            editorDom.removeEventListener('compositionend', handleCompositionEnd);
        };
    }, [editorEl, isPreview, readOnly, handleCompositionStart, handleCompositionEnd]);
    
    // 自定义键盘事件处理，解决中文输入法下斜杠命令和特殊字符问题
    const handleKeyDown = useCallback((e: ReactKeyboardEvent) => {
        // 如果在组合输入状态下按下斜杠键
        if (isComposing && e.key === '/') {
            console.log('组合输入中检测到斜杠键');
            // 阻止默认行为
            e.preventDefault();
            e.stopPropagation();
            
            // 标记有一个待处理的斜杠命令
            setSlashCommandPending(true);
            return;
        }
        
        // 处理其他Markdown语法特殊字符
        const specialChars = ['#', '*', '>', '`', '-', '+', '=', '[', ']', '(', ')', '!', '@'];
        if (isComposing && specialChars.includes(e.key)) {
            console.log(`组合输入中检测到特殊字符: ${e.key}`);
            // 阻止默认行为
            e.preventDefault();
            e.stopPropagation();
            
            // 将特殊字符添加到待处理队列
            pendingSpecialChars.current.push(e.key);
            return;
        }
        
        // 处理组合输入期间的Enter键，可能会触发Markdown格式化
        if (isComposing && (e.key === 'Enter' || e.key === 'Tab')) {
            console.log(`组合输入中检测到格式键: ${e.key}`);
            e.preventDefault();
            e.stopPropagation();
            return;
        }
    }, [isComposing]);

    // 自定义onChange处理，确保在组合输入期间不会打断输入
    const handleEditorChange = useCallback(
        (value: () => string) => {
            // 如果正在组合输入，不立即触发onChange
            if (isComposing) {
                console.log('组合输入中，延迟处理onChange');
                return;
            }
            
            // 检查是否有待处理的特殊字符或斜杠命令
            if (slashCommandPending || pendingSpecialChars.current.length > 0) {
                console.log('有待处理的特殊字符或斜杠命令，延迟处理onChange');
                return;
            }
            
            // 否则正常处理onChange
            onEditorChange(value);
        },
        [isComposing, onEditorChange, slashCommandPending]
    );

    return (
        <>
            <div 
                onKeyDown={handleKeyDown}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                onCompositionUpdate={() => console.log('组合输入更新中')}
            >
                <MarkdownEditor
                    readOnly={readOnly}
                    id={note?.id}
                    ref={editorEl}
                    value={mounted ? note?.content : ''}
                    onChange={handleEditorChange}
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
                />
            </div>
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
