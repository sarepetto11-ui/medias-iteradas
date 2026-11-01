"""Refresh data before serving; fail explicitly instead of serving stale prices."""
import argparse
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import webbrowser
from fetch_market_data import fetch, ROOT

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    fetch()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(SimpleHTTPRequestHandler, directory=str(ROOT)))
    url = f'http://127.0.0.1:{args.port}/laboratorio_promedios_definido.html'
    if not args.no_browser:
        webbrowser.open(url)
    print('Laboratorio iniciado; Ctrl+C para detener.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
