
// # iss me eek issue hai yeh thumbanil measn caprue full website kar rah ahi 

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const axios = require('axios'); 

// ==========================================
// ⚙️ SETTINGS & ENVIRONMENT VARIABLES
// ==========================================
const TARGET_URL = process.env.TARGET_URL || 'https://dlstreams.com/watch.php?id=316';
const TITLES_INPUT = process.env.TITLES_LIST || 'Live Match Today,,Watch Full Match DC vs GT';
const DESCS_INPUT = process.env.DESCS_LIST || 'Watch the live action here';
const HASHTAGS = process.env.HASHTAGS || '#IPL2026 #DCvsGT #CricketLovers #LiveMatch';
const WAIT_TIME_MS = 300 * 1000; 
const START_TIME = Date.now();
const RESTART_TRIGGER_MS = (5 * 60 * 60 + 30 * 60) * 1000; 
const END_TIME_LIMIT_MS = (5 * 60 * 60 + 50 * 60) * 1000; 

let clipCounter = 1;
let browser = null;
let page = null;
let targetFrame = null;

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
// 🌐 SETUP BROWSER
// =========================================================================
async function initBrowserAndPlayer() {
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

    console.log(`[*] Navigating to target URL: ${TARGET_URL}...`);
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 10000)); 

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
}

// ==========================================
// 📸 THUMBNAIL GENERATOR (TITLE KE NAAM SE SAVE KAREGA)
// ==========================================
async function worker_generate_thumbnail(titleText) {
    console.log(`\n[🎨] Puppeteer se HD Thumbnail bana raha hoon...`);
    const rawFrame = 'temp_raw_frame.jpg';
    
    // 🛑 TITLE KO SAFE FILE NAME BANANA (A-Z, 0-9 aur space allow hai bas)
    let safeTitleName = titleText.replace(/[^a-zA-Z0-9 ]/g, "").trim().substring(0, 80);
    if (!safeTitleName) safeTitleName = `Live_Match_${Date.now()}`;
    const finalImageName = `${safeTitleName}.png`;

    try {
        const videoElement = await targetFrame.$('video[data-html5-video], video');
        if (videoElement) await videoElement.screenshot({ path: rawFrame, type: 'jpeg', quality: 90 });
        else await page.screenshot({ path: rawFrame, type: 'jpeg', quality: 90 });
    } catch (e) { return false; }
    if (!fs.existsSync(rawFrame)) return false;

    const b64Image = "data:image/jpeg;base64," + fs.readFileSync(rawFrame).toString('base64');
    const htmlCode = `<!DOCTYPE html><html><head><style>body { margin: 0; width: 1280px; height: 720px; background: #0f0f0f; font-family: sans-serif; color: white; display: flex; flex-direction: column; overflow: hidden; } .hero-container { position: relative; width: 100%; height: 440px; } .hero-img { width: 100%; height: 100%; object-fit: cover; filter: blur(5px); opacity: 0.6; } .pip-img { position: absolute; top: 20px; right: 40px; width: 45%; border: 6px solid white; box-shadow: -15px 15px 30px rgba(0,0,0,0.8); } .text-container { flex-grow: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 10px 40px; font-size: 70px; font-weight: 900; }</style></head><body><div class="hero-container"><img src="${b64Image}" class="hero-img"><img src="${b64Image}" class="pip-img"></div><div class="text-container">LIVE NOW: ${titleText}</div></body></html>`;

    const tb = await puppeteer.launch({ headless: true, defaultViewport: { width: 1280, height: 720 }, args: ['--no-sandbox'] });
    const tPage = await tb.newPage();
    await tPage.setContent(htmlCode);
    
    // IMAGE KO TITLE KE NAAM SE SAVE KAR RAHA HAI
    await tPage.screenshot({ path: finalImageName });
    await tb.close();
    if (fs.existsSync(rawFrame)) fs.unlinkSync(rawFrame); 
    
    console.log(`[✅] Image Ready aur Save ho gayi hai: ${finalImageName}`);
    return finalImageName;
}

// ==========================================
// 📤 UPLOAD WORKER: PYTHON SCRIPT CALL WITH FFMPEG RECORDING
// ==========================================
async function worker_upload(imagePath, title, desc, clipNum) {
    console.log(`\n[📤] Upload Data ready hai. Python DrissionPage script ko bula rahe hain...`);
    
    // Python script ko image ka naam aur text dena
    const postData = { image_path: imagePath, title: title, desc: desc };
    fs.writeFileSync('post_data.json', JSON.stringify(postData), 'utf-8');

    // SABOOT KE LIYE FFMPEG SCREEN RECORDING
    let proofVideoName = `upload_proof_cycle_${clipNum}_${Date.now()}.mp4`;
    console.log(`[🎥] Saboot Recording Start: ${proofVideoName}`);
    
    const displayNum = process.env.DISPLAY || ':99';
    const ffmpegArgs = [
        '-y', '-video_size', '1920x1080', '-framerate', '30',
        '-f', 'x11grab', '-i', displayNum,
        '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
        proofVideoName
    ];
    let ffmpegProc = spawn('ffmpeg', ffmpegArgs);
    await new Promise(r => setTimeout(r, 2000)); 

    // 🚀 PYTHON SCRIPT RUN KAREIN
    try {
        console.log("---------------- PYTHON DRISSIONPAGE LOGS ----------------");
        execSync('python facebook_upload.py', { stdio: 'inherit' });
        console.log("----------------------------------------------------------");
    } catch (error) {
        console.log(`[❌] Python script mein error aaya: ${error.message}`);
    }

    // RECORDING STOP KAREIN
    console.log(`[🎥] Saboot Recording stop kar rahe hain...`);
    try {
        ffmpegProc.kill('SIGINT');
        await new Promise(r => setTimeout(r, 4000)); 
    } catch(e){}

    // UPLOAD VIDEO SABOOT TO GITHUB RELEASES
    if (fs.existsSync(proofVideoName)) {
        console.log(`[📤 SABOOT] Upload Proof Video GitHub Releases par bhej raha hoon...`);
        try {
            const tagName = `upload-proof-${Date.now()}`;
            execSync(`gh release create ${tagName} "${proofVideoName}" --title "Upload Proof Cycle #${clipNum}" --notes "Facebook Python Image upload ka saboot."`, { stdio: 'inherit' });
            console.log('✅ [+] Successfully uploaded Video Saboot!');
        } catch (err) {
            console.log(`[❌] Upload proof upload fail ho gaya.`);
        }
        try { fs.unlinkSync(proofVideoName); } catch(e){}
    }
    
    try { fs.unlinkSync('post_data.json'); } catch(e){}
    return true;
}

// ==========================================
// 🚀 CRASH MANAGER & MAIN LOOP
// ==========================================
async function cleanup() {
    if (browser) { try { await browser.close(); } catch (e) { } browser = null; page = null; targetFrame = null; }
}

async function main() {
    console.log("\n==================================================");
    console.log(`   🚀 HYBRID BOT (IMAGE UPLOADER)`);
    console.log(`   ⏰ STARTED AT: ${formatPKT()}`);
    console.log("==================================================");

    let nextRunTriggered = false;

    while (true) {
        const elapsedTimeMs = Date.now() - START_TIME;
        console.log(`\n--- 🔄 STARTING CYCLE #${clipCounter} ---`);
        
        if (elapsedTimeMs > END_TIME_LIMIT_MS) { process.exit(0); }

        const meta = generateMetadata(clipCounter);

        try {
            await initBrowserAndPlayer(); 
            // Thumbnail banayega aur uska naam 'title.png' rakhega
            const generatedImageName = await worker_generate_thumbnail(meta.title);
            
            // Browser band kar dena taake RAM free ho aur Python use kar sakay
            await cleanup();

            if (generatedImageName && fs.existsSync(generatedImageName)) {
                await worker_upload(generatedImageName, meta.title, meta.desc, clipCounter);
                
                // Upload hone ke baad image delete kardo
                try { fs.unlinkSync(generatedImageName); } catch(e){}
            }
        } catch (err) {
            console.error(`\n[!] CRASH DETECTED IN CYCLE #${clipCounter}: ${err.message}`);
        } finally {
            await cleanup();
            console.log(`\n[⏳] Cycle #${clipCounter} Mukammal! Aglay round tak wait...`);
            clipCounter++;
            await new Promise(r => setTimeout(r, WAIT_TIME_MS)); 
        }
    }
}

main();












// # ====== yeh below vide upload karta hai facebook mei lekin kucj issue hai step1 complet karta hai box open karat hai title(description) bey write kardeta hai video mei post kar deta hai lekin wahat par video facebook naehy leta hai qunkysome issue pehely aap isko locally test karo, how to upload video on facebook manually through bot =========================

// const puppeteer = require('puppeteer-extra');
// const StealthPlugin = require('puppeteer-extra-plugin-stealth');
// puppeteer.use(StealthPlugin());

// const { spawn, execSync } = require('child_process');
// const fs = require('fs');
// const axios = require('axios'); 
// const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');

// const TARGET_URL = process.env.TARGET_URL || 'https://dlstreams.com/watch.php?id=316';
// const TITLES_INPUT = process.env.TITLES_LIST || 'Live Match Today,,Watch Full Match DC vs GT';
// const DESCS_INPUT = process.env.DESCS_LIST || 'Watch the live action here';
// const HASHTAGS = process.env.HASHTAGS || '#IPL2026 #DCvsGT #CricketLovers #LiveMatch';
// const WAIT_TIME_MS = 300 * 1000; 
// const START_TIME = Date.now();
// const RESTART_TRIGGER_MS = (5 * 60 * 60 + 30 * 60) * 1000; 
// const END_TIME_LIMIT_MS = (5 * 60 * 60 + 50 * 60) * 1000; 

// let clipCounter = 1;
// let browser = null;
// let page = null;
// let targetFrame = null;

// function formatPKT(timestampMs = Date.now()) {
//     return new Date(timestampMs).toLocaleString('en-US', {
//         timeZone: 'Asia/Karachi', hour12: true, year: 'numeric', month: 'short',
//         day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
//     }) + " PKT";
// }

// function generateMetadata(clipNum) {
//     const titles = TITLES_INPUT.split(',,').map(t => t.trim()).filter(t => t);
//     const descs = DESCS_INPUT.split(',,').map(d => d.trim()).filter(d => d);
//     const title = titles.length ? titles[Math.floor(Math.random() * titles.length)] : "Live Match";
//     const descBody = descs.length ? descs[Math.floor(Math.random() * descs.length)] : "Watch live!";
//     const emojis = ["🔥", "🏏", "⚡", "🏆", "💥", "😱", "📺", "🚀"].sort(() => 0.5 - Math.random()).slice(0, 3);
//     const tags = HASHTAGS.split(' ').sort(() => 0.5 - Math.random()).slice(0, 4).join(' ');
    
//     const finalTitle = title.substring(0, 240); 
//     const finalDesc = `${finalTitle} ${emojis.join(' ')}\n\n${descBody}\n\n⏱️ Update: ${formatPKT()}\n👇 Watch Full Match Link in First Comment!\n\n${tags}`;
//     return { title: finalTitle, desc: finalDesc };
// }

// async function initBrowserAndPlayer(isFirstCycle) {
//     console.log(`\n[*] Starting FRESH browser instance...`);
//     browser = await puppeteer.launch({
//         channel: 'chrome', headless: false, 
//         defaultViewport: { width: 1280, height: 720 },
//         ignoreDefaultArgs: ['--enable-automation'], 
//         args: [ '--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,720', '--kiosk', '--autoplay-policy=no-user-gesture-required', '--mute-audio' ]
//     });
//     page = await browser.newPage();
//     const pages = await browser.pages();
//     for (const p of pages) if (p !== page) await p.close();

//     console.log(`[*] Navigating to target URL: ${TARGET_URL}...`);
//     await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
//     await new Promise(r => setTimeout(r, 10000)); 

//     for (const frame of page.frames()) {
//         try {
//             const isRealLiveStream = await frame.evaluate(() => {
//                 const vid = document.querySelector('video[data-html5-video]') || document.querySelector('video');
//                 return vid && vid.clientWidth > 300; 
//             });
//             if (isRealLiveStream) {
//                 targetFrame = frame;
//                 await frame.evaluate(() => { const fAd = document.getElementById('floated'); if (fAd) fAd.remove(); });
//             }
//         } catch (e) { }
//     }
//     if (!targetFrame) throw new Error('No <video> element could be found.');

//     try {
//         const iframeEl = await targetFrame.frameElement();
//         const box = await iframeEl.boundingBox();
//         if (box) await page.mouse.click(box.x + (box.width / 2), box.y + (box.height / 2), { delay: 100 });
//         await new Promise(r => setTimeout(r, 2000));
//     } catch (e) { }

//     await targetFrame.evaluate(async () => {
//         const video = document.querySelector('video[data-html5-video]') || document.querySelector('video');
//         if (video) { video.volume = 1.0; await video.play().catch(e => {}); }
//     });

//     await targetFrame.evaluate(async () => {
//         const vid = document.querySelector('video[data-html5-video]') || document.querySelector('video');
//         if (!vid) return;
//         try { if (vid.requestFullscreen) await vid.requestFullscreen(); else if (vid.webkitRequestFullscreen) await vid.webkitRequestFullscreen(); } 
//         catch (err) { vid.style.position = 'fixed'; vid.style.top = '0'; vid.style.left = '0'; vid.style.width = '100vw'; vid.style.height = '100vh'; vid.style.zIndex = '2147483647'; vid.style.backgroundColor = 'black'; }
//     });
// }

// async function worker_0_5_generate_thumbnail(titleText, outputImagePath) {
//     console.log(`\n[🎨 Worker 0.5] Puppeteer se HD Thumbnail bana raha hoon...`);
//     const rawFrame = 'temp_raw_frame.jpg';
//     try {
//         const videoElement = await targetFrame.$('video[data-html5-video], video');
//         if (videoElement) await videoElement.screenshot({ path: rawFrame, type: 'jpeg', quality: 90 });
//         else await page.screenshot({ path: rawFrame, type: 'jpeg', quality: 90 });
//     } catch (e) { return false; }
//     if (!fs.existsSync(rawFrame)) return false;

//     const b64Image = "data:image/jpeg;base64," + fs.readFileSync(rawFrame).toString('base64');
//     const htmlCode = `<!DOCTYPE html><html><head><style>body { margin: 0; width: 1280px; height: 720px; background: #0f0f0f; font-family: sans-serif; color: white; display: flex; flex-direction: column; overflow: hidden; } .hero-container { position: relative; width: 100%; height: 440px; } .hero-img { width: 100%; height: 100%; object-fit: cover; filter: blur(5px); opacity: 0.6; } .pip-img { position: absolute; top: 20px; right: 40px; width: 45%; border: 6px solid white; box-shadow: -15px 15px 30px rgba(0,0,0,0.8); } .text-container { flex-grow: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 10px 40px; font-size: 70px; font-weight: 900; }</style></head><body><div class="hero-container"><img src="${b64Image}" class="hero-img"><img src="${b64Image}" class="pip-img"></div><div class="text-container">LIVE NOW: ${titleText}</div></body></html>`;

//     const tb = await puppeteer.launch({ headless: true, defaultViewport: { width: 1280, height: 720 }, args: ['--no-sandbox'] });
//     const tPage = await tb.newPage();
//     await tPage.setContent(htmlCode);
//     await tPage.screenshot({ path: outputImagePath });
//     await tb.close();
//     if (fs.existsSync(rawFrame)) fs.unlinkSync(rawFrame); 
    
