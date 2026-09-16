"""Serve the integrated prebuilt app over local HTTP without npm or an API key."""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import sys
root = Path(__file__).resolve().parents[1]
folder = root / 'dist'
if not (folder / 'index.html').is_file():
    raise SystemExit('Prebuilt app missing. Run npm ci and npm run build first.')
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
try:
    server = ThreadingHTTPServer(('127.0.0.1', port), partial(SimpleHTTPRequestHandler, directory=str(folder)))
except OSError as error:
    raise SystemExit(f'{error}\nTry another port: python3 scripts/serve-local.py 8001')
print(f'CEPHALO / STRUCTURAL LAB: http://localhost:{port}/\nKeep this terminal open. Ctrl+C stops the server.', flush=True)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
