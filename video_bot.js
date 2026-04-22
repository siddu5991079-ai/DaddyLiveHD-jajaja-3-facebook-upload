const puppeteer = require('puppeteer');
const { spawnSync, execSync } = require('child_process');
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios'); 

// ==========================================
// ⚙️ SETTINGS & ENVIRONMENT VARIABLES
// ==========================================
const TARGET_URL = process.env.TARGET_URL || 'https://dadocric.st/player.php?id=ptvsp';

// 🔑 DUAL FACEBOOK TOKENS
const FB_TOKEN_1 = process.env.FB_TOKEN_1 || '';
const FB_TOKEN_2 = process.env.FB_TOKEN_2 || '';
const TOKEN_SELECTION = process.env.TOKEN_SELECTION || 'Dual'; 

const TITLES_INPUT = process.env.TITLES_LIST || 'Live Match Today,,Watch Full Match DC vs GT';
const DESCS_INPUT = process.env.DESCS_LIST || 'Watch the live action here';
const HASHTAGS = process.env.HASHTAGS || '#IPL2026 #DCvsGT #CricketLovers #LiveMatch';

const WAIT_TIME_MS = 300 * 1000; 
const START_TIME = Date.now();
const RESTART_TRIGGER_MS = (5 * 60 * 60 + 30 * 60) * 1000; 
const END_TIME_LIMIT_MS = (5 * 60 * 60 + 50 * 60) * 1000; 

let consecutiveLinkFails = 0;
let clipCounter = 1;

function formatPKT(timestampMs = Date.now()) {
    return new Date(timestampMs).toLocaleString('en-US', {
        timeZone: 'Asia/Karachi', hour12: true, year: 'numeric', month: 'short',
        day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
    }) + " PKT";
}

// ==========================================
// 🧠 METADATA GENERATOR
// ==========================================
function generateMetadata(clipNum) {
    console.log(`\n[🧠 Metadata] Cycle #${clipNum} ke liye naya Title aur Description ban raha hai...`);
    const titles = TITLES_INPUT.split(',,').map(t => t.trim()).filter(t => t);
    const descs = DESCS_INPUT.split(',,').map(d => d.trim()).filter(d => d);
    const title = titles.length ? titles[Math.floor(Math.random() * titles.length)] : "Live Match Today";
    const descBody = descs.length ? descs[Math.floor(Math.random() * descs.length)] : "Watch the live action here!";
    const emojis = ["🔥", "🏏", "⚡", "🏆", "💥", "😱", "📺", "🚀"].sort(() => 0.5 - Math.random()).slice(0, 3);
    const tags = HASHTAGS.split(' ').sort(() => 0.5 - Math.random()).slice(0, 4).join(' ');
    
    const finalTitle = title.substring(0, 240); 
    const finalDesc = `${finalTitle} ${emojis.join(' ')}\n\n${descBody}\n\n⏱️ Update: ${formatPKT()}\n👇 Watch Full Match Link in First Comment!\n\n${tags}`;
    console.log(`[✅ Metadata] Ready: ${finalTitle}`);
    return { title: finalTitle, desc: finalDesc };
}

