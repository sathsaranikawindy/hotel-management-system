// ==========================================================================
// Grand Horizon Hotel Booking System - Client JavaScript
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Global State
  let authToken = localStorage.getItem('hotel_jwt_token') || null;
  let currentUser = JSON.parse(localStorage.getItem('hotel_user')) || null;

  // Initialize UI State
  updateAuthUI();
  setupTabs();
  setupStarPicker();
  setupForms();
  setupApiExplorer();
  
  // Load initial reviews & rating summary for room_101
  loadRoomReviews('room_101');
  loadRoomSummary('room_101');

  // ==========================================================================
  // 1. AUTHENTICATION & TOKEN MANAGERS
  // ==========================================================================
  function updateAuthUI() {
    const authBadge = document.getElementById('authBadge');
    const userInfoBadge = document.getElementById('userInfoBadge');
    const badgeUserName = document.getElementById('badgeUserName');
    const activeJwtToken = document.getElementById('activeJwtToken');

    if (authToken && currentUser) {
      authBadge.textContent = 'LOGGED IN';
      authBadge.className = 'status-badge online';
      badgeUserName.textContent = `${currentUser.name} (${currentUser.role})`;
      userInfoBadge.classList.remove('hidden');

      if (activeJwtToken) activeJwtToken.value = authToken;
    } else {
      authBadge.textContent = 'NOT LOGGED IN';
      authBadge.className = 'status-badge offline';
      userInfoBadge.classList.add('hidden');

      if (activeJwtToken) activeJwtToken.value = '';
    }
  }

  function setSession(token, user) {
    authToken = token;
    currentUser = user;
    localStorage.setItem('hotel_jwt_token', token);
    localStorage.setItem('hotel_user', JSON.stringify(user));
    updateAuthUI();
  }

  function clearSession() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('hotel_jwt_token');
    localStorage.removeItem('hotel_user');
    updateAuthUI();
  }

  document.getElementById('btnLogout').addEventListener('click', () => {
    clearSession();
    alert('Logged out successfully!');
  });

  document.getElementById('btnCopyToken').addEventListener('click', () => {
    const activeJwtToken = document.getElementById('activeJwtToken');
    if (activeJwtToken.value) {
      navigator.clipboard.writeText(activeJwtToken.value);
      alert('JWT Token copied to clipboard!');
    } else {
      alert('No active JWT token available.');
    }
  });

  // ==========================================================================
  // 2. TAB SWITCHING SYSTEM
  // ==========================================================================
  function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');

        tabButtons.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(targetTab).classList.add('active');
      });
    });
  }

  // ==========================================================================
  // 3. STAR RATING PICKER
  // ==========================================================================
  function setupStarPicker() {
    const stars = document.querySelectorAll('#starPicker .star');
    const ratingInput = document.getElementById('reviewRatingVal');

    stars.forEach(star => {
      star.addEventListener('click', () => {
        const val = parseInt(star.getAttribute('data-val'));
        ratingInput.value = val;

        stars.forEach((s, idx) => {
          if (idx < val) {
            s.classList.add('active');
          } else {
            s.classList.remove('active');
          }
        });
      });
    });
  }

  // ==========================================================================
  // 4. FORMS SUBMISSION LISTENERS
  // ==========================================================================
  function setupForms() {
    // --- USER REGISTRATION FORM ---
    const formRegister = document.getElementById('formRegister');
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('regName').value;
      const email = document.getElementById('regEmail').value;
      const password = document.getElementById('regPassword').value;
      const role = document.getElementById('regRole').value;

      const btn = document.getElementById('btnRegisterSubmit');
      btn.disabled = true;
      btn.textContent = 'Registering...';

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, role })
        });
        const data = await res.json();

        document.getElementById('regResponseJson').textContent = JSON.stringify(data, null, 2);

        if (data.success) {
          setSession(data.token, data.user);
          alert(`Registration Successful! Welcome ${data.user.name}.`);
          formRegister.reset();
        } else {
          alert(`Registration Failed: ${data.message}`);
        }
      } catch (err) {
        document.getElementById('regResponseJson').textContent = JSON.stringify({ error: err.message }, null, 2);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Register User API';
      }
    });

    // --- USER LOGIN FORM ---
    const formLogin = document.getElementById('formLogin');
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;

      const btn = document.getElementById('btnLoginSubmit');
      btn.disabled = true;
      btn.textContent = 'Authenticating...';

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        document.getElementById('loginResponseJson').textContent = JSON.stringify(data, null, 2);

        if (data.success) {
          setSession(data.token, data.user);
          alert(`Login Successful! Logged in as ${data.user.name}.`);
        } else {
          alert(`Login Failed: ${data.message}`);
        }
      } catch (err) {
        document.getElementById('loginResponseJson').textContent = JSON.stringify({ error: err.message }, null, 2);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Authenticate & Get JWT Token';
      }
    });

    // --- GUEST REVIEW FORM ---
    const formReview = document.getElementById('formReview');
    formReview.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!authToken) {
        alert('Please log in or register first before submitting a review!');
        // Switch to login tab
        document.querySelector('[data-tab="tab-login"]').click();
        return;
      }

      const roomSelect = document.getElementById('reviewRoomSelect');
      const roomId = roomSelect.value;
      const roomName = roomSelect.options[roomSelect.selectedIndex].text;
      const rating = parseInt(document.getElementById('reviewRatingVal').value);
      const title = document.getElementById('reviewTitle').value;
      const comment = document.getElementById('reviewComment').value;

      const btn = document.getElementById('btnSubmitReview');
      btn.disabled = true;
      btn.textContent = 'Submitting...';

      try {
        const res = await fetch('/api/reviews', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ roomId, roomName, rating, title, comment })
        });
        const data = await res.json();

        if (data.success) {
          alert('Review submitted successfully!');
          formReview.reset();
          document.getElementById('reviewRatingVal').value = '5';
          document.querySelectorAll('#starPicker .star').forEach(s => s.classList.add('active'));
          
          // Refresh room reviews & metrics
          document.getElementById('filterRoomId').value = roomId;
          loadRoomReviews(roomId);
          loadRoomSummary(roomId);
        } else {
          alert(`Review Error: ${data.message}`);
        }
      } catch (err) {
        alert(`Error: ${err.message}`);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Submit Guest Review';
      }
    });

    // --- FILTER ROOM SELECTOR ---
    const filterRoomSelect = document.getElementById('filterRoomId');
    filterRoomSelect.addEventListener('change', (e) => {
      const selectedRoom = e.target.value;
      loadRoomReviews(selectedRoom);
      loadRoomSummary(selectedRoom);
    });
  }

  // ==========================================================================
  // 5. REVIEWS & RATING DATA FETCHERS
  // ==========================================================================
  async function loadRoomReviews(roomId) {
    const reviewsFeed = document.getElementById('reviewsFeed');
    reviewsFeed.innerHTML = '<p style="color: var(--text-secondary);">Loading reviews...</p>';

    try {
      const res = await fetch(`/api/reviews?roomId=${roomId}`);
      const data = await res.json();

      if (!data.success || data.reviews.length === 0) {
        reviewsFeed.innerHTML = '<p style="color: var(--text-secondary);">No guest reviews submitted for this room yet.</p>';
        return;
      }

      reviewsFeed.innerHTML = '';
      data.reviews.forEach(review => {
        const card = document.createElement('div');
        card.className = 'review-item';

        const starString = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
        const reviewDate = new Date(review.createdAt).toLocaleDateString(undefined, {
          year: 'numeric', month: 'short', day: 'numeric'
        });

        const isOwnerOrAdmin = currentUser && (currentUser.id === review.userId || currentUser.role === 'admin');

        card.innerHTML = `
          <div class="review-item-header">
            <span class="review-user-name">👤 ${escapeHtml(review.userName)}</span>
            <span class="review-date">${reviewDate}</span>
          </div>
          <div class="review-stars">${starString}</div>
          <div class="review-item-title">${escapeHtml(review.title)}</div>
          <div class="review-item-comment">${escapeHtml(review.comment)}</div>
          ${isOwnerOrAdmin ? `<button class="review-delete-btn" data-id="${review.id}">🗑 Delete Review</button>` : ''}
        `;

        if (isOwnerOrAdmin) {
          const deleteBtn = card.querySelector('.review-delete-btn');
          deleteBtn.addEventListener('click', () => deleteReview(review.id, roomId));
        }

        reviewsFeed.appendChild(card);
      });
    } catch (err) {
      reviewsFeed.innerHTML = `<p style="color: var(--error-red);">Error loading reviews: ${err.message}</p>`;
    }
  }

  async function loadRoomSummary(roomId) {
    try {
      const res = await fetch(`/api/reviews/summary/${roomId}`);
      const data = await res.json();

      if (data.success) {
        document.getElementById('avgScore').textContent = data.averageRating || '0.0';
        document.getElementById('totalReviewsCount').textContent = `Based on ${data.totalReviews} review(s)`;

        // Calculate gold stars
        const avgNum = Math.round(data.averageRating || 0);
        document.getElementById('avgStars').textContent = '★'.repeat(avgNum) + '☆'.repeat(5 - avgNum);

        // Update Progress Bars
        const total = data.totalReviews || 1;
        const breakdown = data.starBreakdown || { 5:0, 4:0, 3:0, 2:0, 1:0 };

        const barRows = document.querySelectorAll('#ratingBars .bar-row');
        [5, 4, 3, 2, 1].forEach((starNum, idx) => {
          const count = breakdown[starNum] || 0;
          const percentage = data.totalReviews > 0 ? (count / total * 100).toFixed(0) : 0;
          
          if (barRows[idx]) {
            barRows[idx].querySelector('.progress-fill').style.width = `${percentage}%`;
            barRows[idx].querySelector('.count').textContent = count;
          }
        });
      }
    } catch (err) {
      console.error('Error loading summary:', err);
    }
  }

  async function deleteReview(reviewId, roomId) {
    if (!confirm('Are you sure you want to delete this review?')) return;

    try {
      const res = await fetch(`/api/reviews/${reviewId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const data = await res.json();

      if (data.success) {
        alert('Review deleted successfully.');
        loadRoomReviews(roomId);
        loadRoomSummary(roomId);
      } else {
        alert(`Delete failed: ${data.message}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  }

  // ==========================================================================
  // 6. INTERACTIVE REST API EXPLORER
  // ==========================================================================
  function setupApiExplorer() {
    const select = document.getElementById('apiEndpointSelect');
    const requestBody = document.getElementById('apiRequestBody');
    const btnExecute = document.getElementById('btnExecuteApi');
    const statusOutput = document.getElementById('apiResponseStatus');
    const timeOutput = document.getElementById('apiResponseTime');
    const responseOutput = document.getElementById('apiResponseOutput');

    const defaultPayloads = {
      POST_REGISTER: {
        method: 'POST',
        url: '/api/auth/register',
        body: {
          name: "Amila Perera",
          email: "amila@hotel.com",
          password: "password123",
          role: "guest"
        }
      },
      POST_LOGIN: {
        method: 'POST',
        url: '/api/auth/login',
        body: {
          email: "sarah@example.com",
          password: "password123"
        }
      },
      GET_ME: {
        method: 'GET',
        url: '/api/auth/me',
        requiresAuth: true
      },
      POST_REVIEW: {
        method: 'POST',
        url: '/api/reviews',
        requiresAuth: true,
        body: {
          roomId: "room_101",
          roomName: "Deluxe Ocean Suite",
          rating: 5,
          title: "Stunning Sunrise View",
          comment: "Room service was impeccable and the balcony view was outstanding!"
        }
      },
      GET_REVIEWS: {
        method: 'GET',
        url: '/api/reviews?roomId=room_101'
      },
      GET_SUMMARY: {
        method: 'GET',
        url: '/api/reviews/summary/room_101'
      }
    };

    function updateExplorerView() {
      const selectedKey = select.value;
      const config = defaultPayloads[selectedKey];
      if (config.body) {
        requestBody.value = JSON.stringify(config.body, null, 2);
        requestBody.disabled = false;
      } else {
        requestBody.value = '// GET requests do not require a JSON body';
        requestBody.disabled = true;
      }
    }

    select.addEventListener('change', updateExplorerView);
    updateExplorerView(); // Initial call

    btnExecute.addEventListener('click', async () => {
      const selectedKey = select.value;
      const config = defaultPayloads[selectedKey];
      const startTime = performance.now();

      statusOutput.textContent = 'Sending...';
      statusOutput.className = 'status-code';
      responseOutput.textContent = 'Waiting for response...';

      const headers = { 'Content-Type': 'application/json' };
      if (config.requiresAuth && authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const fetchOptions = {
        method: config.method,
        headers: headers
      };

      if (config.method !== 'GET' && requestBody.value && !requestBody.disabled) {
        try {
          JSON.parse(requestBody.value); // Test JSON validity
          fetchOptions.body = requestBody.value;
        } catch (e) {
          alert('Invalid JSON in request body area!');
          return;
        }
      }

      try {
        const res = await fetch(config.url, fetchOptions);
        const duration = (performance.now() - startTime).toFixed(0);
        const data = await res.json();

        statusOutput.textContent = `${res.status} ${res.statusText}`;
        statusOutput.className = res.ok ? 'status-code success' : 'status-code error';
        timeOutput.textContent = `${duration} ms`;

        responseOutput.textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        statusOutput.textContent = 'ERROR';
        statusOutput.className = 'status-code error';
        responseOutput.textContent = JSON.stringify({ error: err.message }, null, 2);
      }
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function(m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[m];
    });
  }
});
