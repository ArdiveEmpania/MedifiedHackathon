const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const WebSocket = require('ws'); // Add WebSocket support for real-time alerts

const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server for WebSocket
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Mock Database - In production, use MongoDB/PostgreSQL
let medicines = [
  {
    id: 1,
    name: 'Dolo 650',
    description: 'Paracetamol Tablets',
    price: 45.00,
    category: ['popular'],
    rating: 4.5,
    reviews: 1200,
    availability: 'in-stock',
    pharmacies: ['Apollo', 'MedPlus', 'Fortis'],
    composition: 'Paracetamol 650mg',
    manufacturer: 'Micro Labs Ltd',
    prescription_required: false,
    price_history: [
      { date: '2023-10-01', price: 42.00 },
      { date: '2023-10-15', price: 43.50 },
      { date: '2023-11-01', price: 45.00 }
    ]
  },
  // ... (keep existing medicine data, add price_history to each)
];

let users = [];
let prescriptions = [];
let consultations = [];
let orders = [];
let pharmacies = [
  { 
    id: 1, 
    name: 'Apollo Pharmacy', 
    location: 'Multiple Locations', 
    phone: '+91-9999999999',
    address: '123 Main St, City Center',
    hours: '8:00 AM - 10:00 PM',
    coordinates: { lat: 12.9716, lng: 77.5946 },
    delivery_radius: 5 // km
  },
  { 
    id: 2, 
    name: 'MedPlus', 
    location: 'Multiple Locations', 
    phone: '+91-8888888888',
    address: '456 Oak Ave, Downtown',
    hours: '9:00 AM - 9:00 PM',
    coordinates: { lat: 12.9680, lng: 77.5870 },
    delivery_radius: 4 // km
  },
  { 
    id: 3, 
    name: 'Fortis Healthcare', 
    location: 'Multiple Locations', 
    phone: '+91-7777777777',
    address: '789 Elm St, Medical District',
    hours: '24/7',
    coordinates: { lat: 12.9750, lng: 77.6000 },
    delivery_radius: 7 // km
  }
];

let diseaseData = [
  { name: 'Seasonal Influenza', trend: '+24%', type: 'increase', icon: 'lungs-virus' },
  { name: 'Allergic Rhinitis', trend: '+18%', type: 'increase', icon: 'allergies' },
  { name: 'Viral Fever', trend: '+15%', type: 'increase', icon: 'virus' },
  { name: 'Upper Respiratory Infection', trend: '-8%', type: 'decrease', icon: 'head-side-cough' },
  { name: 'Gastroenteritis', trend: '+12%', type: 'increase', icon: 'stomach' }
];

// Admin users
let admins = [
  { id: 1, username: 'admin', password: 'admin123', pharmacy_id: 1 },
  { id: 2, username: 'medplus_admin', password: 'medplus123', pharmacy_id: 2 },
  { id: 3, username: 'fortis_admin', password: 'fortis123', pharmacy_id: 3 }
];

// Price alerts
let priceAlerts = [];

let currentId = 11;

// WebSocket connection handling for real-time alerts
wss.on('connection', function connection(ws) {
  console.log('Client connected for real-time alerts');
  
  ws.on('message', function incoming(message) {
    console.log('Received: %s', message);
  });
  
  ws.on('close', function() {
    console.log('Client disconnected');
  });
});

// Function to send alerts to connected clients
function sendAlertToClients(alertData) {
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(alertData));
    }
  });
}

// Serve main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve admin portal
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'MediFind Backend',
    features: ['search', 'price_comparison', 'alerts', 'admin_portal', 'reports']
  });
});

// MEDICINE ENDPOINTS

