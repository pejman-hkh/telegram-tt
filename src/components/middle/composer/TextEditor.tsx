import type { FC, RefObject } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useRef, useState,
} from '../../../lib/teact/teact';

import { MapTokens } from '../../../util/markdownParser';
import { parseMarkdown } from '../../../util/parseHtmlAsFormattedText';
import { getCaretPosition, setCaretPosition } from '../../../util/selection';

import useLastCallback from '../../../hooks/useLastCallback';

type History = {
  text: string;
  content: string;
  caretPosition: number;
};

type OwnProps = {
  ref: RefObject<HTMLDivElement | null>;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onChange: (event: any) => void;
  onUpdate: (html: string) => void;
  onReset: boolean;
};

export const MapTokensReversed: { [key: string]: string } = Object.fromEntries(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Object.entries(MapTokens)/* .filter(([_, value]) => value !== 'blockquote') */.map(([key, value]) => [value, key]),
);

export const TagTokens: { [key: string]: string } = {
  b: '**',
  i: '__',
  del: '~~',
  span: '||',
  blockquote: '^^',
  code: '`',
  spoiler: '||',
};

function placeCaretAfterNode(node: Node, space = '\u200B') {
  // console.log('place caret after node', node);
  const range = document.createRange();
  const selection = window.getSelection();
  if (!node.parentNode) return;
  if (node?.nextSibling instanceof HTMLElement) {
    // range.setStart(node.nextSibling, 0);
    return;
  }

  if (node.parentNode.nextSibling?.textContent?.startsWith(space)) {
    // console.log('next exist', node.parentNode.nextSibling);
    range.setStart(node.parentNode.nextSibling, 1);
  } else {
    const spacer = document.createTextNode(space); // zero-width space
    (node.parentNode as HTMLElement).after(spacer);
    if (spacer?.parentElement) {
      range.setStartAfter(spacer);
    }
    // console.log('next not exist', node, spacer);
  }

  selection?.removeAllRanges();
  selection?.addRange(range);
}

