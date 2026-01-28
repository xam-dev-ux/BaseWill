import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const screenshotsDir = join(publicDir, 'screenshots');

// Ensure directories exist
if (!existsSync(screenshotsDir)) {
  mkdirSync(screenshotsDir, { recursive: true });
}

// Brand colors
const navy = '#1e3a5f';
const gold = '#c9a227';
const white = '#ffffff';
const lightBg = '#f8fafc';

// Generate SVG content for different image types
function createIconSvg(size) {
  return `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${navy}"/>
      <rect x="10%" y="10%" width="80%" height="80%" rx="15%" fill="${navy}" stroke="${gold}" stroke-width="3%"/>
      <text x="50%" y="58%" font-family="Arial, sans-serif" font-size="${size * 0.45}px" font-weight="bold" fill="${gold}" text-anchor="middle">W</text>
      <text x="50%" y="78%" font-family="Arial, sans-serif" font-size="${size * 0.1}px" fill="${white}" text-anchor="middle">BaseWill</text>
    </svg>
  `;
}

function createSplashSvg(size) {
  return `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${navy}"/>
      <circle cx="50%" cy="40%" r="25%" fill="none" stroke="${gold}" stroke-width="4"/>
      <text x="50%" y="45%" font-family="Arial, sans-serif" font-size="${size * 0.25}px" font-weight="bold" fill="${gold}" text-anchor="middle">W</text>
      <text x="50%" y="75%" font-family="Arial, sans-serif" font-size="${size * 0.12}px" font-weight="bold" fill="${white}" text-anchor="middle">BaseWill</text>
      <text x="50%" y="88%" font-family="Arial, sans-serif" font-size="${size * 0.06}px" fill="${gold}" text-anchor="middle">Loading...</text>
    </svg>
  `;
}

function createHeroSvg(width, height) {
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${navy};stop-opacity:1" />
          <stop offset="100%" style="stop-color:#2d4a6f;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bgGrad)"/>
      <circle cx="15%" cy="50%" r="200" fill="${gold}" opacity="0.1"/>
      <circle cx="85%" cy="30%" r="150" fill="${gold}" opacity="0.1"/>
      <text x="50%" y="35%" font-family="Arial, sans-serif" font-size="72px" font-weight="bold" fill="${white}" text-anchor="middle">BaseWill</text>
      <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="32px" fill="${gold}" text-anchor="middle">Secure Your Crypto Legacy</text>
      <text x="50%" y="65%" font-family="Arial, sans-serif" font-size="24px" fill="${white}" opacity="0.8" text-anchor="middle">Decentralized Inheritance on Base</text>
      <rect x="38%" y="75%" width="24%" height="8%" rx="20" fill="${gold}"/>
      <text x="50%" y="81%" font-family="Arial, sans-serif" font-size="20px" font-weight="bold" fill="${navy}" text-anchor="middle">Get Started</text>
    </svg>
  `;
}

function createScreenshotSvg(width, height, title, content) {
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${lightBg}"/>
      <!-- Header -->
      <rect width="100%" height="80" fill="${navy}"/>
      <text x="50" y="50" font-family="Arial, sans-serif" font-size="28px" font-weight="bold" fill="${white}">BaseWill</text>
      <circle cx="${width - 60}" cy="40" r="20" fill="${gold}"/>
      <!-- Title -->
      <text x="50" y="150" font-family="Arial, sans-serif" font-size="36px" font-weight="bold" fill="${navy}">${title}</text>
      <!-- Content cards -->
      <rect x="40" y="200" width="${width - 80}" height="200" rx="16" fill="${white}" stroke="#e2e8f0" stroke-width="2"/>
      <text x="70" y="260" font-family="Arial, sans-serif" font-size="24px" fill="${navy}">${content[0] || ''}</text>
      <text x="70" y="310" font-family="Arial, sans-serif" font-size="18px" fill="#64748b">${content[1] || ''}</text>
      <text x="70" y="350" font-family="Arial, sans-serif" font-size="18px" fill="#64748b">${content[2] || ''}</text>

      <rect x="40" y="440" width="${width - 80}" height="200" rx="16" fill="${white}" stroke="#e2e8f0" stroke-width="2"/>
      <text x="70" y="500" font-family="Arial, sans-serif" font-size="24px" fill="${navy}">${content[3] || ''}</text>
      <text x="70" y="550" font-family="Arial, sans-serif" font-size="18px" fill="#64748b">${content[4] || ''}</text>

      <rect x="40" y="680" width="${width - 80}" height="200" rx="16" fill="${white}" stroke="#e2e8f0" stroke-width="2"/>
      <text x="70" y="740" font-family="Arial, sans-serif" font-size="24px" fill="${navy}">${content[5] || ''}</text>
      <text x="70" y="790" font-family="Arial, sans-serif" font-size="18px" fill="#64748b">${content[6] || ''}</text>

      <!-- Bottom button -->
      <rect x="40" y="${height - 150}" width="${width - 80}" height="70" rx="16" fill="${navy}"/>
      <text x="50%" y="${height - 105}" font-family="Arial, sans-serif" font-size="24px" font-weight="bold" fill="${white}" text-anchor="middle">${content[7] || 'Continue'}</text>

      <!-- Bottom nav -->
      <rect x="0" y="${height - 60}" width="100%" height="60" fill="${white}"/>
      <circle cx="${width * 0.2}" cy="${height - 30}" r="15" fill="#e2e8f0"/>
      <circle cx="${width * 0.4}" cy="${height - 30}" r="15" fill="#e2e8f0"/>
      <circle cx="${width * 0.6}" cy="${height - 30}" r="15" fill="${navy}"/>
      <circle cx="${width * 0.8}" cy="${height - 30}" r="15" fill="#e2e8f0"/>
    </svg>
  `;
}