// Search medicines with enhanced filters
app.get('/api/medicines/search', (req, res) => {
  const { q, location, category, sort, limit = 10, minPrice, maxPrice, maxDistance } = req.query;
  
  let results = [...medicines];
  
  // Filter by search query
  if (q) {
    const searchTerm = q.toLowerCase();
    results = results.filter(medicine => 
      medicine.name.toLowerCase().includes(searchTerm) ||
      medicine.description.toLowerCase().includes(searchTerm) ||
      medicine.composition.toLowerCase().includes(searchTerm)
    );
  }
  
  // Filter by category
  if (category && category !== 'all') {
    results = results.filter(medicine => 
      medicine.category.includes(category)
    );
  }
  
  // Filter by price range
  if (minPrice) {
    results = results.filter(medicine => medicine.price >= parseFloat(minPrice));
  }
  
  if (maxPrice) {
    results = results.filter(medicine => medicine.price <= parseFloat(maxPrice));
  }
  
  // Filter by location/pharmacy availability
  if (location) {
    results = results.filter(medicine => 
      medicine.pharmacies.some(pharmacy => 
        pharmacy.toLowerCase().includes(location.toLowerCase())
      )
    );
  }
  
  // Sort results
  if (sort) {
    switch (sort) {
      case 'price-low':
        results.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        results.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        results.sort((a, b) => b.rating - a.rating);
        break;
      case 'name':
        results.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'distance':
        // This would require actual location data to sort by distance
        // For now, we'll sort randomly to simulate distance-based sorting
        results.sort(() => Math.random() - 0.5);
        break;
    }
  }
  
  // Limit results
  results = results.slice(0, parseInt(limit));
  
  res.json({
    query: q,
    category,
    location,
    results,
    total: results.length,
    timestamp: new Date().toISOString()
  });
});

// Get medicines by category
app.get('/api/medicines/category/:category', (req, res) => {
  const { category } = req.params;
  const { limit = 20 } = req.query;
  
  let results = medicines;
  
  if (category !== 'all') {
    results = medicines.filter(medicine => 
      medicine.category.includes(category)
    );
  }
  
  results = results.slice(0, parseInt(limit));
  
  res.json({
    category,
    medicines: results,
    total: results.length
  });
});

// Get single medicine details
app.get('/api/medicines/:id', (req, res) => {
  const medicineId = parseInt(req.params.id);
  const medicine = medicines.find(m => m.id === medicineId);
  
  if (!medicine) {
    return res.status(404).json({ error: 'Medicine not found' });
  }
  
  res.json(medicine);
});

// Check medicine availability with distance calculation
app.get('/api/medicines/:id/availability', (req, res) => {
  const medicineId = parseInt(req.params.id);
  const { userLat, userLng } = req.query;
  const medicine = medicines.find(m => m.id === medicineId);
  
  if (!medicine) {
    return res.status(404).json({ error: 'Medicine not found' });
  }
  
  // Calculate distance if user coordinates provided
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };
  
  // Mock availability data by pharmacy with distance calculation
  const availabilityData = medicine.pharmacies.map(pharmacyName => {
    const pharmacy = pharmacies.find(p => p.name === pharmacyName);
    if (!pharmacy) return null;
    
    let distance = null;
    if (userLat && userLng && pharmacy.coordinates) {
      distance = calculateDistance(
        parseFloat(userLat), 
        parseFloat(userLng),
        pharmacy.coordinates.lat,
        pharmacy.coordinates.lng
      );
    } else {
      distance = parseFloat((Math.random() * 5 + 1).toFixed(1)); // Fallback random distance
    }
    
    return {
      pharmacy: pharmacyName,
      pharmacy_info: pharmacy,
      stock: Math.random() > 0.2 ? 'in-stock' : 'out-of-stock',
      price: medicine.price + (Math.random() * 20 - 10), // Price variation
      distance: distance.toFixed(1) + ' km',
      deliveryTime: `${Math.floor(Math.random() * 3 + 1)} hours`
    };
  }).filter(item => item !== null);
  
  res.json({
    medicine_id: medicineId,
    medicine_name: medicine.name,
    availability: availabilityData,
    last_updated: new Date().toISOString()
  });
});

// Get pharmacy details
app.get('/api/pharmacies/:id', (req, res) => {
  const pharmacyId = parseInt(req.params.id);
  const pharmacy = pharmacies.find(p => p.id === pharmacyId);
  
  if (!pharmacy) {
    return res.status(404).json({ error: 'Pharmacy not found' });
  }
  
  // Get medicines available at this pharmacy
  const pharmacyMedicines = medicines.filter(medicine => 
    medicine.pharmacies.includes(pharmacy.name)
  );
  
  res.json({
    ...pharmacy,
    medicines: pharmacyMedicines,
    total_medicines: pharmacyMedicines.length
  });
});

