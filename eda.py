import pandas as pd
import numpy as np
import re

df = pd.read_csv('orders_sample.csv')
df['status_clean'] = df['final_status'].astype(str).str.strip().str.upper()
cod = df[df['status_clean'].isin(['DELIVERED', 'RTO'])].copy()
cod['is_rto'] = (cod['status_clean'] == 'RTO').astype(int)

print(f"Total valid COD records: {len(cod)}")
print(f"Overall RTO rate: {cod['is_rto'].mean():.2%}")

print("\n--- 1. Fake / Test Names ---")
fake_name_pattern = r'^(test|asdf|qwerty|abc|xyz|na)\b'
cod['is_fake_name'] = cod['customer_name'].astype(str).str.strip().str.lower().apply(lambda x: bool(re.search(fake_name_pattern, x)))
print(cod.groupby('is_fake_name')['is_rto'].agg(['count', 'mean']))

print("\n--- 2. Low Quality Addresses ---")
def check_addr_issue(addr):
    s = str(addr).strip().lower()
    if len(s) <= 4 or s in ['.', 'xyz', 'home', 'call me', 'near station']:
        return 'gibberish_or_extremely_short'
    if s.startswith('ph krke') or 'ph krke' in s:
        return 'ph_krke'
    if 'ke peeche' in s or 'ke paas' in s or 'ke saamne' in s:
        return 'hinglish_landmarks'
    return 'structured'

cod['addr_issue'] = cod['address'].apply(check_addr_issue)
print(cod.groupby('addr_issue')['is_rto'].agg(['count', 'mean']))

print("\n--- 3. City / State Breakdown ---")
city_summary = cod.groupby('city')['is_rto'].agg(['count', 'mean']).sort_values('count', ascending=False)
print("Top Cities by Volume and RTO:")
print(city_summary)

state_summary = cod.groupby('state')['is_rto'].agg(['count', 'mean']).sort_values('count', ascending=False)
print("\nStates by Volume and RTO:")
print(state_summary)

print("\n--- 4. Pincode Anomalies ---")
pin_summary = cod.groupby('pincode')['is_rto'].agg(['count', 'mean'])
high_rto_pins = pin_summary[(pin_summary['count'] >= 5) & (pin_summary['mean'] > 0.5)]
print(f"Total unique pincodes: {len(pin_summary)}")
print(f"Pincodes with >= 5 orders and > 50% RTO: {len(high_rto_pins)}")
print(high_rto_pins.head(10))

print("\n--- 5. Prior Orders & Prior RTO ---")
print("By Customer Prior Orders:")
print(cod.groupby('customer_prior_orders')['is_rto'].agg(['count', 'mean']))

print("\nBy Customer Prior RTO:")
print(cod.groupby('customer_prior_rto')['is_rto'].agg(['count', 'mean']))

print("\nCustomer Prior Orders vs Prior RTO cross-tab (mean RTO):")
print(cod.pivot_table(index='customer_prior_orders', columns='customer_prior_rto', values='is_rto', aggfunc=['count', 'mean']))

print("\n--- 6. Marketing Source (utm_source) ---")
print(cod.groupby('utm_source')['is_rto'].agg(['count', 'mean']).sort_values('mean', ascending=False))

print("\n--- 7. Courier Performance ---")
print(cod.groupby('courier')['is_rto'].agg(['count', 'mean']).sort_values('mean', ascending=False))

print("\n--- 8. Order Value ---")
cod['val_bin'] = pd.qcut(cod['order_value'], q=4)
print(cod.groupby('val_bin', observed=False)['is_rto'].agg(['count', 'mean']))

print("\n--- 9. Order Time of Day ---")
cod['hour'] = pd.to_datetime(cod['order_datetime']).dt.hour
cod['night_order'] = cod['hour'].between(0, 5).astype(int)
print("Night Orders (12 AM - 5 AM):")
print(cod.groupby('night_order')['is_rto'].agg(['count', 'mean']))

print("\n--- 10. Phone Number Anomalies ---")
cod['phone_str'] = cod['phone'].astype(str).str.replace(r'\D', '', regex=True)
cod['phone_len'] = cod['phone_str'].str.len()
print("Phone Length Distribution:")
print(cod.groupby('phone_len')['is_rto'].agg(['count', 'mean']))
