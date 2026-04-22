const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const { spawnSync, execSync } = require('child_process');
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios'); 
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');

// ==========================================
// ⚙️ SETTINGS & ENVIRONMENT VARIABLES
// ==========================================
const TARGET_URL = process.env.TARGET_URL || 'https://dlstreams.com/watch.php?id=316';

const FB_TOKEN_1 = process.env.FB_TOKEN_1 || '';
const FB_TOKEN_2 = process.env.FB_TOKEN_2 || '';
const TOKEN_SELECTION = process.env.TOKEN_SELECTION || 'Dual'; 

const TITLES_INPUT = process.env.TITLES_LIST || 'Live Match Today,,Watch Full Match DC vs GT';
const DESCS_INPUT = process.env.DESCS_LIST || 'Watch the live action here';
const HASHTAGS = process.env.HASHTAGS || '#IPL2026 #DCvsGT #CricketLovers #LiveMatch';

const WAIT_TIME_MS = 300 * 1000; // 5 Minutes loop wait
const START_TIME = Date.now();
const RESTART_TRIGGER_MS = (5 * 60 * 60 + 30 * 60) * 1000; // 5.5 Hours
const END_TIME_LIMIT_MS = (5 * 60 * 60 + 50 * 60) * 1000; // 5.8 Hours

let clipCounter = 1;

// 🌐 BROWSER VARIABLES
let browser = null;
let page = null;
let targetFrame = null;
const DISPLAY_NUM = process.env.DISPLAY || ':99';

function formatPKT(timestampMs = Date.now()) {
    return new Date(timestampMs).toLocaleString('en-US', {
        timeZone: 'Asia/Karachi', hour12: true, year: 'numeric', month: 'short',
        day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
    }) + " PKT";
}

function generateMetadata(clipNum) {
    const titles = TITLES_INPUT.split(',,').map(t => t.trim()).filter(t => t);
    const descs = DESCS_INPUT.split(',,').map(d => d.trim()).filter(d => d);
    const title = titles.length ? titles[Math.floor(Math.random() * titles.length)] : "Live Match";
    const descBody = descs.length ? descs[Math.floor(Math.random() * descs.length)] : "Watch live!";
    const emojis = ["🔥", "🏏", "⚡", "🏆", "💥", "😱", "📺", "🚀"].sort(() => 0.5 - Math.random()).slice(0, 3);
    const tags = HASHTAGS.split(' ').sort(() => 0.5 - Math.random()).slice(0, 4).join(' ');
    
    const finalTitle = title.substring(0, 240); 
    const finalDesc = `${finalTitle} ${emojis.join(' ')}\n\n${descBody}\n\n⏱️ Update: ${formatPKT()}\n👇 Watch Full Match Link in First Comment!\n\n${tags}`;
    return { title: finalTitle, desc: finalDesc };
}

