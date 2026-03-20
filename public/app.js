document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('url');
  const articleInput = document.getElementById('selector-article');
  const titleInput = document.getElementById('selector-title');
  const linkInput = document.getElementById('selector-link');
  const dateInput = document.getElementById('selector-date');
  const summaryInput = document.getElementById('selector-summary');

  const sampleBtn = document.getElementById('sample-btn');
  const generateBtn = document.getElementById('generate-btn');

  const samplesContainer = document.getElementById('samples-container');
  const toastContainer = document.getElementById('toast-container');

  // --- Toast Notification Function ---
  function showMessage(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
      success: 'fa-check-circle',
      error: 'fa-times-circle',
      info: 'fa-info-circle',
    };
    
    toast.innerHTML = `
      <i class="fas ${icons[type]}"></i>
      <span>${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 5000);
  }

  // --- Event Listeners ---
  sampleBtn.addEventListener('click', async () => {
    const selectors = getSelectors();
    if (!selectors) return;

    samplesContainer.innerHTML = ''; // Clear previous samples

    try {
      const response = await fetch('/api/sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectors),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      const data = await response.json();
      renderSamples(data.samples);

    } catch (error) {
      showMessage(`Failed to fetch samples: ${error.message}`, 'error');
    }
  });

  generateBtn.addEventListener('click', async () => {
    const selectors = getSelectors();
    if (!selectors) return;
    
    // showMessage('Generating RSS feed...', 'info'); // This line is removed as per user request

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectors),
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }
      
      const data = await response.json();
      showMessage(data.message, 'success');
      clearInputFields(); // Clear input fields on successful generation
      // The link to the feed is now logged to the console for simplicity.
      console.log(`Feed available at: ${window.location.origin}${data.feedPath}`);

    } catch (error) {
       showMessage(`Failed to generate feed: ${error.message}`, 'error');
    }
  });

  // --- Helper Functions ---
  function getSelectors() {
    const url = urlInput.value.trim();
    if (!url) {
      showMessage('URL is required.', 'error');
      return null;
    }
    return {
      url: url,
      selectors: {
        article: articleInput.value.trim(),
        title: titleInput.value.trim(),
        link: linkInput.value.trim(),
        date: dateInput.value.trim(),
        summary: summaryInput.value.trim(),
      },
    };
  }

  function clearInputFields() {
    urlInput.value = '';
    articleInput.value = '';
    titleInput.value = '';
    linkInput.value = '';
    dateInput.value = '';
    summaryInput.value = '';
    samplesContainer.innerHTML = ''; // Reset sample preview area
  }
  
  function renderSamples(samples) {
    if (!samples || samples.length === 0) {
      showMessage('No articles found with the given selectors.', 'info');
      // samplesContainer.innerHTML = '<p>No articles found.</p>'; // This line is removed
      return;
    }

    const html = samples.map(article => `
      <div class="sample-item">
        <h4>${article.link ? `<a href="${article.link}" target="_blank" rel="noopener noreferrer">${article.title || 'No Title'}</a>` : `<span>${article.title || 'No Title'}</span>`}</h4>
        <p class="date">${article.date || 'No Date'}</p>
        <p class="summary">${article.summary || 'No Summary'}</p>
      </div>
    `).join('');

    samplesContainer.innerHTML = html;
  }
});
