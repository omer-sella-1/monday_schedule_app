import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';

const EventModal = ({ isOpen, onClose, onSave, event, columns }) => {
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setStart(event.start ? formatDateTimeForInput(new Date(event.start)) : '');
      setEnd(event.end ? formatDateTimeForInput(new Date(event.end)) : '');
      setStatus(event.extendedProps?.status__1 || '');
    }
  }, [event]);

  const formatDateTimeForInput = (date) => {
    const offset = date.getTimezoneOffset();
    const adjustedDate = new Date(date.getTime() - (offset*60*1000));
    return adjustedDate.toISOString().slice(0, 16);
  };

  const handleSave = () => {
    onSave({
      id: event?.id,
      title,
      start,
      end,
      status__1: status
    });
  };

  const statusColumn = columns.find(col => col.id === 'status__1');
  const statusOptions = statusColumn?.options || [];

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
      <div className="form-group">
        <label>Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Select Status</option>
          {statusOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </div>
      <div className="button-group">
        <button onClick={handleSave}>Save</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
};

export default EventModal;