// =========================================================================
// 🌐 SETUP BROWSER (Runs Fresh Every Cycle)
// =========================================================================
async function initBrowserAndPlayer(isFirstCycle) {
    console.log(`\n[*] Starting FRESH browser instance...`);
    
    browser = await puppeteer.launch({
        channel: 'chrome', headless: false, 
        defaultViewport: { width: 1280, height: 720 },
        ignoreDefaultArgs: ['--enable-automation'], 
        args: [ '--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,720', '--kiosk', '--autoplay-policy=no-user-gesture-required', '--mute-audio' ]
    });

    page = await browser.newPage();
    const pages = await browser.pages();
    for (const p of pages) if (p !== page) await p.close();

    browser.on('targetcreated', async (target) => {
        if (target.type() === 'page') {
            try { const newPage = await target.page(); if (newPage && newPage !== page) { await page.bringToFront(); setTimeout(() => newPage.close().catch(() => {}), 1000); } } catch (e) { }
        }
    });

    console.log(`[*] Navigating to target URL: ${TARGET_URL}...`);
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 10000)); // Cloudflare bypass wait

    console.log('[*] Scanning iframes for the REAL Live Stream Video...');
    for (const frame of page.frames()) {
        try {
            const isRealLiveStream = await frame.evaluate(() => {
                const vid = document.querySelector('video[data-html5-video]') || document.querySelector('video');
                return vid && vid.clientWidth > 300; 
            });
            if (isRealLiveStream) {
                targetFrame = frame;
                await frame.evaluate(() => { const fAd = document.getElementById('floated'); if (fAd) fAd.remove(); });
            }
        } catch (e) { }
    }

    if (!targetFrame) throw new Error('No <video> element could be found.');

    try {
        const iframeEl = await targetFrame.frameElement();
        const box = await iframeEl.boundingBox();
        if (box) await page.mouse.click(box.x + (box.width / 2), box.y + (box.height / 2), { delay: 100 });
        await new Promise(r => setTimeout(r, 2000));
    } catch (e) { }

    await targetFrame.evaluate(async () => {
        const video = document.querySelector('video[data-html5-video]') || document.querySelector('video');
        if (video) { video.volume = 1.0; await video.play().catch(e => {}); }
    });

    await targetFrame.evaluate(async () => {
        const vid = document.querySelector('video[data-html5-video]') || document.querySelector('video');
        if (!vid) return;
        try {
            if (vid.requestFullscreen) await vid.requestFullscreen();
            else if (vid.webkitRequestFullscreen) await vid.webkitRequestFullscreen();
        } catch (err) {
            vid.style.position = 'fixed'; vid.style.top = '0'; vid.style.left = '0';
            vid.style.width = '100vw'; vid.style.height = '100vh'; vid.style.zIndex = '2147483647'; vid.style.backgroundColor = 'black'; vid.style.objectFit = 'contain';
        }
    });

    console.log('[✅] Browser Ready! Video is playing fullscreen.');

    // 🎥 DEBUG RECORDING (Only on First Cycle)
    if (isFirstCycle) {
        console.log(`\n[🔍 DEBUG] Cycle 1 par 15-second ki Visual Debug Recording kar raha hoon...`);
        const recorder = new PuppeteerScreenRecorder(page);
        const debugFileName = `debug_video_${Date.now()}.mp4`;
        await recorder.start(debugFileName);
        
        await new Promise(r => setTimeout(r, 15000)); // Record for 15 seconds
        await recorder.stop();
        
        console.log(`[📤 DEBUG] Uploading to GitHub Releases...`);
        try {
            const tagName = `visual-debug-${Date.now()}`;
            execSync(`gh release create ${tagName} ${debugFileName} --title "Visual Debug Capture" --notes "First Cycle Screen Check"`, { stdio: 'inherit' });
            console.log('✅ [+] Successfully uploaded visual debug video to GitHub Releases!');
        } catch (err) {
            console.error('❌ [!] Failed to upload debug video (Check GH_TOKEN in yaml):', err.message);
        }
        if (fs.existsSync(debugFileName)) fs.unlinkSync(debugFileName);
    }
}