//     try {
//         const tagName = `thumb-proof-${Date.now()}`;
//         execSync(`gh release create ${tagName} "${outputImagePath}" --title "Thumbnail Proof Capture" --notes "Cycle #${clipCounter} Thumbnail Saboot."`, { stdio: 'inherit' });
//     } catch (err) {}
//     return true;
// }

// async function runFFmpegEditAsync(args, stepName) {
//     return new Promise((resolve) => {
//         const ffmpegProc = spawn('ffmpeg', args);
//         ffmpegProc.on('close', (code) => { resolve(code === 0); });
//     });
// }

// async function worker_1_2_capture_and_edit(outputVid) {
//     console.log(`\n[🎬 Worker 1 & 2] Puppeteer Recording & Fast Edit shuru ho raha hai...`);
//     const raw10sVid = `raw_screen_${Date.now()}.mp4`; 
//     try {
//         const recorder = new PuppeteerScreenRecorder(page, { fps: 30 });
//         await recorder.start(raw10sVid);
//         await new Promise(r => setTimeout(r, 10000)); 
//         await recorder.stop();
//     } catch (e) { return false; }

//     await cleanup(); 

//     console.log(`\n[>] Editing video...`);
//     let args1 = ["-y", "-i", raw10sVid, "-vf", "scale=1280:720,format=yuv420p", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-b:a", "128k", "-t", "10", outputVid];
//     const editSuccess = await runFFmpegEditAsync(args1, "Apply Filters");
//     if (fs.existsSync(raw10sVid)) fs.unlinkSync(raw10sVid); 
//     return editSuccess && fs.existsSync(outputVid);
// }

// // ==========================================
// // 📤 WORKER 3: PYTHON SCRIPT CALL WITH FFMPEG RECORDING
// // ==========================================
// async function worker_3_upload(videoPath, thumbPath, title, desc, clipNum) {
//     console.log(`\n[📤 Worker 3] Upload Data ready hai. Python DrissionPage script ko bula rahe hain...`);
    
//     // Python script ko data dene k liye JSON banayen
//     const postData = { video_path: videoPath, thumb_path: thumbPath, title: title, desc: desc };
//     fs.writeFileSync('post_data.json', JSON.stringify(postData), 'utf-8');

//     // SABOOT KE LIYE FFMPEG SCREEN RECORDING (Virtual Xvfb Screen ki full recording)
//     let proofVideoName = `upload_proof_cycle_${clipNum}_${Date.now()}.mp4`;
//     console.log(`[🎥] Saboot Recording Start: ${proofVideoName}`);
    
//     const displayNum = process.env.DISPLAY || ':99';
//     const ffmpegArgs = [
//         '-y', '-video_size', '1280x720', '-framerate', '30',
//         '-f', 'x11grab', '-i', displayNum,
//         '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
//         proofVideoName
//     ];
//     let ffmpegProc = spawn('ffmpeg', ffmpegArgs);
//     await new Promise(r => setTimeout(r, 2000)); // Recording start hone ka waqt dein

//     // 🚀 PYTHON SCRIPT RUN KAREIN
//     try {
//         console.log("---------------- PYTHON DRISSIONPAGE LOGS ----------------");
//         execSync('python facebook_upload.py', { stdio: 'inherit' });
//         console.log("----------------------------------------------------------");
//     } catch (error) {
//         console.log(`[❌] Python script mein error aaya: ${error.message}`);
//     }

//     // RECORDING STOP KAREIN
//     console.log(`[🎥] Saboot Recording stop kar rahe hain...`);
//     try {
//         ffmpegProc.kill('SIGINT');
//         await new Promise(r => setTimeout(r, 4000)); // Video save hone dein
//     } catch(e){}

//     // UPLOAD VIDEO TO GITHUB RELEASES
//     if (fs.existsSync(proofVideoName)) {
//         console.log(`[📤 SABOOT] Upload Proof Video GitHub Releases par upload ho rahi hai...`);
//         try {
//             const tagName = `upload-proof-${Date.now()}`;
//             execSync(`gh release create ${tagName} "${proofVideoName}" --title "Upload Proof Cycle #${clipNum}" --notes "Facebook Python web automation upload ka saboot."`, { stdio: 'inherit' });
//             console.log('✅ [+] Successfully uploaded Video Saboot to GitHub Releases!');
//         } catch (err) {
//             console.log(`[❌] Upload proof upload fail ho gaya.`);
//         }
//         try { fs.unlinkSync(proofVideoName); } catch(e){}
//     }
//     try { fs.unlinkSync('post_data.json'); } catch(e){}

//     return true;
// }

// // ==========================================
// // 🚀 CRASH MANAGER & MAIN HYBRID LOOP
// // ==========================================
// async function cleanup() {
//     if (browser) { try { await browser.close(); } catch (e) { } browser = null; page = null; targetFrame = null; }
// }

// async function triggerNextRun() {
//     const token = process.env.GH_PAT, repo = process.env.GITHUB_REPOSITORY, branch = process.env.GITHUB_REF_NAME || 'main'; if (!token || !repo) return;
//     try { await axios.post(`https://api.github.com/repos/${repo}/actions/workflows/video_loop.yml/dispatches`, { ref: branch, inputs: { target_url: TARGET_URL, titles_list: TITLES_INPUT, descs_list: DESCS_INPUT, hashtags: HASHTAGS } }, { headers: { 'Authorization': `token ${token}` } }); console.log(`\n[🔄 AUTO-RESTART] Naya bot trigger kar diya gaya!`); } catch (e) { }
// }

// async function main() {
//     console.log("\n==================================================");
//     console.log(`   🚀 HYBRID BOT (PYTHON DRISSIONPAGE UPLOADER)`);
//     console.log(`   ⏰ STARTED AT: ${formatPKT()}`);
//     console.log("==================================================");

//     let nextRunTriggered = false;

//     while (true) {
//         const elapsedTimeMs = Date.now() - START_TIME;
//         console.log(`\n--- 🔄 STARTING VIDEO CYCLE #${clipCounter} ---`);
//         if (elapsedTimeMs > RESTART_TRIGGER_MS && !nextRunTriggered) { await triggerNextRun(); nextRunTriggered = true; }
//         if (elapsedTimeMs > END_TIME_LIMIT_MS) { process.exit(0); }

//         const meta = generateMetadata(clipCounter);
//         const thumbFile = `studio_thumb_${clipCounter}.png`;
//         const finalVidFile = `final_${clipCounter}.mp4`;

//         try {
//             await initBrowserAndPlayer(clipCounter === 1); 
//             await worker_0_5_generate_thumbnail(meta.title, thumbFile);
            
//             if (await worker_1_2_capture_and_edit(finalVidFile)) {
//                 await worker_3_upload(finalVidFile, thumbFile, meta.title, meta.desc, clipCounter);
//             }
//         } catch (err) {
//             console.error(`\n[!] CRASH DETECTED IN CYCLE #${clipCounter}: ${err.message}`);
//         } finally {
//             await cleanup();
//             [thumbFile, finalVidFile].forEach(f => { if (fs.existsSync(f)) { fs.unlinkSync(f); } });
//             console.log(`\n[⏳] Cycle #${clipCounter} Mukammal! Aglay round tak 5 min wait...`);
//             clipCounter++;
//             await new Promise(r => setTimeout(r, WAIT_TIME_MS)); 
//         }
//     }
// }

// main();






// # ====== yeh below vide upload karta hai facebook mei lekin kucj issue hai step1 complet karta hai box open karat hai title(description) bey write kardeta hai video mei post kar deta hai lekin wahat par video facebook naehy leta hai qunkysome issue pehely aap isko locally test karo, how to upload video on facebook manually through bot, iss mei bey same issue hai lekin yeh sab kuch akelaa karta hai iskoo facebook_upload.py file k zaroorat nahey  =========================


// const puppeteer = require('puppeteer-extra');
// const StealthPlugin = require('puppeteer-extra-plugin-stealth');
// puppeteer.use(StealthPlugin());

// const { spawn, execSync } = require('child_process');
// const fs = require('fs');
// const FormData = require('form-data');
// const axios = require('axios'); 
// const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');

// // ==========================================
// // ⚙️ SETTINGS & ENVIRONMENT VARIABLES
// // ==========================================
// const TARGET_URL = process.env.TARGET_URL || 'https://dlstreams.com/watch.php?id=316';

// const TITLES_INPUT = process.env.TITLES_LIST || 'Live Match Today,,Watch Full Match DC vs GT';
// const DESCS_INPUT = process.env.DESCS_LIST || 'Watch the live action here';
// const HASHTAGS = process.env.HASHTAGS || '#IPL2026 #DCvsGT #CricketLovers #LiveMatch';

// const WAIT_TIME_MS = 300 * 1000; // 5 Minutes loop wait
// const START_TIME = Date.now();
// const RESTART_TRIGGER_MS = (5 * 60 * 60 + 30 * 60) * 1000; // 5.5 Hours
// const END_TIME_LIMIT_MS = (5 * 60 * 60 + 50 * 60) * 1000; // 5.8 Hours

// let clipCounter = 1;

// // 🌐 BROWSER VARIABLES
// let browser = null;
// let page = null;
// let targetFrame = null;

// function formatPKT(timestampMs = Date.now()) {
//     return new Date(timestampMs).toLocaleString('en-US', {
//         timeZone: 'Asia/Karachi', hour12: true, year: 'numeric', month: 'short',
//         day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
//     }) + " PKT";
// }

// function generateMetadata(clipNum) {
//     const titles = TITLES_INPUT.split(',,').map(t => t.trim()).filter(t => t);
//     const descs = DESCS_INPUT.split(',,').map(d => d.trim()).filter(d => d);
//     const title = titles.length ? titles[Math.floor(Math.random() * titles.length)] : "Live Match";
//     const descBody = descs.length ? descs[Math.floor(Math.random() * descs.length)] : "Watch live!";
//     const emojis = ["🔥", "🏏", "⚡", "🏆", "💥", "😱", "📺", "🚀"].sort(() => 0.5 - Math.random()).slice(0, 3);
//     const tags = HASHTAGS.split(' ').sort(() => 0.5 - Math.random()).slice(0, 4).join(' ');
    
//     const finalTitle = title.substring(0, 240); 
//     const finalDesc = `${finalTitle} ${emojis.join(' ')}\n\n${descBody}\n\n⏱️ Update: ${formatPKT()}\n👇 Watch Full Match Link in First Comment!\n\n${tags}`;
//     return { title: finalTitle, desc: finalDesc };
// }

// // =========================================================================
// // 🌐 SETUP BROWSER (Runs Fresh Every Cycle)
// // =========================================================================
// async function initBrowserAndPlayer(isFirstCycle) {
//     console.log(`\n[*] Starting FRESH browser instance...`);
    
//     browser = await puppeteer.launch({
//         channel: 'chrome', headless: false, 
//         defaultViewport: { width: 1280, height: 720 },
//         ignoreDefaultArgs: ['--enable-automation'], 
//         args: [ '--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,720', '--kiosk', '--autoplay-policy=no-user-gesture-required', '--mute-audio' ]
//     });

//     page = await browser.newPage();
//     const pages = await browser.pages();
//     for (const p of pages) if (p !== page) await p.close();

//     browser.on('targetcreated', async (target) => {
//         if (target.type() === 'page') {
//             try { const newPage = await target.page(); if (newPage && newPage !== page) { await page.bringToFront(); setTimeout(() => newPage.close().catch(() => {}), 1000); } } catch (e) { }
//         }
//     });

//     console.log(`[*] Navigating to target URL: ${TARGET_URL}...`);
//     await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
//     await new Promise(r => setTimeout(r, 10000)); 

//     console.log('[*] Scanning iframes for the REAL Live Stream Video...');
//     for (const frame of page.frames()) {
//         try {
//             const isRealLiveStream = await frame.evaluate(() => {
//                 const vid = document.querySelector('video[data-html5-video]') || document.querySelector('video');
//                 return vid && vid.clientWidth > 300; 
//             });
//             if (isRealLiveStream) {
//                 targetFrame = frame;
//                 await frame.evaluate(() => { const fAd = document.getElementById('floated'); if (fAd) fAd.remove(); });
//             }
//         } catch (e) { }
//     }

//     if (!targetFrame) throw new Error('No <video> element could be found.');

//     try {
//         const iframeEl = await targetFrame.frameElement();
//         const box = await iframeEl.boundingBox();
//         if (box) await page.mouse.click(box.x + (box.width / 2), box.y + (box.height / 2), { delay: 100 });
//         await new Promise(r => setTimeout(r, 2000));
//     } catch (e) { }

//     await targetFrame.evaluate(async () => {
//         const video = document.querySelector('video[data-html5-video]') || document.querySelector('video');
//         if (video) { video.volume = 1.0; await video.play().catch(e => {}); }
//     });

//     await targetFrame.evaluate(async () => {
//         const vid = document.querySelector('video[data-html5-video]') || document.querySelector('video');
//         if (!vid) return;
//         try {
//             if (vid.requestFullscreen) await vid.requestFullscreen();
//             else if (vid.webkitRequestFullscreen) await vid.webkitRequestFullscreen();
//         } catch (err) {
//             vid.style.position = 'fixed'; vid.style.top = '0'; vid.style.left = '0';
//             vid.style.width = '100vw'; vid.style.height = '100vh'; vid.style.zIndex = '2147483647'; vid.style.backgroundColor = 'black'; vid.style.objectFit = 'contain';
//         }
//     });

//     console.log('[✅] Browser Ready! Video is playing fullscreen.');

//     if (isFirstCycle) {
//         console.log(`\n[🔍 DEBUG] Cycle 1 par 15-second ki Visual Debug Recording kar raha hoon...`);
//         const recorder = new PuppeteerScreenRecorder(page);
//         const debugFileName = `debug_video_${Date.now()}.mp4`;
//         await recorder.start(debugFileName);
        
//         await new Promise(r => setTimeout(r, 15000)); 
//         await recorder.stop();
        
//         console.log(`[📤 DEBUG] Uploading to GitHub Releases...`);
//         try {
//             const tagName = `visual-debug-${Date.now()}`;
//             execSync(`gh release create ${tagName} ${debugFileName} --title "Visual Debug Capture" --notes "First Cycle Screen Check"`, { stdio: 'inherit' });
//             console.log('✅ [+] Successfully uploaded visual debug video to GitHub Releases!');
//         } catch (err) {}
//         if (fs.existsSync(debugFileName)) fs.unlinkSync(debugFileName);
//     }
// }

// // ==========================================
// // 📸 WORKER 0.5: GENERATE THUMBNAIL
// // ==========================================
// async function worker_0_5_generate_thumbnail(titleText, outputImagePath) {
//     console.log(`\n[🎨 Worker 0.5] Puppeteer se HD Thumbnail bana raha hoon...`);
//     const rawFrame = 'temp_raw_frame.jpg';
    
//     try {
//         console.log(`[>] Sirf video player ka frame extract kar raha hoon...`);
//         const videoElement = await targetFrame.$('video[data-html5-video], video');
//         if (videoElement) {
//             await videoElement.screenshot({ path: rawFrame, type: 'jpeg', quality: 90 });
//         } else {
//             await page.screenshot({ path: rawFrame, type: 'jpeg', quality: 90 });
//         }
//     } catch (e) {
//         console.log(`[❌] Screenshot lene mein masla: ${e.message}`);
//         return false;
//     }