function placeCaretBeforeNode(node: Node) {
  // console.log('place caret before node', node);
  const range = document.createRange();
  const selection = window.getSelection();
  if (!node.parentNode) return;
  if (node.parentNode.previousSibling?.textContent?.startsWith('\u200B')
    && !node.parentNode.previousSibling?.textContent?.endsWith('\n')) {
    // console.log('set caret before node', node.parentNode.previousSibling);
    range.setStart(node.parentNode.previousSibling, 0);
  } else {
    // console.log('create zero before node');
    const spacer = document.createTextNode('\u200B'); // zero-width space
    (node.parentNode as HTMLElement).before(spacer);
    range.setStartAfter(spacer);
  }
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function createBasedOnNode(node: Node): Node {
  const hasElementChild = Array.from(node.childNodes).some((child) => child.nodeType === Node.ELEMENT_NODE);

  if (hasElementChild) {
    const fragment = document.createElement('div');
    fragment.innerHTML = (node as HTMLElement).innerHTML;
    return fragment;
  } else {
    return document.createTextNode(node.textContent || '');
  }
}

const TextEditor: FC<OwnProps | any> = ({
  ref, onKeyDown, onChange, onUpdate, onReset, ...props
}) => {
  const [history, setHistory] = useState<History[]>([{ text: '', content: '', caretPosition: 0 }]);
  const [index, setIndex] = useState<number>(0);
  let editorRef = useRef<HTMLDivElement | undefined>(undefined);

  if (ref) {
    editorRef = ref;
  }
  // eslint-disable-next-line no-null/no-null
  const selectedElement = useRef<HTMLElement>(null);

  const resetSelected = useLastCallback(() => {
    if (!selectedElement?.current) {
      return;
    }

    const resetTag = (node: HTMLElement, token: string) => {
      // console.log('in reset tag', node);
      const size = token.length;
      let pos = getCaretPosition(node);
      const beforeLen = node.textContent?.length || 0;
      let replaced = false;
      if (!node.innerHTML.trim().startsWith(token) || !node.innerHTML.trim().endsWith(token)) {
        pos = getCaretPosition(editorRef?.current as HTMLElement);
        pos -= size;
        // console.log('child replaced in reset tag', node, token);
        node.parentElement?.replaceChild(createBasedOnNode(node), node);
        replaced = true;
      } else {
        // console.log('inner html of node changed in reset tag', node);
        let html = selectedElement.current!.innerHTML.slice(size, -size);
        if (token === '```') {
          const split = html.split('\n');
          if (split?.length > 1) {
            selectedElement.current!.classList.add('has-language');
            if (selectedElement.current) {
              selectedElement.current.dataset.language = split[0].trim();
            }
            split.shift();
            html = split.join('\n');

            // const language = document.createElement('span');
            // language.innerHTML = selectedElement?.current?.dataset?.language || '';
            // selectedElement?.current!.append(language);
          }
        }
        node.innerHTML = html;
      }
      onUpdate(editorRef.current?.innerHTML || '');
      const afterLen = node.textContent?.length || 0;
      const newPosition = pos - (beforeLen - afterLen) + size;
      if (newPosition >= 0) {
        // console.log('caret position seted in reset tag', node, newPosition, pos, beforeLen, afterLen);
        setCaretPosition(replaced ? (editorRef?.current as Node) : node, newPosition);
      }
      // console.log('set caret after reset tag', newPosition);
    };

    const token = MapTokensReversed[selectedElement.current.tagName?.toLocaleLowerCase()];
    if (token) {
      resetTag(selectedElement?.current, token + token);
    } else if (selectedElement.current.tagName === 'PRE') {
      resetTag(selectedElement?.current, '```');
    } else if (selectedElement.current.tagName === 'CODE') {
      resetTag(selectedElement?.current, '`');
    }
    // console.log('selected element reseted');
    // eslint-disable-next-line no-null/no-null
    selectedElement.current = null;
  });

  const handleMarkdownKeydown = (e: React.KeyboardEvent<HTMLElement>) => {
    // If we are at the end of the text, we should be able to remove it, and we must not exit the tag
    const selection = window.getSelection();
    const range = selection?.getRangeAt(0);
    const current = range?.startContainer;

    // if (e.key === 'Backspace') {
    //   console.log('tttttttttttttttttt', current, current?.previousSibling);
    //   if (current?.previousSibling instanceof HTMLElement
    //     && (current?.previousSibling as HTMLElement).tagName === 'PRE') {
    //     editableElement(current?.previousSibling);
    //     setCaretPosition(current?.previousSibling, current?.previousSibling?.textContent?.length || 0);
    //     return;
    //   }
    // }

    if (current?.parentElement && current?.parentElement !== editorRef?.current) {
      const pos = getCaretPosition(current.parentElement);
      if (current && selectedElement.current) {
        if (pos === selectedElement.current?.textContent?.length) {
          if (e.key !== 'Backspace' && e.key !== 'ArrowLeft') {
            placeCaretAfterNode(current);
            resetSelected();
          }
        }
      }
    }

    // If Enter is pressed inside a <code> tag, we should move to the next line
    if (e.shiftKey && e.key === 'Enter') {
      const nrange = selection?.getRangeAt(0);
      const ncurrent = nrange?.startContainer;
      if (ncurrent?.parentElement?.tagName === 'CODE') {
        e.preventDefault();
        placeCaretAfterNode(ncurrent, '\n');
      }
    }
  };

  const editableElement = (target: HTMLElement) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection?.getRangeAt(0);
      if (!range?.collapsed) return;
    }

    if (target === editorRef?.current) {
      return;
    }

    // console.log('editable element done', target);
    const editable = (token: string) => {
      if (!target.innerHTML.startsWith(token)) {
        const pos = getCaretPosition(target);
        selectedElement.current = target;
        let start = '';
        if (token === '```') {
          if (selectedElement?.current?.dataset?.language) {
            start = `${selectedElement?.current?.dataset?.language}\n`;
            selectedElement.current.classList.remove('has-language');
            selectedElement.current.setAttribute('data-language1', selectedElement?.current?.dataset?.language);
            delete selectedElement?.current?.dataset?.language;
          }
        }
        target.innerHTML = token + start + target.innerHTML + token;
        onUpdate(editorRef.current?.innerHTML || '');
        const newPosition = pos + token.length;
        if (newPosition > 0) {
          setCaretPosition(target, newPosition);
        }
      }
    };

    const token = MapTokensReversed[target.tagName?.toLocaleLowerCase()];
    if (token) {
      editable(token + token);
    } else if (target.tagName === 'PRE') {
      editable('```');
    } else if (target.tagName === 'CODE') {
      editable('`');
    }
  };

  const placingCaret = () => {
    const selection = window?.getSelection();
    if (selection && selection.rangeCount <= 0) {
      return;
    }

    const range = selection?.getRangeAt(0);
    const current = range?.startContainer;

    if (current?.parentElement && current?.parentElement !== editorRef?.current) {
      const pos = getCaretPosition(current.parentElement);
      // console.log('parent element is',
      //   selectedElement.current,
      //   current.parentElement,
      //   pos,
      //   current?.parentElement?.textContent?.length,
      // );

      if (current && selectedElement.current) {
        if (pos === 0) {
          placeCaretBeforeNode(current);
          resetSelected();
        }
      }

      // We can allow exiting the tag after reaching the last character, but we will lose the ability to remove tag from the end.
      // if (current && selectedElement.current) {
      //   if (pos === selectedElement.current?.textContent?.length) {
      //     placeCaretAfterNode(current);
      //     resetSelected();
      //   }
      // }
    }
    if (current !== editorRef?.current
      && current !== selectedElement.current
      && current?.parentElement !== selectedElement.current) {
      resetSelected();
    }
  };

  const editableCurrent = () => {
    const selection = window.getSelection();
    const range = selection?.getRangeAt(0);
    const current = range?.startContainer;

    if (current && current !== selectedElement?.current) {
      editableElement(current as HTMLElement);
    }
  };

  const markdownElement = (element: HTMLElement) => {
    if (selectedElement?.current && selectedElement?.current !== editorRef?.current) {
      const size = TagTokens[selectedElement?.current?.tagName.toLocaleLowerCase()]?.length;
      if (selectedElement?.current?.tagName !== 'PRE'
        && selectedElement?.current?.textContent?.slice(size, -size).match(/(`|__|\*\*|~~|\|\|)/)) {
        resetSelected();
      } else {
        return;
      }
    }

    const selection = window.getSelection();
    const pos = getCaretPosition(element);
    const beforeLen = element.textContent?.length || 0;

    const html = parseMarkdown(element.innerHTML);

    element.innerHTML = html;
    onUpdate(html);
    // eslint-disable-next-line no-null/no-null
    selectedElement.current = null;
    const afterLen = element.textContent?.length || 0;
    const newPosition = pos - (beforeLen - afterLen);

    if (newPosition > 0) {
      // console.log('caret position seted', newPosition, pos, beforeLen, afterLen);
      setCaretPosition(element, newPosition);
    }

    if (beforeLen !== afterLen) {
      if (selection && selection.rangeCount > 0) {
        const range = selection?.getRangeAt(0);
        const current = range?.startContainer;
        if (current
          && current.parentNode
          && current?.parentElement !== editorRef?.current
          && current !== editorRef?.current
          && element.contains(current)) {
          setTimeout(() => {
            placeCaretAfterNode(current);
            editableCurrent();
          }, 0);
        }
      }
    }
  };

  const editableHandler = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // if ((e?.ctrlKey || e?.metaKey) && e.code === 'KeyZ') {
    //   return;
    // }

    // Let delete tags
    if (e.key === 'Backspace') {
      const selection = window.getSelection();
      const range = selection?.getRangeAt(0);
      const current = range?.startContainer;
      const node = current?.parentElement
      const tagTokens = TagTokens;
      tagTokens.pre = '```';

      if (node instanceof HTMLElement
        && Object.keys(tagTokens).includes((node as HTMLElement).tagName.toLocaleLowerCase())) {
        const element = node as HTMLElement;
        const tagName = element.tagName.toLocaleLowerCase();
        const token = tagTokens[tagName];

        editableElement(node);
        const range1 = selection?.getRangeAt(0);
        const current1 = range1?.startContainer;
        setCaretPosition(current1?.parentElement as Node, (current1?.parentElement?.textContent?.length || 0));
        if (!current1?.parentElement?.textContent?.startsWith(token)
          || !current1?.parentElement?.textContent?.endsWith(token)) {
          resetSelected();
        }
        return;
      }
    }

    if (e.key.startsWith('Arrow') || e.key === 'Shift' /* || e.key === 'Enter'  || selectedElement.current */) {
      return;
    }

    const selection = window.getSelection();
    // const range = selection?.getRangeAt(0);
    // const current = range?.startContainer;
    // console.log(current);

    // if (current?.textContent?.match(/(`|__|\*\*|~~|\|\|)/)) {
    //   const last = current.textContent.slice(-1);
    //   const tagName = MapTokens[last];
    //   if (current?.parentElement?.tagName.toLocaleLowerCase() !== tagName) {
    //     const pos = getCaretPosition(editorRef?.current!);
    //     const beforContent = current.textContent.slice(0, -2);
    //     const fragment = document.createDocumentFragment();
    //     fragment.append(beforContent);
    //     const el = document.createElement(tagName);
    //     el.innerHTML = beforContent;
    //     fragment.append(el);
    //     current.parentElement?.replaceChild(fragment, current);
    //     setCaretPosition(editorRef?.current!, pos);
    //     return;
    //   }
    // }
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      // resetSelected();
      return;
    }

    if (editorRef?.current) {
      markdownElement(editorRef?.current);
    }
  };

  const keyupHandler = (e: React.KeyboardEvent<HTMLDivElement>) => {
    editableHandler(e);
    if (selectedElement.current) {
      placingCaret();
    }
    const selection = window.getSelection();

    if (e.key.startsWith('Arrow')) {
      if (!selection || selection.rangeCount === 0) {
        return;
      }

      const range = selection?.getRangeAt(0);
      const current = range?.startContainer;
      if (current?.parentElement !== selectedElement.current
        && current !== editorRef?.current
        && current?.parentElement !== editorRef?.current) {
        editableElement(current?.parentElement as HTMLElement);
      }
    }
  };

  const reselectText = () => {
    const selection = window.getSelection();
    // If selection happens on text with markdown, we should reset the selection and select only the tag without the token.
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const start = range.startOffset;
      const end = range.endOffset;
      const node = range.startContainer;
      const tagName = node?.parentElement?.tagName || '';
      if (node.parentElement !== editorRef?.current) {
        const token = TagTokens[tagName.toLocaleLowerCase()];
        if (node?.parentElement?.textContent?.startsWith(token) && node?.parentElement?.textContent?.endsWith(token)) {
          const selectedText = selection ? selection.toString() : '';

          const size = token.length;
          let newStart = start - size;
          let newEnd = end - size;
          if (selectedText?.startsWith(token)) {
            newStart = 0;
            newEnd = end - size - size;
          }

          resetSelected();
          const afterRange = selection.getRangeAt(0);
          let afterNode = afterRange.startContainer;

          // console.log('node selected', node, selectedText, start, end, afterNode);
          if (afterNode instanceof HTMLElement) {
            afterNode = afterNode.childNodes[0];
          }

          const newRange = document.createRange();
          if (newStart >= 0) {
            newRange.setStart(afterNode, newStart);
            newRange.setEnd(afterNode, newEnd);
          }

          selection.removeAllRanges();
          selection.addRange(newRange);
        }
      }
    }
  };

  const mouseupHandler = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    reselectText();
    placingCaret();
    editableElement(target);
  };

  useEffect(() => {
    // Reset history, after events on the MessageInput (Send message, Edit last message, ...)
    setTimeout(() => {
      resetSelected();
      const html = parseMarkdown(editorRef.current!.innerHTML);
      editorRef.current!.innerHTML = html;
      onUpdate(html);

      setHistory([{
        content: editorRef.current!.innerHTML,
        text: editorRef.current?.textContent || '',
        caretPosition: editorRef.current?.textContent!.length || 0,
      }]);
      setIndex(0);
    }, 0);
  }, [onReset, onUpdate, resetSelected]);

  const undo = () => {
    if (index > 0 && history?.length > 0) {
      let newIndex = index;
      let posIndex = 0;
      if (history[index - 1]?.content?.length > history[index]?.content?.length) {
        newIndex = index - 1;
      } else {
        let i;
        for (i = index; i > 0; i--) {
          // When correcting words, we should go back to where the corrected word started
          if (history[i]?.content?.length < history[i - 1]?.content?.length) {
            break;
          }

          // If formatted happened at the end of text
          if (history[i]?.caretPosition === history[i - 1]?.caretPosition) {
            i -= 1;
            break;
          }

          // If writed some text in the middle of current text
          if (history[i]?.content?.length !== history[i]?.caretPosition) {
            // get text instead html
            const text = history[i]?.text;

            const first = text?.slice(0, history[i]?.caretPosition);

            if (first?.endsWith(' ')) {
              i -= 1;
              break;
            }
          }

          // eslint-disable-next-line no-unsafe-optional-chaining
          if (history[i]?.caretPosition - history[i - 1]?.caretPosition > 1) {
            i -= 1;
            break;
          }

          // If writed some text in the middle of current text
          if (history[i]?.caretPosition < history[i - 1]?.caretPosition) {
            posIndex = i;
            i -= 1;
            break;
          }

          if (history[i]?.content === '') {
            i -= 1;
            break;
          }

          // If cursor is not in the middle of text
          if ((history[i]?.caretPosition === history[i]?.text?.length
            && history[i]?.content?.endsWith(' '))
            || history[i]?.content?.endsWith('\n')) {
            i -= 1;
            break;
          }
        }

        newIndex = i > 0 ? i : 0;
      }

      const historyContent = history[newIndex]?.content;
      editorRef.current!.innerHTML = historyContent || '';
      onUpdate(historyContent);

      // If undo is performed in the middle of the text, the cursor should remain there.
      let caretPosition = history[newIndex]?.caretPosition;
      if (posIndex !== 0) {
        if (history[posIndex]?.text !== history[newIndex]?.text) {
          // eslint-disable-next-line no-unsafe-optional-chaining
          caretPosition = history[posIndex]?.caretPosition - 1;
        } else {
          caretPosition = history[posIndex]?.caretPosition;
        }
      }

      setCaretPosition(editorRef?.current!, caretPosition);
      setIndex(newIndex);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (onKeyDown) onKeyDown(e);
    handleMarkdownKeydown(e);

    // editableHandler(e);
    // Also we can implement redo, with save changed history on a redo stack
    if ((e?.ctrlKey || e?.metaKey) && e.code === 'KeyZ') {
      e.preventDefault();
      undo();
    }
  };

  const handleOnChange = (event: any) => {
    if (onChange) onChange(event);

    if (!editorRef.current) return;
    const content = editorRef.current.innerHTML.replace('&nbsp;', ' ');

    if (content !== history[index]?.content) {
      const caretPosition = getCaretPosition(editorRef.current!);
      setHistory((prev: History[]) => [...prev.slice(0, index + 1), {
        content,
        text: editorRef.current?.textContent || '',
        caretPosition,
      }]);
      setIndex(index + 1);
    }
  };

  return (
    <div
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...props}
      ref={editorRef}
      onKeyUp={keyupHandler}
      onMouseUp={mouseupHandler}
      onChange={handleOnChange}
      onKeyDown={handleKeyDown}
    />
  );
};

export default memo(TextEditor);
