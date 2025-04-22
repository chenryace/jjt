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
    // 创建MutationObserver引用
    const observerRef = useRef<MutationObserver | null>(null);
    // 跟踪编辑器状态是否被锁定
    const isEditorLocked = useRef<boolean>(false);
    // 跟踪是否需要处理特殊字符
    const needsSpecialCharHandling = useRef<boolean>(false);
    // 跟踪最后一次组合输入结束的时间
    const lastCompositionEndTime = useRef<number>(0);
    // 跟踪最后一次键盘操作的时间
    const lastKeyPressTime = useRef<number>(0);

    useEffect(() => {
        if (isPreview) return;
        setHasMinHeight((backlinks?.length ?? 0) <= 0);
    }, [backlinks, isPreview]);

    // 添加处理Markdown格式化命令的函数
    const handleMarkdownCommand = useCallback((command: string) => {
        if (!editorEl.current || !editorEl.current.view) return;
        
        console.log(`处理Markdown命令: ${command}`);
        
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
            case '/':
                // 处理斜杠命令，确保命令菜单显示
                // 使用requestAnimationFrame代替setTimeout，确保在下一帧渲染前处理
                requestAnimationFrame(() => {
                    if (editorEl.current && editorEl.current.view) {
                        // 检查编辑器状态是否已经有斜杠
                        const { state } = editorEl.current.view;
                        const { selection } = state;
                        const { from } = selection;
                        
                        // 获取当前位置前的文本
                        const textBefore = state.doc.textBetween(
                            Math.max(0, from - 1),
                            from,
                            ''
                        );
                        
                        // 只有当前位置前没有斜杠时才插入
                        if (textBefore !== '/') {
                            // 模拟斜杠命令触发
                            editorEl.current.view.dispatch(state.tr.insertText('/'));
                        }
                    }
                });
                break;
            default:
                break;
        }
    }, [editorEl]);

    // 添加组合事件处理函数
    const handleCompositionStart = useCallback(() => {
        console.log('输入法组合开始');
        setIsComposing(true);
        // 清空待处理字符
        pendingChars.current = "";
        // 锁定编辑器状态
        isEditorLocked.current = true;
        // 重置特殊字符处理标志
        needsSpecialCharHandling.current = false;
    }, []);

    const handleCompositionEnd = useCallback(() => {
        console.log('输入法组合结束');
        
        // 记录组合输入结束时间
        lastCompositionEndTime.current = Date.now();
        
        // 如果有特殊字符需要处理，设置标志
        if (pendingChars.current) {
            needsSpecialCharHandling.current = true;
            console.log(`组合输入结束，待处理特殊字符: ${pendingChars.current}`);
            
            // 检查是否包含斜杠，如果包含，需要特殊处理
            if (pendingChars.current.includes('/') && editorEl.current && editorEl.current.view) {
                // 检查编辑器状态，避免重复插入斜杠
                const { state } = editorEl.current.view;
                const { selection } = state;
                const { from } = selection;
                
                // 获取当前位置前的文本
                const textBefore = state.doc.textBetween(
                    Math.max(0, from - 1),
                    from,
                    ''
                );
                
                // 如果前一个字符已经是斜杠，则不再处理
                if (textBefore === '/') {
                    console.log('组合输入结束: 检测到已有斜杠，跳过处理');
                    needsSpecialCharHandling.current = false;
                    pendingChars.current = "";
                }
            }
        }
        
        // 重置组合状态
        setIsComposing(false);
        
        // 立即解锁编辑器
        isEditorLocked.current = false;
        
        // 使用requestAnimationFrame确保在下一帧渲染前刷新编辑器状态
        // 这比setTimeout更可靠，因为它与浏览器的渲染周期同步
        requestAnimationFrame(() => {
            if (editorEl.current && editorEl.current.view) {
                // 发送一个空操作来刷新编辑器状态
                editorEl.current.view.dispatch(editorEl.current.view.state.tr);
                
                // 确保编辑器接收键盘事件
                if (editorEl.current.element) {
                    editorEl.current.element.focus();
                }
                
                // 再次确认编辑器已解锁
                isEditorLocked.current = false;
            }
        });
    }
    }, [editorEl]);

    // 添加编辑器DOM引用的事件监听和MutationObserver
    useEffect(() => {
        if (!editorEl.current || isPreview || readOnly) return;

        // 获取编辑器的DOM元素
        const editorDom = editorEl.current.element;
        if (!editorDom) return;

        // 添加组合事件监听
        editorDom.addEventListener('compositionstart', handleCompositionStart);
        editorDom.addEventListener('compositionend', handleCompositionEnd);
        
        // 添加输入事件监听，用于检测组合输入结束后的实际输入
        const handleInput = () => {
            // 如果组合输入刚刚结束且有待处理的特殊字符
            if (needsSpecialCharHandling.current && pendingChars.current) {
                console.log('输入事件：处理待处理的特殊字符', pendingChars.current);
                
                // 计算自上次组合输入结束的时间差
                const timeSinceCompositionEnd = Date.now() - lastCompositionEndTime.current;
                
                // 如果时间差小于100ms，使用requestAnimationFrame延迟处理
                // 这样可以确保编辑器内部状态已经稳定
                if (timeSinceCompositionEnd < 100) {
                    requestAnimationFrame(() => {
                        // 再次检查状态，确保在执行时仍然需要处理
                        if (needsSpecialCharHandling.current && pendingChars.current) {
                            // 立即处理特殊字符
                            if (pendingChars.current.includes('/')) {
                                handleMarkdownCommand('/');
                            } else if (pendingChars.current.includes('*')) {
                                handleMarkdownCommand('*');
                            } else if (pendingChars.current.includes('#')) {
                                handleMarkdownCommand('#');
                            }
                            
                            // 重置待处理状态
                            needsSpecialCharHandling.current = false;
                            pendingChars.current = "";
                        }
                    });
                } else {
                    // 立即处理特殊字符
                    if (pendingChars.current.includes('/')) {
                        handleMarkdownCommand('/');
                    } else if (pendingChars.current.includes('*')) {
                        handleMarkdownCommand('*');
                    } else if (pendingChars.current.includes('#')) {
                        handleMarkdownCommand('#');
                    }
                    
                    // 重置待处理状态
                    needsSpecialCharHandling.current = false;
                    pendingChars.current = "";
                }
            }
            
            // 确保编辑器未锁定
            if (isEditorLocked.current) {
                isEditorLocked.current = false;
            }
        };
        
        // 添加输入事件监听
        editorDom.addEventListener('input', handleInput);
        
        // 创建MutationObserver来监听DOM变化
        const observer = new MutationObserver((mutations) => {
            // 如果不需要处理特殊字符，直接返回
            if (!needsSpecialCharHandling.current) return;
            
            // 检查是否有文本内容变化
            const hasTextChange = mutations.some(mutation => 
                mutation.type === 'characterData' || 
                mutation.type === 'childList' || 
                mutation.addedNodes.length > 0 || 
                mutation.removedNodes.length > 0
            );
            
            if (hasTextChange) {
                // 计算自上次组合输入结束的时间差
                const timeSinceCompositionEnd = Date.now() - lastCompositionEndTime.current;
                // 计算自上次键盘操作的时间差
                const timeSinceKeyPress = Date.now() - lastKeyPressTime.current;
                
                // 如果时间差太小，可能是重复处理，跳过
                if (timeSinceCompositionEnd < 50 || timeSinceKeyPress < 50) {
                    console.log('MutationObserver: 检测到可能的重复处理，跳过');
                    return;
                }
                
                // 检查编辑器状态，避免重复插入斜杠
                if (pendingChars.current.includes('/') && editorEl.current && editorEl.current.view) {
                    const { state } = editorEl.current.view;
                    const { selection } = state;
                    const { from } = selection;
                    
                    // 获取当前位置前的文本
                    const textBefore = state.doc.textBetween(
                        Math.max(0, from - 1),
                        from,
                        ''
                    );
                    
                    // 如果前一个字符已经是斜杠，则不再处理
                    if (textBefore === '/') {
                        console.log('MutationObserver: 检测到已有斜杠，跳过处理');
                        needsSpecialCharHandling.current = false;
                        pendingChars.current = "";
                        return;
                    }
                    
                    // 处理斜杠命令
                    handleMarkdownCommand('/');
                } else if (pendingChars.current.includes('*')) {
                    // 处理加粗/斜体命令
                    handleMarkdownCommand('*');
                } else if (pendingChars.current.includes('#')) {
                    // 处理标题命令
                    handleMarkdownCommand('#');
                }
                
                // 重置待处理状态
                needsSpecialCharHandling.current = false;
                pendingChars.current = "";
            }
        });
        
        // 保存observer引用以便清理
        observerRef.current = observer;
        
        // 开始观察编辑器DOM变化
        observer.observe(editorDom, {
            childList: true,
            subtree: true,
            characterData: true
        });

        // 添加安全机制，防止编辑器永久锁定
        const safetyTimer = setInterval(() => {
            // 如果编辑器锁定但不在组合输入状态，强制解锁
            if (isEditorLocked.current && !isComposing) {
                console.log('安全机制：检测到异常锁定状态，强制解锁');
                isEditorLocked.current = false;
            }
        }, 200); // 减少间隔时间，提高响应速度

        return () => {
            // 清理事件监听和MutationObserver
            editorDom.removeEventListener('compositionstart', handleCompositionStart);
            editorDom.removeEventListener('compositionend', handleCompositionEnd);
            editorDom.removeEventListener('input', handleInput);
            if (observerRef.current) {
                observerRef.current.disconnect();
                observerRef.current = null;
            }
            // 清理安全定时器
            clearInterval(safetyTimer);
        };
    }, [editorEl, isPreview, readOnly, handleCompositionStart, handleCompositionEnd, handleMarkdownCommand, isComposing]);

    
    // 自定义键盘事件处理，解决中文输入法下斜杠命令和特殊字符问题
    const handleKeyDown = useCallback((e: ReactKeyboardEvent) => {
        // 定义需要特殊处理的Markdown语法字符
        const specialChars = ['/', '#', '*', '>', '`', '-', '+', '=', '[', ']', '(', ')', '!', '@'];
        
        // 记录最后一次键盘操作时间
        lastKeyPressTime.current = Date.now();
        
        // 检查输入法状态 - 使用原生事件的isComposing属性
        const nativeIsComposing = e.nativeEvent && e.nativeEvent.isComposing;
        
        // 处理通过数字键选择候选词的情况
        if ((isComposing || nativeIsComposing) && e.key >= '1' && e.key <= '9') {
            console.log(`组合输入中通过数字键选择候选词: ${e.key}`);
            // 不阻止默认行为，让输入法正常处理
            return;
        }
        
        // 处理Enter键 - 无论在什么状态下都确保它能正常工作
        if (e.key === 'Enter') {
            // 如果是在组合输入状态，但不是选择候选词的数字键
            if (nativeIsComposing) {
                console.log('检测到输入法组合状态下的Enter键');
                // 不阻止默认行为，让输入法完成当前输入
                return;
            }
            
            // 如果编辑器被锁定但实际上不在组合输入状态，强制解锁
            if (isEditorLocked.current && !isComposing && !nativeIsComposing) {
                console.log('检测到编辑器锁定但不在组合输入状态，强制解锁');
                isEditorLocked.current = false;
                // 不阻止默认行为
                return;
            }
        }
        
        // 处理Backspace键 - 确保它在组合输入结束后能正常工作
        if (e.key === 'Backspace') {
            // 如果编辑器被锁定但实际上不在组合输入状态，强制解锁
            if (isEditorLocked.current && !isComposing && !nativeIsComposing) {
                console.log('检测到编辑器锁定但不在组合输入状态，强制解锁');
                isEditorLocked.current = false;
                // 不阻止默认行为
                return;
            }
            
            // 如果在组合输入状态，但有待处理的特殊字符，允许删除它们
            if ((isComposing || nativeIsComposing) && pendingChars.current.length > 0) {
                pendingChars.current = pendingChars.current.slice(0, -1);
                console.log(`删除待处理字符，剩余: ${pendingChars.current}`);
                // 不阻止默认行为
                return;
            }
        }
        
        // 如果在组合输入状态下按下特殊字符
        if ((isComposing || nativeIsComposing) && specialChars.includes(e.key)) {
            console.log(`组合输入中检测到特殊字符: ${e.key}`);
            // 阻止默认行为
            e.preventDefault();
            e.stopPropagation();
            
            // 将特殊字符添加到待处理字符串
            pendingChars.current += e.key;
            
            // 如果是斜杠命令，提供视觉反馈
            if (e.key === '/' && editorEl.current && editorEl.current.view) {
                // 在编辑器中显示视觉反馈，但不实际插入字符
                const { state } = editorEl.current.view;
                const { selection } = state;
                
                // 设置一个标志，表示已经捕获了斜杠命令
                needsSpecialCharHandling.current = true;
                
                // 在当前位置显示一个闪烁的光标，提示用户命令已被捕获
                editorEl.current.view.dispatch(state.tr.setSelection(selection));
                
                // 记录捕获时间，用于后续处理
                lastKeyPressTime.current = Date.now();
            }
            return;
        }
        
        // 处理非组合输入状态下的斜杠键
        if (!isComposing && !nativeIsComposing && e.key === '/') {
            // 确保编辑器不会被锁定
            isEditorLocked.current = false;
            
            // 检查是否需要阻止默认行为
            // 如果编辑器内部已经有斜杠命令处理机制，则不干预
            if (editorEl.current && editorEl.current.view) {
                const { state } = editorEl.current.view;
                const { selection } = state;
                const { from } = selection;
                
                // 获取当前位置前的文本
                const textBefore = state.doc.textBetween(
                    Math.max(0, from - 1),
                    from,
                    ''
                );
                
                // 如果前一个字符已经是斜杠，则阻止重复输入
                if (textBefore === '/') {
                    console.log('检测到重复的斜杠输入，阻止默认行为');
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }
            
            // 正常处理斜杠键
            return;
        }
    }, [isComposing, editorEl]);

    // 自定义onChange处理，确保在组合输入期间不会打断输入
    const handleEditorChange = useCallback(
        (value: () => string) => {
            // 如果正在组合输入，不立即触发onChange
            if (isComposing) {
                console.log('组合输入中，不处理onChange');
                return;
            }
            
            // 计算自上次组合输入结束的时间差
            const timeSinceCompositionEnd = Date.now() - lastCompositionEndTime.current;
            
            // 如果组合输入刚刚结束（小于100ms），延迟处理onChange
            // 这样可以确保特殊字符处理完成后再触发onChange
            if (timeSinceCompositionEnd < 100) {
                console.log('组合输入刚刚结束，延迟处理onChange');
                requestAnimationFrame(() => {
                    // 再次检查状态，确保在执行时不在组合输入状态
                    if (!isComposing) {
                        onEditorChange(value);
                    }
                });
                return;
            }
            
            // 如果需要处理特殊字符，使用requestAnimationFrame代替setTimeout
            if (needsSpecialCharHandling.current) {
                console.log('需要处理特殊字符，使用requestAnimationFrame处理onChange');
                // 使用requestAnimationFrame确保在下一帧渲染前处理onChange
                // 这比setTimeout更可靠，因为它与浏览器的渲染周期同步
                requestAnimationFrame(() => {
                    // 再次检查状态，确保在执行时仍然需要处理
                    if (!isComposing) {
                        onEditorChange(value);
                        // 处理完成后重置标志
                        needsSpecialCharHandling.current = false;
                    }
                });
                return;
            }
            
            // 否则正常处理onChange
            onEditorChange(value);
        },
        [isComposing, onEditorChange]
    );
    
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
