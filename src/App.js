import React, { useState, useEffect } from "react";
import "./App.css";
import mondaySdk from "monday-sdk-js";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import EventModal from './components/EventModal';
import Modal from 'react-modal';



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
          if (column.type === 'color' || column.type === 'dropdown') {
            const settings = JSON.parse(column.settings_str);
            return {
              ...column,
              options: settings.labels
            };
          }
          return column;
        });
        setColumns(columnsWithSettings);
      } else {
        console.error("Unexpected response structure for columns:", response);
      }
    } catch (error) {
      console.error("Error fetching board columns:", error);
      if (error.errorMessage) {
        console.error("GraphQL error in fetchBoardColumns:", error.errorMessage);
      }
    }
  };

  const convertToCalendarEvents = (items) => {
    return items.map(item => {
      const startDateColumn = item.column_values.find(col => col.id === "date4");
      const endDateColumn = item.column_values.find(col => col.id === "date__1");
      
      const parseDate = (dateValue) => {
        if (!dateValue) return null;
        try {
          const { date, time } = JSON.parse(dateValue);
          if (!date) return null;
          // Create date in local timezone (Israel/Jerusalem)
          const dateTime = new Date(`${date}T${time || '00:00:00'}`);
          if (isNaN(dateTime.getTime())) return null;
          return dateTime;
        } catch (error) {
          console.error("Error parsing date:", error);
          return null;
        }
      };
  
      const start = parseDate(startDateColumn?.value);
      const end = parseDate(endDateColumn?.value);
  
      if (start) {
        return {
          id: item.id,
          title: item.name,
          start: start,
          end: end || start,
          allDay: !startDateColumn.value.includes('time'),
          extendedProps: {
            column_values: item.column_values
          }
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
      const formatDate = (dateObj) => {
        const date = dateObj.toISOString().split('T')[0];
        const time = dateObj.toTimeString().split(' ')[0];
        return { date, time };
      };
  
      const startDate = new Date(event.start);
      const endDate = new Date(event.end);
      
      const columnValues = {
        date4: formatDate(startDate),
        date__1: formatDate(endDate)
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
  
      console.log("Mutation:", mutation); // Log the mutation for debugging
  
      const response = await monday.api(mutation);
      console.log("API Response:", response); // Log the full response
  
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
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return {
        date: date.toISOString().split('T')[0],
        time: date.toTimeString().split(' ')[0]
      };
    };
  
    const columnValues = {
      date4: formatDate(eventData.start),
      date__1: formatDate(eventData.end)
    };
  
    // Add other column values here if needed
    columns.forEach(column => {
      if (eventData[column.id] && column.type !== 'date') {
        columnValues[column.id] = eventData[column.id];
      }
    });
  
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
      console.log("API Response:", response);
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
        />
      </div>
      <EventModal
        isOpen={modalIsOpen}
        onClose={() => setModalIsOpen(false)}
        onSave={handleEventSave}
        event={selectedEvent}
        columns={columns}
        users={users}
      />
    </div>
  );
};

export default App;