# BaseWill Mini App Assets

Required images for Base Mini App indexing and embeds.

## Required Assets

| Asset | Filename | Dimensions | Format | Description |
|-------|----------|------------|--------|-------------|
| Icon | `icon.png` | 1024x1024 | PNG | App icon (no transparent background) |
| Splash | `splash.png` | 200x200 | PNG | Loading screen image |
| Hero | `hero.png` | 1200x630 | PNG/JPG | Large promotional image (1.91:1) |
| OG Image | `og.png` | 1200x630 | PNG/JPG | Open Graph share image |
| Screenshot 1 | `screenshots/dashboard.png` | 1284x2778 | PNG | Dashboard view |
| Screenshot 2 | `screenshots/create-will.png` | 1284x2778 | PNG | Will creation wizard |
| Screenshot 3 | `screenshots/beneficiary.png` | 1284x2778 | PNG | Beneficiary view |

## Setup Steps

1. **Generate Assets**: Use [Mini App Assets Generator](https://www.miniappassets.com/) to create properly formatted images

2. **Account Association**:
   - Go to [Base Build Account Association Tool](https://www.base.dev/preview?tab=account)
   - Enter your domain (e.g., `basewill.xyz`)
   - Click "Submit" then "Verify"
   - Sign with your wallet
   - Copy the generated `header`, `payload`, and `signature` values
   - Update `/public/.well-known/farcaster.json` with these values

3. **Deploy & Index**:
   - Deploy your app with the manifest at `/.well-known/farcaster.json`
   - Share your Mini App URL in the Base feed to trigger indexing
   - Indexing happens automatically when URLs are shared

## Development vs Production

In `farcaster.json`:
- Set `"noindex": true` for staging/development to prevent search indexing
- Set `"noindex": false` for production to enable discovery

## Validation

After deploying, verify your manifest is accessible at:
```
https://your-domain.com/.well-known/farcaster.json
```

## Troubleshooting

If your Mini App doesn't appear in search results:
1. Verify manifest is accessible at the correct URL
2. Check all required fields are present and valid
3. Ensure images meet size/format requirements
4. Re-share the URL in the feed to trigger re-indexing
5. Check that `noindex` is not set to `true`

## Brand Colors

- Primary Navy: `#1e3a5f`
- Gold Accent: `#c9a227`
- Background: `#f8fafc`
