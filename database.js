const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'freshers.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Ensure database file exists
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2), 'utf-8');
}

/**
 * Read all freshers from persistent JSON store
 */
function getAllFreshers() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error('Error reading freshers DB:', err);
    return [];
  }
}

/**
 * Save all freshers to persistent JSON store
 */
function saveAllFreshers(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error saving freshers DB:', err);
    return false;
  }
}

/**
 * Add a new fresher
 */
function addFresher(fresher) {
  const list = getAllFreshers();
  // Check if USN already registered
  const existingIndex = list.findIndex(
    item => item.usn && item.usn.trim().toUpperCase() === fresher.usn.trim().toUpperCase()
  );

  if (existingIndex !== -1) {
    // Update existing record
    list[existingIndex] = {
      ...list[existingIndex],
      ...fresher,
      updatedAt: new Date().toISOString()
    };
    saveAllFreshers(list);
    return { record: list[existingIndex], isUpdate: true };
  } else {
    // Append new fresher
    const newRecord = {
      ...fresher,
      createdAt: new Date().toISOString()
    };
    list.unshift(newRecord); // newest first
    saveAllFreshers(list);
    return { record: newRecord, isUpdate: false };
  }
}

/**
 * Delete a fresher by ID
 */
function deleteFresher(id) {
  const list = getAllFreshers();
  const filtered = list.filter(item => item.id !== id);
  saveAllFreshers(filtered);
  return filtered.length !== list.length;
}

/**
 * Clear all demo records
 */
function clearAllFreshers() {
  saveAllFreshers([]);
  return true;
}

/**
 * Get analytics/statistics
 */
function getStats() {
  const list = getAllFreshers();
  const interestCounts = {};
  
  list.forEach(item => {
    if (Array.isArray(item.interests)) {
      item.interests.forEach(interest => {
        const clean = interest.trim();
        if (clean) {
          interestCounts[clean] = (interestCounts[clean] || 0) + 1;
        }
      });
    }
  });

  // Sort interests by popularity
  const sortedInterests = Object.entries(interestCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalRegistered: list.length,
    interests: sortedInterests,
    recentCount: list.filter(item => {
      const time = new Date(item.createdAt).getTime();
      return Date.now() - time < 3600 * 1000; // last 1 hour
    }).length
  };
}

module.exports = {
  getAllFreshers,
  addFresher,
  deleteFresher,
  clearAllFreshers,
  getStats
};
