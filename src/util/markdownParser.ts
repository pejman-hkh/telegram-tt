import { ApiMessageEntityTypes } from '../api/types';
/*
This parser now parsing nested, we can disable nested mode and use start and end like pre.
For example: ^^**b**__italic__ `code` ~~del~~^^ will generate <blockquote data-entity-type="MessageEntityBlockquote"><b>b</b><i>italic</i> <code>code</code> <del>del</del></blockquote>
*/
type NodeType = {
  token?: string;
  type?: string;
  text?: string;
  children?: Array<NodeType>;
  parent?: NodeType;
  attrs?: any;
  start?: number;
  end?: number;
};

// We can use settings for each tag in here for custom HTML, for example custom tag, attributes, ...
export const MapTokens: { [key: string]: string } = {
  '*': 'b',
  _: 'i',
  '~': 'del',
  '|': 'spoiler',
  // Telegram another apps, doesn't support blockquote markdown, so I added this just for test.
  '^': 'blockquote',
};

export class ParseMarkdown {
  text: string;

  len: number;

  i: number;

  tokens: Array<string>;

  constructor(text: string) {
    this.text = text;
    this.len = text.length;
    this.i = 0;
    this.tokens = Object.keys(MapTokens);
  }

  parseContent({ node }: { node: NodeType }) {
    // If buffer is slow, we can use slice instead, or faster buffer
    const buffer: Array<string> = [];
    while (this.i < this.len) {
      const tok = this.text[this.i];

      if (this.tokens.includes(tok) || tok === '`' || tok === '\n' || tok === '[' || tok === ']' || tok === ')') {
        break;
      }

      buffer.push(tok);
      this.i++;
    }
    node.type = 'text';
    node.text = buffer.join('');
  }

  getChildren({
    node, type, tempNode, pre, enode,
  }: { node: NodeType; type: string; tempNode?: NodeType; pre?: string; enode: NodeType }) {
    node.type = type;
    let nodes: Array<NodeType> = [];

    while (this.i < this.len) {
      nodes = this.parseTag({ parent: node, enode });

      let currentNode = node;
      while (currentNode?.type) {
        if (currentNode.type === enode.type) {
          currentNode.children = nodes;
          return;
        }

        if (pre && tempNode) {
          node.type = 'text1';
          node.text = pre;
          tempNode.type = 'text1';
          tempNode.children = nodes;
        } else {
          node.type = 'text1';
          node.children = nodes;
        }
        currentNode = currentNode?.parent || {};
      }
    }

    if (pre && tempNode) {
      node.type = 'text1';
      node.text = pre;
      tempNode.type = 'text1';
      tempNode.children = nodes;
    } else {
      node.type = 'text1';
      node.children = nodes;
    }
  }

  // If some tags weren't closed inside a tag, we should check all parents to find starting tag
  // eslint-disable-next-line class-methods-use-this
  isInParents({ enode }: { enode: NodeType }, parent: NodeType, type: string) {
    let node = parent;
    while (node?.type) {
      if (node?.type === type) {
        enode.type = node.type;
        return true;
      }

      node = node?.parent || {};
    }
    return false;
  }

  parseTag({ parent, enode }: { parent: NodeType; enode: NodeType }) {
    const nodes: Array<NodeType> = [];
    while (this.i < this.len) {
      // Reset enode in document children
      if (parent?.type === 'document') {
        enode = {};
      }

      if (enode?.type) {
        let currentNode = parent;
        let breakMain = false;
        while (currentNode?.type) {
          if (currentNode.type === enode.type) {
            breakMain = true;
            break;
          }
          currentNode = currentNode?.parent || {};
        }
        if (breakMain) {
          break;
        }
      }

      const tok = this.text[this.i];
      const node: NodeType = {};
      let tempNode: NodeType = {};
      node.parent = parent;

      if (tok === '`') {
        this.i++;
        let next = this.text[this.i];
        if (next === '`') {
          this.i++;
          next = this.text[this.i];
          if (next === '`') {
            this.i++;

            if (this.isInParents({ enode }, parent, 'pre')) {
              break;
            }

            const start = this.i;
            this.getChildren({
              node, type: 'pre', pre: '```', tempNode, enode,
            });
            const end = this.i - 3;

            node.start = start;
            node.end = end;
            node.token = '```';
          } else {
            this.getChildren({
              node, type: 'text', tempNode, pre: '``', enode,
            });
          }
        } else {
          if (this.isInParents({ enode }, parent, 'code')) {
            break;
          }

          const start = this.i;
          this.getChildren({
            node, type: 'code', tempNode, pre: '`', enode,
          });
          const end = this.i - 1;

          node.start = start;
          node.end = end;
          node.token = '`';
        }
      } else if (tok === '\n') {
        this.i++;
        node.type = 'br';
        node.token = '\n';
      } else if (tok === ')') {
        this.i++;
        if (this.isInParents({ enode }, parent, 'link')) {
          break;
        }

        nodes.push({ type: 'text', text: ')' });
      } else if (tok === ']') {
        this.i++;
        if (this.isInParents({ enode }, parent, 'a')) {
          break;
        }

        nodes.push({ type: 'text', text: ']' });
      } else if (tok === '[') {
        this.i++;
        node.attrs = { href: '#' };
        node.token = '[';
        this.getChildren({ node, type: 'a', enode });

        if (node.type === 'a') {
          if (this.text[this.i] === '(') {
            this.i++;

            this.getChildren({ node: tempNode, type: 'link', enode });

            if (tempNode?.type === 'link') {
              node.attrs = { href: tempNode?.children?.[0]?.text || '' };
              tempNode = {};
            } else if (tempNode?.children) {
              tempNode?.children.unshift({ type: 'text', text: '(' });
            }
          }
        } else {
          nodes.push({ type: 'text', text: '[' });
        }
      } else if (this.tokens.includes(tok)) {
        this.i++;
        const next = this.text[this.i];
        if (next === tok) {
          node.token = tok + tok;
          this.i++;
          if (this.isInParents({ enode }, parent, MapTokens[tok])) {
            break;
          }

          this.getChildren({
            node, type: MapTokens[tok], tempNode, pre: tok + tok, enode,
          });
        } else {
          node.type = 'text';
          node.text = tok;
        }
      } else {
        this.parseContent({ node });
      }

      nodes.push(node);

      // This make flat our markdown tree object
      if (tempNode?.children && tempNode?.children?.length > 0) {
        // eslint-disable-next-line array-callback-return
        tempNode?.children?.map((n: NodeType) => {
          nodes.push(n);
        });
      }
    }

    return nodes;
  }