// Upload prescription
app.post('/api/prescriptions/upload', (req, res) => {
  const { patient_name, doctor_name, medicines_list, notes } = req.body;
  
  const prescription = {
    id: currentId++,
    patient_name,
    doctor_name,
    medicines_list,
    notes,
    uploaded_at: new Date().toISOString(),
    status: 'pending'
  };
  
  prescriptions.push(prescription);
  
  res.status(201).json({
    success: true,
    prescription,
    message: 'Prescription uploaded successfully'
  });
});

// Get user prescriptions
app.get('/api/prescriptions', (req, res) => {
  const { patient_name } = req.query;
  
  let results = prescriptions;
  
  if (patient_name) {
    results = prescriptions.filter(p => 
      p.patient_name.toLowerCase().includes(patient_name.toLowerCase())
    );
  }
  
  res.json({
    prescriptions: results,
    total: results.length
  });
});

// Book consultation
app.post('/api/consultations/book', (req, res) => {
  const { patient_name, phone, preferred_time, consultation_type, query } = req.body;
  
  if (!patient_name || !phone) {
    return res.status(400).json({ error: 'Patient name and phone are required' });
  }
  
  const consultation = {
    id: currentId++,
    patient_name,
    phone,
    preferred_time,
    consultation_type: consultation_type || 'general',
    query,
    status: 'scheduled',
    booked_at: new Date().toISOString()
  };
  
  consultations.push(consultation);
  
  res.status(201).json({
    success: true,
    consultation,
    message: 'Consultation booked successfully'
  });
});

// Get consultations
app.get('/api/consultations', (req, res) => {
  res.json({
    consultations,
    total: consultations.length
  });
});

// Drug interaction checker
app.post('/api/medicines/check-interactions', (req, res) => {
  const { medicine_ids } = req.body;
  
  if (!medicine_ids || !Array.isArray(medicine_ids)) {
    return res.status(400).json({ error: 'Medicine IDs array is required' });
  }
  
  const selectedMedicines = medicines.filter(m => medicine_ids.includes(m.id));
  
  // Mock interaction data
  const interactions = [];
  
  if (medicine_ids.includes(2) && medicine_ids.includes(5)) {
    interactions.push({
      severity: 'moderate',
      medicines: ['Azithral 500', 'Atorva 10'],
      description: 'May increase risk of muscle toxicity. Monitor for muscle pain.',
      recommendation: 'Consult your doctor before taking together.'
    });
  }
  
  res.json({
    medicines: selectedMedicines,
    interactions,
    interaction_count: interactions.length,
    checked_at: new Date().toISOString()
  });
});

// Get pharmacies with filtering
app.get('/api/pharmacies', (req, res) => {
  const { location, minDistance, maxDistance } = req.query;
  
  let results = pharmacies;
  
  if (location) {
    results = pharmacies.filter(p => 
      p.location.toLowerCase().includes(location.toLowerCase()) ||
      p.address.toLowerCase().includes(location.toLowerCase())
    );
  }
  
  res.json({
    pharmacies: results,
    total: results.length
  });
});

// Get disease trends
app.get('/api/disease-trends', (req, res) => {
  res.json({
    trends: diseaseData,
    last_updated: new Date().toISOString()
  });
});

// Create order
app.post('/api/orders', (req, res) => {
  const { customer_name, phone, address, medicines, pharmacy_id, delivery_option } = req.body;
  
  if (!customer_name || !phone || !medicines || medicines.length === 0) {
    return res.status(400).json({ error: 'Customer details and medicines are required' });
  }
  
  const total_amount = medicines.reduce((sum, item) => {
    const medicine = medicines.find(m => m.id === item.medicine_id);
    return sum + (medicine ? medicine.price * item.quantity : 0);
  }, 0);
  
  const order = {
    id: currentId++,
    customer_name,
    phone,
    address,
    medicines,
    pharmacy_id,
    delivery_option: delivery_option || 'standard',
    total_amount,
    status: 'confirmed',
    created_at: new Date().toISOString(),
    estimated_delivery: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };
  
  orders.push(order);
  
  res.status(201).json({
    success: true,
    order,
    message: 'Order placed successfully'
  });
});