// ==========================================
// 🔍 WORKER 0: GET M3U8 LINK (SMART CHECK LOGIC)
// ==========================================
async function getStreamData() {
    console.log(`\n[🔍 STEP 1] Puppeteer Chrome Start kar raha hoon... (Strike: ${consecutiveLinkFails}/3)`);
    const browser = await puppeteer.launch({ 
        headless: true, 
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--mute-audio'] 
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    let streamData = null;
    page.on('request', (request) => {
        const url = request.url();
        if (url.includes('.m3u8')) {
            const urlObj = new URL(url);
            const expires = urlObj.searchParams.get('expires') || urlObj.searchParams.get('e') || urlObj.searchParams.get('exp');
            let expireMs = expires ? parseInt(expires) * 1000 : Date.now() + (60 * 60 * 1000);
            streamData = {
                url: url, referer: request.headers()['referer'] || TARGET_URL,
                cookie: request.headers()['cookie'] || '', expireTime: expireMs
            };
        }
    });

    try {
        console.log(`[🌐] Target URL par ja raha hoon: ${TARGET_URL}`);
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });
        
        // 🚀 PROJECT 1: SMART SCANNER & FORCED PLAY LOGIC
        console.log('[*] Scanning iframes for the REAL Live Stream Video (Project 1 Integration)...');
        let targetFrame = null;
        for (const frame of page.frames()) {
            try {
                const isRealLiveStream = await frame.evaluate(() => {
                    const vid = document.querySelector('video[data-html5-video]') || document.querySelector('video');
                    return !!vid; 
                });
                if (isRealLiveStream) {
                    targetFrame = frame;
                    console.log(`[+] Smart Scanner selected Real Video in frame: ${frame.url() || 'unknown'}`);
                    break;
                }
            } catch (e) { }
        }

        if (targetFrame) {
            console.log('[*] Executing JS Play logic to trigger m3u8 request...');
            await targetFrame.evaluate(async () => {
                const video = document.querySelector('video[data-html5-video]') || document.querySelector('video');
                if (video) {
                    video.muted = true; // Audio mute is safer for auto-play
                    await video.play().catch(e => {});
                }
            });
        } else {
            console.log('[⚠️] Specific video element nahi mila, fallback to general click...');
            await page.click('body').catch(() => {});
        }
        // 🚀 PROJECT 1 END

        console.log(`[⏳] M3U8 Link ka intezar hai... (5 Second ke 3 Rounds)`);
        
        for (let i = 1; i <= 3; i++) {
            await new Promise(r => setTimeout(r, 5000)); // 5 Second Wait
            
            if (streamData) {
                console.log(`[✅] Round ${i} mein link mil gaya! Aage barh raha hoon...`);
                break; 
            } else {
                console.log(`[⚠️] Round ${i}/3: Abhi tak link nahi mila. Mazeed wait kar raha hoon...`);
            }
        }

    } catch (e) { 
        console.log(`[❌ ERROR] Page load nahi ho saka.`); 
    }
    
    await browser.close();

    if (streamData) {
        consecutiveLinkFails = 0; 
        console.log(`[✅ BINGO] M3U8 Link pakar liya gaya! Expiry: ${formatPKT(streamData.expireTime)}`);
        return streamData;
    } else {
        consecutiveLinkFails++;
        console.log(`[🚨 WARNING] 3 Rounds poore hue par Link nahi mila. Strike: ${consecutiveLinkFails}/3`);
        
        if (consecutiveLinkFails >= 3) {
            console.log(`[🛑 FATAL] 3 baar consecutive link fail hua! Bot ko hamesha ke liye band kar raha hoon.`);
            process.exit(1); 
        }
        return null;
    }
}

// ==========================================
// 📸 WORKER 0.5: GENERATE THUMBNAIL
// ==========================================
async function worker_0_5_generate_thumbnail(data, titleText, outputImagePath) {
    console.log(`\n[🎨 Worker 0.5] Puppeteer se HD Thumbnail bana raha hoon...`);
    const rawFrame = 'temp_raw_frame.jpg';
    try {
        const headersCmd = `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\nReferer: ${data.referer}\r\nCookie: ${data.cookie}\r\n`;
        execSync(`ffmpeg -y -headers "${headersCmd}" -i "${data.url}" -vframes 1 -q:v 2 ${rawFrame}`, { stdio: 'ignore' });
    } catch (e) { return false; }

    if (!fs.existsSync(rawFrame)) return false;
    const b64Image = "data:image/jpeg;base64," + fs.readFileSync(rawFrame).toString('base64');
    
    const htmlCode = `
        <!DOCTYPE html><html><head>
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@700;900&display=swap" rel="stylesheet">
        <style>
            body { margin: 0; width: 1280px; height: 720px; background: #0f0f0f; font-family: 'Roboto', sans-serif; color: white; display: flex; flex-direction: column; overflow: hidden; }
            .header { height: 100px; display: flex; align-items: center; padding: 0 40px; justify-content: space-between; z-index: 10; }
            .logo { font-size: 50px; font-weight: 900; letter-spacing: 1px; text-shadow: 0 0 10px rgba(255,255,255,0.8); }
            .live-badge { border: 4px solid #cc0000; border-radius: 12px; padding: 5px 20px; font-size: 40px; font-weight: 700; display: flex; gap: 10px; }
            .hero-container { position: relative; width: 100%; height: 440px; }
            .hero-img { width: 100%; height: 100%; object-fit: cover; filter: blur(5px); opacity: 0.6; }
            .pip-img { position: absolute; top: 20px; right: 40px; width: 45%; border: 6px solid white; box-shadow: -15px 15px 30px rgba(0,0,0,0.8); }
            .text-container { flex-grow: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 10px 40px; }
            .main-title { font-size: 70px; font-weight: 900; line-height: 1.1; text-shadow: 6px 6px 15px rgba(0,0,0,0.9); }
            .live-text { color: #cc0000; }
        </style>
        </head><body>
            <div class="header"><div class="logo">SPORTSHUB</div><div class="live-badge"><span style="color:#cc0000">●</span> LIVE</div></div>
            <div class="hero-container"><img src="${b64Image}" class="hero-img"><img src="${b64Image}" class="pip-img"></div>
            <div class="text-container"><div class="main-title"><span class="live-text">LIVE NOW: </span>${titleText}</div></div>
        </body></html>`;

    const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1280, height: 720 }, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(htmlCode);
    await page.screenshot({ path: outputImagePath });
    await browser.close();
    if (fs.existsSync(rawFrame)) fs.unlinkSync(rawFrame); 
    console.log(`[✅ Worker 0.5] Thumbnail Ready: ${outputImagePath}`);
    return true;
}

