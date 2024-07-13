import React, { useState, useEffect } from "react";
import "./App.css";
import mondaySdk from "monday-sdk-js";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import EventModal from './components/EventModal';
import Modal from 'react-modal';
import moment from 'moment';



Modal.setAppElement('#root');

const monday = mondaySdk();

const App = () => {
  const [context, setContext] = useState(null);
  const [events, setEvents] = useState([]);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [columns, setColumns] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    monday.listen("context", (res) => {
      setContext(res.data);
      if (res.data && res.data.boardIds && res.data.boardIds.length > 0) {
        fetchBoardItems(res.data.boardIds[0]);
        fetchBoardColumns(res.data.boardIds[0]);
        fetchUsers();
      } else {
        console.error("No board ID found in context");
      }
    });

    monday.listen("error", (error) => {
      console.error("Monday.com SDK error:", error);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchBoardItems = async (boardId) => {
    try {
      const query = `query {
        boards(ids: ${boardId}) {
          items_page {
            items {
              id
              name
              column_values {
                id
                text
                value
              }
            }
          }
        }
      }`;
  
      const response = await monday.api(query);
  
      if (response.data?.boards[0]?.items_page?.items) {
        const calendarEvents = convertToCalendarEvents(response.data.boards[0].items_page.items);
        setEvents(calendarEvents);
      } else {
        console.error("Unexpected response structure:", response);
      }
    } catch (error) {
      console.error("Error fetching board items:", error);
      if (error.errorMessage) {
        console.error("GraphQL error:", error.errorMessage);
      }
    }
  };

  const fetchUsers = async () => {
    try {
      const query = `query { users { id name } }`;
      const response = await monday.api(query);
      if (response.data?.users) {
        setUsers(response.data.users);
      } else {
        console.error("Unexpected response structure for users:", response);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchBoardColumns = async (boardId) => {
    try {
      const query = `query {
        boards(ids: ${boardId}) {
          columns {
            id
            title
            type
            settings_str
          }
        }
      }`;
  
      const response = await monday.api(query);
  
      if (response.data?.boards[0]?.columns) {
        const columnsWithSettings = response.data.boards[0].columns.map(column => {
          if (column.type === 'status' && column.settings_str) {
            try {
              const settings = JSON.parse(column.settings_str);
              if (settings.labels && typeof settings.labels === 'object') {
                const options = Object.entries(settings.labels).map(([id, name]) => ({
                  id,
                  name,
                  color: settings.labels_colors[id]?.color
                }));
                return { ...column, options };
              }
            } catch (error) {
              console.error("Error parsing status column settings:", error);
            }
          }
          return column;
        });
        
        console.log("Columns with settings:", columnsWithSettings);
        setColumns(columnsWithSettings);
      } else {
        console.error("Unexpected response structure for columns:", response);
      }
    } catch (error) {
      console.error("Error fetching board columns:", error);
    }
  };


  const convertToCalendarEvents = (items) => {
    return items.map(item => {
      const startDateColumn = item.column_values.find(col => col.id === "date4");
      const endDateColumn = item.column_values.find(col => col.id === "date__1");
      const statusColumn = item.column_values.find(col => col.id === "status__1");
      
      const parseDate = (dateValue) => {
        if (!dateValue) return null;
        try {
          const { date, time } = JSON.parse(dateValue);
          if (!date) return null;
          return moment.utc(`${date}T${time || '00:00:00'}`).local();
        } catch (error) {
          console.error("Error parsing date:", error);
          return null;
        }
      };
  
      const start = parseDate(startDateColumn?.value);
    const end = parseDate(endDateColumn?.value);

    if (start) {
      let status = null;
      let backgroundColor = null;
      let statusLabel = '';
      
      if (statusColumn && statusColumn.value) {
        try {
          status = JSON.parse(statusColumn.value);
          backgroundColor = status.color;
          statusLabel = statusColumn.text || '';
        } catch (error) {
          console.error("Error parsing status:", error);
        }
      }

      return {
        id: item.id,
        title: item.name,
        start: start.toDate(),
        end: end ? end.toDate() : start.toDate(),
        allDay: !startDateColumn.value.includes('time'),
        extendedProps: {
          column_values: item.column_values,
          status: status,
          statusLabel: statusLabel
        },
        backgroundColor: backgroundColor
      };
    }
    return null;
  }).filter(event => event !== null);
};
  const handleDateSelect = (selectInfo) => {
    const startDate = selectInfo.startStr;
    const endDate = selectInfo.endStr;
    setSelectedEvent({
      start: startDate,
      end: endDate,
      title: ''
    });
    setModalIsOpen(true);
  };

  const handleEventClick = (clickInfo) => {
    const event = clickInfo.event;
    setSelectedEvent({
      id: event.id,
      title: event.title,
      start: event.startStr,
      end: event.endStr,
      extendedProps: event.extendedProps
    });
    setModalIsOpen(true);
  };

  const handleEventDrop = async (dropInfo) => {
    await updateMondayItem({
      id: dropInfo.event.id,
      start: dropInfo.event.startStr,
      end: dropInfo.event.endStr,
      boardId: context.boardIds[0]
    });
  };
  
  const handleEventResize = async (resizeInfo) => {
    await updateMondayItem({
      id: resizeInfo.event.id,
      start: resizeInfo.event.startStr,
      end: resizeInfo.event.endStr,
      boardId: context.boardIds[0]
    });
  };


  const updateMondayItem = async (event) => {
    try {
      const formatDate = (dateString) => {
        // Convert local time to UTC
        const date = moment(dateString).utc();
        return {
          date: date.format('YYYY-MM-DD'),
          time: date.format('HH:mm:ss')
        };
      };
  
      const columnValues = {
        date4: formatDate(event.start),
        date__1: formatDate(event.end)
      };
  
      const mutation = `mutation {
        change_multiple_column_values (
          item_id: ${event.id},
          board_id: ${event.boardId},
          column_values: ${JSON.stringify(JSON.stringify(columnValues))}
        ) {
          id
        }
      }`;
  
      console.log("Mutation:", mutation);
  
      const response = await monday.api(mutation);
  
      if (response.data?.change_multiple_column_values?.id) {
        console.log("Item updated successfully:", response.data.change_multiple_column_values.id);
        await fetchBoardItems(event.boardId);
      } else {
        console.error("Failed to update item:", response);
        if (response.errors) {
          response.errors.forEach(error => {
            console.error("GraphQL error:", error.message);
          });
        }
      }
    } catch (error) {
      console.error("Error updating Monday item:", error);
      if (error.data && error.data.errors) {
        error.data.errors.forEach(err => console.error("GraphQL error:", err.message));
      }
    }
  };


  const handleEventSave = async (eventData) => {
    const formatDateForMonday = (dateString) => {
      // Convert local time to UTC
      const date = moment(dateString).utc();
      return {
        date: date.format('YYYY-MM-DD'),
        time: date.format('HH:mm:ss')
      };
    };
  
    const columnValues = {
      name: eventData.title,
      date4: formatDateForMonday(eventData.start),
      date__1: formatDateForMonday(eventData.end),
      status__1: eventData.status ? { index: parseInt(eventData.status) } : null
    };
  
    const mutation = eventData.id
      ? `mutation {
          change_multiple_column_values (
            item_id: ${eventData.id},
            board_id: ${context.boardIds[0]},
            column_values: ${JSON.stringify(JSON.stringify(columnValues))}
          ) {
            id
          }
        }`
      : `mutation {
          create_item (
            board_id: ${context.boardIds[0]},
            item_name: ${JSON.stringify(eventData.title)},
            column_values: ${JSON.stringify(JSON.stringify(columnValues))}
          ) {
            id
          }
        }`;
  
    try {
      const response = await monday.api(mutation);
      if (response.data?.change_multiple_column_values?.id || response.data?.create_item?.id) {
        console.log(eventData.id ? "Item updated successfully" : "New item created successfully");
        await fetchBoardItems(context.boardIds[0]);
      } else {
        console.error("Failed to update/create item:", response);
      }
    } catch (error) {
      console.error("Error updating/creating Monday item:", error);
      if (error.data && error.data.errors) {
        error.data.errors.forEach(err => console.error("GraphQL error:", err.message));
      }
    }
    
    setModalIsOpen(false);
  };

  const renderEventContent = (eventInfo) => {
    return (
      <div style={{ lineHeight: '1.2', overflow: 'hidden' }}>
        <div>{eventInfo.timeText}</div>
        <div style={{ fontWeight: 'bold' }}>{eventInfo.event.title}</div>
        {eventInfo.event.extendedProps.statusLabel && (
          <div style={{ fontSize: '0.8em', opacity: 0.7 }}>
            {eventInfo.event.extendedProps.statusLabel}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="App">
      <div className="calendar-container">
      <FullCalendar
  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
  initialView="dayGridMonth"
  headerToolbar={{
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,timeGridDay'
  }}
  events={events}
  editable={true}
  selectable={true}
  select={handleDateSelect}
  eventClick={handleEventClick}
  eventDrop={handleEventDrop}
  eventResize={handleEventResize}
  height="100%"
  timeZone="local"
  eventContent={renderEventContent}
  eventDisplay="block"
  eventMinHeight={40}
/>
      </div>
      <EventModal
        isOpen={modalIsOpen}
        onClose={() => setModalIsOpen(false)}
        onSave={handleEventSave}
        event={selectedEvent}
        columns={columns}
      />
    </div>
  );
};

export default App;
