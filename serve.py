#!/usr/bin/env python3
"""Tiny static server for Crazy Pickers.

Plain `python3 -m http.server` lets the browser cache shared/*.js aggressively,
which makes edits look like they did nothing. This one never caches.

It also accepts `POST /__save?name=<file>[&dir=qa]` and writes the body into
assets/ (default) or qa/. tools/og-builder.html uses it to hand back the link
preview; tools/qa.html uses it for contact sheets.
Development only; GitHub Pages never sees this file run.
"""
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

ROOT = os.path.dirname(os.path.abspath(__file__))
DIRS = {'assets', 'qa'}


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_POST(self):
        url = urlparse(self.path)
        if url.path != '/__save':
            self.send_error(404)
            return
        q = parse_qs(url.query)
        name = os.path.basename(q.get('name', [''])[0])
        sub = q.get('dir', ['assets'])[0]
        if sub not in DIRS:
            self.send_error(400, 'dir must be assets or qa')
            return
        if not name or not name.endswith(('.png', '.jpg', '.webp', '.json')):
            self.send_error(400, 'name must be a .png/.jpg/.webp/.json basename')
            return
        length = int(self.headers.get('Content-Length', 0))
        if length <= 0 or length > 20_000_000:
            self.send_error(400, 'bad length')
            return
        folder = os.path.join(ROOT, sub)
        os.makedirs(folder, exist_ok=True)
        with open(os.path.join(folder, name), 'wb') as f:
            f.write(self.rfile.read(length))
        body = f'saved {sub}/{name} ({length} bytes)\n'.encode()
        self.send_response(200)
        self.send_header('Content-Type', 'text/plain')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)
        print(body.decode().strip())

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4173
    print(f'Crazy Pickers running at http://localhost:{port}')
    ThreadingHTTPServer(('127.0.0.1', port), NoCacheHandler).serve_forever()