//     if (!fs.existsSync(rawFrame)) return false;
//     const b64Image = "data:image/jpeg;base64," + fs.readFileSync(rawFrame).toString('base64');
    
//     const htmlCode = `<!DOCTYPE html><html><head><link href="https://fonts.googleapis.com/css2?family=Roboto:wght@700;900&display=swap" rel="stylesheet"><style>body { margin: 0; width: 1280px; height: 720px; background: #0f0f0f; font-family: 'Roboto', sans-serif; color: white; display: flex; flex-direction: column; overflow: hidden; } .header { height: 100px; display: flex; align-items: center; padding: 0 40px; justify-content: space-between; z-index: 10; } .logo { font-size: 50px; font-weight: 900; letter-spacing: 1px; text-shadow: 0 0 10px rgba(255,255,255,0.8); } .live-badge { border: 4px solid #cc0000; border-radius: 12px; padding: 5px 20px; font-size: 40px; font-weight: 700; display: flex; gap: 10px; } .hero-container { position: relative; width: 100%; height: 440px; } .hero-img { width: 100%; height: 100%; object-fit: cover; filter: blur(5px); opacity: 0.6; } .pip-img { position: absolute; top: 20px; right: 40px; width: 45%; border: 6px solid white; box-shadow: -15px 15px 30px rgba(0,0,0,0.8); } .text-container { position: relative; z-index: 999; flex-grow: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 10px 40px; } .main-title { font-size: 70px; font-weight: 900; line-height: 1.1; text-shadow: 6px 6px 15px rgba(0,0,0,0.9); } .live-text { color: #cc0000; }</style></head><body><div class="header"><div class="logo">SPORTSHUB</div><div class="live-badge"><span style="color:#cc0000">●</span> LIVE</div></div><div class="hero-container"><img src="${b64Image}" class="hero-img"><img src="${b64Image}" class="pip-img"></div><div class="text-container"><div class="main-title"><span class="live-text">LIVE NOW: </span>${titleText}</div></div></body></html>`;

//     const tb = await puppeteer.launch({ headless: true, defaultViewport: { width: 1280, height: 720 }, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
//     const tPage = await tb.newPage();
//     await tPage.setContent(htmlCode);
//     await tPage.screenshot({ path: outputImagePath });
//     await tb.close();
//     if (fs.existsSync(rawFrame)) fs.unlinkSync(rawFrame); 
//     console.log(`[✅ Worker 0.5] Thumbnail Ready: ${outputImagePath}`);

//     console.log(`[📤 SABOOT] Professional Saboot (Thumbnail) GitHub Releases par upload kar raha hoon...`);
//     try {
//         const tagName = `thumb-proof-${Date.now()}`;
//         execSync(`gh release create ${tagName} "${outputImagePath}" --title "Thumbnail Proof Capture" --notes "Cycle #${clipCounter} ke liye banaya gaya HD Thumbnail Saboot."`, { stdio: 'inherit' });
//         console.log('✅ [+] Successfully uploaded Thumbnail Saboot to GitHub Releases!');
//     } catch (err) {
//         console.log(`[❌] Thumbnail saboot upload fail ho gaya. Error: ${err.message}`);
//     }

//     return true;
// }

// // ==========================================
// // 🛠️ ASYNC FFMPEG EXECUTOR
// // ==========================================
// async function runFFmpegEditAsync(args, stepName) {
//     return new Promise((resolve) => {
//         const ffmpegProc = spawn('ffmpeg', args);
//         let lastLogTime = Date.now();
//         let errorLog = "";

//         ffmpegProc.stderr.on('data', (data) => {
//             const output = data.toString().trim();
//             errorLog = output; 
//             if (Date.now() - lastLogTime > 3000) {
//                 if (output.includes('time=')) console.log(`[FFmpeg ${stepName}]: ${output.substring(0, 100)}...`);
//                 lastLogTime = Date.now();
//             }
//         });

//         ffmpegProc.on('close', (code) => {
//             if (code === 0) { 
//                 console.log(`[✅] ${stepName} Completed Successfully!`); 
//                 resolve(true); 
//             } else { 
//                 console.log(`[❌] ${stepName} Failed! Reason: \n${errorLog}`); 
//                 resolve(false); 
//             }
//         });
//     });
// }

// // ==========================================
// // 🎥 WORKER 1 & 2: THE NEW FLAWLESS CAPTURE & EDIT
// // ==========================================
// async function worker_1_2_capture_and_edit(outputVid) {
//     console.log(`\n[🎬 Worker 1 & 2] Puppeteer Recording & Fast Edit shuru ho raha hai...`);
//     const audioFile = "marya_live.mp3"; const bgImage = "website_frame.png"; const staticVideo = "main_video.mp4"; 
//     const blurAmount = "15:3"; const duration = "10";
    
//     const hasBg = fs.existsSync(bgImage); const hasAudio = fs.existsSync(audioFile); const hasMainVideo = fs.existsSync(staticVideo);
//     const raw10sVid = `raw_screen_${Date.now()}.mp4`; const tempDynVideo = `temp_dyn_${Date.now()}.mp4`; 

//     console.log(`\n[>] [Step 0] Recording 10 seconds of LIVE Fullscreen using Puppeteer...`);
//     try {
//         const recorder = new PuppeteerScreenRecorder(page, { fps: 30 });
//         await recorder.start(raw10sVid);
//         await new Promise(r => setTimeout(r, 10000)); 
//         await recorder.stop();
//         console.log(`[✅] Step 0 Done! Smooth 10s video captured.`);
//     } catch (e) {
//         console.log(`[❌] Puppeteer recording failed: ${e.message}`);
//         return false;
//     }

//     if (!fs.existsSync(raw10sVid) || fs.statSync(raw10sVid).size < 1000) return false;

//     console.log(`[🧹 ECO-MODE] Screen capture done. Closing browser to free up RAM before heavy processing...`);
//     await cleanup(); 

//     console.log(`\n[>] [Step A] Applying Blur & PiP Frame on recorded clip...`);
//     let args1 = ["-y", "-thread_queue_size", "1024", "-i", raw10sVid]; 
//     if (hasBg) args1.push("-thread_queue_size", "1024", "-loop", "1", "-framerate", "30", "-i", bgImage);
//     if (hasAudio) args1.push("-thread_queue_size", "1024", "-stream_loop", "-1", "-i", audioFile);
    
//     let filterComplex1 = hasBg 
//         ? `[0:v]setpts=PTS-STARTPTS,fps=30,scale=1064:565,boxblur=${blurAmount}[pip]; [1:v]setpts=PTS-STARTPTS,fps=30[bg]; [bg][pip]overlay=0:250:shortest=1,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p[outv]` 
//         : `[0:v]setpts=PTS-STARTPTS,fps=30,scale=1280:720,boxblur=${blurAmount},format=yuv420p[outv]`;
        
//     args1.push("-filter_complex", filterComplex1, "-map", "[outv]");
    
//     if (hasAudio) {
//         let audioIndex = hasBg ? 2 : 1;
//         args1.push("-map", `${audioIndex}:a:0`, "-af", "aresample=async=1");
//     } else {
//         args1.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100", "-map", "1:a:0");
//     }
    
//     args1.push("-c:v", "libx264", "-preset", "ultrafast", "-threads", "2", "-vsync", "1", "-c:a", "aac", "-b:a", "128k", "-t", duration, tempDynVideo);

//     const editSuccess = await runFFmpegEditAsync(args1, "Apply Filters");
//     if (fs.existsSync(raw10sVid)) fs.unlinkSync(raw10sVid); 
    
//     if (!editSuccess || !fs.existsSync(tempDynVideo)) return false;

//     if (hasMainVideo) {
//         console.log(`\n[>] [Step B] Merging with 'main_video.mp4'...`);
//         let args2 = ["-y", "-i", tempDynVideo, "-i", staticVideo, "-filter_complex", "[0:v]scale=1280:720,setsar=1,fps=30,format=yuv420p[v0]; [0:a]aformat=sample_rates=44100:channel_layouts=stereo[a0]; [1:v]scale=1280:720,setsar=1,fps=30,format=yuv420p[v1]; [1:a]aformat=sample_rates=44100:channel_layouts=stereo[a1]; [v0][a0][v1][a1]concat=n=2:v=1:a=1[outv][outa]", "-map", "[outv]", "-map", "[outa]", "-c:v", "libx264", "-preset", "ultrafast", "-threads", "2", "-vsync", "1", "-c:a", "aac", "-b:a", "128k", outputVid];
        
//         const mergeSuccess = await runFFmpegEditAsync(args2, "Merge Video");
//         fs.unlinkSync(tempDynVideo); 
        
//         if (mergeSuccess && fs.existsSync(outputVid)) return true;
//     } else {
//         console.log(`[⚠️] 'main_video.mp4' nahi mili! Sirf edited clip final bani.`);
//         fs.renameSync(tempDynVideo, outputVid); return true;
//     }
//     return false;
// }

// // ==========================================
// // 📤 WORKER 3: EXACT PROJECT 1 WEB AUTOMATION LOGIC (WITH RECORDING & EXTENDED WAIT)
// // ==========================================
// async function worker_3_upload(videoPath, thumbPath, title, desc, clipNum) {
//     console.log(`\n[📤 Worker 3] Facebook Web Automation Upload (Cycle #${clipNum})`);
    
//     const cookiesJson = process.env.FB_COOKIES;
//     if (!cookiesJson) {
//         console.log("❌ Error: FB_COOKIES secret nahi mila!");
//         return false;
//     }

//     let cookies;
//     try {
//         cookies = JSON.parse(cookiesJson);
//     } catch (e) {
//         console.log("❌ Error: FB_COOKIES sahi JSON format mein nahi hai!");
//         return false;
//     }

//     console.log("🚀 Script Start... Browser khul raha hai...");
    
//     const fbBrowser = await puppeteer.launch({
//         channel: 'chrome', headless: false,
//         defaultViewport: { width: 1920, height: 1080 },
//         ignoreDefaultArgs: ['--enable-automation'],
//         args: [
//             '--no-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080',
//             '--test-type', '--disable-infobars', '--disable-blink-features=AutomationControlled',
//             '--password-store=basic', '--disable-notifications', '--log-level=3', '--disable-logging',
//             '--mute-audio'
//         ]
//     });

//     const fbPage = await fbBrowser.newPage();
//     await fbPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

//     // 🎥 SABOOT KE LIYE SCREEN RECORDING SETUP
//     let uploadRecorder = null;
//     let proofVideoName = `upload_proof_cycle_${clipNum}_${Date.now()}.mp4`;

//     try {
//         // Start Video Recording for Proof
//         uploadRecorder = new PuppeteerScreenRecorder(fbPage, { fps: 30 });
//         await uploadRecorder.start(proofVideoName);
//         console.log(`[🎥] Saboot ke liye Screen Recording shuru ho gayi hai: ${proofVideoName}`);

//         // ==========================================
//         // LOGIN PROCESS
//         // ==========================================
//         console.log("🌐 Facebook par ja rahe hain...");
//         await fbPage.goto("https://www.facebook.com/404", { waitUntil: 'domcontentloaded' });
//         await new Promise(r => setTimeout(r, 3000));

//         const formattedCookies = cookies.filter(c => c.domain && c.domain.includes('facebook.com')).map(c => ({
//             name: c.name, value: c.value, domain: c.domain, path: c.path || '/'
//         }));
//         await fbPage.setCookie(...formattedCookies);

//         await fbPage.goto("https://www.facebook.com/", { waitUntil: 'networkidle2' });
        
//         const titleText = await fbPage.title();
//         if (titleText.toLowerCase().includes("log in") || titleText.toLowerCase().includes("login")) {
//             console.log("❌ Login Failed! Cookies expire ho chuki hain.");
//             return false;
//         }
//         console.log("✅ Login Successful!");

//         // ==========================================
//         // SMART WAIT: PAGE LOAD CHECK
//         // ==========================================
//         console.log("⏳ Wait kar rahe hain taake page aur post box puri tarah load ho jaye...");
//         await new Promise(r => setTimeout(r, 5000)); 

//         const postBoxXPath = '//div[contains(@aria-label, "What\'s on your mind") or contains(@aria-label, "Create a post") or contains(@aria-label, "Write something")]';
        
//         try {
//             await fbPage.waitForXPath(postBoxXPath, { timeout: 15000 });
//             console.log("✅ Page loaded! Post box screen par aagaya hai.");
//         } catch (e) {
//             console.log("❌ Timeout: Post box screen par nahi aaya.");
//             return false;
//         }

//         // ==========================================
//         // STEP 1: CREATE POST POPUP KHOLNA (ZIDDI CLICKER)
//         // ==========================================
//         console.log("▶️ STEP 1: 'What's on your mind?' wale box ko dhoond kar click kar rahe hain...");
//         let popupOpened = false;
//         const postBoxes = await fbPage.$x(postBoxXPath);
        
//         if (postBoxes.length > 0) {
//             for (let i = 0; i < postBoxes.length; i++) {
//                 const box = postBoxes[i];
//                 const isVisible = await fbPage.evaluate(el => {
//                     const style = window.getComputedStyle(el);
//                     return style && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
//                 }, box);

//                 if (isVisible) {
//                     console.log(`   -> Visible box mil gaya (Index: ${i}). Hover kar rahe hain...`);
//                     await box.hover();
//                     await new Promise(r => setTimeout(r, 2000));
                    
//                     console.log("   -> Mouse se left click kar rahe hain...");
//                     await box.click();
//                     await new Promise(r => setTimeout(r, 5000));

//                     let dialog = await fbPage.$x('//div[@role="dialog"]');
//                     if (dialog.length > 0) {
//                         popupOpened = true;
//                         console.log("✅ BINGO! Popup khul gaya.");
//                         break;
//                     }

//                     console.log("   ⚠️ Click se nahi khula, 'Enter' key try kar rahe hain...");
//                     await box.focus();
//                     await fbPage.keyboard.press('Enter');
//                     await new Promise(r => setTimeout(r, 4000));

//                     dialog = await fbPage.$x('//div[@role="dialog"]');
//                     if (dialog.length > 0) {
//                         popupOpened = true;
//                         console.log("✅ BINGO! Enter dabane se popup khul gaya.");
//                         break;
//                     }
//                 }
//             }
//         } else {
//             console.log("❌ Box select nahi ho saka.");
//             return false;
//         }

//         if (!popupOpened) {
//             console.log("❌ ERROR: Popup nahi khula! Script end.");
//             return false;
//         }

//         // ==========================================
//         // STEP 2: TEXT TYPE KARNA (DYNAMIC DESC)
//         // ==========================================
//         console.log("▶️ STEP 2: Text box mein likh rahe hain...");
//         const textBoxXPath = '//div[@role="dialog"]//div[@role="textbox" and @contenteditable="true"]';
//         await fbPage.waitForXPath(textBoxXPath, { timeout: 5000 });
        
//         const textBoxes = await fbPage.$x(textBoxXPath);
//         if (textBoxes.length > 0) {
//             await textBoxes[0].type(desc, { delay: 10 }); 
//             console.log("✅ Text type ho gaya.");
//             await new Promise(r => setTimeout(r, 3000));
//         } else {
//             console.log("❌ Text box dialog mein nahi mila.");
//             return false;
//         }

