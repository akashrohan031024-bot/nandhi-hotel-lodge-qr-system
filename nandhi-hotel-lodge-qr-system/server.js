const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

function servePage(res, filenames) {
  const publicDir = path.join(__dirname, 'public');
  for (const f of filenames) {
    const fullPath = path.join(publicDir, f);
    if (fs.existsSync(fullPath)) {
      return res.sendFile(fullPath);
    }
  }
  try {
    const allFiles = fs.readdirSync(publicDir);
    for (const f of filenames) {
      const match = allFiles.find(file => file.toLowerCase() === f.toLowerCase());
      if (match) {
        return res.sendFile(path.join(publicDir, match));
      }
    }
  } catch (err) {
    console.error('File resolution error:', err);
  }
  return res.status(404).send('<!DOCTYPE html><html><head><title>Page Not Found - Hotel Nandhi Inn</title></head><body style="font-family:sans-serif;text-align:center;padding:50px;"><h2>Hotel Nandhi Inn — Page Not Found</h2><p><a href="/dashboard.html">Admin Dashboard</a> | <a href="/owner.html">Owner Command</a> | <a href="/website.html">Hotel & Lodge Website</a></p></body></html>');
}

app.get(['/website', '/website.html', '/Website', '/Website.html', '/site', '/lodge'], (req, res) => {
  servePage(res, ['Website.html', 'website.html']);
});

app.get(['/dashboard', '/dashboard.html', '/dashboard.htm', '/Dashboard', '/Dashboard.html'], (req, res) => {
  servePage(res, ['dashboard.html', 'dashboard.htm']);
});

app.get(['/owner', '/owner.html', '/Owner', '/Owner.html'], (req, res) => {
  servePage(res, ['owner.html']);
});

app.get(['/waiter', '/waiter.html', '/Waiter', '/Waiter.html'], (req, res) => {
  servePage(res, ['waiter.html']);
});

app.get(['/kitchen', '/kitchen.html', '/Kitchen', '/Kitchen.html'], (req, res) => {
  servePage(res, ['kitchen.html']);
});

const GOOGLE_SHEET_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbzB26bkeD8LZTykFuLHyGkLgDKa13QlzvUluGxgvbMt4IHCF6XDPeQAmD2Lq-PrlNWI/exec";

