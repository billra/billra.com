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
- x help text
- any keypress in help will switch to editor
- version number
- empty content hint
- settings: spell check, start in editor
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