async function generateImages() {
  console.log('Generating Mini App images...');

  // 1. Icon (1024x1024)
  console.log('Creating icon.png (1024x1024)...');
  await sharp(Buffer.from(createIconSvg(1024)))
    .png()
    .toFile(join(publicDir, 'icon.png'));

  // 2. Splash (200x200)
  console.log('Creating splash.png (200x200)...');
  await sharp(Buffer.from(createSplashSvg(200)))
    .png()
    .toFile(join(publicDir, 'splash.png'));

  // 3. Hero Image (1200x630)
  console.log('Creating hero.png (1200x630)...');
  await sharp(Buffer.from(createHeroSvg(1200, 630)))
    .png()
    .toFile(join(publicDir, 'hero.png'));

  // 4. OG Image (1200x630) - same as hero
  console.log('Creating og.png (1200x630)...');
  await sharp(Buffer.from(createHeroSvg(1200, 630)))
    .png()
    .toFile(join(publicDir, 'og.png'));

  // 5. Screenshots (1284x2778)
  const screenshots = [
    {
      name: 'dashboard.png',
      title: 'Dashboard',
      content: [
        'My Wills',
        'Track your active wills and check-in status',
        'Last check-in: 2 days ago',
        'Total Value Secured',
        '2.5 ETH across 3 wills',
        'Beneficiaries',
        '5 people designated',
        'Create New Will'
      ]
    },
    {
      name: 'create-will.png',
      title: 'Create Will',
      content: [
        'Step 1: Basic Settings',
        'Configure your will parameters',
        'Inactivity threshold: 365 days',
        'Step 2: Beneficiaries',
        'Add up to 20 beneficiaries',
        'Step 3: Assets',
        'Select tokens and NFTs to include',
        'Continue'
      ]
    },
    {
      name: 'beneficiary.png',
      title: 'Beneficiary View',
      content: [
        'Potential Inheritance',
        '1.25 ETH from 2 wills',
        'Claimable when wills execute',
        'Named In',
        '2 active wills',
        'Claim History',
        'No claims yet',
        'View Details'
      ]
    }
  ];

  for (const screenshot of screenshots) {
    console.log(`Creating screenshots/${screenshot.name} (1284x2778)...`);
    await sharp(Buffer.from(createScreenshotSvg(1284, 2778, screenshot.title, screenshot.content)))
      .png()
      .toFile(join(screenshotsDir, screenshot.name));
  }

  console.log('All images generated successfully!');
}

generateImages().catch(console.error);
