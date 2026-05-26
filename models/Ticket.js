const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required']
  },
  customerEmail: {
    type: String,
    required: [true, 'Customer email is required'],
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  priority: {
    type: String,
    enum: {
      values: ['low', 'medium', 'high', 'urgent'],
      message: '{VALUE} is not a valid priority'
    },
    required: [true, 'Priority is required']
  },
  status: {
    type: String,
    enum: {
      values: ['open', 'in_progress', 'resolved', 'closed'],
      message: '{VALUE} is not a valid status'
    },
    default: 'open'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: {
    type: Date
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ageMinutes: minutes between createdAt and now (or resolvedAt if resolved/closed)
ticketSchema.virtual('ageMinutes').get(function() {
  const isResolvedState = (this.status === 'resolved' || this.status === 'closed');
  const endTime = (isResolvedState && this.resolvedAt) ? this.resolvedAt : new Date();
  return Math.floor((endTime - this.createdAt) / (60 * 1000));
});

// slaBreached: True if a ticket is still unresolved past its target, or if it was resolved after its target.
ticketSchema.virtual('slaBreached').get(function() {
  const SLA_LIMITS = {
    urgent: 1 * 60 * 60 * 1000,   // 1 hour
    high: 4 * 60 * 60 * 1000,     // 4 hours
    medium: 24 * 60 * 60 * 1000,  // 24 hours
    low: 72 * 60 * 60 * 1000      // 72 hours
  };
  const targetLimit = SLA_LIMITS[this.priority.toLowerCase()] || SLA_LIMITS.low;
  const isResolvedState = (this.status === 'resolved' || this.status === 'closed');
  const endTime = (isResolvedState && this.resolvedAt) ? this.resolvedAt : new Date();
  return (endTime - this.createdAt) > targetLimit;
});

const Ticket = mongoose.model('Ticket', ticketSchema);

module.exports = Ticket;
