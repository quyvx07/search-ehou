// Popup JavaScript for Search EHOU - Auto Extract Only
console.log('Popup script loaded - Auto extract only mode');

class SimplePopup {
  constructor() {
    this.extensionState = {
      autoExtractEnabled: true,
      autoFillEnabled: true
    };
    this.init();
  }

  async init() {
    await this.loadState();
    this.setupEventListeners();
    this.showStatus();
    this.updateToggles();
  }

  async loadState() {
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'GET_STATE' }, resolve);
      });

      if (response) {
        this.extensionState = { ...this.extensionState, ...response };
      }
    } catch (error) {
      console.error('Error loading state:', error);
    }
  }

  setupEventListeners() {
    // Auto extract toggle
    const autoExtractToggle = document.getElementById('autoExtractToggle');
    if (autoExtractToggle) {
      autoExtractToggle.addEventListener('click', () => {
        this.toggleAutoExtract();
      });
    }

    // Auto fill toggle
    const autoFillToggle = document.getElementById('autoFillToggle');
    if (autoFillToggle) {
      autoFillToggle.addEventListener('click', () => {
        this.toggleAutoFill();
      });
    }

    // Manual fill button
    const manualFillBtn = document.getElementById('manualFillBtn');
    if (manualFillBtn) {
      manualFillBtn.addEventListener('click', () => {
        this.manualFillCurrentTab();
      });
    }
  }

  updateToggles() {
    // Update auto extract toggle
    const autoExtractToggle = document.getElementById('autoExtractToggle');
    if (autoExtractToggle) {
      if (this.extensionState.autoExtractEnabled) {
        autoExtractToggle.classList.add('active');
      } else {
        autoExtractToggle.classList.remove('active');
      }
    }

    // Update auto fill toggle
    const autoFillToggle = document.getElementById('autoFillToggle');
    if (autoFillToggle) {
      if (this.extensionState.autoFillEnabled) {
        autoFillToggle.classList.add('active');
      } else {
        autoFillToggle.classList.remove('active');
      }
    }
  }

  async toggleAutoExtract() {
    this.extensionState.autoExtractEnabled = !this.extensionState.autoExtractEnabled;
    await this.saveState();
    this.updateToggles();
    this.showStatus();
  }

  async toggleAutoFill() {
    this.extensionState.autoFillEnabled = !this.extensionState.autoFillEnabled;
    await this.saveState();
    this.updateToggles();
    this.showStatus();
  }

  async saveState() {
    try {
      await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'UPDATE_STATE',
          data: this.extensionState
        }, resolve);
      });
    } catch (error) {
      console.error('Error saving state:', error);
    }
  }

  async manualFillCurrentTab() {
    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (tab) {
        // Send message to content script to manually trigger auto fill
        await chrome.tabs.sendMessage(tab.id, {
          action: 'MANUAL_FILL_QUIZ'
        });

        // Show feedback
        this.showManualFillFeedback();
      }
    } catch (error) {
      console.error('Error triggering manual fill:', error);
      alert('Không thể thực hiện điền đáp án. Vui lòng đảm bảo bạn đang ở trang quiz.');
    }
  }

  showManualFillFeedback() {
    const manualFillBtn = document.getElementById('manualFillBtn');
    if (manualFillBtn) {
      const originalText = manualFillBtn.innerHTML;
      manualFillBtn.innerHTML = '✅ Đang xử lý...';
      manualFillBtn.disabled = true;

      setTimeout(() => {
        manualFillBtn.innerHTML = originalText;
        manualFillBtn.disabled = false;
      }, 3000);
    }
  }

  showStatus() {
    const statusDiv = document.getElementById('status');
    if (statusDiv) {
      const extractStatus = this.extensionState.autoExtractEnabled ? '✅' : '❌';
      const fillStatus = this.extensionState.autoFillEnabled ? '✅' : '❌';

      statusDiv.innerHTML = `
        <div style="text-align: center; padding: 10px;">
          <h3 style="margin: 0 0 10px 0; color: #4CAF50;">🔍 Search EHOU Active</h3>
          <div style="font-size: 12px; color: #666; margin-bottom: 5px;">
            ${extractStatus} Tự động trích xuất: ${this.extensionState.autoExtractEnabled ? 'Bật' : 'Tắt'}
          </div>
          <div style="font-size: 12px; color: #666;">
            ${fillStatus} Tự động điền đáp án: ${this.extensionState.autoFillEnabled ? 'Bật' : 'Tắt'}
          </div>
        </div>
      `;
    }
  }
}

// Initialize popup
const popup = new SimplePopup();