//         // ==========================================
//         // STEP 3: VIDEO UPLOAD (WITH EXTENDED WAIT)
//         // ==========================================
//         console.log("▶️ STEP 3: Video upload kar rahe hain...");
//         const photoIconXPath = '//div[@role="dialog"]//div[@aria-label="Photo/video"]';
//         const photoIcons = await fbPage.$x(photoIconXPath);
        
//         if (photoIcons.length > 0) {
//             await fbPage.evaluate(el => el.click(), photoIcons[0]);
//             await new Promise(r => setTimeout(r, 2000));

//             const fileInputXPath = '//div[@role="dialog"]//input[@type="file"]';
//             const fileInputs = await fbPage.$x(fileInputXPath);
            
//             if (fileInputs.length > 0 && fs.existsSync(videoPath)) {
//                 await fileInputs[0].uploadFile(videoPath);
                
//                 // 🛑 YAHAN 60 SECONDS (1 MINUTE) KA WAIT ADD KIYA HAI 🛑
//                 console.log(`✅ Video attached (${videoPath}). Process hone ka mukammal 1 MINUTE wait kar rahe hain...`);
//                 await new Promise(r => setTimeout(r, 60000)); 
//             }
//         }

//         // ==========================================
//         // STEP 4: NEXT BUTTON
//         // ==========================================
//         console.log("▶️ STEP 4: Next button daba rahe hain...");
//         const nextBtn = await fbPage.$('div[aria-label="Next"][role="button"]');
//         if (nextBtn) {
//             await fbPage.evaluate(el => el.click(), nextBtn);
//             await new Promise(r => setTimeout(r, 4000));
//         }

//         // ==========================================
//         // STEP 4.5: POST BUTTON
//         // ==========================================
//         console.log("▶️ STEP 4.5: Post button check kar rahe hain...");
//         let postBtn = await fbPage.$x('//div[@aria-label="Post" and @role="button"]');
//         if (postBtn.length === 0) {
//             postBtn = await fbPage.$x('//span[text()="Post"]');
//         }

//         if (postBtn.length > 0) {
//             await fbPage.evaluate(el => el.click(), postBtn[0]);
//             console.log("✅ 'Post' button daba diya.");
//             await new Promise(r => setTimeout(r, 20000));
//         } else {
//             const closeEarly = await fbPage.$('div[aria-label="Close"][role="button"]');
//             if (closeEarly) {
//                 await fbPage.evaluate(el => el.click(), closeEarly);
//             }
//         }

//         // ==========================================
//         // STEP 4.8: ZIDDI POPUP HUNTER
//         // ==========================================
//         console.log("▶️ STEP 4.8: Ziddi popups check kar rahe hain...");
//         for (let i = 0; i < 2; i++) {
//             await new Promise(r => setTimeout(r, 6000));
//             const closeBtn = await fbPage.$('div[aria-label="Close"][role="button"]');
//             if (closeBtn) {
//                 await fbPage.evaluate(el => el.click(), closeBtn);
//             }
//         }

//         // ==========================================
//         // STEP 5: FINAL "SHARE NOW" BUTTON
//         // ==========================================
//         console.log("▶️ STEP 5: Final Share button dhoond rahe hain...");
//         let shareNowBtn = await fbPage.$('div[aria-label="Share now"][role="button"]');
//         if (!shareNowBtn) {
//             const shareXPath = await fbPage.$x('//span[text()="Share now" or text()="Publish" or text()="Share"]');
//             if (shareXPath.length > 0) shareNowBtn = shareXPath[0];
//         }

//         if (shareNowBtn) {
//             await fbPage.evaluate(el => el.click(), shareNowBtn);
//             await new Promise(r => setTimeout(r, 15000));
//             console.log("🎉 BINGO! Facebook Video Post 100% Successful.");
//         } else {
//             console.log("🎉 BINGO! Video Post Done (Share button nahi mila, matlab direct post ho gayi).");
//         }
        
//         await new Promise(r => setTimeout(r, 5000));
//         return true;

//     } catch (e) {
//         console.log(`⚠️ HOUSTON, WE HAVE A PROBLEM IN UPLOAD: ${e.message}`);
//         return false;
//     } finally {
//         // 🛑 SABOOT UPLOAD LOGIC 🛑
//         if (uploadRecorder) {
//             console.log(`[🎥] Saboot Recording stop kar rahe hain...`);
//             try { await uploadRecorder.stop(); } catch(e){}
            
//             if (fs.existsSync(proofVideoName)) {
//                 console.log(`[📤 SABOOT] Upload Proof Video GitHub Releases par upload kar raha hoon...`);
//                 try {
//                     const tagName = `upload-proof-${Date.now()}`;
//                     execSync(`gh release create ${tagName} "${proofVideoName}" --title "Upload Proof Cycle #${clipNum}" --notes "Facebook web automation upload ka mukammal video saboot."`, { stdio: 'inherit' });
//                     console.log('✅ [+] Successfully uploaded Upload Proof Video to GitHub Releases!');
//                 } catch (err) {
//                     console.log(`[❌] Upload proof upload fail ho gaya. Error: ${err.message}`);
//                 }
//                 // Upload ke baad file delete kar do taake space bache
//                 try { fs.unlinkSync(proofVideoName); } catch(e){}
//             }
//         }

//         console.log("\nFacebook Uploader Browser band kar rahe hain...");
//         await fbBrowser.close();
//         try { execSync("pkill chrome"); } catch(e){}
//         console.log("✅ Uploader Browser successfully khatam ho gaya!");
//     }
// }

// // ==========================================
// // 🚀 CRASH MANAGER & MAIN HYBRID LOOP
// // ==========================================
// async function cleanup() {
//     if (browser) { try { await browser.close(); console.log(`[🧹] Browser connection closed.`); } catch (e) { } browser = null; page = null; targetFrame = null; }
// }

// async function triggerNextRun() {
//     const token = process.env.GH_PAT, repo = process.env.GITHUB_REPOSITORY, branch = process.env.GITHUB_REF_NAME || 'main'; if (!token || !repo) return;
//     try { await axios.post(`https://api.github.com/repos/${repo}/actions/workflows/video_loop.yml/dispatches`, { ref: branch, inputs: { target_url: TARGET_URL, titles_list: TITLES_INPUT, descs_list: DESCS_INPUT, hashtags: HASHTAGS } }, { headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' } }); console.log(`\n[🔄 AUTO-RESTART] Naya bot trigger kar diya gaya!`); } catch (e) { }
// }

// async function main() {
//     console.log("\n==================================================");
//     console.log(`   🚀 HYBRID BOT (PROJECT 1 WEB UPLOADER INTEGRATED)`);
//     console.log(`   ⏰ STARTED AT: ${formatPKT()}`);
//     console.log("==================================================");

//     let nextRunTriggered = false;

//     while (true) {
//         const elapsedTimeMs = Date.now() - START_TIME;
//         console.log(`\n--------------------------------------------------`);
//         console.log(`--- 🔄 STARTING VIDEO CYCLE #${clipCounter} ---`);
//         console.log(`  [-] Bot Uptime: ${Math.floor(elapsedTimeMs / 60000)} minutes`);
//         console.log(`--------------------------------------------------`);

//         if (elapsedTimeMs > RESTART_TRIGGER_MS && !nextRunTriggered) { await triggerNextRun(); nextRunTriggered = true; }
//         if (elapsedTimeMs > END_TIME_LIMIT_MS) { console.log(`[🛑] 6 Hours Limit. Exiting.`); process.exit(0); }

//         const meta = generateMetadata(clipCounter);
//         const thumbFile = `studio_thumb_${clipCounter}.png`;
//         const finalVidFile = `final_${clipCounter}.mp4`;

//         try {
//             await initBrowserAndPlayer(clipCounter === 1); 
//             await worker_0_5_generate_thumbnail(meta.title, thumbFile);
            
//             if (await worker_1_2_capture_and_edit(finalVidFile)) {
//                 // Yahan humne clipCounter pass kiya hai taake video ka naam unique ban sake
//                 await worker_3_upload(finalVidFile, thumbFile, meta.title, meta.desc, clipCounter);
//             }
//         } catch (err) {
//             console.error(`\n[!] CRASH DETECTED IN CYCLE #${clipCounter}: ${err.message}`);
//         } finally {
//             await cleanup();
//             [thumbFile, finalVidFile].forEach(f => { if (fs.existsSync(f)) { fs.unlinkSync(f); } });
//             console.log(`\n[⏳ Cycle End] Cycle #${clipCounter} Mukammal! Aglay round tak 5 minute wait kar raha hoon...`);
//             clipCounter++;
//             await new Promise(r => setTimeout(r, WAIT_TIME_MS)); 
//         }
//     }
// }

// main();














































// ==================== yeh 100% teek ulaod karta hai facebook mei though facebook api , lekin opper hum inshallah banty hai k yeh manually post karey =====================



// const puppeteer = require('puppeteer-extra');
// const StealthPlugin = require('puppeteer-extra-plugin-stealth');
// puppeteer.use(StealthPlugin());

// const { spawn, execSync } = require('child_process');
// const fs = require('fs');
// const FormData = require('form-data');
// const axios = require('axios'); 
// const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');

// // ==========================================
// // ⚙️ SETTINGS & ENVIRONMENT VARIABLES
// // ==========================================
// const TARGET_URL = process.env.TARGET_URL || 'https://dlstreams.com/watch.php?id=316';

// const FB_TOKEN_1 = process.env.FB_TOKEN_1 || '';
// const FB_TOKEN_2 = process.env.FB_TOKEN_2 || '';
// const TOKEN_SELECTION = process.env.TOKEN_SELECTION || 'Dual'; 

// const TITLES_INPUT = process.env.TITLES_LIST || 'Live Match Today,,Watch Full Match DC vs GT';
// const DESCS_INPUT = process.env.DESCS_LIST || 'Watch the live action here';
// const HASHTAGS = process.env.HASHTAGS || '#IPL2026 #DCvsGT #CricketLovers #LiveMatch';

// const WAIT_TIME_MS = 300 * 1000; // 5 Minutes loop wait
// const START_TIME = Date.now();
// const RESTART_TRIGGER_MS = (5 * 60 * 60 + 30 * 60) * 1000; // 5.5 Hours
// const END_TIME_LIMIT_MS = (5 * 60 * 60 + 50 * 60) * 1000; // 5.8 Hours

// let clipCounter = 1;

// // 🌐 BROWSER VARIABLES
// let browser = null;
// let page = null;
// let targetFrame = null;

// function formatPKT(timestampMs = Date.now()) {
//     return new Date(timestampMs).toLocaleString('en-US', {
//         timeZone: 'Asia/Karachi', hour12: true, year: 'numeric', month: 'short',
//         day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
//     }) + " PKT";
// }

// function generateMetadata(clipNum) {
//     const titles = TITLES_INPUT.split(',,').map(t => t.trim()).filter(t => t);
//     const descs = DESCS_INPUT.split(',,').map(d => d.trim()).filter(d => d);
//     const title = titles.length ? titles[Math.floor(Math.random() * titles.length)] : "Live Match";
//     const descBody = descs.length ? descs[Math.floor(Math.random() * descs.length)] : "Watch live!";
//     const emojis = ["🔥", "🏏", "⚡", "🏆", "💥", "😱", "📺", "🚀"].sort(() => 0.5 - Math.random()).slice(0, 3);
//     const tags = HASHTAGS.split(' ').sort(() => 0.5 - Math.random()).slice(0, 4).join(' ');
    
//     const finalTitle = title.substring(0, 240); 
//     const finalDesc = `${finalTitle} ${emojis.join(' ')}\n\n${descBody}\n\n⏱️ Update: ${formatPKT()}\n👇 Watch Full Match Link in First Comment!\n\n${tags}`;
//     return { title: finalTitle, desc: finalDesc };
// }

// // =========================================================================
// // 🌐 SETUP BROWSER (Runs Fresh Every Cycle)
// // =========================================================================
// async function initBrowserAndPlayer(isFirstCycle) {
//     console.log(`\n[*] Starting FRESH browser instance...`);
    
//     browser = await puppeteer.launch({
//         channel: 'chrome', headless: false, 
//         defaultViewport: { width: 1280, height: 720 },
//         ignoreDefaultArgs: ['--enable-automation'], 
//         args: [ '--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,720', '--kiosk', '--autoplay-policy=no-user-gesture-required', '--mute-audio' ]
//     });

//     page = await browser.newPage();
//     const pages = await browser.pages();
//     for (const p of pages) if (p !== page) await p.close();

//     browser.on('targetcreated', async (target) => {
//         if (target.type() === 'page') {
//             try { const newPage = await target.page(); if (newPage && newPage !== page) { await page.bringToFront(); setTimeout(() => newPage.close().catch(() => {}), 1000); } } catch (e) { }
//         }
//     });

//     console.log(`[*] Navigating to target URL: ${TARGET_URL}...`);
//     await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
//     await new Promise(r => setTimeout(r, 10000)); 

//     console.log('[*] Scanning iframes for the REAL Live Stream Video...');
//     for (const frame of page.frames()) {
//         try {
//             const isRealLiveStream = await frame.evaluate(() => {
//                 const vid = document.querySelector('video[data-html5-video]') || document.querySelector('video');
//                 return vid && vid.clientWidth > 300; 
//             });
//             if (isRealLiveStream) {
//                 targetFrame = frame;
//                 await frame.evaluate(() => { const fAd = document.getElementById('floated'); if (fAd) fAd.remove(); });
//             }
//         } catch (e) { }
//     }

//     if (!targetFrame) throw new Error('No <video> element could be found.');

//     try {
//         const iframeEl = await targetFrame.frameElement();
//         const box = await iframeEl.boundingBox();
//         if (box) await page.mouse.click(box.x + (box.width / 2), box.y + (box.height / 2), { delay: 100 });
//         await new Promise(r => setTimeout(r, 2000));
//     } catch (e) { }

//     await targetFrame.evaluate(async () => {
//         const video = document.querySelector('video[data-html5-video]') || document.querySelector('video');
//         if (video) { video.volume = 1.0; await video.play().catch(e => {}); }
//     });

//     await targetFrame.evaluate(async () => {
//         const vid = document.querySelector('video[data-html5-video]') || document.querySelector('video');
//         if (!vid) return;
//         try {
//             if (vid.requestFullscreen) await vid.requestFullscreen();
//             else if (vid.webkitRequestFullscreen) await vid.webkitRequestFullscreen();
//         } catch (err) {
//             vid.style.position = 'fixed'; vid.style.top = '0'; vid.style.left = '0';
//             vid.style.width = '100vw'; vid.style.height = '100vh'; vid.style.zIndex = '2147483647'; vid.style.backgroundColor = 'black'; vid.style.objectFit = 'contain';
//         }
//     });

//     console.log('[✅] Browser Ready! Video is playing fullscreen.');

//     if (isFirstCycle) {
//         console.log(`\n[🔍 DEBUG] Cycle 1 par 15-second ki Visual Debug Recording kar raha hoon...`);
//         const recorder = new PuppeteerScreenRecorder(page);
//         const debugFileName = `debug_video_${Date.now()}.mp4`;
//         await recorder.start(debugFileName);
        
//         await new Promise(r => setTimeout(r, 15000)); 
//         await recorder.stop();
        