// ==========================================
// 🎥 WORKER 1 & 2: CAPTURE, EDIT & MERGE
// ==========================================
async function worker_1_2_capture_and_edit(data, outputVid) {
    console.log(`\n[🎬 Worker 1 & 2] Stream capture, PiP Frame aur Merging shuru ho rahi hai...`);
    const headersCmd = `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\nReferer: ${data.referer}\r\nCookie: ${data.cookie}\r\n`;
    
    const audioFile = "marya_live.mp3";
    const bgImage = "website_frame.png";
    const staticVideo = "main_video.mp4"; 
    const duration = "10"; 
    const blurAmount = "20:5"; 

    const hasBg = fs.existsSync(bgImage);
    const hasAudio = fs.existsSync(audioFile);
    const hasMainVideo = fs.existsSync(staticVideo);

    const tempDynVideo = `temp_dyn_${Date.now()}.mp4`; 

    // -----------------------------------------------------
    // STEP A: 10 Second Ki Live Clip Banana (Blur + PiP)
    // -----------------------------------------------------
    console.log(`[>] Step A: 10 sec ki live clip tayyar kar raha hoon...`);
    let args1 = [
        "-y", "-thread_queue_size", "1024", "-headers", headersCmd, "-i", data.url
    ];

    if (hasBg) {
        args1.push("-thread_queue_size", "1024", "-loop", "1", "-framerate", "30", "-i", bgImage);
    }
    if (hasAudio) {
        args1.push("-thread_queue_size", "1024", "-stream_loop", "-1", "-i", audioFile);
    }

    let filterComplex1 = "";
    if (hasBg) {
        filterComplex1 += `[0:v]scale=1064:565,boxblur=${blurAmount}[pip]; [1:v][pip]overlay=0:250:shortest=1,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p[outv]`;
    } else {
        filterComplex1 += `[0:v]scale=1280:720,boxblur=${blurAmount},format=yuv420p[outv]`;
    }

    args1.push("-filter_complex", filterComplex1, "-map", "[outv]");

    if (hasAudio) {
        let audioIndex = hasBg ? 2 : 1;
        args1.push("-map", `${audioIndex}:a:0`);
    } else {
        args1.push("-map", "0:a:0");
    }

    args1.push("-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-b:a", "128k", "-t", duration, tempDynVideo);

    try {
        const result1 = spawnSync('ffmpeg', args1, { stdio: 'pipe' });
        if (result1.status !== 0) console.log(`[❌] Step A Error Details:\n${result1.stderr.toString()}`);

        if (fs.existsSync(tempDynVideo) && fs.statSync(tempDynVideo).size > 1000) {
            console.log(`[✅] Step A Done! 10 sec ki clip ban gayi.`);
            
            // -----------------------------------------------------
            // STEP B: Live Clip ko Main Video ke sath Jorna (Merge)
            // -----------------------------------------------------
            if (hasMainVideo) {
                console.log(`[>] Step B: 'main_video.mp4' mil gayi! Ab dono ko aapas mein merge kar raha hoon...`);
                
                let args2 = [
                    "-y",
                    "-i", tempDynVideo,
                    "-i", staticVideo,
                    "-filter_complex",
                    "[0:v]scale=1280:720,setsar=1,fps=30,format=yuv420p[v0]; [0:a]aformat=sample_rates=44100:channel_layouts=stereo[a0]; [1:v]scale=1280:720,setsar=1,fps=30,format=yuv420p[v1]; [1:a]aformat=sample_rates=44100:channel_layouts=stereo[a1]; [v0][a0][v1][a1]concat=n=2:v=1:a=1[outv][outa]",
                    "-map", "[outv]",
                    "-map", "[outa]",
                    "-c:v", "libx264",
                    "-preset", "ultrafast",
                    "-c:a", "aac",
                    "-b:a", "128k",
                    outputVid
                ];

                const result2 = spawnSync('ffmpeg', args2, { stdio: 'pipe' });
                if (result2.status !== 0) console.log(`[❌] Step B Error Details:\n${result2.stderr.toString()}`);
                
                fs.unlinkSync(tempDynVideo); 

                if (fs.existsSync(outputVid) && fs.statSync(outputVid).size > 1000) {
                    console.log(`[✅ Worker 1 & 2] Merging SUCCESS! Final Video Ready: ${outputVid}`);
                    return true;
                } else {
                    console.log(`[❌ Worker 1 & 2] Merging ke dauran file corrupt ho gayi.`);
                }

            } else {
                console.log(`[⚠️] 'main_video.mp4' nahi mili! Sirf 10 sec ki clip ko hi final bana raha hoon.`);
                fs.renameSync(tempDynVideo, outputVid); 
                return true;
            }
        }
    } catch (e) { 
        console.log(`[❌ Worker 1 & 2] FFmpeg processing code crash ho gaya!`); 
    }
    
    return false;
}

