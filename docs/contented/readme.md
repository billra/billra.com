# Contented

Web based text editor. Name derived from a contenteditable div, which this editor is based on.

## Task List

- empty content hint
- settings: spell check, start in editor
- move to billra for publishing
- use 'light-dark(white, black)' css syntax and settings dialog to select color scheme
- browser tab text gets filename
- experiment with page color and editor margin 2px

```
todo: doLoad fails some test cases
|0|
|1 | fail
|2  |
|3   | fail
|4    |
|5     | fail
more test cases:
| 1|
|  2|
|   3|
|    4|
|     5|
|1 1|
|2  2|
|4   3|
|5    4|
|5     5|
where '|' mark beginning and ending of lines
include beginning and end of file
```

## Quick Start

- open cmd command prompt
- move to `C:\Users\billr\Desktop\git\contented` source directory
- start Python environment: `conda activate py311`
- new command window: `start cmd`
- start http server: `python -m http.server 8098`
- browse to `http://localhost:8098/contented.html` to launch application