//         console.log(`[📤 DEBUG] Uploading to GitHub Releases...`);
//         try {
//             const tagName = `visual-debug-${Date.now()}`;
//             execSync(`gh release create ${tagName} ${debugFileName} --title "Visual Debug Capture" --notes "First Cycle Screen Check"`, { stdio: 'inherit' });
//             console.log('✅ [+] Successfully uploaded visual debug video to GitHub Releases!');
//         } catch (err) {}
//         if (fs.existsSync(debugFileName)) fs.unlinkSync(debugFileName);
//     }
// }

// // ==========================================
// // 📸 WORKER 0.5: GENERATE THUMBNAIL (WITH PROOF UPLOAD & VIDEO CROP FIXED)
// // ==========================================

// async function worker_0_5_generate_thumbnail(titleText, outputImagePath) {
//     console.log(`\n[🎨 Worker 0.5] Puppeteer se HD Thumbnail bana raha hoon...`);
//     const rawFrame = 'temp_raw_frame.jpg';
    
//     // 👇 NAYA UPDATE: Sirf Video Element ka screenshot le ga, website elements ko ignore kare ga 👇
//     try {
//         console.log(`[>] Sirf video player ka frame extract kar raha hoon...`);
//         const videoElement = await targetFrame.$('video[data-html5-video], video');
//         if (videoElement) {
//             await videoElement.screenshot({ path: rawFrame, type: 'jpeg', quality: 90 });
//         } else {
//             // Agar video target na ho saky tou fallback karay
//             await page.screenshot({ path: rawFrame, type: 'jpeg', quality: 90 });
//         }
//     } catch (e) {
//         console.log(`[❌] Screenshot lene mein masla: ${e.message}`);
//         return false;
//     }
//     // 👆 NAYA UPDATE 👆

//     if (!fs.existsSync(rawFrame)) return false;
//     const b64Image = "data:image/jpeg;base64," + fs.readFileSync(rawFrame).toString('base64');
    
//     // const htmlCode = `
//     //     <!DOCTYPE html><html><head><link href="https://fonts.googleapis.com/css2?family=Roboto:wght@700;900&display=swap" rel="stylesheet">
//     //     <style>body { margin: 0; width: 1280px; height: 720px; background: #0f0f0f; font-family: 'Roboto', sans-serif; color: white; display: flex; flex-direction: column; overflow: hidden; } .header { height: 100px; display: flex; align-items: center; padding: 0 40px; justify-content: space-between; z-index: 10; } .logo { font-size: 50px; font-weight: 900; letter-spacing: 1px; text-shadow: 0 0 10px rgba(255,255,255,0.8); } .live-badge { border: 4px solid #cc0000; border-radius: 12px; padding: 5px 20px; font-size: 40px; font-weight: 700; display: flex; gap: 10px; } .hero-container { position: relative; width: 100%; height: 440px; } .hero-img { width: 100%; height: 100%; object-fit: cover; filter: blur(5px); opacity: 0.6; } .pip-img { position: absolute; top: 20px; right: 40px; width: 45%; border: 6px solid white; box-shadow: -15px 15px 30px rgba(0,0,0,0.8); } .text-container { flex-grow: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 10px 40px; } .main-title { font-size: 70px; font-weight: 900; line-height: 1.1; text-shadow: 6px 6px 15px rgba(0,0,0,0.9); } .live-text { color: #cc0000; }</style>
//     //     </head><body><div class="header"><div class="logo">SPORTSHUB</div><div class="live-badge"><span style="color:#cc0000">●</span> LIVE</div></div><div class="hero-container"><img src="${b64Image}" class="hero-img"><img src="${b64Image}" class="pip-img"></div><div class="text-container"><div class="main-title"><span class="live-text">LIVE NOW: </span>${titleText}</div></div></body></html>`;
//     const htmlCode = `<!DOCTYPE html><html><head><link href="https://fonts.googleapis.com/css2?family=Roboto:wght@700;900&display=swap" rel="stylesheet"><style>body { margin: 0; width: 1280px; height: 720px; background: #0f0f0f; font-family: 'Roboto', sans-serif; color: white; display: flex; flex-direction: column; overflow: hidden; } .header { height: 100px; display: flex; align-items: center; padding: 0 40px; justify-content: space-between; z-index: 10; } .logo { font-size: 50px; font-weight: 900; letter-spacing: 1px; text-shadow: 0 0 10px rgba(255,255,255,0.8); } .live-badge { border: 4px solid #cc0000; border-radius: 12px; padding: 5px 20px; font-size: 40px; font-weight: 700; display: flex; gap: 10px; } .hero-container { position: relative; width: 100%; height: 440px; } .hero-img { width: 100%; height: 100%; object-fit: cover; filter: blur(5px); opacity: 0.6; } .pip-img { position: absolute; top: 20px; right: 40px; width: 45%; border: 6px solid white; box-shadow: -15px 15px 30px rgba(0,0,0,0.8); } .text-container { position: relative; z-index: 999; flex-grow: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 10px 40px; } .main-title { font-size: 70px; font-weight: 900; line-height: 1.1; text-shadow: 6px 6px 15px rgba(0,0,0,0.9); } .live-text { color: #cc0000; }</style></head><body><div class="header"><div class="logo">SPORTSHUB</div><div class="live-badge"><span style="color:#cc0000">●</span> LIVE</div></div><div class="hero-container"><img src="${b64Image}" class="hero-img"><img src="${b64Image}" class="pip-img"></div><div class="text-container"><div class="main-title"><span class="live-text">LIVE NOW: </span>${titleText}</div></div></body></html>`;



    
//     const tb = await puppeteer.launch({ headless: true, defaultViewport: { width: 1280, height: 720 }, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
//     const tPage = await tb.newPage();
//     await tPage.setContent(htmlCode);
//     await tPage.screenshot({ path: outputImagePath });
//     await tb.close();
//     if (fs.existsSync(rawFrame)) fs.unlinkSync(rawFrame); 
//     console.log(`[✅ Worker 0.5] Thumbnail Ready: ${outputImagePath}`);

//     // 👇 SABOOT UPLOAD TO GITHUB RELEASES 👇
//     console.log(`[📤 SABOOT] Professional Saboot (Thumbnail) GitHub Releases par upload kar raha hoon...`);
//     try {
//         const tagName = `thumb-proof-${Date.now()}`;
//         execSync(`gh release create ${tagName} "${outputImagePath}" --title "Thumbnail Proof Capture" --notes "Cycle #${clipCounter} ke liye banaya gaya HD Thumbnail Saboot."`, { stdio: 'inherit' });
//         console.log('✅ [+] Successfully uploaded Thumbnail Saboot to GitHub Releases!');
//     } catch (err) {
//         console.log(`[❌] Thumbnail saboot upload fail ho gaya. Error: ${err.message}`);
//     }
//     // 👆 SABOOT UPLOAD END 👆

//     return true;
// }

// // ==========================================
// // 🛠️ ASYNC FFMPEG EXECUTOR (With Enhanced Error Logs)
// // ==========================================
// async function runFFmpegEditAsync(args, stepName) {
//     return new Promise((resolve) => {
//         const ffmpegProc = spawn('ffmpeg', args);
//         let lastLogTime = Date.now();
//         let errorLog = "";

//         ffmpegProc.stderr.on('data', (data) => {
//             const output = data.toString().trim();
//             errorLog = output; // Save the last output line to show if it fails
            
//             if (Date.now() - lastLogTime > 3000) {
//                 if (output.includes('time=')) console.log(`[FFmpeg ${stepName}]: ${output.substring(0, 100)}...`);
//                 lastLogTime = Date.now();
//             }
//         });

//         ffmpegProc.on('close', (code) => {
//             if (code === 0) { 
//                 console.log(`[✅] ${stepName} Completed Successfully!`); 
//                 resolve(true); 
//             } else { 
//                 console.log(`[❌] ${stepName} Failed! Reason: \n${errorLog}`); 
//                 resolve(false); 
//             }
//         });
//     });
// }

// // ==========================================
// // 🎥 WORKER 1 & 2: THE NEW FLAWLESS CAPTURE & EDIT
// // ==========================================
// async function worker_1_2_capture_and_edit(outputVid) {
//     console.log(`\n[🎬 Worker 1 & 2] Puppeteer Recording & Fast Edit shuru ho raha hai...`);
//     const audioFile = "marya_live.mp3"; const bgImage = "website_frame.png"; const staticVideo = "main_video.mp4"; 
//     const blurAmount = "15:3"; const duration = "10";
    
//     const hasBg = fs.existsSync(bgImage); const hasAudio = fs.existsSync(audioFile); const hasMainVideo = fs.existsSync(staticVideo);
//     const raw10sVid = `raw_screen_${Date.now()}.mp4`; const tempDynVideo = `temp_dyn_${Date.now()}.mp4`; 

//     // ----------------------------------------
//     // 🚀 STEP 0: RECORD USING PUPPETEER
//     // ----------------------------------------
//     console.log(`\n[>] [Step 0] Recording 10 seconds of LIVE Fullscreen using Puppeteer...`);
//     try {
//         const recorder = new PuppeteerScreenRecorder(page, { fps: 30 });
//         await recorder.start(raw10sVid);
//         await new Promise(r => setTimeout(r, 10000)); // Exactly 10 seconds wait
//         await recorder.stop();
//         console.log(`[✅] Step 0 Done! Smooth 10s video captured.`);
//     } catch (e) {
//         console.log(`[❌] Puppeteer recording failed: ${e.message}`);
//         return false;
//     }

//     if (!fs.existsSync(raw10sVid) || fs.statSync(raw10sVid).size < 1000) return false;

//     // 🔴 ECO-MODE: Browser band kar do
//     console.log(`[🧹 ECO-MODE] Screen capture done. Closing browser to free up RAM before heavy processing...`);
//     await cleanup(); 

//     // ----------------------------------------
//     // STEP A: EDIT CLIP (Blur & PiP + Audio)
//     // ----------------------------------------
//     console.log(`\n[>] [Step A] Applying Blur & PiP Frame on recorded clip...`);
//     let args1 = ["-y", "-thread_queue_size", "1024", "-i", raw10sVid]; 
//     if (hasBg) args1.push("-thread_queue_size", "1024", "-loop", "1", "-framerate", "30", "-i", bgImage);
//     if (hasAudio) args1.push("-thread_queue_size", "1024", "-stream_loop", "-1", "-i", audioFile);
    
//     // 🚀 FIX: Typo removed. Added setpts for perfect speed sync!
//     let filterComplex1 = hasBg 
//         ? `[0:v]setpts=PTS-STARTPTS,fps=30,scale=1064:565,boxblur=${blurAmount}[pip]; [1:v]setpts=PTS-STARTPTS,fps=30[bg]; [bg][pip]overlay=0:250:shortest=1,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p[outv]` 
//         : `[0:v]setpts=PTS-STARTPTS,fps=30,scale=1280:720,boxblur=${blurAmount},format=yuv420p[outv]`;
        
//     args1.push("-filter_complex", filterComplex1, "-map", "[outv]");
    
//     if (hasAudio) {
//         let audioIndex = hasBg ? 2 : 1;
//         args1.push("-map", `${audioIndex}:a:0`, "-af", "aresample=async=1");
//     } else {
//         // Fallback incase audio is missing
//         args1.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100", "-map", "1:a:0");
//     }
    
//     args1.push("-c:v", "libx264", "-preset", "ultrafast", "-threads", "2", "-vsync", "1", "-c:a", "aac", "-b:a", "128k", "-t", duration, tempDynVideo);

//     const editSuccess = await runFFmpegEditAsync(args1, "Apply Filters");
//     if (fs.existsSync(raw10sVid)) fs.unlinkSync(raw10sVid); 
    
//     if (!editSuccess || !fs.existsSync(tempDynVideo)) return false;

//     // ----------------------------------------
//     // STEP B: MERGE
//     // ----------------------------------------
//     if (hasMainVideo) {
//         console.log(`\n[>] [Step B] Merging with 'main_video.mp4'...`);
//         let args2 = ["-y", "-i", tempDynVideo, "-i", staticVideo, "-filter_complex", "[0:v]scale=1280:720,setsar=1,fps=30,format=yuv420p[v0]; [0:a]aformat=sample_rates=44100:channel_layouts=stereo[a0]; [1:v]scale=1280:720,setsar=1,fps=30,format=yuv420p[v1]; [1:a]aformat=sample_rates=44100:channel_layouts=stereo[a1]; [v0][a0][v1][a1]concat=n=2:v=1:a=1[outv][outa]", "-map", "[outv]", "-map", "[outa]", "-c:v", "libx264", "-preset", "ultrafast", "-threads", "2", "-vsync", "1", "-c:a", "aac", "-b:a", "128k", outputVid];
        
//         const mergeSuccess = await runFFmpegEditAsync(args2, "Merge Video");
//         fs.unlinkSync(tempDynVideo); 
        
//         if (mergeSuccess && fs.existsSync(outputVid)) return true;
//     } else {
//         console.log(`[⚠️] 'main_video.mp4' nahi mili! Sirf edited clip final bani.`);
//         fs.renameSync(tempDynVideo, outputVid); return true;
//     }
//     return false;
// }

// // ==========================================
// // 📤 WORKER 3: FACEBOOK UPLOAD 
// // ==========================================
// async function checkFacebookToken(token) { const res = await axios.get(`https://graph.facebook.com/v18.0/me?access_token=${token}&fields=id,name`); return { pageId: res.data.id, pageName: res.data.name }; }

// async function worker_3_upload(videoPath, thumbPath, title, desc) {
//     console.log(`\n[📤 Worker 3] Facebook Upload (Mode: ${TOKEN_SELECTION})`);
//     let tokensToTry = TOKEN_SELECTION === 'Token1' ? [FB_TOKEN_1] : TOKEN_SELECTION === 'Token2' ? [FB_TOKEN_2] : [FB_TOKEN_1, FB_TOKEN_2]; 
//     let activeToken = null, pageId = null;
//     for (let token of tokensToTry) { if (!token) continue; try { const info = await checkFacebookToken(token); activeToken = token; pageId = info.pageId; break; } catch (e) { } }
//     if (!activeToken) return false;

//     try {
//         const form = new FormData(); form.append('access_token', activeToken); form.append('title', title); form.append('description', desc); form.append('source', fs.createReadStream(videoPath));
//         if (fs.existsSync(thumbPath)) form.append('thumb', fs.createReadStream(thumbPath));
//         const uploadRes = await axios.post(`https://graph-video.facebook.com/v18.0/${pageId}/videos`, form, { headers: form.getHeaders() });
//         await new Promise(r => setTimeout(r, 15000));
        
//         const commentForm = new FormData(); commentForm.append('access_token', activeToken); commentForm.append('message', '📺 Watch Full Match Without Buffering Here: https://bulbul4u-live.xyz');
//         if (fs.existsSync("comment_image.jpeg")) commentForm.append('source', fs.createReadStream("comment_image.jpeg"));
//         await axios.post(`https://graph.facebook.com/v18.0/${uploadRes.data.id}/comments`, commentForm, { headers: commentForm.getHeaders() });
//         console.log(`[✅] Upload & Comment Posted!`); return true;
//     } catch (e) { return false; }
// }

// // ==========================================
// // 🚀 CRASH MANAGER & MAIN HYBRID LOOP
// // ==========================================
// async function cleanup() {
//     if (browser) { try { await browser.close(); console.log(`[🧹] Browser connection closed.`); } catch (e) { } browser = null; page = null; targetFrame = null; }
// }

