/**
 * Offerwall Competitors Analysis Tool
 *
 * Focused specifically on offerwall/reward apps competitors.
 * Filters out irrelevant apps and prioritizes longer, more insightful reviews.
 */

const gplay = require("google-play-scraper").default;
const fs = require("fs");
const path = require("path");
const pLimit = require("p-limit").default;
const { stringify } = require("csv-stringify/sync");

const OUT_DIR = path.join(__dirname, "out");
const LIMIT = pLimit(3);

// ---- CONFIG ----
const CONFIG = {
  lang: "en",
  country: "us",

  // Core offerwall competitor apps (verified package IDs)
  seededAppIds: [
    // Major Offerwall/GPT Apps
    "com.prodege.swagbucksmobile",          // Swagbucks
    "com.mentormate.android.inboxdollars",  // InboxDollars
    "com.mistplay.mistplay",                // Mistplay
    "com.tapgen.featurepoints",             // FeaturePoints
    "com.requapp.requ",                     // AttaPoll
    "com.survjun",                          // Survey Junkie
    "com.freecash.app2",                    // Freecash
    "com.google.android.apps.paidtasks",    // Google Opinion Rewards
    "com.eureka.android",                   // Eureka
    "de.empfohlen",                         // Testerup
    "com.kashkick.kashkickapp",             // KashKick
    "us.current.android",                   // Current (Make Money)
    "com.earnstar.games.earn.money",        // EarnStar
    "com.apphype.surveystreak",             // SurveyStreak
    "com.bestplay.app",                     // BestPlay
    "in.sweatco.app",                       // Sweatcoin
    "com.fetchrewards.fetchrewards.hop",    // Fetch Rewards
    "com.weward",                           // WeWard
    // Play-to-earn apps
    "com.justdice",                         // JustDice
    "app.justplay.de",                      // JustPlay
    "com.wombat.money",                     // Wombat
    "money.cash.giraffe",                   // Cash Giraffe
    "com.scrambly.app",                     // Scrambly
    "com.snakzy.app",                       // Snakzy
    "com.copper.app",                       // Copper
    "com.ember.app",                        // Ember
    // Survey apps
    "com.qmee.app",                         // Qmee
    "com.surveymonkey.rewards",             // SurveyMonkey Rewards
    "com.lifepoints.lps",                   // LifePoints
    "com.toluna.androidapp",                // Toluna
    "com.yougov.participate",               // YouGov
    "com.surveytime.app",                   // SurveyTime
    "com.primeresearch.primeopinion",       // Prime Opinion
    // Cashback/Receipt apps
    "com.ibotta.android",                   // Ibotta
    "com.shopkick.app",                     // Shopkick
    "com.infoscout.receipthog",             // Receipt Hog
    "com.checkout51.android",               // Checkout 51
    "com.appcard.dosh",                     // Dosh
  ],

  // Focused keywords for offerwall/GPT niche
  keywords: [
    "offerwall app",
    "GPT app earn",
    "get paid to app",
    "reward app offerwall",
    "earn money playing games",
    "paid surveys app",
    "survey rewards app",
    "complete tasks earn money",
    "watch videos earn money",
    "install apps earn cash",
    "cashback rewards app",
    "earn gift cards app",
    "play to earn rewards",
    "money making app legit",
    "earn paypal cash",
    "referral bonus app",
    "daily rewards app",
    "spin wheel earn money",
    "scratch cards earn money",
    "trivia game earn money",
    "swagbucks alternative",
    "mistplay alternative",
    "freecash alternative",
  ],

  appsPerKeyword: 20,
  similarAppsPerApp: 5,
  maxReviewsPerApp: 3000,      // Increased to get more reviews
  reviewSort: gplay.sort.NEWEST,
  minTotalReviewsToInclude: 500,  // Higher threshold
  minReviewLength: 100,            // Minimum characters for a review to be considered
  examplesPerCategory: 15,         // More examples per theme
  
  delayBetweenRequests: 250,
};

// ---- RELEVANCE FILTERS ----
// Exclude these app IDs (big tech, browsers, social media, unrelated)
const EXCLUDED_APP_IDS = new Set([
  // Browsers
  "com.android.chrome",
  "com.chrome.beta",
  "com.chrome.dev",
  "org.mozilla.firefox",
  "com.opera.browser",
  "com.opera.mini.native",
  "com.microsoft.emmx",
  "com.brave.browser",
  "com.duckduckgo.mobile.android",
  // Social Media
  "com.twitter.android",
  "com.instagram.android",
  "com.facebook.katana",
  "com.facebook.lite",
  "com.whatsapp",
  "com.snapchat.android",
  "com.zhiliaoapp.musically", // TikTok
  "com.ss.android.ugc.trill", // TikTok
  "com.pinterest",
  "com.linkedin.android",
  "com.reddit.frontpage",
  "com.tumblr",
  "com.discord",
  "org.telegram.messenger",
  // Big Tech / Utilities
  "com.google.android.youtube",
  "com.google.android.apps.youtube.music",
  "com.google.android.gm",
  "com.google.android.apps.docs",
  "com.google.android.apps.maps",
  "com.google.android.apps.photos",
  "com.microsoft.office.outlook",
  "com.microsoft.teams",
  "com.amazon.mShop.android.shopping",
  "com.amazon.kindle",
  "com.ebay.mobile",
  "com.alibaba.aliexpresshd",
  "com.walmart.android",
  // Streaming / Entertainment (not reward-based)
  "com.netflix.mediaclient",
  "com.spotify.music",
  "com.hulu.plus",
  "com.disney.disneyplus",
  "com.amazon.avod.thirdpartyclient",
  // Banking/Finance (traditional)
  "com.paypal.android.p2pmobile",
  "com.venmo",
  "com.squareup.cash",
  "com.zellepay.zelle",
  // Games (mainstream, not earn-to-play)
  "com.supercell.clashofclans",
  "com.supercell.clashroyale",
  "com.king.candycrushsaga",
  "com.rovio.angrybirds",
  "com.mojang.minecraftpe",
  "com.activision.callofduty.shooter",
  "com.pubg.krmobile",
  // Crypto exchanges (not offerwall)
  "com.binance.dev",
  "com.coinbase.android",
  "com.kraken.trade",
]);

