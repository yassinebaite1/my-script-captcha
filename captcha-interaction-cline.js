window.__captchaAPIAccess = true;

// Initialize state
let captchaSolvingEnabled = false;

/**
 * CAPTCHA Button Component
 * Creates and manages the CAPTCHA interaction button
 */
class CaptchaButton {
  constructor() {
    this.addStyles();
    this.createButton();
    this.setupEventListeners();
  }

  /**
   * Add required CSS styles to the document
   */
  addStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      #elineCaptchaButton {
        position: fixed;
        bottom: 16px;
        left: 16px;
        z-index: 999999;
        color: #fff;
        font-family: sans-serif;
        font-size: 14px;
        font-weight: 600;
        border: none;
        border-radius: 50px;
        padding: 12px 20px;
        cursor: pointer;
        box-shadow: 0 8px 20px rgba(0,0,0,0.15);
        transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
        opacity: 0.95;
        background-color: #4a90e2;
      }
      #elineCaptchaButton:hover { 
        transform: scale(1.03); 
        opacity: 1; 
      }
      #elineCaptchaButton:active { 
        transform: scale(0.97); 
      }
      #elineCaptchaButton.animate-click { 
        animation: ringFlash 0.9s forwards; 
      }
      @keyframes ringFlash {
        0% { box-shadow: 0 8px 20px rgba(0,0,0,0.15); }
        33% { box-shadow: 0 0 0 5px #ff8da1, 0 12px 24px rgba(0,0,0,0.2); }
        66% { box-shadow: 0 0 0 5px #5AD2F4, 0 12px 24px rgba(0,0,0,0.2); }
        100% { box-shadow: 0 8px 20px rgba(0,0,0,0.15); }
      }
      #eline-captcha-status {
        font-weight: bold;
        margin: 10px 0;
        padding: 5px;
      }
      .img-selected {
        border: 3px solid #4a90e2;
        transform: scale(0.95);
      }
      .img-active {
        opacity: 1;
        pointer-events: auto;
      }
      .captcha-img {
        cursor: pointer;
        transition: all 0.2s ease;
      }
      #captchaForm button {
        padding: 8px 16px;
        border-radius: 4px;
        border: none;
        background-color: #4a90e2;
        color: white;
        font-weight: bold;
        cursor: pointer;
        opacity: 0.6;
        pointer-events: none;
      }
      #captchaForm button.img-active {
        opacity: 1;
        pointer-events: auto;
      }
    `;
    document.head.appendChild(styleElement);
  }

  /**
   * Create the CAPTCHA button element
   */
  createButton() {
    const button = document.createElement('button');
    button.id = 'elineCaptchaButton';
    button.textContent = 'CAPTCHA Solver';
    button.style.backgroundColor = captchaSolvingEnabled ? '#4CAF50' : '#F44336';
    
    // Add to document
    if (document.body) {
      document.body.appendChild(button);
    } else {
      // If document.body is not available yet, wait for it
      setTimeout(() => {
        if (document.body) {
          document.body.appendChild(button);
        }
      }, 0);
    }
    
    this.buttonElement = button;
  }

  /**
   * Set up event listeners for the button
   */
  setupEventListeners() {
    this.buttonElement.addEventListener('click', () => {
      captchaSolvingEnabled = !captchaSolvingEnabled;
      this.updateButtonState();
      
      // Toggle the class for animation
      this.buttonElement.classList.add('animate-click');
      setTimeout(() => {
        this.buttonElement.classList.remove('animate-click');
      }, 900);
      
      console.log(`CAPTCHA solving is now ${captchaSolvingEnabled ? 'ON' : 'OFF'}`);
      
      // Start CAPTCHA solving if enabled
      if (captchaSolvingEnabled) {
        captchaSolver.start();
      }
    });
  }

  /**
   * Update button state based on current settings
   */
  updateButtonState() {
    this.buttonElement.style.backgroundColor = captchaSolvingEnabled ? '#4CAF50' : '#F44336';
    
    // Save state to localStorage
    localStorage.setItem('captchaSolverEnabled', captchaSolvingEnabled.toString());
  }
}

/**
 * CAPTCHA Solver
 * Handles the logic for solving CAPTCHAs
 */
class CaptchaSolver {
  constructor() {
    this.isProcessing = false;
    this.initFromLocalStorage();
  }

  /**
   * Initialize state from localStorage
   */
  initFromLocalStorage() {
    const savedState = localStorage.getItem('captchaSolverEnabled');
    if (savedState === 'true') {
      captchaSolvingEnabled = true;
    }
  }

  /**
   * Start the CAPTCHA solving process
   */
  async start() {
    if (!captchaSolvingEnabled || this.isProcessing) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      // Display status message
      this.showStatus('Analyzing CAPTCHA images...');
      
      // Find CAPTCHA images on the page
      const images = document.querySelectorAll('img.captcha-img');
      if (images.length === 0) {
        this.showStatus('No CAPTCHA images found');
        return;
      }
      
      // Process images and collect data
      const imageData = this.processImages(images);
      
      // Send data to server for processing
      const result = await this.sendToServer(imageData);
      
      // Handle the result
      if (result.success) {
        this.selectImages(result.selections, images);
        this.showStatus('CAPTCHA solved successfully');
      } else {
        this.showStatus('Failed to solve CAPTCHA');
      }
    } catch (error) {
      console.error('Error solving CAPTCHA:', error);
      this.showStatus('Error solving CAPTCHA');
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process images to extract necessary data
   */
  processImages(images) {
    const imageData = [];
    const positions = {};
    
    images.forEach(img => {
      if (this.isVisibleElement(img)) {
        const rect = img.getBoundingClientRect();
        const position = `${rect.x},${rect.y}`;
        const style = getComputedStyle(img).backgroundImage;
        
        imageData.push({
          element: img,
          position,
          style,
          id: img.getAttribute('data-id')
        });
        
        // Track positions
        positions[position] = positions[position] 
          ? positions[position] + '/' + style 
          : style;
      }
    });
    
    return { imageData, positions };
  }

  /**
   * Check if an element is visible
   */
  isVisibleElement(element) {
    const rect = element.getBoundingClientRect();
    return (
      element.offsetWidth > 0 && 
      element.offsetHeight > 0 && 
      rect.width > 0 && 
      rect.height > 0 && 
      getComputedStyle(element).visibility !== 'hidden' && 
      getComputedStyle(element).display !== 'none'
    );
  }

  /**
   * Send data to server for processing
   */
  async sendToServer(data) {
    // This is a mock implementation
    // In the original code, this would send data to a server
    return new Promise(resolve => {
      setTimeout(() => {
        // Simulate server response
        resolve({
          success: true,
          selections: [0, 2, 5] // Example indices to select
        });
      }, 1000);
    });
  }

  /**
   * Select images based on server response
   */
  selectImages(selections, images) {
    selections.forEach(index => {
      if (index < images.length) {
        const img = images[index];
        img.click(); // Trigger the click event to select the image
      }
    });
  }

  /**
   * Show status message
   */
  showStatus(message) {
    let statusElement = document.getElementById('eline-captcha-status');
    if (!statusElement) {
      statusElement = document.createElement('div');
      statusElement.id = 'eline-captcha-status';
      document.body.appendChild(statusElement);
    }
    
    statusElement.textContent = message;
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      statusElement.textContent = '';
    }, 3000);
  }
}

/**
 * Custom Modal System
 * Replaces the default alert with a custom modal
 */
class ModalSystem {
  constructor() {
    this.msgQueue = [];
    this.modalElement = undefined;
    this.notification = null;
    this.setupModalHTML();
    this.overrideAlert();
  }

  /**
   * Set up the modal HTML template
   */
  setupModalHTML() {
    this.modalHTML = `
      <div id="cyberwho-alerts-modal-content">
        <p id="cyberwho-alerts-modal-content-text"></p>
      </div>
    `;
    
    // Add styles for the modal
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      #cyberwho-alerts-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999999;
      }
      #cyberwho-alerts-modal-content {
        background-color: white;
        padding: 20px;
        border-radius: 8px;
        max-width: 80%;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      }
      #cyberwho-alerts-modal-content-text {
        margin: 0;
        font-family: sans-serif;
        font-size: 16px;
      }
    `;
    document.head.appendChild(styleElement);
  }

  /**
   * Override the default alert function
   */
  overrideAlert() {
    const self = this;
    window.alert = function(msg) {
      self.queueMsg(msg);
    };
  }

  /**
   * Queue a message to be displayed
   */
  queueMsg(msg) {
    this.msgQueue.push(msg);
    this.generateModal();
  }

  /**
   * Create the modal with the message
   */
  createModal(msg) {
    const span = document.createElement("span");
    span.id = "cyberwho-alerts-modal";
    span.innerHTML = this.modalHTML;
    document.documentElement.appendChild(span);
    
    const modalContent = document.getElementById("cyberwho-alerts-modal-content-text");
    modalContent.textContent = msg;
    
    this.modalElement = document.getElementById("cyberwho-alerts-modal");
    this.modalElement.style.display = "block";
    
    this.notify();
  }

  /**
   * Delete the modal
   */
  deleteModal() {
    if (!this.modalElement) return;
    this.modalElement.parentNode.removeChild(this.modalElement);
    this.modalElement = undefined;
    this.stopFlashTab();
  }

  /**
   * Generate the modal if not already displayed
   */
  generateModal() {
    if (this.modalElement) return;
    
    const msg = this.msgQueue.shift();
    if (!msg) return;
    
    this.createModal(msg);
    this.registerModalClose();
  }

  /**
   * Register event handlers for closing the modal
   */
  registerModalClose() {
    const self = this;
    const originalCallbacks = {};
    let timeoutTimer;
    
    const closeModalCodes = ["Enter", "Escape", "Space"];
    
    function isOnclick(e) {
      return e.target == self.modalElement;
    }
    
    function isOnKeyUp(e) {
      return closeModalCodes.indexOf(e.code) >= 0;
    }
    
    function generateEvent(checkFn, windowEvent) {
      originalCallbacks[windowEvent] = window[windowEvent];
      window[windowEvent] = function(eventObject) {
        if (!checkFn(eventObject)) return;
        
        self.deleteModal();
        
        Object.keys(originalCallbacks).forEach(function(key) {
          window[key] = originalCallbacks[key];
        });
        
        clearTimeout(timeoutTimer);
        self.generateModal();
        
        eventObject.preventDefault();
        return false;
      };
    }
    
    generateEvent(isOnclick, "onclick");
    generateEvent(isOnKeyUp, "onkeyup");
    
    // Auto-close after 5 seconds
    timeoutTimer = setTimeout(function() {
      const keyUpEvent = new KeyboardEvent("keyup", { code: "Escape" });
      window.onkeyup(keyUpEvent);
    }, 5000);
  }

  /**
   * Notify the user by flashing the tab title
   */
  notify() {
    let notified = false;
    this.notification = setInterval(() => {
      notified = true;
      const originalTitle = document.title;
      document.title = originalTitle + " - Alert";
      
      setTimeout(() => {
        document.title = originalTitle;
      }, 500);
    }, 1000);
  }

  /**
   * Stop flashing the tab title
   */
  stopFlashTab() {
    if (this.notification) {
      clearInterval(this.notification);
      this.notification = null;
    }
  }
}

