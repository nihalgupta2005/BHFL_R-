const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Ticket = require('./models/Ticket');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend communication
app.use(cors());

// Middleware for parsing JSON requests
app.use(express.json());

// MongoDB Connection
const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ticket_system';
mongoose.connect(mongoURI)
  .then(() => console.log('Successfully connected to MongoDB.'))
  .catch(err => console.error('MongoDB connection error:', err));

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Backend server is running.' });
});

// Create a new support ticket
const createTicketHandler = async (req, res) => {
  try {
    const { subject, description, customerEmail, priority, status } = req.body;
    const ticket = new Ticket({ subject, description, customerEmail, priority, status });
    await ticket.save();
    res.status(201).json({ success: true, data: ticket });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};
app.post('/api/tickets', createTicketHandler);
app.post('/tickets', createTicketHandler);

// Fetch all support tickets with optional filters (?status, ?priority, ?breached)
const getTicketsHandler = async (req, res) => {
  try {
    const { status, priority, breached } = req.query;
    const dbQuery = {};
    
    if (status) dbQuery.status = status;
    if (priority) dbQuery.priority = priority;

    let tickets = await Ticket.find(dbQuery).sort({ createdAt: -1 });

    // Filter by derived virtual field `slaBreached` if requested
    if (breached !== undefined) {
      const isBreached = breached === 'true';
      tickets = tickets.filter(t => t.slaBreached === isBreached);
    }

    res.status(200).json({ success: true, count: tickets.length, data: tickets });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
app.get('/api/tickets', getTicketsHandler);
app.get('/tickets', getTicketsHandler);

// GET ticket statistics metrics
const getTicketStatsHandler = async (req, res) => {
  try {
    const tickets = await Ticket.find();
    
    const stats = {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'open').length,
      in_progress: tickets.filter(t => t.status === 'in_progress').length,
      resolved: tickets.filter(t => t.status === 'resolved').length,
      closed: tickets.filter(t => t.status === 'closed').length,
      // sla_breached represents the count of SLA-breached tickets currently open (unresolved)
      sla_breached: tickets.filter(t => {
        const isUnresolved = (t.status === 'open' || t.status === 'in_progress');
        return isUnresolved && t.slaBreached;
      }).length
    };

    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
app.get('/api/tickets/stats', getTicketStatsHandler);
app.get('/tickets/stats', getTicketStatsHandler);

// PATCH route handler to update ticket status with transition rules
const patchTicketHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid Ticket ID format.' });
    }

    // Validate status parameter
    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required.' });
    }

    const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid status '${status}'. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    // Retrieve the ticket
    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found.' });
    }

    const currentStatus = ticket.status;
    const newStatus = status;

    const currentIdx = validStatuses.indexOf(currentStatus);
    const newIdx = validStatuses.indexOf(newStatus);

    // Enforce transition logic
    if (newIdx > currentIdx) {
      // Forward transition: must be exactly one step
      if (newIdx !== currentIdx + 1) {
        return res.status(400).json({ 
          success: false, 
          error: `Invalid transition: cannot skip forward from '${currentStatus}' to '${newStatus}'. Transition must be step-by-step: open -> in_progress -> resolved -> closed.` 
        });
      }
    } else if (newIdx < currentIdx) {
      // Backward transition: must be exactly one step
      if (newIdx !== currentIdx - 1) {
        return res.status(400).json({ 
          success: false, 
          error: `Invalid transition: cannot move backward more than one step from '${currentStatus}' to '${newStatus}'.` 
        });
      }
    }

    // Update status
    ticket.status = newStatus;

    // Manage resolvedAt timestamp automatically
    if (newStatus === 'resolved') {
      if (!ticket.resolvedAt) {
        ticket.resolvedAt = new Date();
      }
    } else if (newStatus === 'in_progress' || newStatus === 'open') {
      ticket.resolvedAt = undefined; // clears resolvedAt when moving back to unresolved states
    }

    await ticket.save();
    res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};
app.patch('/api/tickets/:id', patchTicketHandler);
app.patch('/tickets/:id', patchTicketHandler);

// DELETE ticket by ID
const deleteTicketHandler = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid Ticket ID format.' });
    }
    const ticket = await Ticket.findByIdAndDelete(id);
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found.' });
    }
    res.status(200).json({ success: true, message: 'Ticket deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
app.delete('/api/tickets/:id', deleteTicketHandler);
app.delete('/tickets/:id', deleteTicketHandler);

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
