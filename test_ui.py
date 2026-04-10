from playwright.sync_api import Page, expect, sync_playwright
import time
import os

def test_ui(page: Page):
  page.goto("http://localhost:5173/pdfiuh/")
  time.sleep(1)

  # Set an input file
  page.locator("#file-input").set_input_files("/tmp/sample.pdf")
  time.sleep(4)

  # Try doing a search
  page.locator("#toggleSidebar").click()
  time.sleep(2)

  page.screenshot(path="/home/jules/verification/sidebar.png")

if __name__ == "__main__":
  with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    try:
      test_ui(page)
    finally:
      browser.close()
