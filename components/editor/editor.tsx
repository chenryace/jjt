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
    // 跟踪最后一次组合输入结束的时间
    const lastCompositionEndTime = useRef<number>(0);
    // 跟踪最后一次键盘操作的时间
    const lastKeyPressTime = useRef<number>(0);
    // 跟踪组合输入结束后的首次键盘事件
    const isFirstKeyAfterComposition = useRef<boolean>(false);
    // 跟踪输入法状态
    const inputMethodActive = useRef<boolean>(false);
    // 跟踪组合输入的内容类型（中文/英文）
    const compositionType = useRef<'chinese' | 'english' | null>(null);
    // 跟踪组合输入的文本
    const compositionText = useRef<string>('');

    useEffect(() => {
        if (isPreview) return;
        setHasMinHeight((backlinks?.length ?? 0) <= 0);
    }, [backlinks, isPreview]);

    // 添加组合事件处理函数
    const handleCompositionStart = useCallback((e: CompositionEvent) => {
        console.log('输入法组合开始', e.data);
        setIsComposing(true);
        inputMethodActive.current = true;
        compositionText.current = e.data || '';
        
        // 根据首个字符判断输入类型
        if (e.data && /[\u4e00-\u9fa5]/.test(e.data)) {
            compositionType.current = 'chinese';
        } else {
            compositionType.current = 'english';
        }
    }, []);

    const handleCompositionUpdate = useCallback((e: CompositionEvent) => {
        // 更新组合文本
        compositionText.current = e.data || '';
        
        // 根据组合文本内容动态判断输入类型
        if (e.data && /[\u4e00-\u9fa5]/.test(e.data)) {
            compositionType.current = 'chinese';
        } else if (e.data && /^[a-zA-Z0-9\s]+$/.test(e.data)) {
            compositionType.current = 'english';
        }
    }, []);

    const handleCompositionEnd = useCallback((e: CompositionEvent) => {
        console.log('输入法组合结束', {
            data: e.data,
            type: compositionType.current
        });
        
        // 记录组合输入结束时间
        lastCompositionEndTime.current = Date.now();
        
        // 标记下一个键盘事件为组合后的首次事件
        isFirstKeyAfterComposition.current = true;
        
        // 重置组合状态
        setIsComposing(false);
        
        // 保持输入法状态为活跃，直到下一个键盘事件
        // 这样可以处理中文输入法下输入英文的情况
        inputMethodActive.current = true;
        
        // 强制刷新编辑器状态，确保后续操作可以执行
        if (editorEl.current && editorEl.current.view) {
            setTimeout(() => {
                if (editorEl.current && editorEl.current.view) {
                    editorEl.current.view.dispatch(editorEl.current.view.state.tr);
                }
            }, 0);
        }
    }, [editorEl]);

    // 自定义键盘事件处理
    const handleKeyDown = useCallback((e: ReactKeyboardEvent) => {
        // 记录最后一次键盘操作时间
        lastKeyPressTime.current = Date.now();
        
        // 检查是否是组合输入结束后的首次键盘事件
        const isJustAfterComposition = isFirstKeyAfterComposition.current;
        if (isJustAfterComposition) {
            isFirstKeyAfterComposition.current = false;
        }
        
        // 计算自上次组合输入结束后经过的时间
        const timeSinceLastComposition = Date.now() - lastCompositionEndTime.current;
        
        // 处理中文输入法下的Enter键和Backspace键
        if ((e.key === 'Enter' || e.key === 'Backspace') && 
            !isComposing && 
            inputMethodActive.current) {
            
            // 如果是组合输入刚结束后的首次键盘事件，或者时间间隔很短
            if (isJustAfterComposition || timeSinceLastComposition < 100) {
                console.log(`检测到组合输入后的键盘操作: ${e.key}`);
                
                // 不阻止默认行为，允许键盘操作正常工作
                return;
            }
            
            // 如果是中文输入法下输入英文的情况
            if (compositionType.current === 'english') {
                console.log(`检测到中文输入法下输入英文后的键盘操作: ${e.key}`);
                
                // 不阻止默认行为，允许键盘操作正常工作
                return;
            }
        }
        
        // 处理通过数字键选择候选词的情况
        if (isComposing && e.key >= '1' && e.key <= '9') {
            console.log(`组合输入中通过数字键选择候选词: ${e.key}`);
            // 不阻止默认行为，让输入法正常处理
            return;
        }
        
        // 处理可能的输入速度过快导致的Enter键无效问题
        if (e.key === 'Enter' && e.nativeEvent && e.nativeEvent.isComposing) {
            console.log('检测到可能的输入速度过快导致的Enter键');
            // 不阻止默认行为，允许Enter键正常工作
            return;
        }
        
        // 如果不是组合输入状态，重置输入法状态
        if (!isComposing && !isJustAfterComposition && timeSinceLastComposition > 500) {
            inputMethodActive.current = false;
            compositionType.current = null;
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
                onCompositionUpdate={handleCompositionUpdate}
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
