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
      console.log("API Response:", JSON.stringify(response, null, 2));
  
      if (response.data?.boards[0]?.items_page?.items) {
        const calendarEvents = convertToCalendarEvents(response.data.boards[0].items_page.items);
        console.log("Calendar events:", JSON.stringify(calendarEvents, null, 2));
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
          if (column.type === 'status' || column.type === 'color') {
            const settings = JSON.parse(column.settings_str);
            return {
              ...column,
              options: settings.labels.map(label => ({
                id: label.id,
                name: label.name
              }))
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
    }
  };

  const convertToCalendarEvents = (items) => {
    console.log("Raw items:", JSON.stringify(items, null, 2));
    
    return items.map(item => {
      console.log("Processing item:", item.id);
      const startDateColumn = item.column_values.find(col => col.id === "date4");
      const endDateColumn = item.column_values.find(col => col.id === "date__1");
      
      console.log("Start date column:", startDateColumn);
      console.log("End date column:", endDateColumn);
  
      const parseDate = (dateValue) => {
        if (!dateValue) {
          console.log("No date value provided");
          return null;
        }
        try {
          console.log("Parsing date value:", dateValue);
          const { date, time } = JSON.parse(dateValue);
          if (!date) {
            console.log("No date in parsed value");
            return null;
          }
          // Create date in UTC
          const dateTime = new Date(`${date}T${time || '00:00:00'}Z`);
          if (isNaN(dateTime.getTime())) {
            console.log("Invalid date time");
            return null;
          }
          // Add 3 hours to match Monday.com display
          dateTime.setHours(dateTime.getHours());
          console.log("Adjusted date time:", dateTime);
          return dateTime;
        } catch (error) {
          console.error("Error parsing date:", error);
          return null;
        }
      };
  
      const start = parseDate(startDateColumn?.value);
      const end = parseDate(endDateColumn?.value);
  
      console.log("Parsed start:", start);
      console.log("Parsed end:", end);
  
      if (start) {
        const event = {
          id: item.id,
          title: item.name,
          start: start,
          end: end || start,
          allDay: !startDateColumn.value.includes('time'),
          extendedProps: {
            column_values: item.column_values
          }
        };
        console.log("Created event:", event);
        return event;
      }
      console.log("Skipping item due to invalid start date");
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
        // Subtract 3 hours to align with Monday.com time
        const adjustedDate = new Date(dateObj.getTime() - (3 * 60 * 60 * 1000));
        return {
          date: adjustedDate.toISOString().split('T')[0],
          time: adjustedDate.toTimeString().split(' ')[0]
        };
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
  
      console.log("Mutation:", mutation);
  
      const response = await monday.api(mutation);
      console.log("API Response:", response);
  
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
      const date = new Date(dateString);
      return {
        date: date.toISOString().split('T')[0],
        time: date.toTimeString().split(' ')[0]
      };
    };
  
    const columnValues = {
      date4: formatDateForMonday(eventData.start),
      date__1: formatDateForMonday(eventData.end),
      status__1: { index: parseInt(eventData.status__1) }
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
      />
    </div>
  );
};

export default App;
