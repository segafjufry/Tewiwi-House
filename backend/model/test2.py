import pandas as pd
from publish_tewiwi import publish
from pathlib import Path

origin = pd.Timestamp('2026-11-24') - pd.Timedelta(days=2)
print('origin:', origin)
try:
    result = publish(Path('Tewiwi_H-2_Per_SKU.joblib'), origin, None)
    print('OK:', result['target_date'])
except Exception as e:
    import traceback
    traceback.print_exc()
