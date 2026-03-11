# Vinted World Audit Checklist

## Database
- Verify `vinted_items` exists with `status`, `sale_price`, `platform_fee`, `sold_at`, `cost_price`, `created_at`.
- Verify `vinted_bundles` exists with `status` for delivered-bundle insights.
- Verify `vinted_expenses` exists with `type='packaging'` rows for packaging task suggestions.
- Verify indexes:
  - `vinted_items(status, created_at)`
  - `vinted_bundles(status)`
  - `vinted_expenses(type)`

## API Endpoints
- `GET /api/vinted/summary`
  - Revenue = sum sold `sale_price`
  - Fees = sum sold `platform_fee`
  - Invested = delivered bundle costs + expenses
- `GET /api/vinted/insights`
  - Low listing stock (<10)
  - Stale unsold >14 days (uses `created_at` as listed proxy in v1)
  - Top selling category by sold count
  - Average margin percent
  - Ops task suggestions + prioritized alerts
- `PATCH /api/vinted/items/:id/status`
  - Updates status
  - Supports clearing sold fields when moving out of sold
- `PATCH /api/vinted/items/:id/sold`
  - Requires `sale_price`
  - Sets `status='sold'`, `sale_price`, `platform_fee`, `sold_at`

## Drag/Drop Sold Flow
- Drag into `Sold` must open Sold Details modal before persisting.
- Saving modal updates sold fields and status in DB.
- Drag out of `Sold` must show confirmation modal.
- Confirming clears sold fields and updates status.

## KPI Correctness
- Sold save updates Dashboard KPIs immediately after API success.
- Moving item out of sold recalculates KPIs (revenue/fees/net impact).
- Margin logic used:
  - Item profit = `sale_price - cost_price - platform_fee`
  - Average margin % = `avg((sale - cost - fee)/cost)` for sold items with `cost_price > 0`.
