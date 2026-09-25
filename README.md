# OSINT Investigator Dashboard — Business Canvas Analyst

Single-file choropleth that scores countries from **public internet APIs**, then maps those observations onto Business Model Canvas hypotheses with a **deterministic rule table**.

Live app file: [`index.html`](./index.html)

Repo: https://github.com/anorakadrian/osint-investigator-dashboard

## What is live vs hypothesized

| Surface | Status | Source |
|---|---|---|
| Country polygons | Observed geometry | Natural Earth via D3 gallery GeoJSON |
| Digital attention | Observed, then percentile | World Bank WDI `IT.NET.USER.ZS` |
| Public-source climate | Observed mean, then percentile | WGI `GOV_WGI_RQ.SC`, `GOV_WGI_RL.SC`, `GOV_WGI_PV.SC` |
| Listed-market depth | Observed, log then weighted percentile | World Bank `CM.MKT.LCAP.CD`, `CM.MKT.LDOM.NO` |
| Connector tiles | Observed raw values + year | Same series. Internet use is not Similarweb. WGI is not a legal finding. Market cap is not startup TAM. |
| Nine BMC blocks / value prop | Hypothesis | Rule table on High/Mid/Low buckets |

No API keys. Missing country-years stay **No data** (never coerced to zero).

## Algorithms (in index.html)

1. Latest non-null join on `mrv=8` World Bank rows per ISO-3. Drop aggregates (`WLD`, `EUU`, income groups).
2. Percentile rank among economies that have the series: `i / (n - 1) * 100`.
3. Digital attention = percentile(internet users %).
4. Public-source climate = percentile(mean of available WGI RQ, RL, PV). Not a threat score.
5. Listed-market depth = `0.6 * percentile(log market cap) + 0.4 * percentile(log listed firms)`.
6. Canvas routing buckets each index at 33 and 67, then selects one of nine catalog propositions.

Open `index.html` in a browser. The page fetches the APIs at runtime.

## What this does not do

- Similarweb, SEC EDGAR, or court-record connectors (not configured).
- Proof of product-market fit, willingness to pay, or legal compliance.
- Minute-level polling. Series are annual.
