import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import './EventModal.css';

const EventModal = ({ isOpen, onClose, onSave, event, columns = [], users = [] }) => {
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [columnValues, setColumnValues] = useState({});

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setStart(event.start || '');
      setEnd(event.end || '');
      
      const newColumnValues = {};
      if (event.extendedProps && event.extendedProps.column_values) {
        event.extendedProps.column_values.forEach(cv => {
          newColumnValues[cv.id] = cv.value;
        });
      }
      setColumnValues(newColumnValues);
    } else {
      setTitle('');
      setStart('');
      setEnd('');
      setColumnValues({});
    }
  }, [event]);

  const handleSave = () => {
    const eventData = {
      id: event?.id,
      title,
      start,
      end,
      ...columnValues
    };
    onSave(eventData);
  };

  const handleColumnChange = (columnId, value) => {
    setColumnValues(prev => ({ ...prev, [columnId]: value }));
  };

  const renderColumnInput = (column) => {
    if (!column) return null;

    switch (column.type) {
      case 'text':
      case 'long-text':
        return (
          <input
            type="text"
            value={columnValues[column.id] || ''}
            onChange={(e) => handleColumnChange(column.id, e.target.value)}
            placeholder={column.title}
          />
        );
      case 'number':
        return (
          <input
            type="number"
            value={columnValues[column.id] || ''}
            onChange={(e) => handleColumnChange(column.id, e.target.value)}
            placeholder={column.title}
          />
        );
      case 'status':
      case 'color':
        return (
          <select
            value={columnValues[column.id] || ''}
            onChange={(e) => handleColumnChange(column.id, e.target.value)}
          >
            <option value="">Select {column.title}</option>
            {(column.labels || []).map((label, index) => (
              <option key={index} value={label.id}>{label.name}</option>
            ))}
          </select>
        );
      case 'date':
        return (
          <input
            type="date"
            value={columnValues[column.id] || ''}
            onChange={(e) => handleColumnChange(column.id, e.target.value)}
          />
        );
      case 'people':
        return (
          <select
            value={columnValues[column.id] || ''}
            onChange={(e) => handleColumnChange(column.id, e.target.value)}
          >
            <option value="">Select {column.title}</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>
        );
      default:
        return null;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Event Modal"
      className="modal-content"
      overlayClassName="modal-overlay"
    >
      <h2>{event?.id ? 'Edit Event' : 'Create Event'}</h2>
      <div className="form-group">
        <label>Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Event Title"
        />
      </div>
      <div className="form-group">
        <label>Start</label>
        <input
          type="datetime-local"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label>End</label>
        <input
          type="datetime-local"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </div>
      {columns.map(column => (
        <div key={column.id} className="form-group">
          <label>{column.title}</label>
          {renderColumnInput(column)}
        </div>
      ))}
      <div className="button-group">
        <button onClick={handleSave}>Save</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
};

export default EventModal;