// ==========================================
// 📸 WORKER 0.5: GENERATE THUMBNAIL 
// ==========================================
async function worker_0_5_generate_thumbnail(titleText, outputImagePath) {
    console.log(`\n[🎨 Worker 0.5] Puppeteer se HD Thumbnail bana raha hoon...`);
    const rawFrame = 'temp_raw_frame.jpg';
    try { await page.screenshot({ path: rawFrame, type: 'jpeg', quality: 90 }); } catch (e) { return false; }
    if (!fs.existsSync(rawFrame)) return false;
    const b64Image = "data:image/jpeg;base64," + fs.readFileSync(rawFrame).toString('base64');
    
    const htmlCode = `
        <!DOCTYPE html><html><head><link href="https://fonts.googleapis.com/css2?family=Roboto:wght@700;900&display=swap" rel="stylesheet">
        <style>body { margin: 0; width: 1280px; height: 720px; background: #0f0f0f; font-family: 'Roboto', sans-serif; color: white; display: flex; flex-direction: column; overflow: hidden; } .header { height: 100px; display: flex; align-items: center; padding: 0 40px; justify-content: space-between; z-index: 10; } .logo { font-size: 50px; font-weight: 900; letter-spacing: 1px; text-shadow: 0 0 10px rgba(255,255,255,0.8); } .live-badge { border: 4px solid #cc0000; border-radius: 12px; padding: 5px 20px; font-size: 40px; font-weight: 700; display: flex; gap: 10px; } .hero-container { position: relative; width: 100%; height: 440px; } .hero-img { width: 100%; height: 100%; object-fit: cover; filter: blur(5px); opacity: 0.6; } .pip-img { position: absolute; top: 20px; right: 40px; width: 45%; border: 6px solid white; box-shadow: -15px 15px 30px rgba(0,0,0,0.8); } .text-container { flex-grow: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 10px 40px; } .main-title { font-size: 70px; font-weight: 900; line-height: 1.1; text-shadow: 6px 6px 15px rgba(0,0,0,0.9); } .live-text { color: #cc0000; }</style>
        </head><body><div class="header"><div class="logo">SPORTSHUB</div><div class="live-badge"><span style="color:#cc0000">●</span> LIVE</div></div><div class="hero-container"><img src="${b64Image}" class="hero-img"><img src="${b64Image}" class="pip-img"></div><div class="text-container"><div class="main-title"><span class="live-text">LIVE NOW: </span>${titleText}</div></div></body></html>`;

    const tb = await puppeteer.launch({ headless: true, defaultViewport: { width: 1280, height: 720 }, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const tPage = await tb.newPage();
    await tPage.setContent(htmlCode);
    await tPage.screenshot({ path: outputImagePath });
    await tb.close();
    if (fs.existsSync(rawFrame)) fs.unlinkSync(rawFrame); 
    console.log(`[✅ Worker 0.5] Thumbnail Ready: ${outputImagePath}`);
    return true;
}

// ==========================================
// 🎥 WORKER 1 & 2: SCREEN RECORDING + EDIT 
// ==========================================
async function worker_1_2_capture_and_edit(outputVid) {
    console.log(`\n[🎬 Worker 1 & 2] Physical Screen Recording & Fast Edit shuru ho raha hai...`);
    const audioFile = "marya_live.mp3"; const bgImage = "website_frame.png"; const staticVideo = "main_video.mp4"; const duration = "10"; const blurAmount = "15:3"; 
    const hasBg = fs.existsSync(bgImage); const hasAudio = fs.existsSync(audioFile); const hasMainVideo = fs.existsSync(staticVideo);
    const raw10sVid = `raw_screen_${Date.now()}.mp4`; const tempDynVideo = `temp_dyn_${Date.now()}.mp4`; 

    // STEP 0: RECORD 10 SECONDS
    console.log(`[>] [Step 0] Recording 10 seconds of LIVE Fullscreen (x11grab)...`);
    const captureArgs = ['-y', '-f', 'x11grab', '-draw_mouse', '0', '-video_size', '1280x720', '-framerate', '30', '-i', DISPLAY_NUM, '-f', 'pulse', '-i', 'default', '-c:v', 'libx264', '-preset', 'ultrafast', '-threads', '2', '-c:a', 'aac', '-t', duration, raw10sVid];
    const recResult = spawnSync('ffmpeg', captureArgs, { stdio: 'pipe', timeout: 25000 });
    if (recResult.error || !fs.existsSync(raw10sVid) || fs.statSync(raw10sVid).size < 1000) return false;
    
    // STEP A: EDIT CLIP
    console.log(`[>] [Step A] Applying Blur & PiP Frame on recorded clip...`);
    let args1 = ["-y", "-thread_queue_size", "1024", "-i", raw10sVid]; 
    if (hasBg) args1.push("-thread_queue_size", "1024", "-loop", "1", "-framerate", "30", "-i", bgImage);
    if (hasAudio) args1.push("-thread_queue_size", "1024", "-stream_loop", "-1", "-i", audioFile);
    let filterComplex1 = hasBg ? `[0:v]scale=1064:565,boxblur=${blurAmount}[pip]; [1:v][pip]overlay=0:250:shortest=1,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p[outv]` : `[0:v]scale=1280:720,boxblur=${blurAmount},format=yuv420p[outv]`;
    args1.push("-filter_complex", filterComplex1, "-map", "[outv]");
    args1.push(hasAudio ? (hasBg ? "-map" : "-map") : "-map", hasAudio ? (hasBg ? "2:a:0" : "1:a:0") : "0:a:0");
    args1.push("-c:v", "libx264", "-preset", "ultrafast", "-threads", "2", "-c:a", "aac", "-b:a", "128k", tempDynVideo);

    const editResult = spawnSync('ffmpeg', args1, { stdio: 'pipe', timeout: 120000 });
    if (fs.existsSync(raw10sVid)) fs.unlinkSync(raw10sVid);
    if (editResult.error || editResult.status !== 0 || !fs.existsSync(tempDynVideo)) return false;

    // STEP B: MERGE
    if (hasMainVideo) {
        console.log(`[>] [Step B] Merging with 'main_video.mp4'...`);
        let args2 = ["-y", "-i", tempDynVideo, "-i", staticVideo, "-filter_complex", "[0:v]scale=1280:720,setsar=1,fps=30,format=yuv420p[v0]; [0:a]aformat=sample_rates=44100:channel_layouts=stereo[a0]; [1:v]scale=1280:720,setsar=1,fps=30,format=yuv420p[v1]; [1:a]aformat=sample_rates=44100:channel_layouts=stereo[a1]; [v0][a0][v1][a1]concat=n=2:v=1:a=1[outv][outa]", "-map", "[outv]", "-map", "[outa]", "-c:v", "libx264", "-preset", "ultrafast", "-threads", "2", "-c:a", "aac", "-b:a", "128k", outputVid];
        const mergeResult = spawnSync('ffmpeg', args2, { stdio: 'pipe', timeout: 120000 });
        fs.unlinkSync(tempDynVideo); 
        if (!mergeResult.error && fs.existsSync(outputVid)) return true;
    } else {
        fs.renameSync(tempDynVideo, outputVid); return true;
    }
    return false;
}

// ==========================================
// 📤 WORKER 3: FACEBOOK UPLOAD 
// ==========================================
async function checkFacebookToken(token) { const res = await axios.get(`https://graph.facebook.com/v18.0/me?access_token=${token}&fields=id,name`); return { pageId: res.data.id, pageName: res.data.name }; }

async function worker_3_upload(videoPath, thumbPath, title, desc) {
    console.log(`\n[📤 Worker 3] Facebook Upload (Mode: ${TOKEN_SELECTION})`);
    let tokensToTry = TOKEN_SELECTION === 'Token1' ? [FB_TOKEN_1] : TOKEN_SELECTION === 'Token2' ? [FB_TOKEN_2] : [FB_TOKEN_1, FB_TOKEN_2]; 
    let activeToken = null, pageId = null;
    for (let token of tokensToTry) { if (!token) continue; try { const info = await checkFacebookToken(token); activeToken = token; pageId = info.pageId; break; } catch (e) { } }
    if (!activeToken) return false;

    try {
        const form = new FormData(); form.append('access_token', activeToken); form.append('title', title); form.append('description', desc); form.append('source', fs.createReadStream(videoPath));
        if (fs.existsSync(thumbPath)) form.append('thumb', fs.createReadStream(thumbPath));
        const uploadRes = await axios.post(`https://graph-video.facebook.com/v18.0/${pageId}/videos`, form, { headers: form.getHeaders() });
        await new Promise(r => setTimeout(r, 15000));
        
        const commentForm = new FormData(); commentForm.append('access_token', activeToken); commentForm.append('message', '📺 Watch Full Match Without Buffering Here: https://bulbul4u-live.xyz');
        if (fs.existsSync("comment_image.jpeg")) commentForm.append('source', fs.createReadStream("comment_image.jpeg"));
        await axios.post(`https://graph.facebook.com/v18.0/${uploadRes.data.id}/comments`, commentForm, { headers: commentForm.getHeaders() });
        console.log(`[✅] Upload & Comment Posted!`); return true;
    } catch (e) { return false; }
}

// ==========================================
// 🚀 CRASH MANAGER & MAIN HYBRID LOOP
// ==========================================
async function cleanup() {
    if (browser) { try { await browser.close(); console.log(`[🧹] Browser CLOSED to save RAM & CPU!`); } catch (e) { } browser = null; page = null; targetFrame = null; }
}

async function triggerNextRun() {
    const token = process.env.GH_PAT, repo = process.env.GITHUB_REPOSITORY, branch = process.env.GITHUB_REF_NAME || 'main'; if (!token || !repo) return;
    try { await axios.post(`https://api.github.com/repos/${repo}/actions/workflows/video_loop.yml/dispatches`, { ref: branch, inputs: { target_url: TARGET_URL, titles_list: TITLES_INPUT, descs_list: DESCS_INPUT, hashtags: HASHTAGS, token_selection: TOKEN_SELECTION } }, { headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' } }); console.log(`\n[🔄 AUTO-RESTART] Naya bot trigger kar diya gaya!`); } catch (e) { }
}

async function main() {
    console.log("\n==================================================");
    console.log(`   🚀 HYBRID SCREEN-RECORDING BOT (ECO-MODE)`);
    console.log(`   ⏰ STARTED AT: ${formatPKT()}`);
    console.log("==================================================");

    let nextRunTriggered = false;

    while (true) {
        const elapsedTimeMs = Date.now() - START_TIME;
        console.log(`\n--------------------------------------------------`);
        console.log(`--- 🔄 STARTING VIDEO CYCLE #${clipCounter} ---`);
        console.log(`  [-] Bot Uptime: ${Math.floor(elapsedTimeMs / 60000)} minutes`);
        console.log(`--------------------------------------------------`);

        if (elapsedTimeMs > RESTART_TRIGGER_MS && !nextRunTriggered) { await triggerNextRun(); nextRunTriggered = true; }
        if (elapsedTimeMs > END_TIME_LIMIT_MS) { console.log(`[🛑] 6 Hours Limit. Exiting.`); process.exit(0); }

        const meta = generateMetadata(clipCounter);
        const thumbFile = `studio_thumb_${clipCounter}.png`;
        const finalVidFile = `final_${clipCounter}.mp4`;

        try {
            // 1. FRESH BROWSER KHOLO (Pehle cycle mein true pass kiya debug ke liye)
            await initBrowserAndPlayer(clipCounter === 1); 
            
            // 2. SAB WORKERS CHALAO
            if (await worker_0_5_generate_thumbnail(meta.title, thumbFile)) {
                if (await worker_1_2_capture_and_edit(finalVidFile)) {
                    await worker_3_upload(finalVidFile, thumbFile, meta.title, meta.desc);
                }
            }
        } catch (err) {
            console.error(`\n[!] CRASH DETECTED IN CYCLE #${clipCounter}: ${err.message}`);
        } finally {
            // 3. HAMESHA BROWSER BAND KAR DO (Save GitHub Actions resources!)
            await cleanup();
            
            [thumbFile, finalVidFile].forEach(f => { if (fs.existsSync(f)) { fs.unlinkSync(f); } });
            console.log(`\n[⏳ Cycle End] Cycle #${clipCounter} Mukammal! Aglay round tak 5 minute wait kar raha hoon...`);
            clipCounter++;
            await new Promise(r => setTimeout(r, WAIT_TIME_MS)); // 5 MINUTE WAIT
        }
    }
}

main();
