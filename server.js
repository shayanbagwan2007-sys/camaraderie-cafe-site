const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'reservations.json');

// --- ADMIN CREDENTIALS ---
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'camaraderie2026'; 

// Simple Basic Authentication middleware
const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Secure Admin Dashboard"');
        return res.status(401).send('Authentication required.');
    }

    const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const user = auth[0];
    const pass = auth[1];

    if (user === ADMIN_USERNAME && pass === ADMIN_PASSWORD) {
        return next();
    }

    res.setHeader('WWW-Authenticate', 'Basic realm="Secure Admin Dashboard"');
    return res.status(401).send('Invalid username or password.');
};

// Middleware setup
app.use(cors());
app.use(express.json());

// 1. Secure the admin page and reservations API using middleware
app.get('/admin.html', requireAuth, (req, res, next) => {
    next(); // Pass control to static file server if logged in
});

app.get('/api/reservations', requireAuth, (req, res) => {
    const reservations = readReservations();
    res.json(reservations);
});

// 2. Route: Delete individual reservation by ID (Secured)
app.delete('/api/reservations/:id', requireAuth, (req, res) => {
    const targetId = req.params.id;
    let reservations = readReservations();
    
    const initialLength = reservations.length;
    reservations = reservations.filter(resObj => resObj.id !== targetId);

    if (reservations.length < initialLength) {
        writeReservations(reservations);
        console.log(`[Admin Action] Deleted reservation ID: ${targetId}`);
        return res.status(200).json({ message: 'Reservation successfully deleted.' });
    } else {
        return res.status(404).json({ error: 'Reservation not found.' });
    }
});

// 3. Route: Clear all reservations (Secured)
app.post('/api/reservations/clear-all', requireAuth, (req, res) => {
    writeReservations([]);
    console.log("[Admin Action] Wiped all reservation records.");
    return res.status(200).json({ message: 'All reservations cleared successfully.' });
});

// 4. Public Home Route (Serve customer page)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 5. Serve public folder static files normally for visitors
app.use(express.static(path.join(__dirname, 'public')));

// Helper to read reservations
const readReservations = () => {
    try {
        if (!fs.existsSync(DATA_FILE)) return [];
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data || '[]');
    } catch (err) {
        console.error("Error reading reservations file:", err);
        return [];
    }
};

// Helper to write reservations
const writeReservations = (data) => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error("Error writing reservations file:", err);
    }
};

// Route: Receive Reservation Form Submissions (Public)
app.post('/api/reservations', (req, res) => {
    const { name, phone, event_type, date, guests } = req.body;

    if (!name || !phone || !date || !guests) {
        return res.status(400).json({ error: 'Please fill in all required fields.' });
    }

    const newReservation = {
        id: Date.now().toString(),
        name,
        phone,
        event_type: event_type || 'Standard Dining',
        date,
        guests,
        createdAt: new Date().toISOString()
    };

    const reservations = readReservations();
    reservations.push(newReservation);
    writeReservations(reservations);

    return res.status(201).json({ 
        message: 'Reservation submitted successfully!', 
        reservation: newReservation 
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});