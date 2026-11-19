import pandas as pd
from publish_tewiwi import publish
from pathlib import Path
origin = pd.Timestamp('2026-11-22')
try:
    result = publish(Path('Tewiwi_H-2_Per_SKU.joblib'), origin, None)
    print('OK:', result['target_date'])
except Exception as e:
    import traceback
    traceback.print_exc()