// Get order status
app.get('/api/orders/:id', (req, res) => {
  const orderId = parseInt(req.params.id);
  const order = orders.find(o => o.id === orderId);
  
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  
  res.json(order);
});

// Contact form submission
app.post('/api/contact', (req, res) => {
  const { name, email, subject, message } = req.body;
  
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required' });
  }
  
  console.log('Contact form submission:', { name, email, subject, message });
  
  res.json({
    success: true,
    message: 'Your message has been sent successfully. We will get back to you soon.',
    timestamp: new Date().toISOString()
  });
});

// ADMIN ENDPOINTS

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  const admin = admins.find(a => a.username === username && a.password === password);
  
  if (!admin) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  res.json({
    success: true,
    admin: {
      id: admin.id,
      username: admin.username,
      pharmacy_id: admin.pharmacy_id
    },
    message: 'Login successful'
  });
});

// Get pharmacy inventory for admin
app.get('/api/admin/inventory/:pharmacyId', (req, res) => {
  const pharmacyId = parseInt(req.params.pharmacyId);
  const pharmacy = pharmacies.find(p => p.id === pharmacyId);
  
  if (!pharmacy) {
    return res.status(404).json({ error: 'Pharmacy not found' });
  }
  
  // Get medicines available at this pharmacy
  const pharmacyMedicines = medicines.filter(medicine => 
    medicine.pharmacies.includes(pharmacy.name)
  ).map(medicine => {
    // Add stock information specific to this pharmacy
    return {
      ...medicine,
      current_stock: Math.floor(Math.random() * 100), // Mock stock data
      last_updated: new Date().toISOString()
    };
  });
  
  res.json({
    pharmacy,
    inventory: pharmacyMedicines,
    total_items: pharmacyMedicines.length
  });
});

// Update medicine stock and price
app.put('/api/admin/inventory/:pharmacyId/medicine/:medicineId', (req, res) => {
  const { pharmacyId, medicineId } = req.params;
  const { stock, price } = req.body;
  
  const pharmacy = pharmacies.find(p => p.id === parseInt(pharmacyId));
  if (!pharmacy) {
    return res.status(404).json({ error: 'Pharmacy not found' });
  }
  
  const medicine = medicines.find(m => m.id === parseInt(medicineId));
  if (!medicine) {
    return res.status(404).json({ error: 'Medicine not found' });
  }
  
  // Check if this medicine is available at the pharmacy
  if (!medicine.pharmacies.includes(pharmacy.name)) {
    return res.status(400).json({ error: 'Medicine not available at this pharmacy' });
  }
  
  // Update price if provided
  if (price !== undefined) {
    const oldPrice = medicine.price;
    medicine.price = parseFloat(price);
    
    // Add to price history
    if (!medicine.price_history) {
      medicine.price_history = [];
    }
    medicine.price_history.push({
      date: new Date().toISOString().split('T')[0],
      price: medicine.price
    });
    
    // Check if any price alerts match this change
    checkPriceAlerts(medicine, oldPrice);
  }
  
  // In a real application, you would update the stock in the database
  // For this mock implementation, we'll just return success
  
  res.json({
    success: true,
    message: 'Inventory updated successfully',
    medicine: {
      id: medicine.id,
      name: medicine.name,
      price: medicine.price,
      pharmacy: pharmacy.name
    }
  });
});

// ALERTS ENDPOINTS

// Create price alert
app.post('/api/alerts/price', (req, res) => {
  const { medicine_id, max_price, email } = req.body;
  
  if (!medicine_id || !max_price || !email) {
    return res.status(400).json({ error: 'Medicine ID, max price, and email are required' });
  }
  
  const medicine = medicines.find(m => m.id === parseInt(medicine_id));
  if (!medicine) {
    return res.status(404).json({ error: 'Medicine not found' });
  }
  
  const alert = {
    id: currentId++,
    medicine_id: parseInt(medicine_id),
    medicine_name: medicine.name,
    max_price: parseFloat(max_price),
    email,
    created_at: new Date().toISOString(),
    active: true
  };
  
  priceAlerts.push(alert);
  
  res.status(201).json({
    success: true,
    alert,
    message: 'Price alert created successfully'
  });
});

