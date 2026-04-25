import os
import json
import time
from DrissionPage import ChromiumPage, ChromiumOptions

def login_and_post():
    # Node.js se data (video, text) read karna
    if not os.path.exists('post_data.json'):
        print("❌ Error: post_data.json nahi mila!")
        return

    with open('post_data.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    video_path = os.path.abspath(data['video_path'])
    post_text = data['desc']

    cookies_json = os.environ.get('FB_COOKIES')
    if not cookies_json:
        print("❌ Error: FB_COOKIES secret nahi mila!")
        return

    try:
        cookies = json.loads(cookies_json)
    except:
        print("❌ Error: Cookies JSON parse nahi ho saka.")
        return

    # ==========================================
    # 🛡️ BROWSER SETUP (STEALTH MODE)
    # ==========================================
    co = ChromiumOptions()
    co.set_argument('--no-sandbox')
    co.set_argument('--disable-dev-shm-usage')
    co.set_argument('--window-size=1280,720')
    co.set_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    co.set_argument('--test-type') 
    co.set_argument('--disable-infobars') 
    co.set_argument('--disable-blink-features=AutomationControlled') 
    co.set_argument('--password-store=basic')
    co.set_argument('--disable-notifications') 
    co.set_argument('--log-level=3')
    co.set_argument('--disable-logging')
    co.set_argument('--mute-audio')
    
    print("🚀 Script Start... Browser khul raha hai...")
    page = ChromiumPage(co)

    try:
        # ==========================================
        # LOGIN PROCESS
        # ==========================================
        print("🌐 Facebook par ja rahe hain...")
        page.get("https://www.facebook.com/404") 
        time.sleep(3)

        for cookie in cookies:
            if 'facebook.com' in cookie.get('domain', ''):
                page.set.cookies({
                    'name': cookie['name'],
                    'value': cookie['value'],
                    'domain': cookie['domain'],
                    'path': cookie.get('path', '/')
                })

        page.get("https://www.facebook.com/")
        time.sleep(5)
        
        if "log in" in page.title.lower() or "login" in page.title.lower():
            print("❌ Login Failed! Cookies expire ho chuki hain.")
            return
        
        print("✅ Login Successful!")

        # ==========================================
        # 🛑 25 MINUTES SESSION WAIT (USER REQUEST)
        # ==========================================
        print("⏳ Session stabilize karne ke liye 25 MINUTES (1500 seconds) ka wait shuru...")
        time.sleep(1500)
        print("✅ 25 Minutes poore ho gaye! Aage barh rahe hain...")

        # ==========================================
        # 🧠 SMART WAIT: PAGE LOAD CHECK
        # ==========================================
        print("⏳ Wait kar rahe hain taake page aur post box puri tarah load ho jaye...")
        page.wait.load_start() 
        time.sleep(5)
        
        # EXACT LOCAL XPATH JO AAPNE DIYA THA
        post_box_xpath = 'xpath://div[contains(@aria-label, "What\'s on your mind") or contains(@aria-label, "Create a post")]'
        
        if page.wait.ele_displayed(post_box_xpath, timeout=15):
            print("✅ Page 100% loaded! Post box screen par aagaya hai.")
            time.sleep(2) 
        else:
            print("❌ Timeout: Post box screen par nahi aaya.")
            return

        # ==========================================
        # STEP 1: CREATE POST POPUP KHOLNA (EXACT OLD LOGIC)
        # ==========================================
        print("▶️ STEP 1: 'What's on your mind?' wale box par click kar rahe hain...")
        create_post_btn = page.ele(post_box_xpath)
        
        if create_post_btn:
            create_post_btn.click()
            time.sleep(5) 
            
            dialog_box = page.ele('xpath://div[@role="dialog"]', timeout=3)
            if not dialog_box:
                print("⚠️ Normal click se popup nahi khula! JS click try kar rahe hain...")
                create_post_btn.click(by_js=True)
                time.sleep(4)
                
                if not page.ele('xpath://div[@role="dialog"]'):
                    print("❌ ERROR: Popup open nahi ho raha! Script rok di gayi hai.")
                    return
        else:
            print("❌ Box select nahi ho saka.")
            return

        # ==========================================
        # STEP 2: TEXT TYPE KARNA
        # ==========================================
        print("▶️ STEP 2: Text box mein likh rahe hain...")
        text_box = page.ele('xpath://div[@role="dialog"]//div[@role="textbox" and @contenteditable="true"]', timeout=5)
        if text_box:
            text_box.input(post_text)
            print("✅ Text type ho gaya.")
            time.sleep(3)
        else:
            print("❌ Text box dialog mein nahi mila.")
            return

        # ==========================================
        # STEP 3: IMAGE/VIDEO UPLOAD
        # ==========================================
        print("▶️ STEP 3: Video upload kar rahe hain...")
        photo_icon = page.ele('xpath://div[@role="dialog"]//div[@aria-label="Photo/video"]', timeout=5)
        if photo_icon:
            photo_icon.click(by_js=True)
            time.sleep(2)
            
            if os.path.exists(video_path):
                file_input = page.ele('xpath://div[@role="dialog"]//input[@type="file"]')
                if file_input:
                    file_input.input(video_path)
                    print("✅ Video attached. Upload hone ka 1 MINUTE wait kar rahe hain...")
                    time.sleep(60)

        # ==========================================
        # STEP 4: NEXT BUTTON
        # ==========================================
        print("▶️ STEP 4: Next button daba rahe hain...")
        next_btn = page.ele('css:div[aria-label="Next"][role="button"]', timeout=3)
        if next_btn:
            next_btn.click(by_js=True)
            time.sleep(4)

        # ==========================================
        # STEP 4.5: POST BUTTON
        # ==========================================
        print("▶️ STEP 4.5: Post button ya popup check kar rahe hain...")
        post_btn = page.ele('xpath://div[@aria-label="Post" and @role="button"]', timeout=3) or page.ele('xpath://span[text()="Post"]', timeout=2)
        if post_btn:
            post_btn.click(by_js=True)
            print("✅ 'Post' button daba diya. 20 Seconds wait...")
            time.sleep(20)
        else:
            close_early = page.ele('css:div[aria-label="Close"][role="button"]', timeout=3)
            if close_early:
                close_early.click(by_js=True)

        # ==========================================
        # STEP 4.8: ZIDDI POPUP HUNTER
        # ==========================================
        for i in range(2):
            time.sleep(6) 
            popup_close_btn = page.ele('css:div[aria-label="Close"][role="button"]', timeout=3)
            if popup_close_btn:
                popup_close_btn.click(by_js=True)

        # ==========================================
        # STEP 5: FINAL "SHARE NOW" BUTTON
        # ==========================================
        print("▶️ STEP 5: Final Share button dhoond rahe hain...")
        share_now_btn = page.ele('css:div[aria-label="Share now"][role="button"]', timeout=3) or page.ele('xpath://span[text()="Share now" or text()="Publish" or text()="Share"]', timeout=2)
        if share_now_btn:
            share_now_btn.click(by_js=True)
            print("🎉 BINGO! Facebook Post 100% Successful.")
            time.sleep(15)
        
        time.sleep(5) 

    except Exception as e:
        print(f"⚠️ HOUSTON, WE HAVE A PROBLEM: {e}")
    finally:
        print("\nBrowser band kar rahe hain...")
        page.quit()
        os.system("pkill chrome")
        print("✅ Browser successfully khatam ho gaya!")

if __name__ == "__main__":
    login_and_post()
