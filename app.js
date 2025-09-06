// MediFind Frontend JavaScript
const API_BASE = '/api';

// Search medicines function with enhanced filters
async function searchMedicines(query, location = '', category = 'all', filters = {}) {
    try {
        showLoading('medicine-container');
        
        const params = new URLSearchParams({
            q: query,
            location: location,
            category: category
        });
        
        // Add filter parameters if provided
        if (filters.minPrice) params.append('minPrice', filters.minPrice);
        if (filters.maxPrice) params.append('maxPrice', filters.maxPrice);
        if (filters.maxDistance) params.append('maxDistance', filters.maxDistance);
        
        const response = await fetch(`${API_BASE}/medicines/search?${params}`);
        const data = await response.json();
        
        if (response.ok) {
            displayMedicines(data.results, `Search Results for "${query}"`);
            // Show filter options
            showFilterOptions();
        } else {
            showError('Search failed: ' + data.error);
        }
    } catch (error) {
        showError('Network error: ' + error.message);
    }
}

// Show filter options
function showFilterOptions() {
    // Check if filter panel already exists
    if (document.getElementById('filter-panel')) return;
    
    const medicineContainer = document.getElementById('medicine-container');
    const filterHtml = `
        <div id="filter-panel" style="margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
            <h3>Filter Results</h3>
            <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                <div>
                    <label>Price Range:</label>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input type="number" id="min-price" placeholder="Min" style="width: 80px; padding: 8px;">
                        <span>-</span>
                        <input type="number" id="max-price" placeholder="Max" style="width: 80px; padding: 8px;">
                    </div>
                </div>
                <div>
                    <label>Max Distance (km):</label>
                    <input type="number" id="max-distance" placeholder="e.g., 5" style="width: 80px; padding: 8px;">
                </div>
                <div>
                    <label>Sort By:</label>
                    <select id="sort-by" style="padding: 8px;">
                        <option value="name">Name</option>
                        <option value="price-low">Price: Low to High</option>
                        <option value="price-high">Price: High to Low</option>
                        <option value="rating">Rating</option>
                        <option value="distance">Distance</option>
                    </select>
                </div>
                <div style="align-self: end;">
                    <button class="btn btn-primary" onclick="applyFilters()" style="padding: 8px 16px;">
                        <i class="fas fa-filter"></i> Apply Filters
                    </button>
                </div>
            </div>
        </div>
    `;
    
    medicineContainer.insertAdjacentHTML('beforebegin', filterHtml);
}

// Apply filters
function applyFilters() {
    const minPrice = document.getElementById('min-price').value;
    const maxPrice = document.getElementById('max-price').value;
    const maxDistance = document.getElementById('max-distance').value;
    const sortBy = document.getElementById('sort-by').value;
    
    const medicationInput = document.getElementById('medicine-search');
    const locationInput = document.getElementById('location-search');
    
    const activeTab = document.querySelector('.tab.active');
    const category = activeTab ? activeTab.getAttribute('data-category') : 'all';
    
    searchMedicines(
        medicationInput.value.trim(),
        locationInput.value.trim(),
        category,
        { minPrice, maxPrice, maxDistance, sortBy }
    );
}

// Get medicines by category
async function getMedicinesByCategory(category) {
    try {
        showLoading('medicine-container');
        
        const response = await fetch(`${API_BASE}/medicines/category/${category}`);
        const data = await response.json();
        
        if (response.ok) {
            const categoryNames = {
                'popular': 'Popular Medicines',
                'generic': 'Generic Medicines',
                'branded': 'Branded Medicines',
                'ayurvedic': 'Ayurvedic Medicines',
                'respiratory': 'Respiratory Care',
                'cardiac': 'Cardiac Care',
                'neuro': 'Neuro Care',
                'antibiotics': 'Antibiotics'
            };
            
            displayMedicines(data.medicines, categoryNames[category] || 'Medicines');
            
            // Remove filter panel when browsing by category
            const filterPanel = document.getElementById('filter-panel');
            if (filterPanel) filterPanel.remove();
        }
    } catch (error) {
        console.error('Error fetching medicines:', error);
        showError('Failed to load medicines');
    }
}

