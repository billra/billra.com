# Contented

Web based text editor. Name derived from a content editable div: &lt;div class="editor" <u>contented</u>itable&gt;&lt;/div&gt;.

## Task List

- x save to storage so F5 brings back text
- x scroll bar when editor vertical full
- x icon
- x menu start point
- x menu: tab order after edit control
- x ctrl-S (capital letter) for save (html)
- x ctrl-s (lowercase letter) for save (text)
- x ctrl-o for open, html and text auto detect based on contents
- help text
- version number
- empty content hint
- move to billra for publishing
- ctrl-n for new (prompt dirty)
- menu: mouseover drops down list:
- menu: save html -> file with htm extension, default with ctrl-s
- menu: save text -> file with txt extension
- menu: load -> fills contenteditable div with the html or txt depending on extension
- use 'light-dark(white, black)' css syntax and settings dialog to select color scheme
- browser tab text gets filename
- experiment with page color and editor margin 2px

## Quick Start

- open cmd command prompt
- move to `C:\Users\billr\Desktop\git\contented` source directory
- start Python environment: `conda activate py311`
- new command window: `start cmd`
- start http server: `python -m http.server 8098`
- browse to `http://localhost:8098/contented.html` to launch application

## help section

![icon](contented.ico) Contented HTML Text Editor

Type text and paste items from other applications.

Keys:
- ctrl-s save as text, stripping everything else
- ctrl-S save as HTML, keeping all content
- ctrl-o open file, auto-detect text and HTML

Features:
- The file created when saving as HTML can be opened in a web browser or opened again in contented.
- Many things can be simply pasted into the editor and retain their original formatting.
- Contents preserved on F5 page refresh.
- Keyboard navigation: Tab, space bar, and enter.
- Fast, no external libraries.
