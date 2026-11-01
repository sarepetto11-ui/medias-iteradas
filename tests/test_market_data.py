import unittest
import pandas as pd
from fetch_market_data import prepare

class Sessions(unittest.TestCase):
    def frames(self, dates=('2026-10-29','2026-10-30'), count=390):
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
            self.assertEqual(rows[0]['close'],frames[s].Close.iloc[390])
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
        data=prepare(self.frames(('2026-11-27',),210),'2026-11-28T12:00:00Z')
        self.assertEqual(data['instruments']['AAPL']['count'],210)
    def test_not_enough_observations(self):
        frames=self.frames(('2026-10-30',),2)
        with self.assertRaises(ValueError):prepare(frames,'2026-11-01T12:00:00Z')
if __name__=='__main__':unittest.main()