// Display medicines
function displayMedicines(medicines, title) {
    const container = document.getElementById('medicine-container');
    const titleElement = document.getElementById('medicine-category-title');
    
    titleElement.textContent = title;
    
    if (!medicines || medicines.length === 0) {
        container.innerHTML = '<p class="loading">No medicines found.</p>';
        return;
    }
    
    container.innerHTML = medicines.map(medicine => `
        <div class="medicine-card">
            <h3 class="medicine-name">${medicine.name}</h3>
            <p class="medicine-desc">${medicine.description}</p>
            <div class="medicine-price">₹${medicine.price.toFixed(2)}</div>
            <div class="medicine-rating">
                ${generateStars(medicine.rating)}
                <span>${medicine.rating} (${medicine.reviews})</span>
            </div>
            <div class="pharmacy-logos">
                ${medicine.pharmacies.map(pharmacy => `
                    <div class="pharmacy-badge">${pharmacy}</div>
                `).join('')}
            </div>
            <button class="btn btn-primary" onclick="checkAvailability(${medicine.id})">
                <i class="fas fa-shopping-cart"></i>
                Check Availability
            </button>
            <button class="btn btn-secondary" onclick="setPriceAlert(${medicine.id}, '${medicine.name}', ${medicine.price})" style="margin-top: 8px; width: 100%;">
                <i class="fas fa-bell"></i>
                Set Price Alert
            </button>
        </div>
    `).join('');
}

// Generate star ratings
function generateStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    let stars = '';
    
    for (let i = 0; i < fullStars; i++) {
        stars += '<i class="fas fa-star"></i>';
    }
    
    if (hasHalfStar) {
        stars += '<i class="fas fa-star-half-alt"></i>';
    }
    
    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
        stars += '<i class="far fa-star"></i>';
    }
    
    return stars;
}

// Check medicine availability with location
async function checkAvailability(medicineId) {
    try {
        // Try to get user's location
        let userLat = null;
        let userLng = null;
        
        if (navigator.geolocation) {
            try {
                const position = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        timeout: 5000,
                        maximumAge: 60000
                    });
                });
                
                userLat = position.coords.latitude;
                userLng = position.coords.longitude;
            } catch (geoError) {
                console.log('Geolocation not available or permission denied');
            }
        }
        
        const params = new URLSearchParams();
        if (userLat && userLng) {
            params.append('userLat', userLat);
            params.append('userLng', userLng);
        }
        
        const response = await fetch(`${API_BASE}/medicines/${medicineId}/availability?${params}`);
        const data = await response.json();
        
        if (response.ok) {
            showAvailabilityModal(data);
        } else {
            showError('Could not check availability');
        }
    } catch (error) {
        showError('Network error: ' + error.message);
    }
}

// Show availability modal with enhanced information
function showAvailabilityModal(data) {
    const modalHtml = `
        <div class="modal-overlay" onclick="closeModal()">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>${data.medicine_name} - Availability</h3>
                    <button onclick="closeModal()" class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <p><strong>Pharmacies with stock:</strong></p>
                    ${data.availability.map(item => `
                        <div class="availability-item">
                            <div class="pharmacy-info">
                                <strong>${item.pharmacy}</strong>
                                <div class="pharmacy-details">
                                    <small>${item.pharmacy_info?.address || 'Multiple locations'}</small>
                                    <small>Hours: ${item.pharmacy_info?.hours || 'Not specified'}</small>
                                </div>
                            </div>
                            <div class="availability-details">
                                <span class="stock-status ${item.stock.replace('-', '')}">${item.stock.replace('-', ' ')}</span>
                                <span class="price">₹${item.price.toFixed(2)}</span>
                                <span class="distance">${item.distance}</span>
                                <span class="delivery">Delivery: ${item.deliveryTime}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Set price alert
function setPriceAlert(medicineId, medicineName, currentPrice) {
    const email = prompt(`Enter your email to get alerts when ${medicineName} price drops below your target price:`);
    
    if (!email) return;
    
    const targetPrice = prompt(`Enter your target price for ${medicineName} (current: ₹${currentPrice.toFixed(2)}):`);
    
    if (!targetPrice || isNaN(parseFloat(targetPrice))) {
        alert('Please enter a valid price');
        return;
    }
    
    // Create price alert
    fetch(`${API_BASE}/alerts/price`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            medicine_id: medicineId,
            max_price: parseFloat(targetPrice),
            email: email
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert(`Price alert set! You'll be notified when ${medicineName} drops below ₹${targetPrice}`);
        } else {
            alert('Failed to set price alert: ' + data.error);
        }
    })
    .catch(error => {
        alert('Error setting price alert: ' + error.message);
    });
}