// Keywords that indicate an app is NOT an offerwall competitor
const NEGATIVE_KEYWORDS = [
  "vpn", "antivirus", "cleaner", "booster", "battery", "wifi",
  "wallpaper", "launcher", "keyboard", "translator", "calculator",
  "weather", "flashlight", "camera", "photo editor", "video editor",
  "music player", "file manager", "browser", "pdf", "qr code",
  "dating", "social network", "messaging", "news", "podcast",
  "fitness tracker", "meditation", "sleep", "diet", "workout",
  "language learning", "education", "kids", "parental control",
  "remote control", "screen mirror", "recording", "notes", "calendar",
  "alarm", "timer", "compass", "speedometer", "scanner",
];

// Keywords that indicate an app IS an offerwall competitor (positive signals)
const POSITIVE_KEYWORDS = [
  "earn", "reward", "cash", "money", "paid", "survey", "offerwall",
  "gift card", "paypal", "redeem", "points", "coins", "credits",
  "tasks", "offers", "watch videos", "install apps", "play games",
  "spin", "scratch", "trivia", "quiz", "lucky", "win", "prize",
  "cashback", "receipt", "shopping rewards", "referral", "bonus",
  "gpt", "get-paid-to", "make money", "side hustle", "passive income",
];

// ---- Theme dictionaries with more granularity ----
const PRAISE = {
  pays_reliably: ["pays", "paid", "payment", "withdraw", "cashout", "redeem", "received", "legit", "legitimate", "real money"],
  easy_to_use: ["easy", "simple", "straightforward", "intuitive", "user friendly", "clean interface"],
  fun_engaging: ["fun", "enjoy", "addictive", "entertaining", "love it", "great app"],
  good_variety: ["variety", "options", "many offers", "lots of games", "many surveys", "different tasks"],
  fast_payout: ["fast payout", "quick payout", "instant", "same day", "within minutes", "quick cash", "fast redemption"],
  good_rates: ["good rates", "pays well", "high paying", "worth it", "good value", "pays more than"],
  low_minimum: ["low minimum", "low threshold", "easy to reach", "quick to redeem"],
  reliable_tracking: ["tracks well", "always credits", "tracking works", "never missed"],
};

const COMPLAINT = {
  not_credited: [
    "not credited", "didn't credit", "no credit", "missing points", "missing credits",
    "not tracking", "stopped tracking", "progress not", "doesn't track", "lost my points",
    "offer didn't credit", "never got credited", "pending forever"
  ],
  withdrawal_issues: [
    "can't withdraw", "withdrawal failed", "cashout failed", "can't cash out",
    "pending", "never received", "won't pay", "waiting for payment", "payout pending",
    "minimum too high", "threshold too high", "can't redeem"
  ],
  scam_suspicion: [
    "scam", "fraud", "fake", "ripoff", "rip off", "waste of time", "don't trust",
    "stealing", "never pays", "total scam", "complete scam", "avoid this"
  ],
  too_many_ads: [
    "too many ads", "constant ads", "ads everywhere", "annoying ads", "ad after ad",
    "more ads than", "forced ads", "unskippable ads", "ads every second"
  ],
  poor_support: [
    "no support", "customer service", "no response", "ignored", "bot reply", "no help",
    "useless support", "never replied", "automated response", "can't contact"
  ],
  account_banned: [
    "banned", "blocked", "suspended", "account disabled", "terminated", "kicked out",
    "banned for no reason", "false ban", "wrongly banned"
  ],
  bugs_crashes: [
    "bug", "glitch", "crash", "freeze", "broken", "not working", "doesn't work",
    "keeps crashing", "error", "laggy", "slow", "won't load", "black screen"
  ],
  low_earnings: [
    "pays too little", "not worth", "waste of time", "barely earn", "takes forever",
    "low pay", "pennies", "cents per hour", "impossible to earn"
  ],
  no_offers: [
    "no offers", "no surveys", "nothing available", "empty", "surveys always full",
    "never qualify", "disqualified", "no tasks", "dried up"
  ],
};

const FIXED_WORDS = ["fixed", "resolved", "after update", "now works", "they fixed", "issue fixed", "problem solved", "working now"];

// ---- Utility Functions ----
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeJSON(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf8");
}

