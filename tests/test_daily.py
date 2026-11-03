import unittest
import pandas as pd
import pandas_market_calendars as mcal
from fetch_market_data import prepare_daily

class Daily(unittest.TestCase):
    def frames(self, end='2026-11-03'):
        schedule=mcal.get_calendar('NYSE').schedule(start_date='2024-11-01',end_date=end)
        index=pd.DatetimeIndex([str(t.date()) for t in schedule.index]).tz_localize('America/New_York')
        return {s:pd.DataFrame({'Close':[100+i/8 for i in range(len(index))]},index=index) for s in ('AAPL','GGAL')}
    def test_trailing_year_from_last_closed_close(self):
        frames=self.frames()
        data=prepare_daily(frames,'2026-11-03T16:00:00Z') # Tuesday session still open
        for s in frames:
            item=data['instruments'][s]
            self.assertEqual(item['last_session'],'2026-11-02')
            self.assertEqual(item['window_start'],'2025-11-02')
            self.assertGreaterEqual(item['first_session'],item['window_start'])
            self.assertEqual(item['count'],item['expected_count'])
            self.assertEqual(item['missing_count'],0)
            self.assertEqual(item['observations'][-1]['close'],frames[s].loc['2026-11-02'].Close)
            self.assertTrue(item['observations'][-1]['timestamp'].endswith('-05:00'))
    def test_weekend_and_missing_sessions_not_filled(self):
        frames=self.frames(); frames['GGAL']=frames['GGAL'].drop(pd.Timestamp('2026-10-30',tz='America/New_York'))
        data=prepare_daily(frames,'2026-11-01T16:00:00Z')
        self.assertEqual(data['instruments']['AAPL']['last_session'],'2026-10-30')
        self.assertEqual(data['instruments']['GGAL']['last_session'],'2026-10-29')
        frames=self.frames();frames['GGAL']=frames['GGAL'].drop(pd.Timestamp('2026-10-28',tz='America/New_York'))
        item=prepare_daily(frames,'2026-11-03T16:00:00Z')['instruments']['GGAL']
        self.assertEqual(item['missing_sessions'],['2026-10-28'])
        self.assertEqual(item['count']+1,item['expected_count'])
        self.assertNotIn('2026-10-28',[r['session'] for r in item['observations']])
    def test_prices_are_original_and_chronological(self):
        frames=self.frames();item=prepare_daily(frames,'2026-11-03T22:00:00Z')['instruments']['AAPL']
        for row in item['observations']:
            self.assertEqual(row['close'],frames['AAPL'].loc[pd.Timestamp(row['timestamp'])].Close)
        self.assertEqual([r['timestamp'] for r in item['observations']],sorted(r['timestamp'] for r in item['observations']))
    def test_duplicates_and_short_history_rejected(self):
        frames=self.frames();frames['GGAL']=pd.concat([frames['GGAL'],frames['GGAL'].iloc[-1:]])
        with self.assertRaises(ValueError):prepare_daily(frames,'2026-11-03T22:00:00Z')
        with self.assertRaises(ValueError):prepare_daily({s:f.iloc[-10:] for s,f in self.frames().items()},'2026-11-03T22:00:00Z')
    def test_leap_year_uses_calendar_year_not_fixed_365_days(self):
        frames=self.frames('2028-02-29')
        item=prepare_daily(frames,'2028-02-29T22:00:00Z')['instruments']['AAPL']
        self.assertEqual(item['window_start'],'2027-02-28')
        self.assertEqual(item['last_session'],'2028-02-29')
if __name__=='__main__':unittest.main()
