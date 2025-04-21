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
    // 存储组合输入期间的特殊字符和命令
    const pendingChars = useRef<string>("");

    useEffect(() => {
        if (isPreview) return;
        setHasMinHeight((backlinks?.length ?? 0) <= 0);
    }, [backlinks, isPreview]);

    // 添加组合事件处理函数
    const handleCompositionStart = useCallback(() => {
        console.log('输入法组合开始');
        setIsComposing(true);
        // 清空待处理字符
        pendingChars.current = "";
    }, []);

    const handleCompositionEnd = useCallback(() => {
        console.log('输入法组合结束');
        
        // 组合结束后，处理待处理的特殊字符
        if (editorEl.current && editorEl.current.view && pendingChars.current) {
            const { state, dispatch } = editorEl.current.view;
            
            // 保存待处理字符的副本，因为我们会在处理过程中清空它
            const chars = pendingChars.current;
            pendingChars.current = "";
            
            // 延迟处理，确保组合输入已完成
            setTimeout(() => {
                if (!editorEl.current || !editorEl.current.view) return;
                
                // 插入待处理的字符
                dispatch(state.tr.insertText(chars));
                
                // 如果有特殊Markdown字符，处理相应的命令
                if (chars.includes('/')) {
                    // 处理斜杠命令
                    setTimeout(() => {
                        if (editorEl.current && editorEl.current.view) {
                            // 触发一个空事务来刷新编辑器状态，这会激活斜杠命令菜单
                            editorEl.current.view.dispatch(editorEl.current.view.state.tr);
                        }
                    }, 50); // 增加延迟时间，确保输入完全处理完毕
                } else if (chars.includes('*')) {
                    // 处理加粗/斜体命令
                    handleMarkdownCommand('*');
                } else if (chars.includes('#')) {
                    // 处理标题命令
                    handleMarkdownCommand('#');
                }
            }, 50); // 增加延迟时间，确保组合输入完全结束
        }
        
        // 重置组合状态
        setIsComposing(false);
    }, [editorEl, handleMarkdownCommand]);

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
        // 定义需要特殊处理的Markdown语法字符
        const specialChars = ['/', '#', '*', '>', '`', '-', '+', '=', '[', ']', '(', ')', '!', '@'];
        
        // 如果在组合输入状态下按下特殊字符
        if (isComposing && specialChars.includes(e.key)) {
            console.log(`组合输入中检测到特殊字符: ${e.key}`);
            // 阻止默认行为
            e.preventDefault();
            e.stopPropagation();
            
            // 将特殊字符添加到待处理字符串
            pendingChars.current += e.key;
            
            // 如果是斜杠命令，立即在编辑器中显示一个占位符，以便用户知道命令已被捕获
            if (e.key === '/' && editorEl.current && editorEl.current.view) {
                // 在编辑器中显示视觉反馈，但不实际插入字符
                const { state } = editorEl.current.view;
                const { selection } = state;
                const pos = selection.$from.pos;
                
                // 在当前位置显示一个闪烁的光标，提示用户命令已被捕获
                editorEl.current.view.dispatch(state.tr.setSelection(selection));
            }
            return;
        }
        
        // 处理组合输入期间的格式化键，防止意外触发Markdown格式化
        if (isComposing && (e.key === 'Enter' || e.key === 'Tab' || e.key === 'Backspace')) {
            console.log(`组合输入中检测到格式键: ${e.key}`);
            
            // 对于退格键，需要特殊处理，允许删除待处理的特殊字符
            if (e.key === 'Backspace' && pendingChars.current.length > 0) {
                pendingChars.current = pendingChars.current.slice(0, -1);
                console.log(`删除待处理字符，剩余: ${pendingChars.current}`);
            } else {
                // 对于其他格式键，阻止默认行为
                e.preventDefault();
                e.stopPropagation();
            }
            return;
        }
    }, [isComposing, editorEl]);

    // 自定义onChange处理，确保在组合输入期间不会打断输入
    const handleEditorChange = useCallback(
        (value: () => string) => {
            // 如果正在组合输入或有待处理字符，不立即触发onChange
            if (isComposing) {
                console.log('组合输入中，延迟处理onChange');
                return;
            }
            
            // 如果有待处理字符但不在组合状态，可能是刚刚结束组合
            if (pendingChars.current) {
                console.log('有待处理字符，延迟处理onChange');
                // 延迟处理onChange，确保待处理字符先被插入
                setTimeout(() => {
                    if (!isComposing && !pendingChars.current) {
                        console.log('延迟处理onChange');
                        onEditorChange(value);
                    }
                }, 50);
                return;
            }
            
            // 否则正常处理onChange
            onEditorChange(value);
        },
        [isComposing, onEditorChange]
    );
    
    // 添加处理Markdown格式化命令的函数
    const handleMarkdownCommand = useCallback((command: string) => {
        if (!editorEl.current || !editorEl.current.view) return;
        
        console.log(`处理Markdown命令: ${command}`);
        const { state, dispatch } = editorEl.current.view;
        
        // 根据命令类型执行相应操作
        switch (command) {
            case '*':
            case '**':
                // 强制刷新视图，确保格式化正确应用
                setTimeout(() => {
                    if (editorEl.current && editorEl.current.view) {
                        editorEl.current.view.dispatch(editorEl.current.view.state.tr);
                    }
                }, 10);
                break;
            default:
                break;
        }
    }, [editorEl]);

    return (
        <>
            <div 
                onKeyDown={handleKeyDown}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
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