/**
 * CAPTCHA Image Selection Handler
 * Handles the selection of images in a CAPTCHA
 */
class CaptchaImageSelector {
  constructor() {
    this.selection = [];
    this.setupEventListeners();
  }

  /**
   * Set up event listeners for CAPTCHA interaction
   */
  setupEventListeners() {
    document.addEventListener('DOMContentLoaded', () => {
      const undoButton = document.getElementById('undo');
      const submitButton = document.getElementById('submit');
      const captchaForm = document.getElementById('captchaForm');
      const selectedImages = document.getElementById('SelectedImages');
      const captchaImages = document.getElementsByClassName('captcha-img');
      
      if (!undoButton || !submitButton || !captchaForm || !selectedImages) {
        return; // Required elements not found
      }
      
      // Add click handlers to all captcha images
      for (let img of captchaImages) {
        img.addEventListener('click', () => {
          this.toggleSelection(img.getAttribute('data-id'), img);
        });
      }
      
      // Set up undo button
      if (undoButton) {
        undoButton.addEventListener('click', () => {
          this.clearSelection(captchaImages);
        });
      }
      
      // Set up submit button
      if (submitButton) {
        submitButton.addEventListener('click', () => {
          this.submitSelection(captchaForm, selectedImages);
        });
      }
    });
  }

