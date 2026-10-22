const fs = require('fs');
const path = require('path');

// Detect if running on Vercel / AWS Lambda serverless environment
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);

// On Vercel, ONLY /tmp is writable; locally, use ./data
const DATA_DIR = isServerless ? '/tmp' : path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'freshers.json');

// In-memory fallback cache
let inMemoryList = [];

// Safely ensure directory and database file exist
function initStorage() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
  } catch (err) {
    console.warn('[Storage] Filesystem notice (using in-memory store):', err.message);
  }
}

// Initialize safely
initStorage();

/**
 * Read all freshers from persistent JSON store or in-memory fallback
 */
function getAllFreshers() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const list = JSON.parse(raw || '[]');
      if (Array.isArray(list) && list.length >= inMemoryList.length) {
        inMemoryList = list;
        return list;
      }
    }
  } catch (err) {
    console.warn('[Storage] Read error, returning in-memory:', err.message);
  }
  return inMemoryList;
}

/**
 * Save all freshers to persistent JSON store
 */
function saveAllFreshers(data) {
  inMemoryList = data;
  try {
    initStorage();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.warn('[Storage] Write error, saved to in-memory:', err.message);
    return true; // Still successful in memory
  }
}

/**
 * Add a new fresher
 */
function addFresher(fresher) {
  const list = getAllFreshers();
  const existingIndex = list.findIndex(
    item => item.usn && item.usn.trim().toUpperCase() === fresher.usn.trim().toUpperCase()
  );

  if (existingIndex !== -1) {
    list[existingIndex] = {
      ...list[existingIndex],
      ...fresher,
      updatedAt: new Date().toISOString()
    };
    saveAllFreshers(list);
    return { record: list[existingIndex], isUpdate: true };
  } else {
    const newRecord = {
      ...fresher,
      createdAt: new Date().toISOString()
    };
    list.unshift(newRecord);
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
        const clean = interest ? interest.trim() : '';
        if (clean) {
          interestCounts[clean] = (interestCounts[clean] || 0) + 1;
        }
      });
    }
  });

  const sortedInterests = Object.entries(interestCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalRegistered: list.length,
    interests: sortedInterests,
    recentCount: list.filter(item => {
      const time = new Date(item.createdAt).getTime();
      return Date.now() - time < 3600 * 1000;
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
