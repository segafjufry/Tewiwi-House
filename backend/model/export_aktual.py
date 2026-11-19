"""
Export data penjualan aktual dari database ke aktual_baru.csv.
Jalankan: python export_aktual.py
"""
import psycopg2
import csv
from datetime import date

DATABASE_URL = "postgresql://postgres.gtwdcuuwtnktowzfaczk:Tewiwi_160798@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"
TRAINED_THROUGH = date(2025, 12, 31)
OUTPUT_FILE = "aktual_baru.csv"
# Perpanjang CSV hingga hari ini + beberapa hari ke depan agar origin selalu tersedia
from datetime import timedelta as _td
EXTEND_TO = date.today() + _td(days=7)

# Mapping product_id -> sku_id (sesuai catalog di model)
# Cek dari tabel products di database
SKU_MAP = None  # akan diambil otomatis dari database

def main():
    print("Menghubungkan ke database...")
    conn = psycopg2.connect(DATABASE_URL, sslmode="require")
    cur = conn.cursor()

    # Ambil mapping product_id -> sku_id dari tabel products
    # Asumsi kolom sku_id ada di products, atau pakai format TW + id
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'products' ORDER BY ordinal_position")
    columns = [r[0] for r in cur.fetchall()]
    print("Kolom tabel products:", columns)

    # Cek apakah ada kolom sku_id
    if 'sku_id' in columns:
        cur.execute("SELECT id, sku_id FROM products WHERE active = true ORDER BY id")
    else:
        # Pakai format TW001, TW002, dst
        cur.execute("SELECT id, 'TW' || LPAD(id::text, 3, '0') as sku_id FROM products WHERE active = true ORDER BY id")

    sku_map = {row[0]: row[1] for row in cur.fetchall()}
    print("SKU mapping:", sku_map)

    # Ambil data order dari tanggal setelah trained_through sampai hari ini
    today = date.today()
    print(f"Mengambil data dari {TRAINED_THROUGH} s/d {today}...")

    cur.execute("""
        SELECT
            o.delivery_date AS order_date,
            oi.product_id,
            SUM(oi.quantity) AS quantity
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE o.delivery_date > %s
          AND o.delivery_date <= %s
          AND o.status NOT IN ('Dibatalkan')
        GROUP BY o.delivery_date, oi.product_id
        ORDER BY o.delivery_date, oi.product_id
    """, (TRAINED_THROUGH, today))

    rows = cur.fetchall()
    print(f"Ditemukan {len(rows)} baris data.")

    if not rows:
        print("Tidak ada data baru setelah tanggal trained_through. Coba dari order_history...")
        cur.execute("""
            SELECT
                delivery_date AS order_date,
                product_id,
                SUM(quantity) AS quantity
            FROM order_history
            WHERE delivery_date > %s
              AND delivery_date <= %s
            GROUP BY delivery_date, product_id
            ORDER BY delivery_date, product_id
        """, (TRAINED_THROUGH, today))
        rows = cur.fetchall()
        print(f"Ditemukan {len(rows)} baris dari order_history.")

    cur.close()
    conn.close()

    if not rows:
        print("Tidak ada data aktual tersedia setelah 2025-12-31.")
        print("Gunakan tanggal prediksi yang sesuai dengan data latih (maks Jumat 2 Jan 2026).")
        return

    # Bangun dict {(order_date, sku_id): quantity}
    from datetime import timedelta

    data = {}
    for order_date, product_id, quantity in rows:
        sku_id = sku_map.get(product_id)
        if sku_id:
            data[(order_date, sku_id)] = int(quantity)

    # Rentang tanggal dari hari pertama data hingga hari ini (isi 0 untuk hari tanpa pesanan)
    all_dates = sorted(set(k[0] for k in data.keys()))
    first_date = all_dates[0]
    last_date = EXTEND_TO
    all_skus = sorted(sku_map.values())

    # Isi semua kombinasi tanggal x SKU, kosong = 0
    full_date_range = []
    d = first_date
    while d <= last_date:
        full_date_range.append(d)
        d += timedelta(days=1)

    # Tulis ke CSV
    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["order_date", "sku_id", "quantity"])
        written = 0
        for d in full_date_range:
            for sku_id in all_skus:
                qty = data.get((d, sku_id), 0)
                writer.writerow([d.strftime("%Y-%m-%d"), sku_id, qty])
                written += 1

    print(f"Selesai. {written} baris ditulis ke {OUTPUT_FILE}")
    print(f"Rentang tanggal: {first_date} s/d {last_date}")
    print(f"Tanggal prediksi yang valid (Selasa/Jumat setelah {last_date}):")
    d = last_date + timedelta(days=1)
    count = 0
    while count < 4:
        if d.weekday() in (1, 4):  # Selasa=1, Jumat=4
            print(f"  - {d.strftime('%Y-%m-%d')} ({'Selasa' if d.weekday()==1 else 'Jumat'})")
            count += 1
        d += timedelta(days=1)

if __name__ == "__main__":
    main()