// Check if price change triggers any alerts
function checkPriceAlerts(medicine, oldPrice) {
  const relevantAlerts = priceAlerts.filter(alert => 
    alert.medicine_id === medicine.id && 
    alert.active && 
    medicine.price <= alert.max_price &&
    oldPrice > alert.max_price
  );
  
  if (relevantAlerts.length > 0) {
    // Send alerts (in a real app, this would send emails or push notifications)
    relevantAlerts.forEach(alert => {
      const alertData = {
        type: 'price_alert',
        message: `Price alert: ${medicine.name} is now ₹${medicine.price}, below your target of ₹${alert.max_price}`,
        medicine: medicine.name,
        current_price: medicine.price,
        target_price: alert.max_price,
        timestamp: new Date().toISOString()
      };
      
      // Send via WebSocket for real-time notifications
      sendAlertToClients(alertData);
      
      console.log(`Price alert sent to ${alert.email}: ${alertData.message}`);
    });
  }
}

// REPORTS ENDPOINTS

// Get price trends for a medicine
app.get('/api/reports/price-trends/:medicineId', (req, res) => {
  const medicineId = parseInt(req.params.medicineId);
  const medicine = medicines.find(m => m.id === medicineId);
  
  if (!medicine) {
    return res.status(404).json({ error: 'Medicine not found' });
  }
  
  // If no price history exists, create some mock data
  if (!medicine.price_history || medicine.price_history.length === 0) {
    medicine.price_history = [
      { date: '2023-10-01', price: medicine.price * 0.9 },
      { date: '2023-10-15', price: medicine.price * 0.95 },
      { date: '2023-11-01', price: medicine.price }
    ];
  }
  
  res.json({
    medicine_id: medicineId,
    medicine_name: medicine.name,
    price_history: medicine.price_history,
    current_price: medicine.price
  });
});

// Get popular medicines report
app.get('/api/reports/popular-medicines', (req, res) => {
  const { limit = 10 } = req.query;
  
  // Sort by reviews to determine popularity
  const popularMedicines = [...medicines]
    .sort((a, b) => b.reviews - a.reviews)
    .slice(0, parseInt(limit))
    .map(medicine => ({
      id: medicine.id,
      name: medicine.name,
      reviews: medicine.reviews,
      rating: medicine.rating,
      category: medicine.category[0],
      price: medicine.price
    }));
  
  res.json({
    report_type: 'popular_medicines',
    medicines: popularMedicines,
    generated_at: new Date().toISOString()
  });
});

// Get best price comparison for a medicine
app.get('/api/reports/best-prices/:medicineId', (req, res) => {
  const medicineId = parseInt(req.params.medicineId);
  const medicine = medicines.find(m => m.id === medicineId);
  
  if (!medicine) {
    return res.status(404).json({ error: 'Medicine not found' });
  }
  
  // Get all pharmacies that carry this medicine
  const pharmacyPrices = medicine.pharmacies.map(pharmacyName => {
    const pharmacy = pharmacies.find(p => p.name === pharmacyName);
    // Add some price variation between pharmacies
    const priceVariation = medicine.price * (0.8 + Math.random() * 0.4);
    
    return {
      pharmacy_id: pharmacy ? pharmacy.id : null,
      pharmacy_name: pharmacyName,
      price: parseFloat(priceVariation.toFixed(2)),
      distance: pharmacy ? `${(Math.random() * 5 + 1).toFixed(1)} km` : 'Unknown'
    };
  });
  
  // Sort by price
  pharmacyPrices.sort((a, b) => a.price - b.price);
  
  res.json({
    medicine_id: medicineId,
    medicine_name: medicine.name,
    prices: pharmacyPrices,
    best_price: pharmacyPrices[0],
    generated_at: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    requested_url: req.url,
    timestamp: new Date().toISOString()
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 MediFind Backend Server running on http://localhost:${PORT}`);
  console.log(`📊 API Documentation available at http://localhost:${PORT}/api/health`);
  console.log(`🔍 Medicine Search: GET http://localhost:${PORT}/api/medicines/search`);
  console.log(`💊 Medicine Categories: GET http://localhost:${PORT}/api/medicines/category/{category}`);
  console.log(`👨‍💼 Admin Portal: http://localhost:${PORT}/admin`);
});

module.exports = app;