function normalize(s) {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Check if an app is relevant to offerwall competitors
function isRelevantApp(appId, title, description) {
  // Exclude known irrelevant apps
  if (EXCLUDED_APP_IDS.has(appId)) return false;

  const text = normalize(`${title} ${description}`);

  // Check for negative signals
  for (const neg of NEGATIVE_KEYWORDS) {
    if (text.includes(neg) && !POSITIVE_KEYWORDS.some(pos => text.includes(pos))) {
      return false;
    }
  }

  // Check for positive signals
  let positiveScore = 0;
  for (const pos of POSITIVE_KEYWORDS) {
    if (text.includes(pos)) positiveScore++;
  }

  // Require at least 2 positive signals for discovered apps
  return positiveScore >= 2;
}

function hitThemes(text, dict) {
  const t = normalize(text);
  const hits = {};
  for (const [label, words] of Object.entries(dict)) {
    hits[label] = words.some((w) => t.includes(w)) ? 1 : 0;
  }
  return hits;
}

function countThemes(reviews) {
  const praiseCounts = {};
  const complaintCounts = {};
  const examples = {};
  let fixedMentions = 0;

  for (const k of Object.keys(PRAISE)) praiseCounts[k] = 0;
  for (const k of Object.keys(COMPLAINT)) complaintCounts[k] = 0;

  // Helper to add example reviews, prioritizing longer ones
  function pushExample(key, text, score) {
    if (!examples[key]) examples[key] = [];
    
    // Only consider reviews of minimum length
    if (text.length < CONFIG.minReviewLength) return;

    const entry = { text: text.slice(0, 500), length: text.length, score };
    
    if (examples[key].length < CONFIG.examplesPerCategory) {
      examples[key].push(entry);
      // Sort by length descending to keep longest reviews
      examples[key].sort((a, b) => b.length - a.length);
    } else if (text.length > examples[key][examples[key].length - 1].length) {
      // Replace shortest example if this one is longer
      examples[key][examples[key].length - 1] = entry;
      examples[key].sort((a, b) => b.length - a.length);
    }
  }

  for (const r of reviews) {
    const text = r.text || r.content || "";
    const score = r.score || r.rating || 0;
    const t = normalize(text);

    const p = hitThemes(t, PRAISE);
    const c = hitThemes(t, COMPLAINT);

    for (const [k, v] of Object.entries(p)) {
      praiseCounts[k] += v;
      if (v) pushExample(`praise:${k}`, text, score);
    }
    for (const [k, v] of Object.entries(c)) {
      complaintCounts[k] += v;
      if (v) pushExample(`complaint:${k}`, text, score);
    }
    if (FIXED_WORDS.some((w) => t.includes(w))) {
      fixedMentions += 1;
      pushExample("fixed", text, score);
    }
  }

  // Convert examples to just text strings for output
  const cleanExamples = {};
  for (const [key, entries] of Object.entries(examples)) {
    cleanExamples[key] = entries.map(e => e.text);
  }

  const top = (obj, n = 10) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n);

  return {
    reviewCountUsed: reviews.length,
    topPraises: top(praiseCounts, 10),
    topComplaints: top(complaintCounts, 10),
    fixedMentions,
    examples: cleanExamples,
  };
}

async function fetchReviews(appId, { lang, country, max, sort }) {
  let all = [];
  let nextToken = null;

  while (all.length < max) {
    try {
      const res = await gplay.reviews({
        appId,
        lang,
        country,
        sort,
        num: Math.min(200, max - all.length),
        nextPaginationToken: nextToken,
      });

      all = all.concat(res.data || []);
      nextToken = res.nextPaginationToken;
      if (!nextToken || (res.data || []).length === 0) break;
      await delay(CONFIG.delayBetweenRequests);
    } catch (err) {
      console.error(`  Error fetching reviews for ${appId}: ${err.message}`);
      break;
    }
  }
  return all;
}

async function searchAppsByKeyword(keyword, { lang, country, n }) {
  try {
    const res = await gplay.search({
      term: keyword,
      lang,
      country,
      num: n,
    });
    await delay(CONFIG.delayBetweenRequests);
    return res || [];
  } catch (err) {
    console.error(`  Error searching for "${keyword}": ${err.message}`);
    return [];
  }
}

async function fetchAppDetails(appId, { lang, country }) {
  return await gplay.app({ appId, lang, country });
}

async function fetchSimilarApps(appId, { lang, country }) {
  try {
    const res = await gplay.similar({
      appId,
      lang,
      country,
    });
    await delay(CONFIG.delayBetweenRequests);
    return res || [];
  } catch (err) {
    return [];
  }
}