// async function triggerNextRun() {
//     const token = process.env.GH_PAT, repo = process.env.GITHUB_REPOSITORY, branch = process.env.GITHUB_REF_NAME || 'main'; if (!token || !repo) return;
//     try { await axios.post(`https://api.github.com/repos/${repo}/actions/workflows/video_loop.yml/dispatches`, { ref: branch, inputs: { target_url: TARGET_URL, titles_list: TITLES_INPUT, descs_list: DESCS_INPUT, hashtags: HASHTAGS, token_selection: TOKEN_SELECTION } }, { headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' } }); console.log(`\n[🔄 AUTO-RESTART] Naya bot trigger kar diya gaya!`); } catch (e) { }
// }

// async function main() {
//     console.log("\n==================================================");
//     console.log(`   🚀 HYBRID BOT (PUPPETEER RECORDING FIXED)`);
//     console.log(`   ⏰ STARTED AT: ${formatPKT()}`);
//     console.log("==================================================");

//     let nextRunTriggered = false;

//     while (true) {
//         const elapsedTimeMs = Date.now() - START_TIME;
//         console.log(`\n--------------------------------------------------`);
//         console.log(`--- 🔄 STARTING VIDEO CYCLE #${clipCounter} ---`);
//         console.log(`  [-] Bot Uptime: ${Math.floor(elapsedTimeMs / 60000)} minutes`);
//         console.log(`--------------------------------------------------`);

//         if (elapsedTimeMs > RESTART_TRIGGER_MS && !nextRunTriggered) { await triggerNextRun(); nextRunTriggered = true; }
//         if (elapsedTimeMs > END_TIME_LIMIT_MS) { console.log(`[🛑] 6 Hours Limit. Exiting.`); process.exit(0); }

//         const meta = generateMetadata(clipCounter);
//         const thumbFile = `studio_thumb_${clipCounter}.png`;
//         const finalVidFile = `final_${clipCounter}.mp4`;

//         try {
//             await initBrowserAndPlayer(clipCounter === 1); 
//             await worker_0_5_generate_thumbnail(meta.title, thumbFile);
            
//             if (await worker_1_2_capture_and_edit(finalVidFile)) {
//                 await worker_3_upload(finalVidFile, thumbFile, meta.title, meta.desc);
//             }
//         } catch (err) {
//             console.error(`\n[!] CRASH DETECTED IN CYCLE #${clipCounter}: ${err.message}`);
//         } finally {
//             await cleanup();
//             [thumbFile, finalVidFile].forEach(f => { if (fs.existsSync(f)) { fs.unlinkSync(f); } });
//             console.log(`\n[⏳ Cycle End] Cycle #${clipCounter} Mukammal! Aglay round tak 5 minute wait kar raha hoon...`);
//             clipCounter++;
//             await new Promise(r => setTimeout(r, WAIT_TIME_MS)); 
//         }
//     }
// }

// main();

































































































// ============== every thing is good, bas thumbnail wala screenshot like full website lata hai full nahey bulky kuch parts like links and iframe wala parts ====================




// const puppeteer = require('puppeteer-extra');
// const StealthPlugin = require('puppeteer-extra-plugin-stealth');
// puppeteer.use(StealthPlugin());

// const { spawn, execSync } = require('child_process');
// const fs = require('fs');
// const FormData = require('form-data');
// const axios = require('axios'); 
// const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');

// // ==========================================
// // ⚙️ SETTINGS & ENVIRONMENT VARIABLES
// // ==========================================
// const TARGET_URL = process.env.TARGET_URL || 'https://dlstreams.com/watch.php?id=316';

// const FB_TOKEN_1 = process.env.FB_TOKEN_1 || '';
// const FB_TOKEN_2 = process.env.FB_TOKEN_2 || '';
// const TOKEN_SELECTION = process.env.TOKEN_SELECTION || 'Dual'; 

// const TITLES_INPUT = process.env.TITLES_LIST || 'Live Match Today,,Watch Full Match DC vs GT';
// const DESCS_INPUT = process.env.DESCS_LIST || 'Watch the live action here';
// const HASHTAGS = process.env.HASHTAGS || '#IPL2026 #DCvsGT #CricketLovers #LiveMatch';

// const WAIT_TIME_MS = 300 * 1000; // 5 Minutes loop wait
// const START_TIME = Date.now();
// const RESTART_TRIGGER_MS = (5 * 60 * 60 + 30 * 60) * 1000; // 5.5 Hours
// const END_TIME_LIMIT_MS = (5 * 60 * 60 + 50 * 60) * 1000; // 5.8 Hours

// let clipCounter = 1;

// // 🌐 BROWSER VARIABLES
// let browser = null;
// let page = null;
// let targetFrame = null;

// function formatPKT(timestampMs = Date.now()) {
//     return new Date(timestampMs).toLocaleString('en-US', {
//         timeZone: 'Asia/Karachi', hour12: true, year: 'numeric', month: 'short',
//         day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
//     }) + " PKT";
// }

// function generateMetadata(clipNum) {
//     const titles = TITLES_INPUT.split(',,').map(t => t.trim()).filter(t => t);
//     const descs = DESCS_INPUT.split(',,').map(d => d.trim()).filter(d => d);
//     const title = titles.length ? titles[Math.floor(Math.random() * titles.length)] : "Live Match";
//     const descBody = descs.length ? descs[Math.floor(Math.random() * descs.length)] : "Watch live!";
//     const emojis = ["🔥", "🏏", "⚡", "🏆", "💥", "😱", "📺", "🚀"].sort(() => 0.5 - Math.random()).slice(0, 3);
//     const tags = HASHTAGS.split(' ').sort(() => 0.5 - Math.random()).slice(0, 4).join(' ');
    
//     const finalTitle = title.substring(0, 240); 
//     const finalDesc = `${finalTitle} ${emojis.join(' ')}\n\n${descBody}\n\n⏱️ Update: ${formatPKT()}\n👇 Watch Full Match Link in First Comment!\n\n${tags}`;
//     return { title: finalTitle, desc: finalDesc };
// }

// // =========================================================================
// // 🌐 SETUP BROWSER (Runs Fresh Every Cycle)
// // =========================================================================
// async function initBrowserAndPlayer(isFirstCycle) {
//     console.log(`\n[*] Starting FRESH browser instance...`);
    
//     browser = await puppeteer.launch({
//         channel: 'chrome', headless: false, 
//         defaultViewport: { width: 1280, height: 720 },
//         ignoreDefaultArgs: ['--enable-automation'], 
//         args: [ '--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,720', '--kiosk', '--autoplay-policy=no-user-gesture-required', '--mute-audio' ]
//     });

//     page = await browser.newPage();
//     const pages = await browser.pages();
//     for (const p of pages) if (p !== page) await p.close();

//     browser.on('targetcreated', async (target) => {
//         if (target.type() === 'page') {
//             try { const newPage = await target.page(); if (newPage && newPage !== page) { await page.bringToFront(); setTimeout(() => newPage.close().catch(() => {}), 1000); } } catch (e) { }
//         }
//     });

//     console.log(`[*] Navigating to target URL: ${TARGET_URL}...`);
//     await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
//     await new Promise(r => setTimeout(r, 10000)); 

//     console.log('[*] Scanning iframes for the REAL Live Stream Video...');
//     for (const frame of page.frames()) {
//         try {
//             const isRealLiveStream = await frame.evaluate(() => {
//                 const vid = document.querySelector('video[data-html5-video]') || document.querySelector('video');
//                 return vid && vid.clientWidth > 300; 
//             });
//             if (isRealLiveStream) {
//                 targetFrame = frame;
//                 await frame.evaluate(() => { const fAd = document.getElementById('floated'); if (fAd) fAd.remove(); });
//             }
//         } catch (e) { }
//     }

//     if (!targetFrame) throw new Error('No <video> element could be found.');

//     try {
//         const iframeEl = await targetFrame.frameElement();
//         const box = await iframeEl.boundingBox();
//         if (box) await page.mouse.click(box.x + (box.width / 2), box.y + (box.height / 2), { delay: 100 });
//         await new Promise(r => setTimeout(r, 2000));
//     } catch (e) { }

//     await targetFrame.evaluate(async () => {
//         const video = document.querySelector('video[data-html5-video]') || document.querySelector('video');
//         if (video) { video.volume = 1.0; await video.play().catch(e => {}); }
//     });

//     await targetFrame.evaluate(async () => {
//         const vid = document.querySelector('video[data-html5-video]') || document.querySelector('video');
//         if (!vid) return;
//         try {
//             if (vid.requestFullscreen) await vid.requestFullscreen();
//             else if (vid.webkitRequestFullscreen) await vid.webkitRequestFullscreen();
//         } catch (err) {
//             vid.style.position = 'fixed'; vid.style.top = '0'; vid.style.left = '0';
//             vid.style.width = '100vw'; vid.style.height = '100vh'; vid.style.zIndex = '2147483647'; vid.style.backgroundColor = 'black'; vid.style.objectFit = 'contain';
//         }
//     });

//     console.log('[✅] Browser Ready! Video is playing fullscreen.');

//     if (isFirstCycle) {
//         console.log(`\n[🔍 DEBUG] Cycle 1 par 15-second ki Visual Debug Recording kar raha hoon...`);
//         const recorder = new PuppeteerScreenRecorder(page);
//         const debugFileName = `debug_video_${Date.now()}.mp4`;
//         await recorder.start(debugFileName);
        
//         await new Promise(r => setTimeout(r, 15000)); 
//         await recorder.stop();
        
//         console.log(`[📤 DEBUG] Uploading to GitHub Releases...`);
//         try {
//             const tagName = `visual-debug-${Date.now()}`;
//             execSync(`gh release create ${tagName} ${debugFileName} --title "Visual Debug Capture" --notes "First Cycle Screen Check"`, { stdio: 'inherit' });
//             console.log('✅ [+] Successfully uploaded visual debug video to GitHub Releases!');
//         } catch (err) {}
//         if (fs.existsSync(debugFileName)) fs.unlinkSync(debugFileName);
//     }
// }

// // ==========================================
// // 📸 WORKER 0.5: GENERATE THUMBNAIL 
// // ==========================================
// async function worker_0_5_generate_thumbnail(titleText, outputImagePath) {
//     console.log(`\n[🎨 Worker 0.5] Puppeteer se HD Thumbnail bana raha hoon...`);
//     const rawFrame = 'temp_raw_frame.jpg';
//     try { await page.screenshot({ path: rawFrame, type: 'jpeg', quality: 90 }); } catch (e) { return false; }
//     if (!fs.existsSync(rawFrame)) return false;
//     const b64Image = "data:image/jpeg;base64," + fs.readFileSync(rawFrame).toString('base64');
    
//     const htmlCode = `
//         <!DOCTYPE html><html><head><link href="https://fonts.googleapis.com/css2?family=Roboto:wght@700;900&display=swap" rel="stylesheet">
//         <style>body { margin: 0; width: 1280px; height: 720px; background: #0f0f0f; font-family: 'Roboto', sans-serif; color: white; display: flex; flex-direction: column; overflow: hidden; } .header { height: 100px; display: flex; align-items: center; padding: 0 40px; justify-content: space-between; z-index: 10; } .logo { font-size: 50px; font-weight: 900; letter-spacing: 1px; text-shadow: 0 0 10px rgba(255,255,255,0.8); } .live-badge { border: 4px solid #cc0000; border-radius: 12px; padding: 5px 20px; font-size: 40px; font-weight: 700; display: flex; gap: 10px; } .hero-container { position: relative; width: 100%; height: 440px; } .hero-img { width: 100%; height: 100%; object-fit: cover; filter: blur(5px); opacity: 0.6; } .pip-img { position: absolute; top: 20px; right: 40px; width: 45%; border: 6px solid white; box-shadow: -15px 15px 30px rgba(0,0,0,0.8); } .text-container { flex-grow: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 10px 40px; } .main-title { font-size: 70px; font-weight: 900; line-height: 1.1; text-shadow: 6px 6px 15px rgba(0,0,0,0.9); } .live-text { color: #cc0000; }</style>
//         </head><body><div class="header"><div class="logo">SPORTSHUB</div><div class="live-badge"><span style="color:#cc0000">●</span> LIVE</div></div><div class="hero-container"><img src="${b64Image}" class="hero-img"><img src="${b64Image}" class="pip-img"></div><div class="text-container"><div class="main-title"><span class="live-text">LIVE NOW: </span>${titleText}</div></div></body></html>`;

//     const tb = await puppeteer.launch({ headless: true, defaultViewport: { width: 1280, height: 720 }, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
//     const tPage = await tb.newPage();
//     await tPage.setContent(htmlCode);
//     await tPage.screenshot({ path: outputImagePath });
//     await tb.close();
//     if (fs.existsSync(rawFrame)) fs.unlinkSync(rawFrame); 
//     console.log(`[✅ Worker 0.5] Thumbnail Ready: ${outputImagePath}`);
//     return true;
// }

// // ==========================================
// // 🛠️ ASYNC FFMPEG EXECUTOR (With Enhanced Error Logs)
// // ==========================================
// async function runFFmpegEditAsync(args, stepName) {
//     return new Promise((resolve) => {
//         const ffmpegProc = spawn('ffmpeg', args);
//         let lastLogTime = Date.now();
//         let errorLog = "";

//         ffmpegProc.stderr.on('data', (data) => {
//             const output = data.toString().trim();
//             errorLog = output; // Save the last output line to show if it fails
            
//             if (Date.now() - lastLogTime > 3000) {
//                 if (output.includes('time=')) console.log(`[FFmpeg ${stepName}]: ${output.substring(0, 100)}...`);
//                 lastLogTime = Date.now();
//             }
//         });

//         ffmpegProc.on('close', (code) => {
//             if (code === 0) { 
//                 console.log(`[✅] ${stepName} Completed Successfully!`); 
//                 resolve(true); 
//             } else { 
//                 console.log(`[❌] ${stepName} Failed! Reason: \n${errorLog}`); 
//                 resolve(false); 
//             }
//         });
//     });
// }

// // ==========================================
// // 🎥 WORKER 1 & 2: THE NEW FLAWLESS CAPTURE & EDIT
// // ==========================================
// async function worker_1_2_capture_and_edit(outputVid) {
//     console.log(`\n[🎬 Worker 1 & 2] Puppeteer Recording & Fast Edit shuru ho raha hai...`);
//     const audioFile = "marya_live.mp3"; const bgImage = "website_frame.png"; const staticVideo = "main_video.mp4"; 
//     const blurAmount = "15:3"; const duration = "10";
    
//     const hasBg = fs.existsSync(bgImage); const hasAudio = fs.existsSync(audioFile); const hasMainVideo = fs.existsSync(staticVideo);
//     const raw10sVid = `raw_screen_${Date.now()}.mp4`; const tempDynVideo = `temp_dyn_${Date.now()}.mp4`; 

//     // ----------------------------------------
//     // 🚀 STEP 0: RECORD USING PUPPETEER
//     // ----------------------------------------
//     console.log(`\n[>] [Step 0] Recording 10 seconds of LIVE Fullscreen using Puppeteer...`);
//     try {
//         const recorder = new PuppeteerScreenRecorder(page, { fps: 30 });
//         await recorder.start(raw10sVid);
//         await new Promise(r => setTimeout(r, 10000)); // Exactly 10 seconds wait
//         await recorder.stop();
//         console.log(`[✅] Step 0 Done! Smooth 10s video captured.`);
//     } catch (e) {
//         console.log(`[❌] Puppeteer recording failed: ${e.message}`);
//         return false;
//     }

