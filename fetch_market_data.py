"""Download unadjusted Yahoo minute closes; never fill missing observations."""
import json
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
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
    selected = {}
    previous_calendar_session = None
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
            # The pair must be adjacent in the exchange calendar, not merely
            # the two most recent dates on which the vendor returned data.
            if selected and previous_calendar_session is not None:
                older = result
                newer = selected
                combined = {}
                for symbol in SYMBOLS:
                    first, second = older[symbol], newer[symbol]
                    combined[symbol] = {
                        'symbol': symbol,
                        'sessions': [first, second],
                        'second_session_start': first['count'],
                        'observations': first['observations'] + second['observations']}
                return {'source': 'Yahoo Finance via yfinance', 'interval': '1m', 'period': '5d',
                        'field': 'Close', 'auto_adjust': False, 'prepost': False,
                        'timezone': 'America/New_York', 'session': previous_calendar_session,
                        'generated_at': now.isoformat(), 'rejected_sessions': rejected,
                        # Original laboratory continues to use only the newer session.
                        'instruments': newer,
                        'predictive': {'session_dates': [str(session.date()), previous_calendar_session],
                                       'instruments': combined}}
            selected = result
            previous_calendar_session = str(session.date())
        else:
            selected = {}
            previous_calendar_session = None
            rejected.append({'session': str(session.date()), 'issues': errors})
    raise ValueError('No two consecutive closed common sessions with enough valid observations in returned 5d data: ' + json.dumps(rejected))


def prepare_daily(frames, now=None):
    """A trailing calendar year ending on each symbol's last available closed session."""
    now = pd.Timestamp(now or datetime.now(timezone.utc))
    if now.tzinfo is None:
        raise ValueError('now must include timezone')
    instruments = {}
    for symbol in SYMBOLS:
        frame = frames[symbol]
        if frame.empty or frame.index.tz is None:
            raise ValueError(f'{symbol}: empty daily data or missing timezone')
        close = frame['Close']
        if isinstance(close, pd.DataFrame):
            close = close[symbol] if symbol in close else close.iloc[:, 0]
        close = close.tz_convert('America/New_York').sort_index()
        dates = pd.Index([t.date() for t in close.index])
        if dates.has_duplicates:
            raise ValueError(f'{symbol}: duplicate daily sessions')
        schedule = mcal.get_calendar('NYSE').schedule(start_date=min(dates), end_date=now.date())
        closed_dates = {t.date() for t, row in schedule.iterrows() if row.market_close <= now}
        valid = close[close.notna() & (close > 0) & (close < float('inf')) & dates.isin(closed_dates)]
        if len(valid) < 3:
            raise ValueError(f'{symbol}: insufficient closed daily observations')
        end = valid.index[-1].date()
        start = (pd.Timestamp(end) - pd.DateOffset(years=1)).date()
        if min(dates) > start:
            raise ValueError(f'{symbol}: download does not cover a full trailing year')
        selected = valid[[t.date() >= start for t in valid.index]]
        expected = [t.date() for t in schedule.index if start <= t.date() <= end]
        available = {t.date() for t in selected.index}
        missing = [str(t) for t in expected if t not in available]
        raw_window = close[[start <= t.date() <= end for t in close.index]]
        observations = [{'timestamp': t.isoformat(), 'session': str(t.date()), 'close': float(v)}
                        for t, v in selected.items()]
        instruments[symbol] = {'symbol': symbol, 'interval': '1d', 'window_start': str(start),
                               'first_session': observations[0]['session'], 'last_session': str(end),
                               'count': len(observations), 'expected_count': len(expected),
                               'missing_count': len(missing), 'missing_sessions': missing,
                               'invalid_count': int((raw_window.isna() | (raw_window <= 0) |
                                                     (raw_window >= float('inf'))).sum()),
                               'observations': observations}
    return {'interval': '1d', 'window': '1 calendar year ending at last available completed close',
            'download_period': '2y', 'field': 'Close', 'auto_adjust': False,
            'timezone': 'America/New_York', 'instruments': instruments}


def fetch(output=ROOT / 'market_data.json'):
    frames = {s: yf.Ticker(s).history(period='5d', interval='1m', prepost=False,
                                     auto_adjust=False, actions=False, repair=False,
                                     raise_errors=True) for s in SYMBOLS}
    payload = prepare(frames)
    daily_frames = {s: yf.Ticker(s).history(period='2y', interval='1d', prepost=False,
                                           auto_adjust=False, actions=False, repair=False,
                                           raise_errors=True) for s in SYMBOLS}
    payload['daily'] = prepare_daily(daily_frames)
    output = Path(output)
    temp = output.with_suffix('.tmp')
    temp.write_text(json.dumps(payload, ensure_ascii=False, allow_nan=False), encoding='utf-8')
    temp.replace(output)
    build_portable(payload, output.parent / 'laboratorio_listo.html')
    for symbol, instrument in payload['predictive']['instruments'].items():
        for session in instrument['sessions']:
            print(f"{symbol}: {session['session']}, {session['count']} original Close values, {session['missing_count']} missing minutes")
    for symbol, item in payload['daily']['instruments'].items():
        print(f"{symbol} daily: {item['first_session']} to {item['last_session']}, {item['count']} original Close values, {item['missing_count']} missing sessions")
    return payload

def build_portable(payload, output=ROOT / 'laboratorio_listo.html'):
    """Embed original data and local experiment scripts; no CDN or server needed."""
    html = (ROOT / 'laboratorio_promedios_definido.html').read_text(encoding='utf-8')
    embedded = json.dumps(payload, ensure_ascii=False, allow_nan=False).replace('<', chr(92) + 'u003c')
    html = html.replace('<script>\nconst $=', '<script>window.MARKET_DATA=' + embedded + ';</script>\n<script>\nconst $=', 1)
    for filename in ('predictive_engine.js', 'predictive_ui.js', 'data_frequency_ui.js'):
        code = (ROOT / filename).read_text(encoding='utf-8').replace('</script', '<' + chr(92) + '/script')
        html = html.replace(f'<script src="{filename}"></script>', '<script>\n' + code + '\n</script>')
    output = Path(output)
    output.write_text(html, encoding='utf-8')
    with ZipFile(output.parent / 'laboratorio_descargable.zip', 'w', compression=ZIP_DEFLATED) as archive:
        archive.write(output, 'laboratorio_listo.html')
        archive.writestr('COMO_ABRIR.txt',
                         '1. Extrae el ZIP.\n2. Abre laboratorio_listo.html con doble clic.\n'
                         '3. Arriba elige Datos intradiarios o Datos diarios.\n'
                         '4. Elige Laboratorio retrospectivo o Experimento predictivo.\n'
                         'No necesitas instalar Python. Las fechas se muestran en cada muestra.\n'
                         'Es una copia de los datos descargados; no se actualiza sola.\n')


if __name__ == '__main__':
    fetch()