function generateHTML(appsOutput) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offerwall Competitors Analysis</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #0a0a0f;
      --bg-secondary: #12121a;
      --bg-card: #1a1a24;
      --bg-hover: #22222e;
      --text-primary: #ffffff;
      --text-secondary: #a0a0b0;
      --text-muted: #6b6b7b;
      --accent-green: #00d47e;
      --accent-red: #ff5c5c;
      --accent-blue: #5c9aff;
      --accent-purple: #a78bfa;
      --accent-yellow: #fbbf24;
      --accent-orange: #fb923c;
      --border-color: rgba(255, 255, 255, 0.08);
      --shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      min-height: 100vh;
    }

    .container { max-width: 1800px; margin: 0 auto; padding: 2rem; }

    header {
      text-align: center;
      margin-bottom: 2rem;
      padding: 2rem;
      background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-card) 100%);
      border-radius: 16px;
      border: 1px solid var(--border-color);
    }

    header h1 {
      font-size: 2.5rem;
      font-weight: 700;
      background: linear-gradient(135deg, var(--accent-orange) 0%, var(--accent-purple) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 0.5rem;
    }

    header p { color: var(--text-secondary); font-size: 1.1rem; }

    .stats-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .stat-card {
      background: var(--bg-card);
      padding: 1.25rem;
      border-radius: 12px;
      border: 1px solid var(--border-color);
      text-align: center;
    }

    .stat-card .value { font-size: 1.75rem; font-weight: 700; color: var(--accent-blue); }
    .stat-card .label { color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.25rem; }

    .controls {
      display: flex;
      gap: 1rem;
      margin-bottom: 2rem;
      flex-wrap: wrap;
      align-items: center;
    }

    .search-box {
      flex: 1;
      min-width: 250px;
      position: relative;
    }

    .search-box input {
      width: 100%;
      padding: 1rem 1rem 1rem 3rem;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      color: var(--text-primary);
      font-size: 1rem;
      transition: border-color 0.2s;
    }

    .search-box input:focus { outline: none; border-color: var(--accent-blue); }
    .search-box::before { content: "🔍"; position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); }

    select, button {
      padding: 1rem;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      color: var(--text-primary);
      font-size: 1rem;
      cursor: pointer;
    }

    button:hover { background: var(--bg-hover); }

    .view-toggle { display: flex; gap: 0.5rem; }
    .view-toggle button.active { background: var(--accent-blue); border-color: var(--accent-blue); }

    /* Grid View */
    .apps-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
      gap: 1.5rem;
    }

    /* Table View */
    .apps-table {
      width: 100%;
      border-collapse: collapse;
      display: none;
    }

    .apps-table th, .apps-table td {
      padding: 1rem;
      text-align: left;
      border-bottom: 1px solid var(--border-color);
    }

    .apps-table th {
      background: var(--bg-secondary);
      font-weight: 600;
      color: var(--text-secondary);
      position: sticky;
      top: 0;
    }

    .apps-table tr:hover { background: var(--bg-hover); }

    .apps-table .app-icon-small {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      margin-right: 0.75rem;
      vertical-align: middle;
    }

    .app-card {
      background: var(--bg-card);
      border-radius: 16px;
      border: 1px solid var(--border-color);
      overflow: hidden;
      transition: transform 0.2s, box-shadow 0.2s;
      cursor: pointer;
    }

    .app-card:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow);
      border-color: var(--accent-blue);
    }

    .app-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.25rem;
      background: var(--bg-secondary);
    }

    .app-icon { width: 56px; height: 56px; border-radius: 12px; object-fit: cover; flex-shrink: 0; }
    .app-title-section { flex: 1; min-width: 0; }
    .app-title { font-size: 1rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .app-developer { color: var(--text-secondary); font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .app-rating {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.4rem 0.8rem;
      background: rgba(255, 193, 7, 0.15);
      border-radius: 20px;
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--accent-yellow);
    }

    .app-body { padding: 1.25rem; }

    .metrics-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.75rem;
      margin-bottom: 1.25rem;
    }

    .metric { text-align: center; }
    .metric .value { font-size: 1.1rem; font-weight: 600; color: var(--text-primary); }
    .metric .label { font-size: 0.7rem; color: var(--text-muted); margin-top: 0.2rem; }

    .themes-section h4 {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 0.5rem;
    }

    .themes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .theme-list { display: flex; flex-direction: column; gap: 0.35rem; }

    .theme-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.8rem;
      padding: 0.3rem 0.5rem;
      border-radius: 4px;
      background: var(--bg-secondary);
    }

    .theme-item.praise { border-left: 3px solid var(--accent-green); }
    .theme-item.complaint { border-left: 3px solid var(--accent-red); }
    .theme-item .name { color: var(--text-secondary); }
    .theme-item .count { font-weight: 600; }
    .theme-item.praise .count { color: var(--accent-green); }
    .theme-item.complaint .count { color: var(--accent-red); }

    .app-footer {
      padding: 0.75rem 1.25rem;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .source-tags { display: flex; gap: 0.4rem; flex-wrap: wrap; }

    .source-tag {
      font-size: 0.65rem;
      padding: 0.2rem 0.4rem;
      background: var(--bg-secondary);
      border-radius: 4px;
      color: var(--text-muted);
    }

    .play-link {
      color: var(--accent-blue);
      text-decoration: none;
      font-size: 0.8rem;
      font-weight: 500;
    }

    .play-link:hover { color: var(--accent-purple); }

    /* Modal */
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.85);
      z-index: 1000;
      overflow-y: auto;
      padding: 2rem;
    }

    .modal-overlay.active { display: flex; justify-content: center; align-items: flex-start; }

    .modal {
      background: var(--bg-secondary);
      border-radius: 20px;
      max-width: 1100px;
      width: 100%;
      border: 1px solid var(--border-color);
      margin: auto;
      max-height: 90vh;
      overflow-y: auto;
    }

    .modal-header {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      padding: 2rem;
      border-bottom: 1px solid var(--border-color);
      position: sticky;
      top: 0;
      background: var(--bg-secondary);
      z-index: 10;
    }

    .modal-header .app-icon { width: 80px; height: 80px; }

    .modal-close {
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: var(--bg-card);
      border: none;
      color: var(--text-secondary);
      font-size: 1.5rem;
      cursor: pointer;
      width: 40px;
      height: 40px;
      border-radius: 50%;
    }

    .modal-body { padding: 2rem; }

    .screenshots-row {
      display: flex;
      gap: 1rem;
      overflow-x: auto;
      padding-bottom: 1rem;
      margin-bottom: 2rem;
    }

    .screenshot { height: 200px; border-radius: 12px; flex-shrink: 0; cursor: zoom-in; transition: transform 0.2s; }
    .screenshot:hover { transform: scale(1.05); }

    /* Lightbox */
    .lightbox {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.95);
      z-index: 2000;
      justify-content: center;
      align-items: center;
      cursor: zoom-out;
    }

    .lightbox.active { display: flex; }
    .lightbox img { max-width: 90%; max-height: 90%; border-radius: 12px; box-shadow: 0 0 40px rgba(0,0,0,0.5); }

    .reviews-section { margin-top: 2rem; }

    .reviews-section h3 {
      color: var(--text-secondary);
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .review-category {
      margin-bottom: 2rem;
      border: 1px solid var(--border-color);
      border-radius: 12px;
      overflow: hidden;
    }

    .review-category-header {
      padding: 1rem;
      background: var(--bg-card);
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .review-category-header:hover { background: var(--bg-hover); }

    .review-category-header h4 {
      font-size: 0.95rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .review-category-header .count {
      background: var(--accent-purple);
      color: white;
      padding: 0.2rem 0.6rem;
      border-radius: 10px;
      font-size: 0.75rem;
    }

    .review-category-content { padding: 1rem; display: none; }
    .review-category.open .review-category-content { display: block; }

    .review-card {
      background: var(--bg-primary);
      padding: 1rem;
      border-radius: 10px;
      margin-bottom: 0.75rem;
      border-left: 3px solid var(--accent-purple);
      font-size: 0.9rem;
      color: var(--text-secondary);
      line-height: 1.6;
    }

    .review-card:last-child { margin-bottom: 0; }

    .no-apps {
      text-align: center;
      padding: 4rem;
      color: var(--text-secondary);
    }

    .praise-label { color: var(--accent-green); }
    .complaint-label { color: var(--accent-red); }

    @media (max-width: 768px) {
      .apps-grid { grid-template-columns: 1fr; }
      .themes-grid { grid-template-columns: 1fr; }
      header h1 { font-size: 1.8rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🎯 Offerwall Competitors Analysis</h1>
      <p>GPT/Offerwall Apps Research • ${appsOutput.length} Competitors Analyzed • Generated ${new Date().toLocaleDateString()}</p>
    </header>

    <div class="stats-row">
      <div class="stat-card">
        <div class="value">${appsOutput.length}</div>
        <div class="label">Competitors</div>
      </div>
      <div class="stat-card">
        <div class="value">${appsOutput.reduce((acc, app) => acc + (app.summary?.reviewCountUsed || 0), 0).toLocaleString()}</div>
        <div class="label">Reviews Analyzed</div>
      </div>
      <div class="stat-card">
        <div class="value">${(appsOutput.reduce((acc, app) => acc + (app.app?.score || 0), 0) / appsOutput.length).toFixed(2)}</div>
        <div class="label">Avg Rating</div>
      </div>
      <div class="stat-card">
        <div class="value">${Math.round(appsOutput.reduce((acc, app) => {
          const complaints = (app.summary?.topComplaints || []).reduce((a, [_, c]) => a + c, 0);
          return acc + complaints;
        }, 0) / appsOutput.length)}</div>
        <div class="label">Avg Complaints/App</div>
      </div>
      <div class="stat-card">
        <div class="value">${appsOutput.reduce((acc, app) => acc + (app.summary?.fixedMentions || 0), 0)}</div>
        <div class="label">Fixed Issues</div>
      </div>
    </div>

    <div class="controls">
      <div class="search-box">
        <input type="text" id="searchInput" placeholder="Search by name, developer, or keywords...">
      </div>
      <select id="sortSelect">
        <option value="reviews">Sort by Reviews</option>
        <option value="rating">Sort by Rating</option>
        <option value="name">Sort by Name</option>
        <option value="complaints">Sort by Complaints</option>
        <option value="praises">Sort by Praises</option>
      </select>
      <div class="view-toggle">
        <button id="gridView" class="active">Grid</button>
        <button id="tableView">Table</button>
      </div>
    </div>

    <div class="apps-grid" id="appsGrid"></div>

    <table class="apps-table" id="appsTable">
      <thead>
        <tr>
          <th>App</th>
          <th>Rating</th>
          <th>Reviews</th>
          <th>Top Praise</th>
          <th>Top Complaint</th>
          <th>Fixed</th>
        </tr>
      </thead>
      <tbody id="appsTableBody"></tbody>
    </table>

    <div class="no-apps" id="noApps" style="display: none;">No apps match your search criteria</div>
  </div>

  <div class="modal-overlay" id="modalOverlay">
    <div class="modal">
      <button class="modal-close" onclick="closeModal()">×</button>
      <div class="modal-header" id="modalHeader"></div>
      <div class="modal-body" id="modalBody"></div>
    </div>
  </div>

  <div class="lightbox" id="lightbox" onclick="this.classList.remove('active')">
    <img id="lightboxImg" src="" alt="Enlarged screenshot">
  </div>

  <script>
    const appsData = ${JSON.stringify(appsOutput)};
    let currentView = 'grid';

    function formatNumber(num) {
      if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
      if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
      return num.toString();
    }

    function renderApps(apps) {
      const grid = document.getElementById('appsGrid');
      const tableBody = document.getElementById('appsTableBody');
      const noApps = document.getElementById('noApps');

      if (apps.length === 0) {
        grid.innerHTML = '';
        tableBody.innerHTML = '';
        noApps.style.display = 'block';
        return;
      }

      noApps.style.display = 'none';

      // Grid view
      grid.innerHTML = apps.map((app) => \`
        <div class="app-card" onclick="showModal('\${app.appId}')">
          <div class="app-header">
            <img class="app-icon" src="\${app.app?.icon || ''}" alt="\${app.app?.title || 'App'}" onerror="this.style.display='none'">
            <div class="app-title-section">
              <div class="app-title">\${app.app?.title || 'Unknown App'}</div>
              <div class="app-developer">\${app.app?.developer || 'Unknown Developer'}</div>
            </div>
            <div class="app-rating">⭐ \${(app.app?.score || 0).toFixed(1)}</div>
          </div>
          <div class="app-body">
            <div class="metrics-row">
              <div class="metric">
                <div class="value">\${formatNumber(app.app?.reviewsTotal || 0)}</div>
                <div class="label">Total Reviews</div>
              </div>
              <div class="metric">
                <div class="value">\${formatNumber(app.summary?.reviewCountUsed || 0)}</div>
                <div class="label">Analyzed</div>
              </div>
              <div class="metric">
                <div class="value">\${app.summary?.fixedMentions || 0}</div>
                <div class="label">Fixed</div>
              </div>
            </div>
            <div class="themes-section">
              <div class="themes-grid">
                <div>
                  <h4>Top Praises</h4>
                  <div class="theme-list">
                    \${(app.summary?.topPraises || []).slice(0, 4).map(([name, count]) => \`
                      <div class="theme-item praise">
                        <span class="name">\${name.replace(/_/g, ' ')}</span>
                        <span class="count">\${count}</span>
                      </div>
                    \`).join('')}
                  </div>
                </div>
                <div>
                  <h4>Top Complaints</h4>
                  <div class="theme-list">
                    \${(app.summary?.topComplaints || []).slice(0, 4).map(([name, count]) => \`
                      <div class="theme-item complaint">
                        <span class="name">\${name.replace(/_/g, ' ')}</span>
                        <span class="count">\${count}</span>
                      </div>
                    \`).join('')}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="app-footer">
            <div class="source-tags">
              \${(app.sources || []).slice(0, 2).map(s => \`<span class="source-tag">\${s.length > 25 ? s.slice(0, 25) + '...' : s}</span>\`).join('')}
            </div>
            <a href="\${app.app?.url || '#'}" target="_blank" class="play-link" onclick="event.stopPropagation()">Play Store →</a>
          </div>
        </div>
      \`).join('');

      // Table view
      tableBody.innerHTML = apps.map((app) => \`
        <tr onclick="showModal('\${app.appId}')" style="cursor: pointer">
          <td>
            <img class="app-icon-small" src="\${app.app?.icon || ''}" alt="" onerror="this.style.display='none'">
            <strong>\${app.app?.title || 'Unknown'}</strong>
            <br><small style="color: var(--text-muted)">\${app.app?.developer || ''}</small>
          </td>
          <td>⭐ \${(app.app?.score || 0).toFixed(1)}</td>
          <td>\${formatNumber(app.app?.reviewsTotal || 0)}</td>
          <td class="praise-label">\${app.summary?.topPraises?.[0]?.[0]?.replace(/_/g, ' ') || '-'} (\${app.summary?.topPraises?.[0]?.[1] || 0})</td>
          <td class="complaint-label">\${app.summary?.topComplaints?.[0]?.[0]?.replace(/_/g, ' ') || '-'} (\${app.summary?.topComplaints?.[0]?.[1] || 0})</td>
          <td>\${app.summary?.fixedMentions || 0}</td>
        </tr>
      \`).join('');
    }

    function filterApps() {
      const searchTerm = document.getElementById('searchInput').value.toLowerCase();
      const sortBy = document.getElementById('sortSelect').value;

      let filtered = appsData.filter(app => {
        const title = (app.app?.title || '').toLowerCase();
        const developer = (app.app?.developer || '').toLowerCase();
        return title.includes(searchTerm) || developer.includes(searchTerm);
      });

      filtered.sort((a, b) => {
        switch (sortBy) {
          case 'rating': return (b.app?.score || 0) - (a.app?.score || 0);
          case 'reviews': return (b.app?.reviewsTotal || 0) - (a.app?.reviewsTotal || 0);
          case 'name': return (a.app?.title || '').localeCompare(b.app?.title || '');
          case 'complaints':
            const aC = (a.summary?.topComplaints || []).reduce((acc, [_, c]) => acc + c, 0);
            const bC = (b.summary?.topComplaints || []).reduce((acc, [_, c]) => acc + c, 0);
            return bC - aC;
          case 'praises':
            const aP = (a.summary?.topPraises || []).reduce((acc, [_, c]) => acc + c, 0);
            const bP = (b.summary?.topPraises || []).reduce((acc, [_, c]) => acc + c, 0);
            return bP - aP;
          default: return 0;
        }
      });

      renderApps(filtered);
    }

    function showModal(appId) {
      const app = appsData.find(a => a.appId === appId);
      if (!app) return;

      const modal = document.getElementById('modalOverlay');
      const header = document.getElementById('modalHeader');
      const body = document.getElementById('modalBody');

      header.innerHTML = \`
        <img class="app-icon" src="\${app.app?.icon || ''}" alt="\${app.app?.title || 'App'}">
        <div class="app-title-section">
          <div class="app-title" style="font-size: 1.5rem">\${app.app?.title || 'Unknown App'}</div>
          <div class="app-developer">\${app.app?.developer || 'Unknown Developer'}</div>
          <div style="margin-top: 0.5rem; color: var(--accent-yellow)">
            ⭐ \${(app.app?.score || 0).toFixed(2)} • \${(app.app?.reviewsTotal || 0).toLocaleString()} reviews • 
            <span style="color: var(--accent-green)">\${app.summary?.reviewCountUsed || 0} analyzed</span>
          </div>
        </div>
      \`;

      const screenshots = app.app?.screenshots || [];
      const examples = app.summary?.examples || {};

      // Group examples by type
      const praiseExamples = {};
      const complaintExamples = {};
      const otherExamples = {};

      for (const [key, texts] of Object.entries(examples)) {
        if (key.startsWith('praise:')) {
          praiseExamples[key.replace('praise:', '')] = texts;
        } else if (key.startsWith('complaint:')) {
          complaintExamples[key.replace('complaint:', '')] = texts;
        } else {
          otherExamples[key] = texts;
        }
      }

      body.innerHTML = \`
        \${screenshots.length > 0 ? \`
          <h3 style="margin-bottom: 1rem; color: var(--text-secondary)">📱 Screenshots (Click to enlarge)</h3>
          <div class="screenshots-row">
            \${screenshots.map(url => \`<img class="screenshot" src="\${url}" alt="Screenshot" onclick="event.stopPropagation(); openLightbox('\${url}')">\`).join('')}
          </div>
        \` : ''}

        <div class="reviews-section">
          <h3>💬 Review Examples (Longest & Most Insightful)</h3>
          
          <h4 style="color: var(--accent-green); margin: 1.5rem 0 1rem">✅ What Users LOVE</h4>
          \${Object.entries(praiseExamples).map(([key, texts]) => \`
            <div class="review-category">
              <div class="review-category-header" onclick="this.parentElement.classList.toggle('open')">
                <h4>\${key.replace(/_/g, ' ').toUpperCase()}</h4>
                <span class="count">\${texts.length} examples</span>
              </div>
              <div class="review-category-content">
                \${texts.map(t => \`<div class="review-card" style="border-left-color: var(--accent-green)">"\${t}"</div>\`).join('')}
              </div>
            </div>
          \`).join('')}

          <h4 style="color: var(--accent-red); margin: 2rem 0 1rem">❌ What Users HATE</h4>
          \${Object.entries(complaintExamples).map(([key, texts]) => \`
            <div class="review-category">
              <div class="review-category-header" onclick="this.parentElement.classList.toggle('open')">
                <h4>\${key.replace(/_/g, ' ').toUpperCase()}</h4>
                <span class="count">\${texts.length} examples</span>
              </div>
              <div class="review-category-content">
                \${texts.map(t => \`<div class="review-card" style="border-left-color: var(--accent-red)">"\${t}"</div>\`).join('')}
              </div>
            </div>
          \`).join('')}

          \${Object.keys(otherExamples).length > 0 ? \`
            <h4 style="color: var(--accent-purple); margin: 2rem 0 1rem">🔧 Fixed Issues Mentioned</h4>
            \${Object.entries(otherExamples).map(([key, texts]) => \`
              <div class="review-category">
                <div class="review-category-header" onclick="this.parentElement.classList.toggle('open')">
                  <h4>\${key.toUpperCase()}</h4>
                  <span class="count">\${texts.length} examples</span>
                </div>
                <div class="review-category-content">
                  \${texts.map(t => \`<div class="review-card">"\${t}"</div>\`).join('')}
                </div>
              </div>
            \`).join('')}
          \` : ''}
        </div>

        <div style="margin-top: 2rem; text-align: center">
          <a href="\${app.app?.url || '#'}" target="_blank" class="play-link" style="font-size: 1.1rem">
            Open in Google Play Store →
          </a>
        </div>
      \`;

      modal.classList.add('active');
    }

    function closeModal() {
      document.getElementById('modalOverlay').classList.remove('active');
    }

    function openLightbox(url) {
      const lightbox = document.getElementById('lightbox');
      const img = document.getElementById('lightboxImg');
      img.src = url;
      lightbox.classList.add('active');
    }

    document.getElementById('modalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'modalOverlay') closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.getElementById('lightbox').classList.remove('active');
      }
    });

    document.getElementById('searchInput').addEventListener('input', filterApps);
    document.getElementById('sortSelect').addEventListener('change', filterApps);

    document.getElementById('gridView').addEventListener('click', () => {
      currentView = 'grid';
      document.getElementById('appsGrid').style.display = 'grid';
      document.getElementById('appsTable').style.display = 'none';
      document.getElementById('gridView').classList.add('active');
      document.getElementById('tableView').classList.remove('active');
    });

    document.getElementById('tableView').addEventListener('click', () => {
      currentView = 'table';
      document.getElementById('appsGrid').style.display = 'none';
      document.getElementById('appsTable').style.display = 'table';
      document.getElementById('gridView').classList.remove('active');
      document.getElementById('tableView').classList.add('active');
    });

    // Initial render
    filterApps();
  </script>
</body>
</html>`;

  return html;
}

async function main() {
  ensureDir(OUT_DIR);

  // ---- 1) Build the app set: seeded + discovery + similar ----
  const found = new Map();

  // Seeded apps first (always included as they are verified competitors)
  for (const appId of CONFIG.seededAppIds) {
    found.set(appId, { appId, from: ["seeded_competitor"], verified: true });
  }

  console.log("=== Phase 1: Discovering apps via keyword search ===");
  for (const kw of CONFIG.keywords) {
    const results = await searchAppsByKeyword(kw, {
      lang: CONFIG.lang,
      country: CONFIG.country,
      n: CONFIG.appsPerKeyword,
    });

    for (const item of results) {
      if (!item.appId) continue;
      if (!found.has(item.appId)) {
        found.set(item.appId, { appId: item.appId, from: [], verified: false });
      }
      found.get(item.appId).from.push(`kw:${kw}`);
    }

    console.log(`  ✓ "${kw}": ${results.length} results`);
  }

  console.log(`\n=== Phase 2: Discovering similar apps ===`);
  const seededApps = CONFIG.seededAppIds.slice(0, 15);

  for (const appId of seededApps) {
    const similar = await fetchSimilarApps(appId, {
      lang: CONFIG.lang,
      country: CONFIG.country,
    });

    for (const item of similar.slice(0, CONFIG.similarAppsPerApp)) {
      if (!item.appId) continue;
      if (!found.has(item.appId)) {
        found.set(item.appId, { appId: item.appId, from: [], verified: false });
      }
      found.get(item.appId).from.push(`similar:${appId.split('.').pop()}`);
    }

    if (similar.length > 0) {
      console.log(`  ✓ Similar to ${appId.split('.').slice(-2).join('.')}: ${similar.length} apps`);
    }
  }

  const appIds = [...found.keys()];
  console.log(`\n=== Total apps discovered: ${appIds.length} ===`);
  console.log(`=== Now filtering for relevant offerwall competitors... ===\n`);

  // ---- 2) Fetch details + filter + reviews ----
  console.log("=== Phase 3: Fetching and filtering apps ===");
  const appsOutput = [];
  let processed = 0;
  let filtered = 0;

  await Promise.all(
    appIds.map((appId) =>
      LIMIT(async () => {
        try {
          const meta = await fetchAppDetails(appId, { lang: CONFIG.lang, country: CONFIG.country });
          processed++;

          // Check minimum reviews
          if ((meta.reviews || 0) < CONFIG.minTotalReviewsToInclude) {
            return;
          }

          // Check relevance (skip for seeded/verified apps)
          const appData = found.get(appId);
          if (!appData.verified) {
            const isRelevant = isRelevantApp(appId, meta.title || "", meta.description || "");
            if (!isRelevant) {
              filtered++;
              return;
            }
          }

          const reviews = await fetchReviews(appId, {
            lang: CONFIG.lang,
            country: CONFIG.country,
            max: CONFIG.maxReviewsPerApp,
            sort: CONFIG.reviewSort,
          });

          const summary = countThemes(reviews);

          const appDir = path.join(OUT_DIR, appId);
          ensureDir(appDir);

          writeJSON(path.join(appDir, "reviews.json"), reviews);
          writeJSON(path.join(appDir, "images.json"), {
            icon: meta.icon || null,
            headerImage: meta.headerImage || null,
            screenshots: meta.screenshots || [],
            video: meta.video || null,
          });
          writeJSON(path.join(appDir, "summary.json"), summary);

          const record = {
            appId,
            fetchedAt: new Date().toISOString(),
            sources: appData.from,
            verified: appData.verified,
            app: {
              title: meta.title,
              developer: meta.developer,
              developerId: meta.developerId,
              score: meta.score,
              ratings: meta.ratings,
              reviewsTotal: meta.reviews,
              url: meta.url,
              icon: meta.icon,
              headerImage: meta.headerImage,
              screenshots: meta.screenshots || [],
              description: meta.description || null,
              summary: meta.summary || null,
              genre: meta.genre || null,
              updated: meta.updated || null,
              version: meta.version || null,
              free: meta.free,
              price: meta.price,
              currency: meta.currency,
            },
            summary,
          };

          appsOutput.push(record);

          console.log(`✓ [${appsOutput.length}] ${meta.title} | ⭐${meta.score?.toFixed(1)} | ${reviews.length} reviews`);
        } catch (err) {
          // Silently skip failed apps
        }
      })
    )
  );

  console.log(`\n=== Filtering summary ===`);
  console.log(`  Total discovered: ${appIds.length}`);
  console.log(`  Filtered out (irrelevant): ${filtered}`);
  console.log(`  Final competitors: ${appsOutput.length}`);

  // ---- 3) Write outputs ----
  appsOutput.sort((a, b) => (b.app.reviewsTotal || 0) - (a.app.reviewsTotal || 0));
  writeJSON(path.join(OUT_DIR, "apps.json"), appsOutput);

  const csvRows = appsOutput.map((r) => ({
    appId: r.appId,
    title: r.app.title,
    developer: r.app.developer,
    rating: r.app.score,
    totalReviews: r.app.reviewsTotal,
    fetchedReviews: r.summary.reviewCountUsed,
    fixedMentions: r.summary.fixedMentions,
    topPraise1: r.summary.topPraises[0]?.[0] || "",
    topPraise1Count: r.summary.topPraises[0]?.[1] || 0,
    topComplaint1: r.summary.topComplaints[0]?.[0] || "",
    topComplaint1Count: r.summary.topComplaints[0]?.[1] || 0,
    url: r.app.url,
    sources: (r.sources || []).join("|"),
  }));

  const csv = stringify(csvRows, { header: true });
  fs.writeFileSync(path.join(OUT_DIR, "apps.csv"), csv, "utf8");

  // ---- 4) Generate HTML report ----
  console.log("\n=== Generating HTML report ===");
  const html = generateHTML(appsOutput);
  fs.writeFileSync(path.join(OUT_DIR, "report.html"), html, "utf8");

  console.log(`\n✅ Done!`);
  console.log(`📊 Offerwall competitors analyzed: ${appsOutput.length}`);
  console.log(`📁 Output: ${OUT_DIR}`);
  console.log(`📄 Open report.html in your browser to explore results!`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});