//     if (!fs.existsSync(raw10sVid) || fs.statSync(raw10sVid).size < 1000) return false;

//     // 🔴 ECO-MODE: Browser band kar do
//     console.log(`[🧹 ECO-MODE] Screen capture done. Closing browser to free up RAM before heavy processing...`);
//     await cleanup(); 

//     // ----------------------------------------
//     // STEP A: EDIT CLIP (Blur & PiP + Audio)
//     // ----------------------------------------
//     console.log(`\n[>] [Step A] Applying Blur & PiP Frame on recorded clip...`);
//     let args1 = ["-y", "-thread_queue_size", "1024", "-i", raw10sVid]; 
//     if (hasBg) args1.push("-thread_queue_size", "1024", "-loop", "1", "-framerate", "30", "-i", bgImage);
//     if (hasAudio) args1.push("-thread_queue_size", "1024", "-stream_loop", "-1", "-i", audioFile);
    
//     // 🚀 FIX: Typo removed. Added setpts for perfect speed sync!
//     let filterComplex1 = hasBg 
//         ? `[0:v]setpts=PTS-STARTPTS,fps=30,scale=1064:565,boxblur=${blurAmount}[pip]; [1:v]setpts=PTS-STARTPTS,fps=30[bg]; [bg][pip]overlay=0:250:shortest=1,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p[outv]` 
//         : `[0:v]setpts=PTS-STARTPTS,fps=30,scale=1280:720,boxblur=${blurAmount},format=yuv420p[outv]`;
        
//     args1.push("-filter_complex", filterComplex1, "-map", "[outv]");
    
//     if (hasAudio) {
//         let audioIndex = hasBg ? 2 : 1;
//         args1.push("-map", `${audioIndex}:a:0`, "-af", "aresample=async=1");
//     } else {
//         // Fallback incase audio is missing
//         args1.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100", "-map", "1:a:0");
//     }
    
//     args1.push("-c:v", "libx264", "-preset", "ultrafast", "-threads", "2", "-vsync", "1", "-c:a", "aac", "-b:a", "128k", "-t", duration, tempDynVideo);

//     const editSuccess = await runFFmpegEditAsync(args1, "Apply Filters");
//     if (fs.existsSync(raw10sVid)) fs.unlinkSync(raw10sVid); 
    
//     if (!editSuccess || !fs.existsSync(tempDynVideo)) return false;

//     // ----------------------------------------
//     // STEP B: MERGE
//     // ----------------------------------------
//     if (hasMainVideo) {
//         console.log(`\n[>] [Step B] Merging with 'main_video.mp4'...`);
//         let args2 = ["-y", "-i", tempDynVideo, "-i", staticVideo, "-filter_complex", "[0:v]scale=1280:720,setsar=1,fps=30,format=yuv420p[v0]; [0:a]aformat=sample_rates=44100:channel_layouts=stereo[a0]; [1:v]scale=1280:720,setsar=1,fps=30,format=yuv420p[v1]; [1:a]aformat=sample_rates=44100:channel_layouts=stereo[a1]; [v0][a0][v1][a1]concat=n=2:v=1:a=1[outv][outa]", "-map", "[outv]", "-map", "[outa]", "-c:v", "libx264", "-preset", "ultrafast", "-threads", "2", "-vsync", "1", "-c:a", "aac", "-b:a", "128k", outputVid];
        
//         const mergeSuccess = await runFFmpegEditAsync(args2, "Merge Video");
//         fs.unlinkSync(tempDynVideo); 
        
//         if (mergeSuccess && fs.existsSync(outputVid)) return true;
//     } else {
//         console.log(`[⚠️] 'main_video.mp4' nahi mili! Sirf edited clip final bani.`);
//         fs.renameSync(tempDynVideo, outputVid); return true;
//     }
//     return false;
// }

// // ==========================================
// // 📤 WORKER 3: FACEBOOK UPLOAD 
// // ==========================================
// async function checkFacebookToken(token) { const res = await axios.get(`https://graph.facebook.com/v18.0/me?access_token=${token}&fields=id,name`); return { pageId: res.data.id, pageName: res.data.name }; }

// async function worker_3_upload(videoPath, thumbPath, title, desc) {
//     console.log(`\n[📤 Worker 3] Facebook Upload (Mode: ${TOKEN_SELECTION})`);
//     let tokensToTry = TOKEN_SELECTION === 'Token1' ? [FB_TOKEN_1] : TOKEN_SELECTION === 'Token2' ? [FB_TOKEN_2] : [FB_TOKEN_1, FB_TOKEN_2]; 
//     let activeToken = null, pageId = null;
//     for (let token of tokensToTry) { if (!token) continue; try { const info = await checkFacebookToken(token); activeToken = token; pageId = info.pageId; break; } catch (e) { } }
//     if (!activeToken) return false;

//     try {
//         const form = new FormData(); form.append('access_token', activeToken); form.append('title', title); form.append('description', desc); form.append('source', fs.createReadStream(videoPath));
//         if (fs.existsSync(thumbPath)) form.append('thumb', fs.createReadStream(thumbPath));
//         const uploadRes = await axios.post(`https://graph-video.facebook.com/v18.0/${pageId}/videos`, form, { headers: form.getHeaders() });
//         await new Promise(r => setTimeout(r, 15000));
        
//         const commentForm = new FormData(); commentForm.append('access_token', activeToken); commentForm.append('message', '📺 Watch Full Match Without Buffering Here: https://bulbul4u-live.xyz');
//         if (fs.existsSync("comment_image.jpeg")) commentForm.append('source', fs.createReadStream("comment_image.jpeg"));
//         await axios.post(`https://graph.facebook.com/v18.0/${uploadRes.data.id}/comments`, commentForm, { headers: commentForm.getHeaders() });
//         console.log(`[✅] Upload & Comment Posted!`); return true;
//     } catch (e) { return false; }
// }

// // ==========================================
// // 🚀 CRASH MANAGER & MAIN HYBRID LOOP
// // ==========================================
// async function cleanup() {
//     if (browser) { try { await browser.close(); console.log(`[🧹] Browser connection closed.`); } catch (e) { } browser = null; page = null; targetFrame = null; }
// }

// async function triggerNextRun() {
//     const token = process.env.GH_PAT, repo = process.env.GITHUB_REPOSITORY, branch = process.env.GITHUB_REF_NAME || 'main'; if (!token || !repo) return;
//     try { await axios.post(`https://api.github.com/repos/${repo}/actions/workflows/video_loop.yml/dispatches`, { ref: branch, inputs: { target_url: TARGET_URL, titles_list: TITLES_INPUT, descs_list: DESCS_INPUT, hashtags: HASHTAGS, token_selection: TOKEN_SELECTION } }, { headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' } }); console.log(`\n[🔄 AUTO-RESTART] Naya bot trigger kar diya gaya!`); } catch (e) { }
// }

// async function main() {
//     console.log("\n==================================================");
//     console.log(`   🚀 HYBRID BOT (PUPPETEER RECORDING FIXED)`);
//     console.log(`   ⏰ STARTED AT: ${formatPKT()}`);
//     console.log("==================================================");

//     let nextRunTriggered = false;

//     while (true) {
//         const elapsedTimeMs = Date.now() - START_TIME;
//         console.log(`\n--------------------------------------------------`);
//         console.log(`--- 🔄 STARTING VIDEO CYCLE #${clipCounter} ---`);
//         console.log(`  [-] Bot Uptime: ${Math.floor(elapsedTimeMs / 60000)} minutes`);
//         console.log(`--------------------------------------------------`);

//         if (elapsedTimeMs > RESTART_TRIGGER_MS && !nextRunTriggered) { await triggerNextRun(); nextRunTriggered = true; }
//         if (elapsedTimeMs > END_TIME_LIMIT_MS) { console.log(`[🛑] 6 Hours Limit. Exiting.`); process.exit(0); }

//         const meta = generateMetadata(clipCounter);
//         const thumbFile = `studio_thumb_${clipCounter}.png`;
//         const finalVidFile = `final_${clipCounter}.mp4`;

//         try {
//             await initBrowserAndPlayer(clipCounter === 1); 
//             await worker_0_5_generate_thumbnail(meta.title, thumbFile);
            
//             if (await worker_1_2_capture_and_edit(finalVidFile)) {
//                 await worker_3_upload(finalVidFile, thumbFile, meta.title, meta.desc);
//             }
//         } catch (err) {
//             console.error(`\n[!] CRASH DETECTED IN CYCLE #${clipCounter}: ${err.message}`);
//         } finally {
//             await cleanup();
//             [thumbFile, finalVidFile].forEach(f => { if (fs.existsSync(f)) { fs.unlinkSync(f); } });
//             console.log(`\n[⏳ Cycle End] Cycle #${clipCounter} Mukammal! Aglay round tak 5 minute wait kar raha hoon...`);
//             clipCounter++;
//             await new Promise(r => setTimeout(r, WAIT_TIME_MS)); 
//         }
//     }
// }

// main();







































































// ========== video uplaod successfully to the facebook, but the 10sec capture(recording) video iss hang.I saw this issue  in the final video =========================




// const puppeteer = require('puppeteer-extra');
// const StealthPlugin = require('puppeteer-extra-plugin-stealth');
// puppeteer.use(StealthPlugin());

// const { spawn, execSync } = require('child_process');
// const fs = require('fs');
// const FormData = require('form-data');
// const axios = require('axios'); 
// const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');

// // ==========================================
// // ⚙️ SETTINGS & ENVIRONMENT VARIABLES
// // ==========================================
// const TARGET_URL = process.env.TARGET_URL || 'https://dlstreams.com/watch.php?id=316';

// const FB_TOKEN_1 = process.env.FB_TOKEN_1 || '';
// const FB_TOKEN_2 = process.env.FB_TOKEN_2 || '';
// const TOKEN_SELECTION = process.env.TOKEN_SELECTION || 'Dual'; 

// const TITLES_INPUT = process.env.TITLES_LIST || 'Live Match Today,,Watch Full Match DC vs GT';
// const DESCS_INPUT = process.env.DESCS_LIST || 'Watch the live action here';
// const HASHTAGS = process.env.HASHTAGS || '#IPL2026 #DCvsGT #CricketLovers #LiveMatch';

// const WAIT_TIME_MS = 300 * 1000; // 5 Minutes loop wait
// const START_TIME = Date.now();
// const RESTART_TRIGGER_MS = (5 * 60 * 60 + 30 * 60) * 1000; // 5.5 Hours
// const END_TIME_LIMIT_MS = (5 * 60 * 60 + 50 * 60) * 1000; // 5.8 Hours

// let clipCounter = 1;

// // 🌐 BROWSER VARIABLES
// let browser = null;
// let page = null;
// let targetFrame = null;
// const DISPLAY_NUM = process.env.DISPLAY || ':99';

// function formatPKT(timestampMs = Date.now()) {
//     return new Date(timestampMs).toLocaleString('en-US', {
//         timeZone: 'Asia/Karachi', hour12: true, year: 'numeric', month: 'short',
//         day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
//     }) + " PKT";
// }

// function generateMetadata(clipNum) {
//     const titles = TITLES_INPUT.split(',,').map(t => t.trim()).filter(t => t);
//     const descs = DESCS_INPUT.split(',,').map(d => d.trim()).filter(d => d);
//     const title = titles.length ? titles[Math.floor(Math.random() * titles.length)] : "Live Match";
//     const descBody = descs.length ? descs[Math.floor(Math.random() * descs.length)] : "Watch live!";
//     const emojis = ["🔥", "🏏", "⚡", "🏆", "💥", "😱", "📺", "🚀"].sort(() => 0.5 - Math.random()).slice(0, 3);
//     const tags = HASHTAGS.split(' ').sort(() => 0.5 - Math.random()).slice(0, 4).join(' ');
    
//     const finalTitle = title.substring(0, 240); 
//     const finalDesc = `${finalTitle} ${emojis.join(' ')}\n\n${descBody}\n\n⏱️ Update: ${formatPKT()}\n👇 Watch Full Match Link in First Comment!\n\n${tags}`;
//     return { title: finalTitle, desc: finalDesc };
// }

// // =========================================================================
// // 🌐 SETUP BROWSER (Runs Fresh Every Cycle)
// // =========================================================================
// async function initBrowserAndPlayer(isFirstCycle) {
//     console.log(`\n[*] Starting FRESH browser instance...`);
    
//     browser = await puppeteer.launch({
//         channel: 'chrome', headless: false, 
//         defaultViewport: { width: 1280, height: 720 },
//         ignoreDefaultArgs: ['--enable-automation'], 
//         args: [ '--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,720', '--kiosk', '--autoplay-policy=no-user-gesture-required', '--mute-audio' ]
//     });

//     page = await browser.newPage();
//     const pages = await browser.pages();
//     for (const p of pages) if (p !== page) await p.close();

//     browser.on('targetcreated', async (target) => {
//         if (target.type() === 'page') {
//             try { const newPage = await target.page(); if (newPage && newPage !== page) { await page.bringToFront(); setTimeout(() => newPage.close().catch(() => {}), 1000); } } catch (e) { }
//         }
//     });

//     console.log(`[*] Navigating to target URL: ${TARGET_URL}...`);
//     await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
//     await new Promise(r => setTimeout(r, 10000)); 

//     console.log('[*] Scanning iframes for the REAL Live Stream Video...');
//     for (const frame of page.frames()) {
//         try {
//             const isRealLiveStream = await frame.evaluate(() => {
//                 const vid = document.querySelector('video[data-html5-video]') || document.querySelector('video');
//                 return vid && vid.clientWidth > 300; 
//             });
//             if (isRealLiveStream) {
//                 targetFrame = frame;
//                 await frame.evaluate(() => { const fAd = document.getElementById('floated'); if (fAd) fAd.remove(); });
//             }
//         } catch (e) { }
//     }

//     if (!targetFrame) throw new Error('No <video> element could be found.');

//     try {
//         const iframeEl = await targetFrame.frameElement();
//         const box = await iframeEl.boundingBox();
//         if (box) await page.mouse.click(box.x + (box.width / 2), box.y + (box.height / 2), { delay: 100 });
//         await new Promise(r => setTimeout(r, 2000));
//     } catch (e) { }

//     await targetFrame.evaluate(async () => {
//         const video = document.querySelector('video[data-html5-video]') || document.querySelector('video');
//         if (video) { video.volume = 1.0; await video.play().catch(e => {}); }
//     });

//     await targetFrame.evaluate(async () => {
//         const vid = document.querySelector('video[data-html5-video]') || document.querySelector('video');
//         if (!vid) return;
//         try {
//             if (vid.requestFullscreen) await vid.requestFullscreen();
//             else if (vid.webkitRequestFullscreen) await vid.webkitRequestFullscreen();
//         } catch (err) {
//             vid.style.position = 'fixed'; vid.style.top = '0'; vid.style.left = '0';
//             vid.style.width = '100vw'; vid.style.height = '100vh'; vid.style.zIndex = '2147483647'; vid.style.backgroundColor = 'black'; vid.style.objectFit = 'contain';
//         }
//     });

//     console.log('[✅] Browser Ready! Video is playing fullscreen.');