  parse() {
    const document: NodeType = { type: 'document' };
    const children = this.parseTag({ parent: document, enode: {} });
    document.children = children;
    return document;
  }

  // eslint-disable-next-line class-methods-use-this
  makeAttrsText(attrs: any) {
    let ret = '';
    // eslint-disable-next-line no-restricted-syntax, guard-for-in
    for (const key in attrs) {
      ret += ` ${key}="${attrs[key]}"`;
    }
    return ret;
  }

  getHtml(mainNode: NodeType) {
    let html = '';

    // eslint-disable-next-line array-callback-return
    mainNode.children?.map((node: NodeType) => {
      if (node?.type === 'text') {
        // eslint-disable-next-line no-unsafe-optional-chaining
        html += node?.text;
      } else {
        let content = '';

        if (node?.type === 'code') {
          const text = this.text.slice(node?.start, node?.end);
          node.text = text;
          node.attrs = { class: 'text-entity-code' };
        } else if (node?.type === 'pre') {
          const text = this.text.slice(node?.start, node?.end);
          node.attrs = { class: '', 'data-language': '' };
          node.attrs.class = 'code-block text-entity-pre';
          if (text?.match(/\n/)) {
            const splitPreCode = text?.split('\n');
            if (splitPreCode?.[0]?.trim()) {
              node.attrs['data-language'] = splitPreCode?.[0]?.trim() || '';
              node.attrs.class += ' has-language';
            }
            splitPreCode?.shift();
            node.text = splitPreCode?.join('\n');
          } else {
            node.text = text;
          }
        }

        if (node?.text) {
          content = node?.text;
        } else if (node?.children && node?.children?.length > 0) {
          content = this.getHtml(node);
        }

        if (node?.type === 'blockquote') {
          node.attrs = { 'data-entity-type': ApiMessageEntityTypes.Blockquote, class: 'blockquote' };
        } else if (node?.type === 'spoiler') {
          node.type = 'spoiler';
          node.attrs = { 'data-entity-type': ApiMessageEntityTypes.Spoiler, class: 'spoiler' };
        } else if (node?.type === 'a') {
          const href = node?.attrs?.href;
          if (href && href.match(/@/)) {
            node.attrs.href = `mailto:${href}`;
          }

          const match = node?.attrs?.href?.match(/customEmoji:(\d+)/);
          // eslint-disable-next-line no-cond-assign
          if (match) {
            node.type = 'img';
            node.attrs = { alt: content, 'data-document-id': match[1] };
          }
        }

        if (node?.type === 'text1') {
          html += content;
        } else if (node?.type === 'img') {
          html += `<img${this.makeAttrsText(node?.attrs)}>`;
        } else if (node?.type === 'br') {
          html += '\n';
        } else if (content === '') {
          // eslint-disable-next-line no-unsafe-optional-chaining
          html += node?.token ? (node?.token + node?.token) : '';
        } else {
          html += `${String(`<${node?.type}`) + this.makeAttrsText(node?.attrs)}>${content}</${node?.type}>`;
        }
      }
    });
    return html;
  }
}

export const markdownParser = (text: string) => {
  const parser = new ParseMarkdown(text);
  const doc = parser.parse();
  return doc;
};

export const markdowToHtml = (text: string) => {
  const parser = new ParseMarkdown(text);
  const doc = parser.parse();
  return parser.getHtml(doc);
};
