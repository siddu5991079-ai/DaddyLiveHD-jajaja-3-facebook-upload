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
    co.set_argument('--window-size=1280,720') # Xvfb ki resolution
    co.set_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    co.set_argument('--test-type') 
    co.set_argument('--disable-infobars') 
    co.set_argument('--disable-blink-features=AutomationControlled') 
    co.set_argument('--password-store=basic')
    co.set_argument('--disable-notifications') 
    co.set_argument('--log-level=3')
    co.set_argument('--disable-logging')
    co.set_argument('--mute-audio')
    
    print("🚀 Python DrissionPage Start... Browser khul raha hai...")
    page = ChromiumPage(co)

    try:
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

        print("⏳ Wait kar rahe hain taake page aur post box load ho jaye...")
        page.wait.load_start() 
        time.sleep(5)
        
        post_box_xpath = 'xpath://div[contains(@aria-label, "What\'s on your mind") or contains(@aria-label, "Create a post") or contains(@aria-label, "Write something")]'
        
        print("▶️ STEP 1: 'What's on your mind?' wale box ko dhoond kar click kar rahe hain...")
        popup_opened = False
        post_boxes = page.eles(post_box_xpath)
        
        if post_boxes:
            for index, box in enumerate(post_boxes):
                try:
                    if box.is_displayed:
                        print(f"   -> Visible box mil gaya. Hover kar rahe hain...")
                        page.actions.move_to(box)
                        time.sleep(2)
                        
                        print("   -> Mouse se left click kar rahe hain...")
                        page.actions.click()
                        time.sleep(5)
                        
                        if page.ele('xpath://div[@role="dialog"]', timeout=3):
                            popup_opened = True
                            print("✅ BINGO! Popup khul gaya.")
                            break
                        
                        print("   ⚠️ Click se nahi khula, 'Enter' key try kar rahe hain...")
                        box.focus()
                        page.actions.type('\n')
                        time.sleep(4)
                        
                        if page.ele('xpath://div[@role="dialog"]', timeout=3):
                            popup_opened = True
                            print("✅ BINGO! Enter dabane se popup khul gaya.")
                            break
                except Exception as e:
                    continue
        else:
            print("❌ Box element pure page par nahi mila.")
            return

        if not popup_opened:
            print("❌ ERROR: Popup nahi khula! Script end.")
            return

        print("▶️ STEP 2: Text box mein likh rahe hain...")
        text_box = page.ele('xpath://div[@role="dialog"]//div[@role="textbox" and @contenteditable="true"]', timeout=5)
        if text_box:
            text_box.input(post_text)
            print("✅ Text type ho gaya.")
            time.sleep(3)
        else:
            print("❌ Text box dialog mein nahi mila.")
            return

        print("▶️ STEP 3: Video upload kar rahe hain...")
        photo_icon = page.ele('xpath://div[@role="dialog"]//div[@aria-label="Photo/video"]', timeout=5)
        if photo_icon:
            photo_icon.click(by_js=True)
            time.sleep(2)
            
            if os.path.exists(video_path):
                file_input = page.ele('xpath://div[@role="dialog"]//input[@type="file"]')
                if file_input:
                    file_input.input(video_path)
                    # 🛑 VIDEO UPLOAD 60 SECONDS WAIT 🛑
                    print("✅ Video attached. Upload hone ka 1 MINUTE lamba wait kar rahe hain...")
                    time.sleep(60)

        print("▶️ STEP 4: Next button daba rahe hain...")
        next_btn = page.ele('css:div[aria-label="Next"][role="button"]', timeout=3)
        if next_btn:
            next_btn.click(by_js=True)
            time.sleep(4)

        print("▶️ STEP 4.5: Post button check kar rahe hain...")
        post_btn = page.ele('xpath://div[@aria-label="Post" and @role="button"]', timeout=3) or page.ele('xpath://span[text()="Post"]', timeout=2)
        if post_btn:
            post_btn.click(by_js=True)
            print("✅ 'Post' button daba diya. 20 Seconds processing wait...")
            time.sleep(20)
        else:
            close_early = page.ele('css:div[aria-label="Close"][role="button"]', timeout=3)
            if close_early:
                close_early.click(by_js=True)

        print("▶️ STEP 4.8: Ziddi popups check kar rahe hain...")
        for i in range(2):
            time.sleep(6) 
            popup_close_btn = page.ele('css:div[aria-label="Close"][role="button"]', timeout=3)
            if popup_close_btn:
                popup_close_btn.click(by_js=True)

        print("▶️ STEP 5: Final Share button dhoond rahe hain...")
        share_now_btn = page.ele('css:div[aria-label="Share now"][role="button"]', timeout=3) or page.ele('xpath://span[text()="Share now" or text()="Publish" or text()="Share"]', timeout=2)
        if share_now_btn:
            share_now_btn.click(by_js=True)
            print("🎉 BINGO! Facebook Video Post 100% Successful.")
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
