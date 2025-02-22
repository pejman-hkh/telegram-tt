1. **Markdown Parser Implementation**  
- Implemented a recursive parsing approach for handling nested Markdown syntax.  
- Fully implemented Telegram-specific syntax, including custom handling for Blockquote with "^^".
- For example, you can use **bold**, __italic__, `code`, ~~del~~, and ||spoiler|| inside a blockquote as shown below:

^^ **bold** __italic__ `code` ~~del~~ ||spoiler|| ^^

Similarly, the same formatting can be applied within bold or italic tags. However, if you don't want the nested formatting to be applied, I introduced a `start` and `end` approach. Currently, for `code`, it doesn't apply bold or italic formatting inside the code block.

2. **Undo (Ctrl+Z) Implementation**  
- Developed a history tracking system to maintain typing history.  
- Implemented a word-by-word undo functionality similar to Telegram desktop app.  
- Handled all types of text changes, including text edits, bold, and other formatting adjustments, ensuring proper undo behavior.

3. **Folder UI Implementation**  
- Added a new prop to the FolderChat component to dynamically manage tabs.  
- Created a reusable component for the main menu to ensure it can be used in multiple places in the application.

4. **Quote Formatting and Editing**  
- Added functionality to handle blockquotes in the text editor.  
- Solved the issue of typing above or below blockquotes while ensuring proper formatting.

5. **TextEditor Component for Undo and Blockquote Handling**  
- Developed a new `TextEditor` component to handle undo and blockquote editing.  
- Ensured smooth integration of the undo feature and proper text editing experience.