// ==========================================
// 📤 WORKER 3: FACEBOOK UPLOAD
// ==========================================
async function checkFacebookToken(token) {
    const res = await axios.get(`https://graph.facebook.com/v18.0/me?access_token=${token}&fields=id,name`);
    return { pageId: res.data.id, pageName: res.data.name };
}

async function worker_3_upload(videoPath, thumbPath, title, desc) {
    console.log(`\n[📤 Worker 3] Facebook Upload (Manual Mode: ${TOKEN_SELECTION})`);
    
    let tokensToTry = [];
    if (TOKEN_SELECTION === 'Token1') tokensToTry = [FB_TOKEN_1];
    else if (TOKEN_SELECTION === 'Token2') tokensToTry = [FB_TOKEN_2];
    else tokensToTry = [FB_TOKEN_1, FB_TOKEN_2]; 

    let activeToken = null;
    let pageId = null;

    for (let token of tokensToTry) {
        if (!token) continue;
        try {
            const info = await checkFacebookToken(token);
            activeToken = token;
            pageId = info.pageId;
            console.log(`[✅ FB Auth] Token Valid! Connected To Page: ${info.pageName}`);
            break; 
        } catch (e) {
            console.log(`[⚠️] Token fail hua. Next try...`);
        }
    }

    if (!activeToken) {
        console.log(`[❌ FATAL] Koi bhi valid token nahi mila! Selection check karein.`);
        return false;
    }

    try {
        const form = new FormData();
        form.append('access_token', activeToken);
        form.append('title', title);
        form.append('description', desc);
        form.append('source', fs.createReadStream(videoPath));
        if (fs.existsSync(thumbPath)) form.append('thumb', fs.createReadStream(thumbPath));

        console.log(`[>] Video Upload ho rahi hai (Isme 10-20 seconds lag sakte hain)...`);
        const uploadRes = await axios.post(`https://graph-video.facebook.com/v18.0/${pageId}/videos`, form, { headers: form.getHeaders() });
        const videoId = uploadRes.data.id;
        console.log(`[✅ Worker 3] Video Successfully Uploaded! (Post ID: ${videoId})`);

        console.log(`[⏳] 15 second ka wait FB ki processing poori hone ke liye...`);
        await new Promise(r => setTimeout(r, 15000));
        
        console.log(`\n[💬] Promotional Comment post karne laga hoon...`);
        const commentForm = new FormData();
        commentForm.append('access_token', activeToken);
        commentForm.append('message', '📺 Watch Full Match Without Buffering Here: https://bulbul4u-live.xyz');
        
        if (fs.existsSync("comment_image.jpeg")) {
            console.log(`[📸] 'comment_image.jpeg' mil gayi hai! Comment mein image attach kar raha hoon...`);
            commentForm.append('source', fs.createReadStream("comment_image.jpeg"));
        } else {
            console.log(`[ℹ️ INFO] 'comment_image.jpeg' nahi mili. Sirf text wala comment post ho raha hai.`);
        }

        await axios.post(`https://graph.facebook.com/v18.0/${videoId}/comments`, commentForm, { headers: commentForm.getHeaders() });
        console.log(`[✅ Worker 3] Comment Successfully Post Ho Gaya!`);
        return true;
    } catch (e) {
        console.log(`[❌ Worker 3] Upload Crash: ${e.message}`);
        return false;
    }
}

