'use strict';
window.LUM = window.LUM || {};

// ===========================================================================
// Snippets: user-defined JSON snippets exposed as Monaco completions that
// expand with tab-stops/placeholders ($1, ${2:label}, $0). Body may be a
// string or an array of lines. `scope` is "*" or a comma list of language ids.
// User file: <userData>/Snippets.json
// ===========================================================================
LUM.snippets = (function () {
  const DEFAULTS = [
    { prefix: 'log', scope: '*', description: 'console.log', body: 'console.log($1)$0' },
    { prefix: 'fn', scope: 'javascript,typescript,javascriptreact,typescriptreact', description: 'function', body: 'function ${1:name}(${2:args}) {\n\t$0\n}' },
    { prefix: 'afn', scope: 'javascript,typescript', description: 'arrow function', body: 'const ${1:name} = (${2:args}) => {\n\t$0\n};' },
    { prefix: 'for', scope: '*', description: 'for loop', body: 'for (let ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t$0\n}' },
    { prefix: 'forof', scope: 'javascript,typescript', description: 'for…of', body: 'for (const ${1:item} of ${2:iterable}) {\n\t$0\n}' },
    { prefix: 'if', scope: '*', description: 'if', body: 'if (${1:condition}) {\n\t$0\n}' },
    { prefix: 'ife', scope: '*', description: 'if/else', body: 'if (${1:condition}) {\n\t$2\n} else {\n\t$0\n}' },
    { prefix: 'cl', scope: '*', description: 'class', body: 'class ${1:Name} {\n\tconstructor(${2:args}) {\n\t\t$0\n\t}\n}' },
    { prefix: 'try', scope: '*', description: 'try/catch', body: 'try {\n\t$1\n} catch (${2:err}) {\n\t$0\n}' },
    { prefix: 'def', scope: 'python', description: 'def', body: 'def ${1:name}(${2:args}):\n\t$0' }
  ];

  let userFile = null;
  let all = DEFAULTS.slice();
  let registered = false;

  function bodyText(b) {
    return Array.isArray(b) ? b.join('\n') : String(b);
  }
  function scopeMatches(scope, lang) {
    if (!scope || scope === '*') return true;
    return scope.split(',').map((s) => s.trim()).includes(lang);
  }

  function provider() {
    return {
      // trigger on identifier chars so typing a prefix surfaces snippets
      provideCompletionItems(model, position) {
        const lang = model.getLanguageId();
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
          startColumn: word.startColumn, endColumn: word.endColumn
        };
        const suggestions = all
          .filter((s) => scopeMatches(s.scope, lang))
          .map((s) => ({
            label: s.prefix,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: bodyText(s.body),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: { value: '**' + (s.description || s.prefix) + '**\n\n```\n' + bodyText(s.body) + '\n```' },
            detail: 'snippet',
            range
          }));
        return { suggestions };
      }
    };
  }

  function registerProvider() {
    if (registered) return;
    const langs = monaco.languages.getLanguages().map((l) => l.id);
    monaco.languages.registerCompletionItemProvider(langs, provider());
    registered = true;
  }

  function parseJsonc(text) {
    const s = text
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:"'\\])\/\/.*$/gm, '$1')
      .replace(/,(\s*[}\]])/g, '$1')
      .trim();
    return s ? JSON.parse(s) : [];
  }

  async function load() {
    const tmpl =
      '// User snippets (JSON array). Each: { "prefix", "scope", "body", "description" }.\n' +
      '// body may be a string or an array of lines; use $1 ${2:label} $0 for tab-stops.\n' +
      '[\n' +
      '  { "prefix": "hola", "scope": "*", "body": "console.log(\\"hello $1\\")$0", "description": "demo snippet" }\n' +
      ']\n';
    userFile = await window.lumenText.configEnsure('Snippets.json', tmpl);
    let user = [];
    try {
      const { content } = await window.lumenText.readFile(userFile);
      user = parseJsonc(content) || [];
    } catch (e) {
      user = [];
    }
    all = DEFAULTS.concat(user.filter((s) => s && s.prefix && s.body));
    registerProvider();
  }

  async function reloadIfSnippetFile(filePath) {
    if (filePath && filePath === userFile) {
      await load();
      LUM.app.toast('Snippets reloaded (' + all.length + ')');
    }
  }

  async function openUI() {
    await load();
    await LUM.editor.openPath(userFile);
  }

  // Insert a snippet body at the cursor (used by the "Insert Snippet" command).
  function insert(body) {
    const ed = LUM.editor.activeEditor();
    if (!ed) return;
    const c = ed.getContribution('snippetController2');
    if (c) c.insert(bodyText(body));
  }
  function pickAndInsert() {
    const ed = LUM.editor.activeEditor();
    const lang = ed && ed.getModel() ? ed.getModel().getLanguageId() : '*';
    const entries = all
      .filter((s) => scopeMatches(s.scope, lang))
      .map((s) => ({ label: s.prefix + '  —  ' + (s.description || ''), run: () => insert(s.body) }));
    LUM.app.inlinePicker ? LUM.app.inlinePicker(entries, 'Insert Snippet') : entries[0] && entries[0].run();
  }

  return { load, openUI, reloadIfSnippetFile, insert, pickAndInsert, userFilePath: () => userFile };
})();