// Close modal
function closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
}

// Show loading
function showLoading(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '<div class="loading">Loading...</div>';
}

// Show error messages
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Load disease trends
async function loadDiseasesTrends() {
    try {
        const response = await fetch(`${API_BASE}/disease-trends`);
        const data = await response.json();
        
        if (response.ok) {
            displayDiseasesTrends(data.trends);
        }
    } catch (error) {
        console.error('Error loading disease trends:', error);
    }
}

// Display disease trends
function displayDiseasesTrends(trends) {
    const container = document.getElementById('disease-trends');
    
    container.innerHTML = trends.map(trend => `
        <div class="disease-item">
            <div class="disease-info">
                <i class="fas fa-${trend.icon}" style="color: #1E88E5;"></i>
                <span>${trend.name}</span>
            </div>
            <span class="disease-trend ${trend.type === 'increase' ? 'trend-up' : 'trend-down'}">${trend.trend} this week</span>
        </div>
    `).join('');
}

// Initialize WebSocket for real-time alerts
function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    
    ws.onmessage = function(event) {
        const alertData = JSON.parse(event.data);
        
        if (alertData.type === 'price_alert') {
            // Show notification to user
            if (Notification.permission === 'granted') {
                new Notification('MediFind Price Alert', {
                    body: alertData.message,
                    icon: '/favicon.ico'
                });
            } else if (Notification.permission !== 'denied') {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        new Notification('MediFind Price Alert', {
                            body: alertData.message,
                            icon: '/favicon.ico'
                        });
                    }
                });
            }
            
            // Also show in-page notification
            showError(alertData.message);
        }
    };
    
    ws.onclose = function() {
        // Try to reconnect after 5 seconds
        setTimeout(initWebSocket, 5000);
    };
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Request notification permission
    if ('Notification' in window) {
        Notification.requestPermission();
    }
    
    // Initialize WebSocket for real-time alerts
    initWebSocket();
    
    // Search form handling
    const searchForm = document.getElementById('main-search-form');
    if (searchForm) {
        searchForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const medicationInput = document.getElementById('medicine-search');
            const locationInput = document.getElementById('location-search');
            
            if (medicationInput.value.trim()) {
                searchMedicines(
                    medicationInput.value.trim(),
                    locationInput.value.trim()
                );
            }
        });
    }
    
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked tab
            tab.classList.add('active');
            
            // Get category and update display
            const category = tab.getAttribute('data-category');
            getMedicinesByCategory(category);
        });
    });
    
    // FAQ toggle functionality
    document.querySelectorAll('.faq-question').forEach(question => {
        question.addEventListener('click', () => {
            const faqItem = question.parentElement;
            faqItem.classList.toggle('faq-active');
        });
    });
    
    // Load initial data
    getMedicinesByCategory('popular');
    loadDiseasesTrends();
});

// Make functions globally available
window.checkAvailability = checkAvailability;
window.closeModal = closeModal;
window.applyFilters = applyFilters;
window.setPriceAlert = setPriceAlert;