//     // 🎥 DEBUG RECORDING
//     if (isFirstCycle) {
//         console.log(`\n[🔍 DEBUG] Cycle 1 par 15-second ki Visual Debug Recording kar raha hoon...`);
//         const recorder = new PuppeteerScreenRecorder(page);
//         const debugFileName = `debug_video_${Date.now()}.mp4`;
//         await recorder.start(debugFileName);
        
//         await new Promise(r => setTimeout(r, 15000)); 
//         await recorder.stop();
        
//         console.log(`[📤 DEBUG] Uploading to GitHub Releases...`);
//         try {
//             const tagName = `visual-debug-${Date.now()}`;
//             execSync(`gh release create ${tagName} ${debugFileName} --title "Visual Debug Capture" --notes "First Cycle Screen Check"`, { stdio: 'inherit' });
//             console.log('✅ [+] Successfully uploaded visual debug video to GitHub Releases!');
//         } catch (err) {
//             console.error('❌ [!] Failed to upload debug video:', err.message);
//         }
//         if (fs.existsSync(debugFileName)) fs.unlinkSync(debugFileName);
//     }
// }

// // ==========================================
// // 📸 WORKER 0.5: GENERATE THUMBNAIL 
// // ==========================================
// async function worker_0_5_generate_thumbnail(titleText, outputImagePath) {
//     console.log(`\n[🎨 Worker 0.5] Puppeteer se HD Thumbnail bana raha hoon...`);
//     const rawFrame = 'temp_raw_frame.jpg';
//     try { await page.screenshot({ path: rawFrame, type: 'jpeg', quality: 90 }); } catch (e) { return false; }
//     if (!fs.existsSync(rawFrame)) return false;
//     const b64Image = "data:image/jpeg;base64," + fs.readFileSync(rawFrame).toString('base64');
    
//     const htmlCode = `
//         <!DOCTYPE html><html><head><link href="https://fonts.googleapis.com/css2?family=Roboto:wght@700;900&display=swap" rel="stylesheet">
//         <style>body { margin: 0; width: 1280px; height: 720px; background: #0f0f0f; font-family: 'Roboto', sans-serif; color: white; display: flex; flex-direction: column; overflow: hidden; } .header { height: 100px; display: flex; align-items: center; padding: 0 40px; justify-content: space-between; z-index: 10; } .logo { font-size: 50px; font-weight: 900; letter-spacing: 1px; text-shadow: 0 0 10px rgba(255,255,255,0.8); } .live-badge { border: 4px solid #cc0000; border-radius: 12px; padding: 5px 20px; font-size: 40px; font-weight: 700; display: flex; gap: 10px; } .hero-container { position: relative; width: 100%; height: 440px; } .hero-img { width: 100%; height: 100%; object-fit: cover; filter: blur(5px); opacity: 0.6; } .pip-img { position: absolute; top: 20px; right: 40px; width: 45%; border: 6px solid white; box-shadow: -15px 15px 30px rgba(0,0,0,0.8); } .text-container { flex-grow: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 10px 40px; } .main-title { font-size: 70px; font-weight: 900; line-height: 1.1; text-shadow: 6px 6px 15px rgba(0,0,0,0.9); } .live-text { color: #cc0000; }</style>
//         </head><body><div class="header"><div class="logo">SPORTSHUB</div><div class="live-badge"><span style="color:#cc0000">●</span> LIVE</div></div><div class="hero-container"><img src="${b64Image}" class="hero-img"><img src="${b64Image}" class="pip-img"></div><div class="text-container"><div class="main-title"><span class="live-text">LIVE NOW: </span>${titleText}</div></div></body></html>`;

//     const tb = await puppeteer.launch({ headless: true, defaultViewport: { width: 1280, height: 720 }, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
//     const tPage = await tb.newPage();
//     await tPage.setContent(htmlCode);
//     await tPage.screenshot({ path: outputImagePath });
//     await tb.close();
//     if (fs.existsSync(rawFrame)) fs.unlinkSync(rawFrame); 
//     console.log(`[✅ Worker 0.5] Thumbnail Ready: ${outputImagePath}`);
//     return true;
// }

// // ==========================================
// // 🛠️ ASYNC FFMPEG EXECUTOR 
// // ==========================================
// async function runFFmpegAsync(args, stepName) {
//     return new Promise((resolve) => {
//         const ffmpegProc = spawn('ffmpeg', args);
//         let lastLogTime = Date.now();

//         ffmpegProc.stderr.on('data', (data) => {
//             const output = data.toString().trim();
//             if (output.toLowerCase().includes('error') || Date.now() - lastLogTime > 3000) {
//                 if (output.includes('time=') || output.toLowerCase().includes('error')) {
//                     console.log(`[FFmpeg ${stepName}]: ${output.substring(0, 100)}...`);
//                 }
//                 lastLogTime = Date.now();
//             }
//         });

//         ffmpegProc.on('close', (code) => {
//             if (code === 0) {
//                 console.log(`[✅] ${stepName} Completed Successfully!`);
//                 resolve(true);
//             } else {
//                 console.log(`[❌] ${stepName} Failed with Code: ${code}`);
//                 resolve(false);
//             }
//         });
//     });
// }

// // ==========================================
// // 🎥 WORKER 1 & 2: SCREEN RECORDING + EDIT 
// // ==========================================
// async function worker_1_2_capture_and_edit(outputVid) {
//     console.log(`\n[🎬 Worker 1 & 2] Physical Screen Recording & Fast Edit shuru ho raha hai...`);
//     const audioFile = "marya_live.mp3"; const bgImage = "website_frame.png"; const staticVideo = "main_video.mp4"; 
//     const duration = "10"; const blurAmount = "15:3"; 
    
//     const hasBg = fs.existsSync(bgImage); const hasAudio = fs.existsSync(audioFile); const hasMainVideo = fs.existsSync(staticVideo);
//     const raw10sVid = `raw_screen_${Date.now()}.mp4`; const tempDynVideo = `temp_dyn_${Date.now()}.mp4`; 

//     // ----------------------------------------
//     // STEP 0: RECORD 10 SECONDS
//     // ----------------------------------------
//     console.log(`\n[>] [Step 0] Recording 10 seconds of LIVE Fullscreen (x11grab)...`);
//     const captureArgs = ['-y', '-f', 'x11grab', '-draw_mouse', '0', '-video_size', '1280x720', '-framerate', '30', '-i', DISPLAY_NUM, '-f', 'pulse', '-i', 'default', '-c:v', 'libx264', '-preset', 'ultrafast', '-threads', '2', '-c:a', 'aac', '-t', duration, raw10sVid];
    
//     const recordSuccess = await runFFmpegAsync(captureArgs, "Screen Capture");
//     if (!recordSuccess || !fs.existsSync(raw10sVid) || fs.statSync(raw10sVid).size < 1000) {
//         console.log(`[❌] Screen recording fail ho gayi. File nahi bani.`); return false;
//     }

//     // 🔴 ECO-MODE: Browser band kar do
//     console.log(`[🧹 ECO-MODE] Screen capture done. Closing browser to free up RAM before heavy processing...`);
//     await cleanup(); 

//     // ----------------------------------------
//     // STEP A: EDIT CLIP (Blur & PiP)
//     // ----------------------------------------
//     console.log(`\n[>] [Step A] Applying Blur & PiP Frame on recorded clip...`);
//     let args1 = ["-y", "-thread_queue_size", "1024", "-i", raw10sVid]; 
//     if (hasBg) args1.push("-thread_queue_size", "1024", "-loop", "1", "-framerate", "30", "-i", bgImage);
//     if (hasAudio) args1.push("-thread_queue_size", "1024", "-stream_loop", "-1", "-i", audioFile);
    
//     let filterComplex1 = hasBg ? `[0:v]scale=1064:565,boxblur=${blurAmount}[pip]; [1:v][pip]overlay=0:250:shortest=1,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p[outv]` : `[0:v]scale=1280:720,boxblur=${blurAmount},format=yuv420p[outv]`;
//     args1.push("-filter_complex", filterComplex1, "-map", "[outv]");
//     args1.push(hasAudio ? (hasBg ? "-map" : "-map") : "-map", hasAudio ? (hasBg ? "2:a:0" : "1:a:0") : "0:a:0");
    
//     // 🚀 FIX APPLIED HERE: Added "-t duration" before the output file so it strictly stops at 10 seconds!
//     args1.push("-c:v", "libx264", "-preset", "ultrafast", "-threads", "2", "-c:a", "aac", "-b:a", "128k", "-t", duration, tempDynVideo);

//     const editSuccess = await runFFmpegAsync(args1, "Apply Filters");
//     if (fs.existsSync(raw10sVid)) fs.unlinkSync(raw10sVid); 
    
//     if (!editSuccess || !fs.existsSync(tempDynVideo)) {
//         console.log(`[❌] Edit step failed.`); return false;
//     }

//     // ----------------------------------------
//     // STEP B: MERGE
//     // ----------------------------------------
//     if (hasMainVideo) {
//         console.log(`\n[>] [Step B] Merging with 'main_video.mp4'...`);
//         let args2 = ["-y", "-i", tempDynVideo, "-i", staticVideo, "-filter_complex", "[0:v]scale=1280:720,setsar=1,fps=30,format=yuv420p[v0]; [0:a]aformat=sample_rates=44100:channel_layouts=stereo[a0]; [1:v]scale=1280:720,setsar=1,fps=30,format=yuv420p[v1]; [1:a]aformat=sample_rates=44100:channel_layouts=stereo[a1]; [v0][a0][v1][a1]concat=n=2:v=1:a=1[outv][outa]", "-map", "[outv]", "-map", "[outa]", "-c:v", "libx264", "-preset", "ultrafast", "-threads", "2", "-c:a", "aac", "-b:a", "128k", outputVid];
        
//         const mergeSuccess = await runFFmpegAsync(args2, "Merge Video");
//         fs.unlinkSync(tempDynVideo); 
        
//         if (mergeSuccess && fs.existsSync(outputVid)) return true;
//     } else {
//         console.log(`[⚠️] 'main_video.mp4' nahi mili! Sirf edited clip final bani.`);
//         fs.renameSync(tempDynVideo, outputVid); return true;
//     }
//     return false;
// }

// // ==========================================
// // 📤 WORKER 3: FACEBOOK UPLOAD 
// // ==========================================
// async function checkFacebookToken(token) { const res = await axios.get(`https://graph.facebook.com/v18.0/me?access_token=${token}&fields=id,name`); return { pageId: res.data.id, pageName: res.data.name }; }

// async function worker_3_upload(videoPath, thumbPath, title, desc) {
//     console.log(`\n[📤 Worker 3] Facebook Upload (Mode: ${TOKEN_SELECTION})`);
//     let tokensToTry = TOKEN_SELECTION === 'Token1' ? [FB_TOKEN_1] : TOKEN_SELECTION === 'Token2' ? [FB_TOKEN_2] : [FB_TOKEN_1, FB_TOKEN_2]; 
//     let activeToken = null, pageId = null;
//     for (let token of tokensToTry) { if (!token) continue; try { const info = await checkFacebookToken(token); activeToken = token; pageId = info.pageId; break; } catch (e) { } }
//     if (!activeToken) return false;

//     try {
//         const form = new FormData(); form.append('access_token', activeToken); form.append('title', title); form.append('description', desc); form.append('source', fs.createReadStream(videoPath));
//         if (fs.existsSync(thumbPath)) form.append('thumb', fs.createReadStream(thumbPath));
//         const uploadRes = await axios.post(`https://graph-video.facebook.com/v18.0/${pageId}/videos`, form, { headers: form.getHeaders() });
//         await new Promise(r => setTimeout(r, 15000));
        
//         const commentForm = new FormData(); commentForm.append('access_token', activeToken); commentForm.append('message', '📺 Watch Full Match Without Buffering Here: https://bulbul4u-live.xyz');
//         if (fs.existsSync("comment_image.jpeg")) commentForm.append('source', fs.createReadStream("comment_image.jpeg"));
//         await axios.post(`https://graph.facebook.com/v18.0/${uploadRes.data.id}/comments`, commentForm, { headers: commentForm.getHeaders() });
//         console.log(`[✅] Upload & Comment Posted!`); return true;
//     } catch (e) { return false; }
// }

// // ==========================================
// // 🚀 CRASH MANAGER & MAIN HYBRID LOOP
// // ==========================================
// async function cleanup() {
//     if (browser) { try { await browser.close(); console.log(`[🧹] Browser connection closed.`); } catch (e) { } browser = null; page = null; targetFrame = null; }
// }

// async function triggerNextRun() {
//     const token = process.env.GH_PAT, repo = process.env.GITHUB_REPOSITORY, branch = process.env.GITHUB_REF_NAME || 'main'; if (!token || !repo) return;
//     try { await axios.post(`https://api.github.com/repos/${repo}/actions/workflows/video_loop.yml/dispatches`, { ref: branch, inputs: { target_url: TARGET_URL, titles_list: TITLES_INPUT, descs_list: DESCS_INPUT, hashtags: HASHTAGS, token_selection: TOKEN_SELECTION } }, { headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' } }); console.log(`\n[🔄 AUTO-RESTART] Naya bot trigger kar diya gaya!`); } catch (e) { }
// }

// async function main() {
//     console.log("\n==================================================");
//     console.log(`   🚀 HYBRID SCREEN-RECORDING BOT (ECO-MODE + ASYNC)`);
//     console.log(`   ⏰ STARTED AT: ${formatPKT()}`);
//     console.log("==================================================");

//     let nextRunTriggered = false;

//     while (true) {
//         const elapsedTimeMs = Date.now() - START_TIME;
//         console.log(`\n--------------------------------------------------`);
//         console.log(`--- 🔄 STARTING VIDEO CYCLE #${clipCounter} ---`);
//         console.log(`  [-] Bot Uptime: ${Math.floor(elapsedTimeMs / 60000)} minutes`);
//         console.log(`--------------------------------------------------`);

//         if (elapsedTimeMs > RESTART_TRIGGER_MS && !nextRunTriggered) { await triggerNextRun(); nextRunTriggered = true; }
//         if (elapsedTimeMs > END_TIME_LIMIT_MS) { console.log(`[🛑] 6 Hours Limit. Exiting.`); process.exit(0); }

//         const meta = generateMetadata(clipCounter);
//         const thumbFile = `studio_thumb_${clipCounter}.png`;
//         const finalVidFile = `final_${clipCounter}.mp4`;

//         try {
//             await initBrowserAndPlayer(clipCounter === 1); 
//             await worker_0_5_generate_thumbnail(meta.title, thumbFile);
            
//             if (await worker_1_2_capture_and_edit(finalVidFile)) {
//                 await worker_3_upload(finalVidFile, thumbFile, meta.title, meta.desc);
//             }
//         } catch (err) {
//             console.error(`\n[!] CRASH DETECTED IN CYCLE #${clipCounter}: ${err.message}`);
//         } finally {
//             await cleanup();
//             [thumbFile, finalVidFile].forEach(f => { if (fs.existsSync(f)) { fs.unlinkSync(f); } });
//             console.log(`\n[⏳ Cycle End] Cycle #${clipCounter} Mukammal! Aglay round tak 5 minute wait kar raha hoon...`);
//             clipCounter++;
//             await new Promise(r => setTimeout(r, WAIT_TIME_MS)); 
//         }
//     }
// }

// main();