  /**
   * Toggle selection of an image
   */
  toggleSelection(id, img) {
    const index = this.selection.indexOf(id);
    
    if (index !== -1) {
      // Deselect
      this.selection.splice(index, 1);
      img.classList.remove('img-selected');
    } else {
      // Select
      this.selection.push(id);
      img.classList.add('img-selected');
    }
    
    // Update button states
    const hasSelection = this.selection.length > 0;
    const undoButton = document.getElementById('undo');
    const submitButton = document.getElementById('submit');
    
    if (undoButton) {
      undoButton.classList.toggle('img-active', hasSelection);
    }
    
    if (submitButton) {
      submitButton.classList.toggle('img-active', hasSelection);
    }
  }

  /**
   * Clear all selections
   */
  clearSelection(captchaImages) {
    this.selection = [];
    
    for (let img of captchaImages) {
      img.classList.remove('img-selected');
    }
    
    const undoButton = document.getElementById('undo');
    const submitButton = document.getElementById('submit');
    
    if (undoButton) {
      undoButton.classList.remove('img-active');
    }
    
    if (submitButton) {
      submitButton.classList.remove('img-active');
    }
  }

  /**
   * Submit the selection
   */
  submitSelection(captchaForm, selectedImages) {
    if (!this.selection.length) return false;
    
    selectedImages.value = this.selection.join(',');
    captchaForm.submit();
  }
}

// Initialize components
const captchaButton = new CaptchaButton();
const captchaSolver = new CaptchaSolver();
const modalSystem = new ModalSystem();
const captchaImageSelector = new CaptchaImageSelector();

// Set up page load handler
window.addEventListener('load', () => {
  if (captchaSolvingEnabled) {
    captchaSolver.start();
  }
});

console.log('CAPTCHA interaction system initialized');