import unittest
import pandas as pd
from fetch_market_data import prepare

class Sessions(unittest.TestCase):
    def frames(self, dates=('2026-10-28','2026-10-29','2026-10-30'), count=390):
        index=pd.DatetimeIndex([] ,tz='America/New_York')
        for date in dates:
            index=index.append(pd.date_range(date+' 09:30',periods=count,freq='min',tz='America/New_York'))
        return {s:pd.DataFrame({'Close':[100+i/100 for i in range(len(index))]},index=index) for s in ('AAPL','GGAL')}
    def test_original_values_and_timezone(self):
        frames=self.frames(); data=prepare(frames, '2026-11-01T12:00:00Z')
        self.assertEqual(data['session'],'2026-10-30')
        for s in frames:
            rows=data['instruments'][s]['observations']
            self.assertEqual(len(rows),390)
            self.assertEqual(rows[0]['close'],frames[s].Close.iloc[-390])
            self.assertTrue(rows[0]['timestamp'].endswith('-04:00'))
    def test_missing_is_kept_without_filling(self):
        frames=self.frames();frames['GGAL']=frames['GGAL'].drop(frames['GGAL'].index[-1])
        data=prepare(frames,'2026-11-01T12:00:00Z')
        self.assertEqual(data['session'],'2026-10-30')
        self.assertEqual(data['instruments']['GGAL']['count'],389)
        self.assertEqual(data['instruments']['GGAL']['missing_count'],1)
        self.assertEqual(data['instruments']['GGAL']['observations'][-1]['close'],frames['GGAL'].Close.iloc[-1])
    def test_current_session_not_closed(self):
        self.assertEqual(prepare(self.frames(),'2026-10-30T17:00:00Z')['session'],'2026-10-29')
    def test_early_close(self):
        data=prepare(self.frames(('2026-11-25','2026-11-27'),210),'2026-11-28T12:00:00Z')
        self.assertEqual(data['instruments']['AAPL']['count'],210)
    def test_not_enough_observations(self):
        frames=self.frames(('2026-10-30',),2)
        with self.assertRaises(ValueError):prepare(frames,'2026-11-01T12:00:00Z')
    def test_pair_boundaries_and_timestamps(self):
        frames=self.frames();frames['GGAL']=frames['GGAL'].drop(frames['GGAL'].index[400])
        data=prepare(frames,'2026-11-01T12:00:00Z')
        self.assertEqual(data['predictive']['session_dates'],['2026-10-29','2026-10-30'])
        for symbol in frames:
            item=data['predictive']['instruments'][symbol]
            self.assertEqual(item['second_session_start'],item['sessions'][0]['count'])
            self.assertEqual(item['observations'],item['sessions'][0]['observations']+item['sessions'][1]['observations'])
            self.assertTrue(item['observations'][0]['timestamp'].startswith('2026-10-29'))
        self.assertEqual(data['predictive']['instruments']['GGAL']['sessions'][0]['missing_count'],1)
        self.assertEqual(data['predictive']['instruments']['GGAL']['second_session_start'],389)
    def test_cannot_skip_exchange_session(self):
        with self.assertRaises(ValueError):
            prepare(self.frames(('2026-10-28','2026-10-30')),'2026-11-01T12:00:00Z')
    def test_duplicate_rejected(self):
        frames=self.frames(('2026-10-29','2026-10-30'))
        frames['GGAL']=pd.concat([frames['GGAL'],frames['GGAL'].iloc[-1:]])
        with self.assertRaises(ValueError):prepare(frames,'2026-11-01T12:00:00Z')
    def test_holiday_skipped_by_calendar(self):
        data=prepare(self.frames(('2026-11-25','2026-11-27')),'2026-11-28T12:00:00Z')
        self.assertEqual(data['predictive']['session_dates'],['2026-11-25','2026-11-27'])
        self.assertEqual(data['predictive']['instruments']['AAPL']['sessions'][1]['expected_count'],210)
if __name__=='__main__':unittest.main()
