#!/usr/bin/env python3
"""Assemble le jeu en un seul fichier HTML autonome (partage facile, hébergement simple).
Usage : python3 tools/build-single.py dist/potager-gardien.html"""
import re, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent / 'www'
order = ['data', 'map', 'audio', 'swarm', 'advisor', 'game', 'ui', 'main']
out = ['const __m = {};']
for name in order:
    src = (root / 'js' / f'{name}.js').read_text()
    exports = []
    def imp(m):
        return f"const {{{m.group(1)}}} = __m['{m.group(2)}'];"
    src = re.sub(r"import\s*\{([^}]*)\}\s*from\s*'\./(\w+)\.js';", imp, src)
    def exp(m):
        exports.append(m.group(2)); return f'{m.group(1)} {m.group(2)}'
    src = re.sub(r'^export\s+(const|let|class|function|async function)\s+(\w+)', exp, src, flags=re.M)
    out.append(f"__m['{name}'] = (() => {{\n{src}\nreturn {{ {', '.join(exports)} }};\n}})();")
js = '\n'.join(out)
html = (root / 'index.html').read_text()
css = (root / 'css' / 'style.css').read_text()
body = html[html.index('<body>') + 6: html.index('<script type="module"')]
head = re.search(r'<title>.*?</title>', html).group(0)
doc = f'''{head}
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&display=swap" rel="stylesheet">
<style>
{css}
</style>
{body}
<script>
(() => {{
{js}
}})();
</script>
'''
dest = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'dist/potager-gardien.html')
dest.parent.mkdir(parents=True, exist_ok=True)
dest.write_text(doc)
print('écrit', dest, len(doc), 'octets')
