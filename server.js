const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001; // Avoid 3000 as React uses it
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Allow large payloads for files
app.use(express.static(__dirname)); // Serve index.html

// Helper to read data
function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    return { users: [], assignments: [], submissions: [], attendance: {}, queries: [], results: [], notifications: [] };
  }
  const data = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(data);
}

// Helper to write data
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Add notification
function addNotification(data, userId, message, type) {
  if (!data.notifications) data.notifications = [];
  data.notifications.unshift({
    id: 'n' + Date.now() + Math.random().toString(36).substr(2, 5),
    userId,
    message,
    type, // 'info', 'success', 'warning'
    read: false,
    date: new Date().toISOString()
  });
}

// GET all data (for initial load)
app.get('/api/data', (req, res) => {
  res.json(readData());
});

// USERS
app.post('/api/users', (req, res) => {
  const data = readData();
  data.users.push(req.body);
  writeData(data);
  res.json({ success: true });
});

// ASSIGNMENTS
app.post('/api/assignments', (req, res) => {
  const data = readData();
  const assignment = req.body;
  data.assignments.push(assignment);

  // Notify all students
  const students = data.users.filter(u => u.role === 'student');
  students.forEach(s => {
    addNotification(data, s.id, `New Assignment Posted: ${assignment.title}`, 'info');
  });

  writeData(data);
  res.json({ success: true });
});

app.delete('/api/assignments/:id', (req, res) => {
  const data = readData();
  data.assignments = data.assignments.filter(a => a.id !== req.params.id);
  writeData(data);
  res.json({ success: true });
});

// SUBMISSIONS
app.post('/api/submissions', (req, res) => {
  const data = readData();
  const submission = req.body;
  const idx = data.submissions.findIndex(s => s.id === submission.id);
  if (idx >= 0) {
    data.submissions[idx] = submission;
  } else {
    data.submissions.push(submission);
  }
  writeData(data);
  res.json({ success: true });
});

// RESULTS
app.post('/api/results', (req, res) => {
  const data = readData();
  const result = req.body;
  const idx = data.results.findIndex(r => r.id === result.id);
  if (idx >= 0) {
    data.results[idx] = result;
  } else {
    data.results.push(result);
  }

  // Notify student
  const a = data.assignments.find(x => x.id === result.assignmentId);
  const title = a ? a.title : 'Assignment';
  addNotification(data, result.userId, `Your assignment '${title}' has been graded! Score: ${result.totalObtained}/${result.totalMax}`, 'success');

  writeData(data);
  res.json({ success: true });
});

// QUERIES
app.post('/api/queries', (req, res) => {
  const data = readData();
  const query = req.body;
  const idx = data.queries.findIndex(q => q.id === query.id);

  if (idx >= 0) {
    const oldQuery = data.queries[idx];
    data.queries[idx] = query;
    // Notify student if answered
    if (oldQuery.status !== 'answered' && query.status === 'answered') {
      addNotification(data, query.userId, `Your query "${query.subject}" has been answered!`, 'success');
    }
  } else {
    data.queries.push(query);
  }

  writeData(data);
  res.json({ success: true });
});

// ATTENDANCE
app.post('/api/attendance', (req, res) => {
  const data = readData();
  data.attendance = req.body;
  writeData(data);
  res.json({ success: true });
});

// INFO POSTS
app.post('/api/infoposts', (req, res) => {
  const data = readData();
  if (!data.infoPosts) data.infoPosts = [];
  const post = req.body;
  const idx = data.infoPosts.findIndex(p => p.id === post.id);
  if (idx >= 0) {
    data.infoPosts[idx] = post;
  } else {
    data.infoPosts.push(post);
  }
  writeData(data);
  res.json({ success: true });
});

app.post('/api/infoposts/delete', (req, res) => {
  const data = readData();
  if (data.infoPosts) {
    data.infoPosts = data.infoPosts.filter(p => p.id !== req.body.id);
  }
  writeData(data);
  res.json({ success: true });
});

// HOLIDAYS
app.post('/api/holidays', (req, res) => {
  const data = readData();
  if (!data.holidays) data.holidays = {};
  data.holidays[req.body.date] = req.body.name;
  writeData(data);
  res.json({ success: true });
});

app.post('/api/holidays/remove', (req, res) => {
  const data = readData();
  if (data.holidays) {
    delete data.holidays[req.body.date];
  }
  writeData(data);
  res.json({ success: true });
});

// NOTIFICATIONS
app.post('/api/notifications/read/:id', (req, res) => {
  const data = readData();
  const notif = data.notifications.find(n => n.id === req.params.id);
  if (notif) notif.read = true;
  writeData(data);
  res.json({ success: true });
});

app.post('/api/notifications/read-all/:userId', (req, res) => {
  const data = readData();
  data.notifications.filter(n => n.userId === req.params.userId).forEach(n => n.read = true);
  writeData(data);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