async function logToGoogleSheet(payload) {
  if (!GOOGLE_SHEET_WEBHOOK_URL || GOOGLE_SHEET_WEBHOOK_URL.includes("YOUR_APPS_SCRIPT")) {
    return;
  }
  try {
    const response = await fetch(GOOGLE_SHEET_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return await response.json();
  } catch (err) {
    console.error("Failed to sync to Google Sheet:", err.message);
  }
}

// Operational Expenses (Restaurant + Lodge Housekeeping)
const recentExpenses = [
  { date: new Date().toISOString().split('T')[0], category: 'Vegetables, Dairy & Nandhi Ghee', description: 'Fresh farm vegetables, paneer blocks & pure ghee supply', amount: 2450 },
  { date: new Date().toISOString().split('T')[0], category: 'Lodge Housekeeping & Linen Laundry', description: '20-room fresh bed linen laundry, toiletries & sanitizers', amount: 1650 }
];

app.get('/api/expenses', (req, res) => {
  res.json({ expenses: recentExpenses });
});

app.post('/api/expenses', async (req, res) => {
  const { category, description, amount } = req.body;
  if (!category || !amount) {
    return res.status(400).json({ error: "Category and amount are required." });
  }
  const now = new Date();
  const expenseData = {
    type: 'EXPENSE',
    sheet: 'Monthly Expenses',
    date: now.toISOString().split('T')[0],
    category: category,
    description: description || 'Hotel Nandhi Inn operational expense',
    amount: parseFloat(amount)
  };
  recentExpenses.unshift(expenseData);
  try {
    const result = await logToGoogleSheet(expenseData);
    io.emit('expense-added', expenseData);
    res.json({ success: true, message: "Expense logged successfully", data: expenseData, result });
  } catch (err) {
    res.status(500).json({ error: "Failed to record expense", details: err.message });
  }
});

const RESTAURANT_WIFI = {
  ssid: "Hotel_Nandhi_Inn_Guest",
  password: "Nandhi@2026"
};

const soldOutItems = new Set();
const customDishes = [];

// 1. Initialize 25 Restaurant Tables
const TOTAL_TABLES = 25;
const tables = {};
for (let i = 1; i <= TOTAL_TABLES; i++) {
  tables[i] = {
    status: 'idle',
    total: 0,
    orders: [],
    waiterCalled: false,
    billRequested: false,
    cashRequested: false,
    paid: false,
    guest: null,
    reservedTime: null,
    phone: null,
    guestsCount: null
  };
}

// 2. Initialize 20 Hotel Nandhi Inn Lodge Rooms (Floor 1: 101-110, Floor 2: 201-210)
const ROOM_CATALOG = [
  { roomNo: '101', floor: 1, type: 'Standard Non-AC Room', price: 1299, capacity: '2 Adults', bed: 'Queen Bed' },
  { roomNo: '102', floor: 1, type: 'Standard Non-AC Room', price: 1299, capacity: '2 Adults', bed: 'Queen Bed' },
  { roomNo: '103', floor: 1, type: 'Standard Non-AC Room', price: 1299, capacity: '2 Adults', bed: 'Queen Bed' },
  { roomNo: '104', floor: 1, type: 'Standard Non-AC Room', price: 1299, capacity: '2 Adults', bed: 'Twin Beds' },
  { roomNo: '105', floor: 1, type: 'Standard Non-AC Room', price: 1299, capacity: '2 Adults', bed: 'Twin Beds' },
  { roomNo: '106', floor: 1, type: 'Deluxe AC Room', price: 1899, capacity: '2 Adults + 1 Child', bed: 'King Bed' },
  { roomNo: '107', floor: 1, type: 'Deluxe AC Room', price: 1899, capacity: '2 Adults + 1 Child', bed: 'King Bed' },
  { roomNo: '108', floor: 1, type: 'Deluxe AC Room', price: 1899, capacity: '2 Adults + 1 Child', bed: 'King Bed' },
  { roomNo: '109', floor: 1, type: 'Deluxe AC Room', price: 1899, capacity: '2 Adults + 1 Child', bed: 'King Bed' },
  { roomNo: '110', floor: 1, type: 'Deluxe AC Room', price: 1899, capacity: '2 Adults + 1 Child', bed: 'King Bed' },
  { roomNo: '201', floor: 2, type: 'Deluxe AC Room', price: 1899, capacity: '2 Adults + 1 Child', bed: 'King Bed' },
  { roomNo: '202', floor: 2, type: 'Deluxe AC Room', price: 1899, capacity: '2 Adults + 1 Child', bed: 'King Bed' },
  { roomNo: '203', floor: 2, type: 'Deluxe AC Room', price: 1899, capacity: '2 Adults + 1 Child', bed: 'King Bed' },
  { roomNo: '204', floor: 2, type: 'Deluxe AC Room', price: 1899, capacity: '2 Adults + 1 Child', bed: 'King Bed' },
  { roomNo: '205', floor: 2, type: 'Executive AC King Suite', price: 2599, capacity: '3 Adults + 1 Child', bed: 'Plush King + Sofa' },
  { roomNo: '206', floor: 2, type: 'Executive AC King Suite', price: 2599, capacity: '3 Adults + 1 Child', bed: 'Plush King + Sofa' },
  { roomNo: '207', floor: 2, type: 'Executive AC King Suite', price: 2599, capacity: '3 Adults + 1 Child', bed: 'Plush King + Sofa' },
  { roomNo: '208', floor: 2, type: 'Executive AC King Suite', price: 2599, capacity: '3 Adults + 1 Child', bed: 'Plush King + Sofa' },
  { roomNo: '209', floor: 2, type: 'Family Interconnected AC Suite', price: 3299, capacity: '4 Adults + 2 Children', bed: '2 King Beds' },
  { roomNo: '210', floor: 2, type: 'Family Interconnected AC Suite', price: 3299, capacity: '4 Adults + 2 Children', bed: '2 King Beds' }
];

const lodgeRooms = {};
ROOM_CATALOG.forEach(r => {
  lodgeRooms[r.roomNo] = {
    ...r,
    status: 'available', // 'available' | 'occupied' | 'reserved' | 'housekeeping'
    guestName: null,
    phone: null,
    idProof: null,
    checkIn: null,
    checkOut: null,
    nights: 1,
    guestsCount: 2,
    addons: [],
    totalAmount: 0,
    advancePaid: 0,
    balanceDue: 0,
    bookingId: null,
    paymentMethod: null
  };
});

// Seed initial active Lodge Bookings so Owner Dashboard has live realistic telemetry immediately
const todayStr = new Date().toISOString().split('T')[0];
const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

const lodgeBookings = [
  {
    bookingId: 'NDH-8401',
    roomNo: '106',
    roomType: 'Deluxe AC Room',
    guestName: 'Dr. Mahesh Gowda',
    phone: '+91 98450 11223',
    email: 'mahesh.gowda@gmail.com',
    idProof: 'Aadhaar •••• 4821',
    checkIn: todayStr,
    checkOut: tomorrowStr,
    nights: 2,
    guestsCount: '2 Adults',
    addons: ['Complimentary Breakfast', 'Early Check-In'],
    totalAmount: 4534,
    advancePaid: 2500,
    balanceDue: 2034,
    paymentMethod: 'UPI Advance',
    status: 'Checked-In',
    source: 'Website Online Booking',
    timestamp: '09:45 AM'
  },
  {
    bookingId: 'NDH-8402',
    roomNo: '205',
    roomType: 'Executive AC King Suite',
    guestName: 'Smt. Kavitha & Family',
    phone: '+91 94480 66789',
    email: 'kavitha.mys@gmail.com',
    idProof: 'Aadhaar •••• 9104',
    checkIn: todayStr,
    checkOut: tomorrowStr,
    nights: 1,
    guestsCount: '3 Adults, 1 Child',
    addons: ['Extra Mattress', 'Complimentary Breakfast'],
    totalAmount: 3303,
    advancePaid: 3303,
    balanceDue: 0,
    paymentMethod: 'Full UPI Paid',
    status: 'Checked-In',
    source: 'Walk-In Front Desk',
    timestamp: '11:15 AM'
  },
  {
    bookingId: 'NDH-8403',
    roomNo: '209',
    roomType: 'Family Interconnected AC Suite',
    guestName: 'Sri Rajashekar Murthy',
    phone: '+91 99001 44556',
    email: 'rajashekar.m@yahoo.com',
    idProof: 'Driving License',
    checkIn: todayStr,
    checkOut: tomorrowStr,
    nights: 2,
    guestsCount: '4 Adults, 2 Children',
    addons: ['Complimentary Breakfast', 'Railway Station Pickup'],
    totalAmount: 7726,
    advancePaid: 3863,
    balanceDue: 3863,
    paymentMethod: '50% Advance UPI',
    status: 'Reserved',
    source: 'Website Online Booking',
    timestamp: '01:30 PM'
  }
];

// Apply seed bookings to lodgeRooms
lodgeRooms['106'] = { ...lodgeRooms['106'], ...lodgeBookings[0], status: 'occupied' };
lodgeRooms['205'] = { ...lodgeRooms['205'], ...lodgeBookings[1], status: 'occupied' };
lodgeRooms['209'] = { ...lodgeRooms['209'], ...lodgeBookings[2], status: 'reserved' };
lodgeRooms['102'].status = 'housekeeping';

const tableReservations = [
  {
    reservationId: 'RES-301',
    tableId: 4,
    tableName: 'Table 04',
    guestName: 'Pradeep Kumar & Family',
    phone: '+91 97412 33890',
    guestsCount: 6,
    date: todayStr,
    timeSlot: '08:00 PM (Dinner)',
    area: 'Ground Floor Woven-Lamp Hall',
    occasion: 'Family Dinner',
    notes: 'Prefer corner table near bamboo lattice window',
    status: 'Confirmed',
    timestamp: '12:20 PM'
  }
];
tables[4].status = 'reserved';
tables[4].guest = 'Pradeep Kumar (6 Guests)';
tables[4].reservedTime = '08:00 PM (Dinner)';
tables[4].phone = '+91 97412 33890';


app.get(['/convention-hall', '/convention-hall.html', '/hall', '/nandhi-bhavana'], (req, res) => {
  servePage(res, ['convention-hall.html']);
});

// 3. Initialize Nandhi Bhavana Convention Hall Bookings State (Synced to Owner Command & Admin Dashboard)
const conventionBookings = [
  {
    bookingId: 'NBH-2026-01',
    eventDate: '2026-11-15',
    eventType: 'Wedding & Muhurtham',
    clientName: 'Sri Venkataramana & Smt. Pushpa Family',
    phone: '+91 98451 22334',
    guests: 850,
    packageType: 'Full-Day Wedding + Floral Decor',
    totalValue: 145000,
    advancePaid: 72500,
    balanceDue: 72500,
    status: 'Confirmed (50% Paid)',
    timestamp: '10:15 AM'
  },
  {
    bookingId: 'NBH-2026-02',
    eventDate: '2026-11-22',
    eventType: 'Wedding & Muhurtham',
    clientName: 'Sri Mallikarjuna Gowda & Family',
    phone: '+91 94482 77889',
    guests: 1000,
    packageType: 'Full-Day Wedding + Turnkey Catering',
    totalValue: 235000,
    advancePaid: 117500,
    balanceDue: 117500,
    status: 'Confirmed (50% Paid)',
    timestamp: '11:40 AM'
  },
  {
    bookingId: 'NBH-2026-03',
    eventDate: '2026-11-29',
    eventType: 'Grand Reception & Sangeet',
    clientName: 'Dr. Raghuveer & Family',
    phone: '+91 99002 55667',
    guests: 550,
    packageType: 'Evening Reception & Chandelier Stage',
    totalValue: 65000,
    advancePaid: 32500,
    balanceDue: 32500,
    status: 'Confirmed (50% Paid)',
    timestamp: '02:10 PM'
  },
  {
    bookingId: 'NBH-2026-04',
    eventDate: '2026-12-06',
    eventType: 'Engagement / Naming Ceremony',
    clientName: 'Smt. Lakshmi & Sri Naveen',
    phone: '+91 97415 88990',
    guests: 400,
    packageType: 'Engagement Package (8-Hr + 4 Rooms)',
    totalValue: 48000,
    advancePaid: 24000,
    balanceDue: 24000,
    status: 'Confirmed (50% Paid)',
    timestamp: '04:05 PM'
  }
];

function createConventionBookingRecord(data) {
  const totalValue = parseFloat(data.totalValue) || 95000;
  const advancePaid = parseFloat(data.advancePaid) || Math.round(totalValue * 0.5);
  const balanceDue = Math.max(0, totalValue - advancePaid);
  const booking = {
    bookingId: data.bookingId || `NBH-2026-0${conventionBookings.length + 1}`,
    eventDate: data.eventDate || new Date().toISOString().split('T')[0],
    eventType: data.eventType || 'Wedding & Muhurtham',
    clientName: data.clientName || 'Walk-In Family Client',
    phone: data.phone || '+91 98450 00000',
    guests: parseInt(data.guests) || 600,
    packageType: data.packageType || 'Full-Day Wedding Package',
    notes: data.notes || '',
    totalValue,
    advancePaid,
    balanceDue,
    status: data.status || 'Confirmed (50% Paid)',
    timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  };
  conventionBookings.unshift(booking);

  logToGoogleSheet({
    type: 'CONVENTION_BOOKING',
    sheet: 'Convention Hall Bookings',
    bookingId: booking.bookingId,
    eventDate: booking.eventDate,
    eventType: booking.eventType,
    clientName: booking.clientName,
    phone: booking.phone,
    guests: booking.guests,
    totalValue: booking.totalValue,
    advancePaid: booking.advancePaid,
    balanceDue: booking.balanceDue
  });

  io.emit('convention-sync', { conventionBookings });
  io.emit('lodge-sync', { rooms: lodgeRooms, bookings: lodgeBookings, tableReservations, conventionBookings });
  io.emit('staff-alert', {
    type: 'convention',
    message: `🏛️ NEW CONVENTION HALL BOOKING: ${booking.eventDate} (${booking.eventType}) booked by ${booking.clientName} — ₹${booking.totalValue.toLocaleString('en-IN')}`
  });
  return booking;
}

app.get('/api/convention', (req, res) => {
  res.json({ conventionBookings });
});

app.post('/api/convention/book', (req, res) => {
  try {
    const booking = createConventionBookingRecord(req.body || {});
    res.json({ success: true, booking, conventionBookings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/lodge', (req, res) => {
  res.json({ rooms: lodgeRooms, bookings: lodgeBookings, tableReservations, conventionBookings });
});
app.get('/api/lodge-legacy', (req, res) => {
  res.json({
    rooms: lodgeRooms,
    bookings: lodgeBookings,
    tableReservations: tableReservations
  });
});

function createLodgeBookingRecord(data) {
  const bookingId = data.bookingId || `NDH-${Math.floor(1000 + Math.random() * 9000)}`;
  // Pick requested room or first available room matching roomType
  let roomNo = data.roomNo;
  if (!roomNo || !lodgeRooms[roomNo] || lodgeRooms[roomNo].status === 'occupied') {
    const candidate = Object.values(lodgeRooms).find(r => r.status === 'available' && (!data.roomType || r.type === data.roomType))
      || Object.values(lodgeRooms).find(r => r.status === 'available')
      || lodgeRooms['101'];
    roomNo = candidate.roomNo;
  }

  const roomObj = lodgeRooms[roomNo];
  const nights = Math.max(1, parseInt(data.nights) || 1);
  const totalAmount = parseFloat(data.totalAmount) || (roomObj.price * nights);
  const advancePaid = parseFloat(data.advancePaid) || 0;
  const balanceDue = Math.max(0, totalAmount - advancePaid);
  const status = data.status || (advancePaid > 0 ? 'Reserved' : 'Confirmed');

  const booking = {
    bookingId,
    roomNo,
    roomType: data.roomType || roomObj.type,
    guestName: data.guestName || 'Walk-in Guest',
    phone: data.phone || '+91 90000 00000',
    email: data.email || '',
    idProof: data.idProof || 'Aadhaar Card',
    checkIn: data.checkIn || todayStr,
    checkOut: data.checkOut || tomorrowStr,
    nights,
    guestsCount: data.guestsCount || '2 Adults',
    addons: Array.isArray(data.addons) ? data.addons : (data.addons ? [data.addons] : ['Complimentary Breakfast']),
    gstIn: data.gstIn || '',
    specialRequests: data.specialRequests || '',
    totalAmount,
    advancePaid,
    balanceDue,
    paymentMethod: data.paymentMethod || 'Pay at Hotel',
    status,
    source: data.source || 'Hotel Website Booking',
    timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  };

  lodgeBookings.unshift(booking);
  lodgeRooms[roomNo] = {
    ...roomObj,
    status: status === 'Checked-In' ? 'occupied' : 'reserved',
    guestName: booking.guestName,
    phone: booking.phone,
    idProof: booking.idProof,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    nights: booking.nights,
    guestsCount: booking.guestsCount,
    addons: booking.addons,
    totalAmount: booking.totalAmount,
    advancePaid: booking.advancePaid,
    balanceDue: booking.balanceDue,
    bookingId: booking.bookingId,
    paymentMethod: booking.paymentMethod
  };

  logToGoogleSheet({
    type: 'LODGE_BOOKING',
    sheet: 'Lodge Bookings',
    bookingId: booking.bookingId,
    date: booking.checkIn,
    roomNo: booking.roomNo,
    roomType: booking.roomType,
    guestName: booking.guestName,
    phone: booking.phone,
    nights: booking.nights,
    totalAmount: booking.totalAmount,
    advancePaid: booking.advancePaid,
    balanceDue: booking.balanceDue,
    paymentMethod: booking.paymentMethod
  });

  io.emit('lodge-sync', { rooms: lodgeRooms, bookings: lodgeBookings, tableReservations, conventionBookings });
  io.emit('lodge-new-booking', booking);
  io.emit('staff-alert', {
    type: 'lodge',
    message: `🏨 NEW LODGE BOOKING: Room ${booking.roomNo} (${booking.roomType}) booked by ${booking.guestName} for ${booking.nights} night(s) — ₹${booking.totalAmount}`
  });

  return booking;
}

app.post('/api/lodge/book', (req, res) => {
  try {
    const booking = createLodgeBookingRecord(req.body || {});
    res.json({ success: true, booking, rooms: lodgeRooms });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function resetTableState(tableId) {
  const id = parseInt(tableId) || 1;
  if (tables[id]) {
    tables[id] = {
      status: 'idle',
      total: 0,
      orders: [],
      waiterCalled: false,
      billRequested: false,
      cashRequested: false,
      paid: false,
      guest: null,
      reservedTime: null,
      phone: null,
      guestsCount: null
    };
    io.emit(`session-reset-${id}`);
    io.emit(`table-paid-${id}`, { method: 'CASH' });
    io.emit('table-cleared', { tableId: id });
    io.emit('table-updated', { tableId: id, table: tables[id] });
    io.emit('tables-sync', tables);
  }
}

io.on('connection', (socket) => {
  socket.emit('tables-sync', tables);
  socket.emit('lodge-sync', { rooms: lodgeRooms, bookings: lodgeBookings, tableReservations, conventionBookings });
  socket.emit('convention-sync', { conventionBookings });
  socket.emit('stock-sync', {
    soldOutIds: Array.from(soldOutItems),
    customDishes: customDishes
  });

  socket.on('get-table-status', () => {
    socket.emit('tables-sync', tables);
    socket.emit('lodge-sync', { rooms: lodgeRooms, bookings: lodgeBookings, tableReservations, conventionBookings });
  socket.emit('convention-sync', { conventionBookings });
    socket.emit('stock-sync', {
      soldOutIds: Array.from(soldOutItems),
      customDishes: customDishes
    });
  });

  // Lodge Room Booking via Socket.io
  socket.on('convention-booking-created', (data) => {
    const b = createConventionBookingRecord(data || {});
    socket.emit('convention-booking-confirmed', b);
  });

  socket.on('lodge-booking-created', (data) => {
    const booking = createLodgeBookingRecord(data || {});
    socket.emit('lodge-booking-confirmed', booking);
  });

  // Update Lodge Room Status (Check-In, Check-Out, Housekeeping, Available) from Owner or Admin Dashboard
  socket.on('update-room-status', ({ roomNo, action, paymentMethod }) => {
    const r = lodgeRooms[roomNo];
    if (!r) return;

    if (action === 'checkin') {
      r.status = 'occupied';
      const b = lodgeBookings.find(x => x.bookingId === r.bookingId || x.roomNo === roomNo);
      if (b) b.status = 'Checked-In';
      io.emit('staff-alert', { type: 'lodge', message: `🔑 Room ${roomNo} (${r.guestName || 'Guest'}) Checked-In!` });
    } else if (action === 'checkout') {
      const settledAmt = r.totalAmount || r.price;
      const b = lodgeBookings.find(x => x.bookingId === r.bookingId || x.roomNo === roomNo);
      if (b) {
        b.status = 'Checked-Out & Paid';
        b.balanceDue = 0;
        b.advancePaid = settledAmt;
      }
      logToGoogleSheet({
        type: 'LODGE_CHECKOUT',
        date: new Date().toISOString().split('T')[0],
        roomNo: roomNo,
        guestName: r.guestName || 'Lodge Guest',
        paymentMethod: paymentMethod || 'UPI',
        totalAmount: settledAmt
      });
      r.status = 'housekeeping';
      r.guestName = null;
      r.phone = null;
      r.idProof = null;
      r.checkIn = null;
      r.checkOut = null;
      r.advancePaid = 0;
      r.balanceDue = 0;
      r.bookingId = null;
      io.emit('staff-alert', { type: 'lodge', message: `✅ Room ${roomNo} Checked-Out & ₹${settledAmt} settled via ${paymentMethod || 'UPI'}. Sent to Housekeeping.` });
    } else if (action === 'available') {
      r.status = 'available';
      r.guestName = null;
      r.phone = null;
      r.bookingId = null;
      r.balanceDue = 0;
    } else if (action === 'housekeeping') {
      r.status = 'housekeeping';
    }

    io.emit('lodge-sync', { rooms: lodgeRooms, bookings: lodgeBookings, tableReservations, conventionBookings });
  });

  // Toggle Dish Stock
  socket.on('toggle-dish-stock', ({ id, name, inStock }) => {
    const keyId = String(id);
    const keyName = String(name || '').toLowerCase().trim();
    if (!inStock) {
      soldOutItems.add(keyId);
      if (keyName) soldOutItems.add(keyName);
    } else {
      soldOutItems.delete(keyId);
      if (keyName) soldOutItems.delete(keyName);
    }
    io.emit('stock-sync', {
      soldOutIds: Array.from(soldOutItems),
      customDishes: customDishes
    });
  });

  socket.on('add-custom-dish', (dish) => {
    customDishes.unshift(dish);
    io.emit('stock-sync', {
      soldOutIds: Array.from(soldOutItems),
      customDishes: customDishes
    });
  });

  // Order Placed by Customer QR, Room Service, Website, or Waiter POS
  socket.on('order-placed', (data) => {
    try {
      const tableId = parseInt(data.tableId || (data.table ? String(data.table).replace(/\D/g, '') : 1)) || 1;
      const table = tables[tableId] || tables[1];
      const roundTotal = parseFloat(data.total || data.roundTotal || 0);
      table.status = 'occupied';
      table.total += roundTotal;

      const newOrder = {
        orderId: data.orderId || `#${Math.floor(1000 + Math.random() * 9000)}`,
        tableId: tableId,
        table: data.table || `Table ${tableId < 10 ? '0' + tableId : tableId}`,
        items: data.items || [],
        roundTotal: roundTotal,
        round: data.round || (table.orders.length + 1),
        status: 'Pending',
        sentToKitchen: true,
        source: data.source || 'Customer QR Scan',
        customer: data.customer || `Table ${tableId < 10 ? '0' + tableId : tableId} Guest`,
        time: data.time || data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      table.orders.push(newOrder);
      io.emit('admin-new-order', newOrder);
      io.emit('new-kitchen-order', newOrder);
      io.emit('table-updated', { tableId, table });
      io.emit('tables-sync', tables);
    } catch (err) {
      console.error("Order processing error:", err);
    }
  });

  socket.on('dispatch-to-kitchen', ({ tableId, orderId }) => {
    const id = parseInt(tableId);
    if (tables[id] && tables[id].orders) {
      let targetOrder = null;
      tables[id].orders = tables[id].orders.map(o => {
        if (o.orderId === orderId) {
          const updated = { ...o, status: 'Preparing', sentToKitchen: true };
          targetOrder = updated;
          return updated;
        }
        return o;
      });
      if (targetOrder) io.emit('new-kitchen-order', targetOrder);
      io.emit('tables-sync', tables);
    }
  });

  socket.on('update-order-status', ({ tableId, orderId, status }) => {
    const id = parseInt(tableId);
    if (tables[id] && tables[id].orders) {
      tables[id].orders = tables[id].orders.map(o => o.orderId === orderId ? { ...o, status } : o);
      io.emit('tables-sync', tables);
    }
  });

  // Table Reservation from Website or Admin Dashboard
  socket.on('update-table-reservation', ({ tableId, status, guest, time, phone, guestsCount, area, occasion, notes }) => {
    const id = parseInt(tableId) || 1;
    if (tables[id]) {
      tables[id].status = status || 'reserved';
      tables[id].guest = guest || null;
      tables[id].reservedTime = time || null;
      tables[id].phone = phone || null;
      tables[id].guestsCount = guestsCount || null;
      io.emit('tables-sync', tables);
    }
    if (status === 'reserved' && guest) {
      const newRes = {
        reservationId: `RES-${Math.floor(100 + Math.random() * 900)}`,
        tableId: id,
        tableName: `Table ${id < 10 ? '0' + id : id}`,
        guestName: guest,
        phone: phone || '+91 98450 00000',
        guestsCount: guestsCount || 4,
        date: new Date().toISOString().split('T')[0],
        timeSlot: time || '07:30 PM (Dinner)',
        area: area || 'Ground Floor Woven-Lamp Dining Hall',
        occasion: occasion || 'Family Dining',
        notes: notes || '',
        status: 'Confirmed',
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      };
      tableReservations.unshift(newRes);
      io.emit('lodge-sync', { rooms: lodgeRooms, bookings: lodgeBookings, tableReservations, conventionBookings });
      io.emit('staff-alert', {
        type: 'reservation',
        tableId: id,
        message: `🍽️ TABLE RESERVATION: Table ${id} reserved for ${guest} at ${time || '7:30 PM'}`
      });
    }
  });

  socket.on('order-modified', (data) => {
    const tableId = data.tableId || 1;
    io.emit('kitchen-order-modified', data);
    io.emit('staff-alert', {
      type: 'warning',
      tableId: tableId,
      message: `⚠️ ${data.table || 'Table ' + tableId} MODIFIED: ${data.itemName} (${data.oldQty} ➔ ${data.newQty})`
    });
  });

  socket.on('call-waiter', (data) => {
    const tableId = parseInt(data.tableId) || 1;
    if (tables[tableId]) {
      tables[tableId].waiterCalled = true;
      io.emit('staff-alert', { type: 'waiter', tableId, message: `Table ${tableId} is calling the waiter!` });
      io.emit('tables-sync', tables);
    }
  });

  socket.on('dismiss-waiter', ({ tableId }) => {
    const id = parseInt(tableId) || 1;
    if (tables[id]) {
      tables[id].waiterCalled = false;
      io.emit('tables-sync', tables);
    }
  });

  socket.on('request-bill', (data) => {
    const tableId = parseInt(data.tableId) || 1;
    if (tables[tableId]) {
      tables[tableId].billRequested = true;
      tables[tableId].cashRequested = false;
      io.emit('staff-alert', { type: 'bill', tableId, message: `Table ${tableId} asked for the bill!` });
      io.emit('tables-sync', tables);
    }
  });

  socket.on('request-cash-payment', ({ tableId, table, total }) => {
    const id = parseInt(tableId) || 1;
    if (tables[id]) {
      tables[id].cashRequested = true;
      tables[id].billRequested = false;
      io.emit('staff-alert', {
        type: 'cash',
        tableId: id,
        message: `💵 ${table || 'Table ' + id} requested CASH payment (${total || '₹' + tables[id].total.toFixed(2)}) - Please collect cash!`
      });
      io.emit('tables-sync', tables);
    }
  });

  socket.on('pay-bill', ({ tableId, method }) => {
    const id = parseInt(tableId) || 1;
    const table = tables[id];
    if (table) {
      table.paid = true;
      table.status = 'idle';
      table.billRequested = false;
      table.cashRequested = false;
      io.emit('table-paid', { tableId: id, method: method });

      const allItems = table.orders.flatMap(o => o.items);
      const itemsSummary = allItems.map(i => `${i.qty || 1}x ${i.name}`).join(', ') || 'Dine-in Order';
      const now = new Date();
      const finalAmount = (table.total * 1.05).toFixed(2);

      logToGoogleSheet({
        type: 'PAYMENT',
        date: now.toISOString().split('T')[0],
        time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        table: `Table ${id}`,
        orderId: table.orders[0]?.orderId || `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
        orderItems: itemsSummary,
        paymentMethod: method || 'UPI',
        totalAmount: finalAmount
      });

      table.orders = [];
      table.total = 0;
      table.guest = null;
      table.reservedTime = null;
      io.emit('tables-sync', tables);
    }
  });

  socket.on('reset-table', ({ tableId }) => resetTableState(tableId));
  socket.on('clear-table', ({ tableId }) => resetTableState(tableId));

  socket.on('log-expense', async (data) => {
    const now = new Date();
    const exp = {
      type: 'EXPENSE',
      sheet: 'Monthly Expenses',
      date: now.toISOString().split('T')[0],
      category: data.category,
      description: data.description,
      amount: parseFloat(data.amount)
    };
    recentExpenses.unshift(exp);
    await logToGoogleSheet(exp);
    io.emit('expense-added', exp);
    io.emit('tables-sync', tables);
  });

  socket.on('get-wifi', () => {
    socket.emit('wifi-info', RESTAURANT_WIFI);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Hotel Nandhi Inn (Restaurant & Lodge) Server running at http://localhost:${PORT}`);
});