// ==========================================
// 🚀 MAIN HYBRID LOOP (THE BRAIN)
// ==========================================
async function triggerNextRun() {
    console.log(`\n[🔄 AUTO-RESTART] GitHub API ke zariye naya bot chala raha hoon...`);
    const token = process.env.GH_PAT;
    const repo = process.env.GITHUB_REPOSITORY;
    const branch = process.env.GITHUB_REF_NAME || 'main';
    if (!token || !repo) return;
    try {
        await axios.post(`https://api.github.com/repos/${repo}/actions/workflows/video_loop.yml/dispatches`, {
            ref: branch, inputs: { target_url: TARGET_URL, titles_list: TITLES_INPUT, descs_list: DESCS_INPUT, hashtags: HASHTAGS, token_selection: TOKEN_SELECTION }
        }, { headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' } });
    } catch (e) { console.log(`[❌ Relay Race] Trigger failed!`); }
}

async function main() {
    console.log("\n==================================================");
    console.log(`   🚀 ULTIMATE HYBRID VIDEO BOT - MODE: ${TOKEN_SELECTION}`);
    console.log(`   ⏰ STARTED AT: ${formatPKT()}`);
    console.log("==================================================");

    let streamData = await getStreamData();
    if (!streamData) return;
    let nextRunTriggered = false;

    while (true) {
        const elapsedTimeMs = Date.now() - START_TIME;
        
        console.log(`\n--------------------------------------------------`);
        console.log(`--- 🔄 STARTING VIDEO CYCLE #${clipCounter} ---`);
        console.log(`  [-] Bot Uptime: ${Math.floor(elapsedTimeMs / 60000)} minutes`);
        console.log(`--------------------------------------------------`);

        if (elapsedTimeMs > RESTART_TRIGGER_MS && !nextRunTriggered) { await triggerNextRun(); nextRunTriggered = true; }
        if (elapsedTimeMs > END_TIME_LIMIT_MS) {
            console.log(`\n[🛑 System] 6 Ghante ki limit poori. Graceful exit.`);
            process.exit(0);
        }

        if (streamData.expireTime - Date.now() < 120000) {
            console.log(`[🚨] Link expire hone wala hai! Naya link la raha hoon...`);
            let newData = await getStreamData();
            if (newData) streamData = newData;
            else { 
                console.log(`[⚠️] Link swap fail. 1 minute baad dobara try karunga...`);
                await new Promise(r => setTimeout(r, 60000)); 
                continue; 
            }
        }

        const meta = generateMetadata(clipCounter);
        const thumbFile = `studio_thumb_${clipCounter}.png`;
        const finalVidFile = `final_${clipCounter}.mp4`;

        console.log(`\n[⚡ Flow] Worker Pipeline Start kar raha hoon...`);
        if (await worker_0_5_generate_thumbnail(streamData, meta.title, thumbFile)) {
            if (await worker_1_2_capture_and_edit(streamData, finalVidFile)) {
                await worker_3_upload(finalVidFile, thumbFile, meta.title, meta.desc);
            }
        }

        console.log(`\n[🧹 Cleanup] Temporary files delete kar raha hoon...`);
        [thumbFile, finalVidFile].forEach(f => { 
            if (fs.existsSync(f)) { fs.unlinkSync(f); console.log(`  [-] Deleted: ${f}`); } 
        });
        
        console.log(`\n[⏳ Cycle End] Cycle #${clipCounter} Mukammal! Aglay round tak 5 minute wait kar raha hoon...`);
        clipCounter++;
        await new Promise(r => setTimeout(r, WAIT_TIME_MS));
    }
}

// Start The Bot
main();
