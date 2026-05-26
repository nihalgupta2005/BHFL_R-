import React, { useState, useEffect } from 'react';

// SLA definitions in milliseconds
const SLA_LIMITS = {
  urgent: 1 * 60 * 60 * 1000,      // 1 hour
  high: 4 * 60 * 60 * 1000,        // 4 hours
  medium: 24 * 60 * 60 * 1000,     // 24 hours
  low: 72 * 60 * 60 * 1000,        // 72 hours
};

// Formats a relative age representation
const getRelativeAge = (createdAtStr) => {
  const diffMs = new Date() - new Date(createdAtStr);
  if (diffMs < 0) return 'just now';

  const diffMins = Math.floor(diffMs / (60 * 1000));
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

// Formats ticket age in "3h 12m" style, stopping when resolved or closed
const getTicketAge = (createdAtStr, resolvedAtStr, status) => {
  const isResolvedState = (status === 'resolved' || status === 'closed');
  const endTime = (isResolvedState && resolvedAtStr) ? new Date(resolvedAtStr) : new Date();
  const diffMs = endTime - new Date(createdAtStr);
  if (diffMs < 0) return 'just now';

  const diffMins = Math.floor(diffMs / (60 * 1000));
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m`;

  const diffHours = Math.floor(diffMins / 60);
  const remainingMins = diffMins % 60;
  if (diffHours < 24) {
    return remainingMins > 0 ? `${diffHours}h ${remainingMins}m` : `${diffHours}h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  const remainingHours = diffHours % 24;
  if (remainingHours > 0) {
    return `${diffDays}d ${remainingHours}h`;
  }
  return `${diffDays}d`;
};

// Determines if a ticket has breached its SLA
const checkSlaBreached = (ticket) => {
  const limit = SLA_LIMITS[ticket.priority.toLowerCase()] || SLA_LIMITS.low;
  const isResolvedState = (ticket.status === 'resolved' || ticket.status === 'closed');
  const endTime = (isResolvedState && ticket.resolvedAt) ? new Date(ticket.resolvedAt) : new Date();
  const elapsed = endTime - new Date(ticket.createdAt);
  return elapsed > limit;
};

// Main Board Columns configuration
const COLUMNS = [
  { id: 'open', label: 'Open', color: 'var(--color-open)' },
  { id: 'in_progress', label: 'In Progress', color: 'var(--color-inprogress)' },
  { id: 'resolved', label: 'Resolved', color: 'var(--color-resolved)' },
  { id: 'closed', label: 'Closed', color: 'var(--color-closed)' },
];

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function App() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [timeTick, setTimeTick] = useState(0);

  // Stats and Filters State
  const [stats, setStats] = useState({ total: 0, open: 0, in_progress: 0, resolved: 0, closed: 0, sla_breached: 0 });
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterSla, setFilterSla] = useState(false);
  const [notification, setNotification] = useState(null);

  // New ticket form state
  const [newTicket, setNewTicket] = useState({
    subject: '',
    description: '',
    customerEmail: '',
    priority: 'medium',
    status: 'open',
  });
  const [formError, setFormError] = useState(null);

  // Auto-dismiss notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const triggerNotification = (message, type = 'success') => {
    setNotification({ message, type });
  };

  // Fetch ticket statistics
  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/tickets/stats`);
      const json = await res.json();
      if (json.success) {
        setStats(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch statistics:', err);
    }
  };

  // Fetch all tickets
  const fetchTickets = async () => {
    try {
      const res = await fetch(`${API_URL}/api/tickets`);
      const json = await res.json();
      if (json.success) {
        setTickets(json.data);
      } else {
        setError(json.error || 'Failed to fetch tickets');
      }
    } catch (err) {
      setError('Cannot connect to the server API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
    fetchStats();
    // Auto-fetch updates
    const fetchInterval = setInterval(() => {
      fetchTickets();
      fetchStats();
    }, 5000);
    // Dynamic timer to update elapsed ages/SLAs every 10 seconds
    const timeInterval = setInterval(() => {
      setTimeTick((prev) => prev + 1);
    }, 10000);

    return () => {
      clearInterval(fetchInterval);
      clearInterval(timeInterval);
    };
  }, []);

  // Handle ticket creation submission
  const handleCreateTicket = async (e) => {
    e.preventDefault();
    setFormError(null);

    // Basic frontend validations
    if (!newTicket.subject.trim() || !newTicket.description.trim() || !newTicket.customerEmail.trim()) {
      setFormError('Please fill out all required fields.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newTicket.customerEmail.trim())) {
      setFormError('Please enter a valid customer email address.');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTicket),
      });
      const json = await res.json();
      if (json.success) {
        setTickets((prev) => [json.data, ...prev]);
        setIsModalOpen(false);
        setNewTicket({
          subject: '',
          description: '',
          customerEmail: '',
          priority: 'medium',
          status: 'open',
        });
        triggerNotification('Ticket created successfully!', 'success');
        fetchStats();
      } else {
        setFormError(json.error || 'Failed to create ticket.');
      }
    } catch (err) {
      setFormError('Network error while creating ticket.');
    }
  };

  // Trigger state transition on ticket
  const transitionTicket = async (ticketId, nextStatus) => {
    try {
      const res = await fetch(`${API_URL}/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (json.success) {
        // Update local state immediately
        setTickets((prev) =>
          prev.map((t) => (t._id === ticketId ? json.data : t))
        );
        triggerNotification(`Ticket status updated to ${nextStatus.replace('_', ' ')}.`, 'success');
        fetchStats();
      } else {
        triggerNotification(`Error updating ticket status: ${json.error}`, 'error');
      }
    } catch (err) {
      triggerNotification('Failed to update ticket status due to a connection issue.', 'error');
    }
  };

  // Combined client-side filtering logic
  const filteredTickets = tickets.filter((ticket) => {
    if (filterPriority !== 'all' && ticket.priority.toLowerCase() !== filterPriority.toLowerCase()) {
      return false;
    }
    if (filterSla && !checkSlaBreached(ticket)) {
      return false;
    }
    return true;
  });

  return (
    <div className="app-container">
      <header>
        <div className="title-container">
          <h1>Support Desk Portal</h1>
          <p>Strict transition rules: open ⇄ in progress ⇄ resolved ⇄ closed</p>
        </div>
        <button className="btn-create" onClick={() => setIsModalOpen(true)}>
          <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>+</span> New Ticket
        </button>
      </header>

      {/* Global Notifications */}
      {notification && (
        <div className={notification.type === 'error' ? 'error-banner' : 'notification-banner'}>
          <span>{notification.message}</span>
          <button className="notification-close" onClick={() => setNotification(null)}>×</button>
        </div>
      )}

      {/* Stats Strip */}
      <div className="stats-strip">
        <div className="stat-item">
          <span className="stat-val">{stats.total}</span>
          <span className="stat-label">Total Tickets</span>
        </div>
        <div className="stat-item">
          <span className="stat-val stat-open">{stats.open}</span>
          <span className="stat-label">Open</span>
        </div>
        <div className="stat-item">
          <span className="stat-val stat-progress">{stats.in_progress}</span>
          <span className="stat-label">In Progress</span>
        </div>
        <div className="stat-item">
          <span className="stat-val stat-resolved">{stats.resolved}</span>
          <span className="stat-label">Resolved</span>
        </div>
        <div className="stat-item">
          <span className="stat-val stat-closed">{stats.closed}</span>
          <span className="stat-label">Closed</span>
        </div>
        <div className="stat-item">
          <span className="stat-val stat-breached">{stats.sla_breached}</span>
          <span className="stat-label">SLA Breached</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="filters-bar">
        <div className="filters-left">
          <div className="filter-group">
            <label htmlFor="priority-filter">Priority:</label>
            <select 
              id="priority-filter" 
              className="filter-select"
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
            >
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <label className="sla-toggle-label">
            <input 
              type="checkbox" 
              checked={filterSla} 
              onChange={(e) => setFilterSla(e.target.checked)} 
            />
            <span className="checkbox-custom"></span>
            <span>SLA Breached Only</span>
          </label>
        </div>
        <div className="filters-right">
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Showing {filteredTickets.length} of {tickets.length} tickets
          </span>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          Loading your support board...
        </div>
      ) : (
        <Board 
          tickets={filteredTickets} 
          onTransition={transitionTicket} 
          triggerNotification={triggerNotification}
        />
      )}

      {/* Create Ticket Modal Dialog */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>File Support Ticket</h2>
              <button className="btn-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            
            {formError && <div className="error-banner">{formError}</div>}

            <form onSubmit={handleCreateTicket} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div className="form-group">
                <label>Subject *</label>
                <input 
                  type="text" 
                  placeholder="Summary of issues..." 
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Customer Email *</label>
                <input 
                  type="email" 
                  placeholder="customer@domain.com" 
                  value={newTicket.customerEmail}
                  onChange={(e) => setNewTicket({ ...newTicket, customerEmail: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Description *</label>
                <textarea 
                  rows="3" 
                  placeholder="Detailed breakdown..." 
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Priority</label>
                <select 
                  value={newTicket.priority}
                  onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-create">Submit Ticket</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Board Grid Component representing Kanban Columns
function Board({ tickets, onTransition, triggerNotification }) {
  const [draggedTicket, setDraggedTicket] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  const getValidTransitions = (status) => {
    switch (status) {
      case 'open': return ['in_progress'];
      case 'in_progress': return ['open', 'resolved'];
      case 'resolved': return ['in_progress', 'closed'];
      case 'closed': return ['resolved'];
      default: return [];
    }
  };

  const handleDragStart = (ticket) => {
    setDraggedTicket(ticket);
  };

  const handleDragEnd = () => {
    setDraggedTicket(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    if (dragOverColumn !== columnId) {
      setDragOverColumn(columnId);
    }
  };

  const handleDragLeave = (columnId) => {
    if (dragOverColumn === columnId) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = (e, targetStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    setDraggedTicket(null);

    const ticketId = e.dataTransfer.getData('ticketId');
    const sourceStatus = e.dataTransfer.getData('sourceStatus');

    if (!ticketId || !sourceStatus) return;

    if (sourceStatus === targetStatus) return;

    const validTargets = getValidTransitions(sourceStatus);
    if (validTargets.includes(targetStatus)) {
      onTransition(ticketId, targetStatus);
    } else {
      const formatStatus = (s) => s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
      triggerNotification(
        `Invalid transition: Cannot move directly from '${formatStatus(sourceStatus)}' to '${formatStatus(targetStatus)}'. Transitions must follow: Open ⇄ In Progress ⇄ Resolved ⇄ Closed.`,
        'error'
      );
    }
  };

  return (
    <div className="board-grid">
      {COLUMNS.map((col) => {
        const colTickets = tickets.filter((t) => t.status === col.id);
        const isDragging = !!draggedTicket;
        const isValidTarget = isDragging && getValidTransitions(draggedTicket.status).includes(col.id);
        const isOver = dragOverColumn === col.id;

        let colClass = "board-column";
        if (isDragging) {
          if (draggedTicket.status === col.id) {
            colClass += " column-source";
          } else if (isValidTarget) {
            colClass += " column-valid-target";
            if (isOver) colClass += " column-drag-over-valid";
          } else {
            colClass += " column-invalid-target";
            if (isOver) colClass += " column-drag-over-invalid";
          }
        }

        return (
          <div 
            className={colClass} 
            key={col.id}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDragLeave={() => handleDragLeave(col.id)}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            <div className="column-header">
              <div className="column-title-wrapper" style={{ color: col.color }}>
                <span className="column-dot" style={{ backgroundColor: col.color }}></span>
                <span className="column-title">{col.label}</span>
              </div>
              <span className="column-count">{colTickets.length}</span>
            </div>

            <div className="column-cards-container">
              {colTickets.length === 0 ? (
                <div className="empty-placeholder">
                  <div className="empty-icon">📭</div>
                  No tickets
                </div>
              ) : (
                colTickets.map((ticket) => (
                  <TicketCard 
                    key={ticket._id} 
                    ticket={ticket} 
                    onTransition={onTransition} 
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    isDragged={draggedTicket && draggedTicket._id === ticket._id}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Ticket Card Component
function TicketCard({ ticket, onTransition, onDragStart, onDragEnd, isDragged }) {
  const isBreached = checkSlaBreached(ticket);
  const relativeAge = getTicketAge(ticket.createdAt, ticket.resolvedAt, ticket.status);

  // Map priorities to CSS colors
  const getPriorityStyle = (pri) => {
    switch (pri.toLowerCase()) {
      case 'low': return { color: 'var(--pri-low)', backgroundColor: 'var(--pri-low-bg)' };
      case 'medium': return { color: 'var(--pri-medium)', backgroundColor: 'var(--pri-medium-bg)' };
      case 'high': return { color: 'var(--pri-high)', backgroundColor: 'var(--pri-high-bg)' };
      case 'urgent': return { color: 'var(--pri-urgent)', backgroundColor: 'var(--pri-urgent-bg)' };
      default: return {};
    }
  };

  const priorityStyle = getPriorityStyle(ticket.priority);

  // Render transition actions based strictly on current state
  // Only adjacent status shifts (one step forward or backward) are displayed
  const renderActionButtons = () => {
    switch (ticket.status) {
      case 'open':
        return (
          <button 
            className="btn-action btn-action-forward"
            onClick={() => onTransition(ticket._id, 'in_progress')}
          >
            Start Work →
          </button>
        );
      case 'in_progress':
        return (
          <>
            <button 
              className="btn-action"
              onClick={() => onTransition(ticket._id, 'open')}
            >
              ← Revert
            </button>
            <button 
              className="btn-action btn-action-forward"
              onClick={() => onTransition(ticket._id, 'resolved')}
            >
              Resolve →
            </button>
          </>
        );
      case 'resolved':
        return (
          <>
            <button 
              className="btn-action"
              onClick={() => onTransition(ticket._id, 'in_progress')}
            >
              ← Reopen
            </button>
            <button 
              className="btn-action btn-action-forward"
              onClick={() => onTransition(ticket._id, 'closed')}
            >
              Close →
            </button>
          </>
        );
      case 'closed':
        return (
          <button 
            className="btn-action"
            onClick={() => onTransition(ticket._id, 'resolved')}
          >
            ← Reopen to Resolved
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div 
      className={`ticket-card ${isDragged ? 'is-dragging' : ''}`}
      style={{ '--accent-priority-color': priorityStyle.color }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('ticketId', ticket._id);
        e.dataTransfer.setData('sourceStatus', ticket.status);
        e.dataTransfer.effectAllowed = 'move';
        if (onDragStart) onDragStart(ticket);
      }}
      onDragEnd={() => {
        if (onDragEnd) onDragEnd();
      }}
    >
      <div className="ticket-header">
        <span className="ticket-subject" title={ticket.subject}>{ticket.subject}</span>
      </div>

      <p className="ticket-desc">{ticket.description}</p>
      
      <div className="ticket-email">
        <span>📧</span>
        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={ticket.customerEmail}>
          {ticket.customerEmail}
        </span>
      </div>

      <div className="ticket-badges">
        <span className="badge" style={priorityStyle}>
          {ticket.priority}
        </span>
        {isBreached && (
          <span className="badge badge-sla-breach">
            ⚠️ SLA BREACHED
          </span>
        )}
      </div>

      <div className="ticket-footer">
        <div className="ticket-meta">
          <span>Age: {relativeAge}</span>
          {ticket.resolvedAt && (
            <span style={{ color: 'var(--color-resolved)' }}>
              Resolved: {getRelativeAge(ticket.resolvedAt)}
            </span>
          )}
        </div>
        
        <div className="ticket-actions">
          {renderActionButtons()}
        </div>
      </div>
    </div>
  );
}

export default App;
