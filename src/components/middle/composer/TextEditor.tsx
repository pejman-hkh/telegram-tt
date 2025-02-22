import React, { FC, memo, RefObject, useEffect, useRef, useState } from "../../../lib/teact/teact";
import { getCaretPosition, setCaretPosition } from "../../../util/selection";

type History = {
    text: string
    content: string
    caretPosition: number
}

type OwnProps = {
    ref: RefObject<HTMLDivElement | null>;
    onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
    onChange: (event: any) => void;
    onUpdate: (html: string) => void
    onReset: boolean
}

const TextEditor: FC<OwnProps | any> = ({ ref, onKeyDown, onChange, onUpdate, onReset, ...props }) => {

    const [history, setHistory] = useState<History[]>([{ text: "", content: "", caretPosition: 0 }]);
    const [index, setIndex] = useState<number>(0);
    let editorRef = useRef<HTMLDivElement | null>(null);

    if (ref) {
        editorRef = ref
    }

    useEffect(() => {
        //Reset history, after events on the MessageInput (Send message, Edit last message, ...)
        setTimeout(() => {
            setHistory([{ content: editorRef.current!.innerHTML, text: editorRef.current?.textContent || "", caretPosition: editorRef.current?.textContent!.length || 0 }])
            setIndex(0)
        }, 0)
    }, [onReset])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (onKeyDown) onKeyDown(e)

        //Also we can implement redo, with save changed history on a redo stack
        if ((e?.ctrlKey || e?.metaKey) && e.code === "KeyZ") {
            e.preventDefault();
            undo();
        } else if (!e?.altKey && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            const selection = document.getSelection();
            let quoteNode = selection?.anchorNode;

            while (quoteNode && quoteNode.nodeName !== "BLOCKQUOTE" && quoteNode !== editorRef?.current) {
                quoteNode = quoteNode.parentNode;
            }

            if (!(quoteNode instanceof HTMLElement)) return;

            let anchorOffset = selection?.anchorOffset || 0;

            let walker = document.createTreeWalker(quoteNode!, NodeFilter.SHOW_TEXT, null);
            let textNode: Node | null;
            while ((textNode = walker.nextNode())) {
                if (textNode === selection?.anchorNode) {
                    break;
                }
                anchorOffset += textNode.textContent?.length || 0;
            }

            const textLength = quoteNode?.textContent?.length || 0;

            if (quoteNode.tagName === "BLOCKQUOTE") {
       
                if (e.key === "ArrowDown" && anchorOffset === textLength && !quoteNode.nextSibling) {
                    const newTextNode = document.createTextNode("\n");
                    quoteNode.parentNode?.appendChild(newTextNode);
                }

                if (e.key === "ArrowUp" && anchorOffset === 0 && !quoteNode.previousSibling) {
                    const newTextNode = document.createTextNode("\n");
                    quoteNode.parentNode?.insertBefore(newTextNode, quoteNode);
                }
            }
        }
    };

    const handleOnChange = (event: any) => {
        if (onChange) onChange(event);

        if (!editorRef.current) return;
        const content = editorRef.current.innerHTML.replace('&nbsp;', ' ');

        if (content !== history[index]?.content) {
            const caretPosition = getCaretPosition(editorRef.current!)
            setHistory((prev: History[]) => [...prev.slice(0, index + 1), { content: content, text: editorRef.current?.textContent || "", caretPosition }]);
            setIndex(index + 1);
        }
    };

    const undo = () => {
        if (index > 0 && history?.length > 0) {
            let newIndex = index
            let posIndex = 0
            if (history[index - 1]?.content?.length > history[index]?.content?.length) {
                newIndex = index - 1
            } else {

                let i
                for (i = index; i > 0; i--) {

                    //When correcting words, we should go back to where the corrected word started
                    if (history[i]?.content?.length < history[i - 1]?.content?.length) {
                        break
                    }

                    //If formatted happened at the end of text
                    if (history[i]?.caretPosition === history[i - 1]?.caretPosition) {
                        i -= 1
                        break
                    }

                    //If writed some text in the middle of current text
                    if (history[i]?.content?.length !== history[i]?.caretPosition) {

                        //get text instead html
                        const text = history[i]?.text;

                        const first = text?.slice(0, history[i]?.caretPosition)

                        if (first?.endsWith(' ')) {
                            i -= 1
                            break
                        }
                    }

                    if (history[i]?.caretPosition - history[i - 1]?.caretPosition > 1) {
                        i -= 1
                        break
                    }

                    //If writed some text in the middle of current text
                    if (history[i]?.caretPosition < history[i - 1]?.caretPosition) {
                        posIndex = i
                        i -= 1
                        break
                    }

                    if (history[i]?.content == '') {
                        i -= 1
                        break
                    }

                    //If cursor is not in the middle of text
                    if (history[i]?.caretPosition == history[i]?.text?.length && history[i]?.content?.endsWith(' ') || history[i]?.content?.endsWith("\n")) {
                        i -= 1
                        break
                    }
                }

                newIndex = i > 0 ? i : 0
            }

            const historyContent = history[newIndex]?.content
            editorRef.current!.innerHTML = historyContent || "";
            onUpdate(historyContent)

            //If undo is performed in the middle of the text, the cursor should remain there.
            let caretPosition = history[newIndex]?.caretPosition
            if (posIndex !== 0) {

                if (history[posIndex]?.text !== history[newIndex]?.text) {
                    caretPosition = history[posIndex]?.caretPosition - 1
                } else {
                    caretPosition = history[posIndex]?.caretPosition
                }
            }

            setCaretPosition(editorRef?.current!, caretPosition)
            setIndex(newIndex)
        }
    };

    return (<div
        {...props}
        ref={editorRef}
        onChange={handleOnChange}
        onKeyDown={handleKeyDown}
    />);
}


export default memo(TextEditor);
