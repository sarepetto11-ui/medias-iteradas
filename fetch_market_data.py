"""Download unadjusted Yahoo minute closes; never fill missing observations."""
import json
from datetime import datetime, timezone
from pathlib import Path
import pandas as pd
import pandas_market_calendars as mcal
import yfinance as yf

SYMBOLS = ('AAPL', 'GGAL')
ROOT = Path(__file__).resolve().parent


def prepare(frames, now=None):
    now = pd.Timestamp(now or datetime.now(timezone.utc))
    if now.tzinfo is None:
        raise ValueError('now must include timezone')
    normalized = {}
    for symbol in SYMBOLS:
        frame = frames[symbol]
        if frame.empty or frame.index.tz is None:
            raise ValueError(f'{symbol}: empty data or missing timezone')
        close = frame['Close']
        if isinstance(close, pd.DataFrame):
            close = close[symbol] if symbol in close else close.iloc[:, 0]
        normalized[symbol] = close.tz_convert('UTC').sort_index()
    start = min(s.index.min() for s in normalized.values()).date()
    schedule = mcal.get_calendar('NYSE').schedule(start_date=start, end_date=now.date())
    rejected = []
    for session, row in schedule.iloc[::-1].iterrows():
        if row.market_close > now:
            rejected.append({'session': str(session.date()), 'reason': 'session not closed'})
            continue
        expected = pd.date_range(row.market_open, row.market_close, freq='min', inclusive='left')
        result, errors = {}, {}
        for symbol, close in normalized.items():
            part = close[(close.index >= row.market_open) & (close.index < row.market_close)]
            valid = part[part.notna() & (part > 0) & (part < float('inf'))]
            missing = expected.difference(valid.index)
            extra = valid.index.difference(expected)
            if len(valid) < 3 or len(extra) or valid.index.has_duplicates:
                errors[symbol] = {'valid_count': len(valid), 'expected_count': len(expected),
                                  'missing': [t.isoformat() for t in missing],
                                  'unexpected': [t.isoformat() for t in extra],
                                  'duplicates': int(valid.index.duplicated().sum())}
                continue
            result[symbol] = {'symbol': symbol, 'session': str(session.date()),
                              'count': len(valid), 'expected_count': len(expected),
                              'missing_count': len(missing),
                              'missing_timestamps': [t.tz_convert('America/New_York').isoformat() for t in missing],
                              'invalid_count': len(part) - len(valid),
                              'observations': [
                                  {'timestamp': t.tz_convert('America/New_York').isoformat(), 'close': float(v)}
                                  for t, v in valid.items()]}
        if not errors:
            return {'source': 'Yahoo Finance via yfinance', 'interval': '1m', 'period': '5d',
                    'field': 'Close', 'auto_adjust': False, 'prepost': False,
                    'timezone': 'America/New_York', 'session': str(session.date()),
                    'generated_at': now.isoformat(), 'rejected_sessions': rejected,
                    'instruments': result}
        rejected.append({'session': str(session.date()), 'issues': errors})
    raise ValueError('No closed common session with enough valid observations in returned 5d data: ' + json.dumps(rejected))


def fetch(output=ROOT / 'market_data.json'):
    frames = {s: yf.Ticker(s).history(period='5d', interval='1m', prepost=False,
                                     auto_adjust=False, actions=False, repair=False,
                                     raise_errors=True) for s in SYMBOLS}
    payload = prepare(frames)
    output = Path(output)
    temp = output.with_suffix('.tmp')
    temp.write_text(json.dumps(payload, ensure_ascii=False, allow_nan=False), encoding='utf-8')
    temp.replace(output)
    # Portable snapshot for users without a local Python installation.
    html = (ROOT / 'laboratorio_promedios_definido.html').read_text(encoding='utf-8')
    embedded = json.dumps(payload, ensure_ascii=False, allow_nan=False).replace('<', r'<')
    html = html.replace('<script>\nconst $=', '<script>window.MARKET_DATA=' + embedded + ';</script>\n<script>\nconst $=', 1)
    (output.parent / 'laboratorio_listo.html').write_text(html, encoding='utf-8')
    for s, instrument in payload['instruments'].items():
        print(f"{s}: {instrument['session']}, {instrument['count']} original Close values, {instrument['missing_count']} missing minutes")
    return payload

if __name__ == '__main__':
    fetch()
