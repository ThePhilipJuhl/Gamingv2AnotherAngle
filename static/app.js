const API_BASE = 'http://localhost:3006/api';

let currentUserId = null;
let currentGames = [];
let isDragging = false;
let isResizing = false;
let resizeType = null; // 'top', 'bottom', or null
let dragStartY = 0;
let currentBlock = null;
let selectedDay = null;

// Initialize time markers
function initializeTimeMarkers() {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    days.forEach(day => {
        const container = document.getElementById(`${day}-slots`);
        container.innerHTML = '';
        
        // Add time markers every 2 hours
        for (let hour = 0; hour < 24; hour += 2) {
            const marker = document.createElement('div');
            marker.className = 'time-marker';
            const top = (hour / 24) * 100;
            marker.style.top = `${top}%`;
            marker.textContent = `${hour.toString().padStart(2, '0')}:00`;
            container.appendChild(marker);
        }
    });
}

// Create user
async function createUser() {
    const userId = document.getElementById('userId').value;
    const userName = document.getElementById('userName').value;
    
    if (!userId) {
        showMessage('Please enter a user ID', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, name: userName || 'User' })
        });
        
        if (response.ok) {
            currentUserId = userId;
            showMessage('Profile created successfully!', 'success');
            loadAvailability();
            loadGames();
        } else {
            const error = await response.json();
            showMessage(error.error || 'Failed to create user', 'error');
        }
    } catch (error) {
        showMessage('Error connecting to server', 'error');
    }
}

// Connect Google Calendar
async function connectGoogleCalendar() {
    if (!currentUserId) {
        showMessage('Please create a profile first', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/google-calendar/auth`);
        const data = await response.json();
        
        if (data.auth_url) {
            // Open in new window and handle callback
            const authWindow = window.open(
                `${data.auth_url}&user_id=${currentUserId}`,
                'Google Calendar Auth',
                'width=500,height=600'
            );
            
            // Listen for callback (in production, use proper OAuth flow)
            window.addEventListener('message', (event) => {
                if (event.data.type === 'google-auth-success') {
                    showMessage('Google Calendar connected!', 'success');
                    authWindow.close();
                }
            });
        }
    } catch (error) {
        showMessage('Error connecting to Google Calendar', 'error');
    }
}

// Sync Google Calendar
async function syncGoogleCalendar() {
    if (!currentUserId) {
        showMessage('Please create a profile first', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/google-calendar/sync/${currentUserId}`, {
            method: 'POST'
        });
        
        if (response.ok) {
            const data = await response.json();
            showMessage('Calendar synced successfully!', 'success');
            loadAvailability();
        } else {
            const error = await response.json();
            showMessage(error.error || 'Failed to sync calendar', 'error');
        }
    } catch (error) {
        showMessage('Error syncing calendar', 'error');
    }
}

// Helper functions for 30-minute interval snapping
function snapTo30Minutes(hours) {
    // Convert hours to total minutes, snap to nearest 30, convert back
    const totalMinutes = hours * 60;
    const snappedMinutes = Math.round(totalMinutes / 30) * 30;
    return snappedMinutes / 60;
}

function percentToHours(percent) {
    return (percent / 100) * 24;
}

function hoursToPercent(hours) {
    return (hours / 24) * 100;
}

function snapPercentTo30Minutes(percent) {
    const hours = percentToHours(percent);
    const snappedHours = snapTo30Minutes(hours);
    return hoursToPercent(snappedHours);
}

// Add time block on click
function addTimeBlock(day, startPercent, endPercent) {
    const container = document.getElementById(`${day}-slots`);
    const block = document.createElement('div');
    block.className = 'time-block';
    
    // Snap to 30-minute intervals
    const snappedStartPercent = snapPercentTo30Minutes(startPercent);
    const snappedEndPercent = snapPercentTo30Minutes(endPercent);
    
    // Ensure minimum 30-minute duration
    const minDuration = hoursToPercent(0.5); // 30 minutes
    const finalEndPercent = Math.max(snappedEndPercent, snappedStartPercent + minDuration);
    
    const startHours = percentToHours(snappedStartPercent);
    const endHours = percentToHours(finalEndPercent);
    
    const startHour = Math.floor(startHours);
    const startMin = (startHours % 1) * 60;
    const endHour = Math.floor(endHours);
    const endMin = (endHours % 1) * 60;
    
    block.style.top = `${snappedStartPercent}%`;
    block.style.height = `${finalEndPercent - snappedStartPercent}%`;
    block.textContent = `${startHour.toString().padStart(2, '0')}:${Math.round(startMin).toString().padStart(2, '0')} - ${endHour.toString().padStart(2, '0')}:${Math.round(endMin).toString().padStart(2, '0')}`;
    
    block.dataset.day = day;
    block.dataset.startPercent = snappedStartPercent;
    block.dataset.endPercent = finalEndPercent;
    
    // Add resize handles
    const topHandle = document.createElement('div');
    topHandle.className = 'resize-handle resize-handle-top';
    topHandle.title = 'Drag to resize start time';
    
    const bottomHandle = document.createElement('div');
    bottomHandle.className = 'resize-handle resize-handle-bottom';
    bottomHandle.title = 'Drag to extend/shrink time block';
    
    block.appendChild(topHandle);
    block.appendChild(bottomHandle);
    
    // Make draggable and resizable
    makeBlockDraggable(block);
    makeBlockResizable(block);
    
    container.appendChild(block);
}

// Make time block draggable
function makeBlockDraggable(block) {
    block.addEventListener('mousedown', (e) => {
        // Don't start dragging if clicking on resize handles
        if (e.target.classList.contains('resize-handle')) {
            return;
        }
        isDragging = true;
        isResizing = false;
        currentBlock = block;
        selectedDay = block.dataset.day;
        dragStartY = e.clientY;
        block.classList.add('selected');
        e.preventDefault();
    });
}

// Make time block resizable
function makeBlockResizable(block) {
    const topHandle = block.querySelector('.resize-handle-top');
    const bottomHandle = block.querySelector('.resize-handle-bottom');
    
    topHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        isDragging = false;
        resizeType = 'top';
        currentBlock = block;
        selectedDay = block.dataset.day;
        dragStartY = e.clientY;
        block.classList.add('selected');
        e.preventDefault();
        e.stopPropagation();
    });
    
    bottomHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        isDragging = false;
        resizeType = 'bottom';
        currentBlock = block;
        selectedDay = block.dataset.day;
        dragStartY = e.clientY;
        block.classList.add('selected');
        e.preventDefault();
        e.stopPropagation();
    });
}

// Handle mouse move for dragging and resizing
document.addEventListener('mousemove', (e) => {
    if ((!isDragging && !isResizing) || !currentBlock) return;
    
    const container = document.getElementById(`${selectedDay}-slots`);
    const rect = container.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const percent = Math.max(0, Math.min(100, (y / rect.height) * 100));
    
    const originalStartPercent = parseFloat(currentBlock.dataset.startPercent);
    const originalEndPercent = parseFloat(currentBlock.dataset.endPercent);
    const originalHeight = originalEndPercent - originalStartPercent;
    
    const minDuration = hoursToPercent(0.5); // 30 minutes
    const maxDuration = hoursToPercent(4); // 4 hours max
    
    let newStartPercent = originalStartPercent;
    let newEndPercent = originalEndPercent;
    
    if (isResizing) {
        if (resizeType === 'top') {
            // Resizing from top - move start time
            const snappedPercent = snapPercentTo30Minutes(percent);
            newStartPercent = Math.max(0, Math.min(originalEndPercent - minDuration, snappedPercent));
            newEndPercent = originalEndPercent;
            
            // Ensure minimum duration
            if (newEndPercent - newStartPercent < minDuration) {
                newStartPercent = newEndPercent - minDuration;
            }
        } else if (resizeType === 'bottom') {
            // Resizing from bottom - extend/shrink end time
            const snappedPercent = snapPercentTo30Minutes(percent);
            newEndPercent = Math.min(100, Math.max(originalStartPercent + minDuration, snappedPercent));
            newStartPercent = originalStartPercent;
            
            // Ensure minimum duration
            if (newEndPercent - newStartPercent < minDuration) {
                newEndPercent = newStartPercent + minDuration;
            }
            
            // Ensure maximum duration (4 hours)
            if (newEndPercent - newStartPercent > maxDuration) {
                newEndPercent = newStartPercent + maxDuration;
            }
        }
    } else if (isDragging) {
        // Moving the whole block
        const snappedPercent = snapPercentTo30Minutes(percent);
        newStartPercent = Math.max(0, Math.min(100 - originalHeight, snappedPercent));
        newEndPercent = newStartPercent + originalHeight;
        
        // Ensure minimum duration
        if (newEndPercent - newStartPercent < minDuration) {
            newEndPercent = newStartPercent + minDuration;
        }
    }
    
    // Snap both to 30-minute intervals
    newStartPercent = snapPercentTo30Minutes(newStartPercent);
    newEndPercent = snapPercentTo30Minutes(newEndPercent);
    
    // Final validation
    const finalHeight = newEndPercent - newStartPercent;
    if (finalHeight < minDuration) {
        newEndPercent = newStartPercent + minDuration;
    }
    if (finalHeight > maxDuration) {
        newEndPercent = newStartPercent + maxDuration;
    }
    
    currentBlock.style.top = `${newStartPercent}%`;
    currentBlock.style.height = `${newEndPercent - newStartPercent}%`;
    currentBlock.dataset.startPercent = newStartPercent;
    currentBlock.dataset.endPercent = newEndPercent;
    
    updateBlockTime(currentBlock);
});

// Handle mouse up
document.addEventListener('mouseup', () => {
    if ((isDragging || isResizing) && currentBlock) {
        currentBlock.classList.remove('selected');
        isDragging = false;
        isResizing = false;
        resizeType = null;
        currentBlock = null;
        selectedDay = null;
    }
});

// Update block time display
function updateBlockTime(block) {
    const startPercent = parseFloat(block.dataset.startPercent);
    const endPercent = parseFloat(block.dataset.endPercent);
    
    const startHours = percentToHours(startPercent);
    const endHours = percentToHours(endPercent);
    
    const startHour = Math.floor(startHours);
    const startMin = Math.round((startHours % 1) * 60);
    const endHour = Math.floor(endHours);
    const endMin = Math.round((endHours % 1) * 60);
    
    block.textContent = `${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')} - ${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
}

// Click to add time block
document.querySelectorAll('.time-slots').forEach(container => {
    container.addEventListener('click', (e) => {
        if (e.target.classList.contains('time-slots') || e.target.classList.contains('time-marker')) {
            const rect = container.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const percent = (y / rect.height) * 100;
            
            const day = container.parentElement.dataset.day;
            // Snap clicked position to 30-minute interval, create 1-hour block by default
            const snappedPercent = snapPercentTo30Minutes(percent);
            const startPercent = Math.max(0, snappedPercent);
            const endPercent = Math.min(100, snappedPercent + hoursToPercent(1)); // Default 1 hour block
            
            addTimeBlock(day, startPercent, endPercent);
        }
    });
});

// Save availability
async function saveAvailability() {
    if (!currentUserId) {
        showMessage('Please create a profile first', 'error');
        return;
    }
    
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const slots = [];
    
    // Get current week dates
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);
    
    days.forEach((day, index) => {
        const dayDate = new Date(monday);
        dayDate.setDate(monday.getDate() + index);
        
        const blocks = document.querySelectorAll(`#${day}-slots .time-block`);
        blocks.forEach(block => {
            const startPercent = parseFloat(block.dataset.startPercent);
            const endPercent = parseFloat(block.dataset.endPercent);
            
            const startHours = percentToHours(startPercent);
            const endHours = percentToHours(endPercent);
            
            const startTime = new Date(dayDate);
            startTime.setHours(Math.floor(startHours), Math.round((startHours % 1) * 60), 0, 0);
            
            const endTime = new Date(dayDate);
            endTime.setHours(Math.floor(endHours), Math.round((endHours % 1) * 60), 0, 0);
            
            slots.push({
                start: startTime.toISOString(),
                end: endTime.toISOString()
            });
        });
    });
    
    try {
        const response = await fetch(`${API_BASE}/availability`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUserId, slots })
        });
        
        if (response.ok) {
            showMessage('Availability saved successfully!', 'success');
        } else {
            const error = await response.json();
            showMessage(error.error || 'Failed to save availability', 'error');
        }
    } catch (error) {
        showMessage('Error saving availability', 'error');
    }
}

// Load availability
async function loadAvailability() {
    if (!currentUserId) return;
    
    try {
        const response = await fetch(`${API_BASE}/availability/${currentUserId}`);
        if (response.ok) {
            const data = await response.json();
            displayAvailability(data.slots);
        }
    } catch (error) {
        console.error('Error loading availability:', error);
    }
}

// Display availability
function displayAvailability(slots) {
    // Clear existing blocks
    document.querySelectorAll('.time-block').forEach(block => block.remove());
    
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);
    
    slots.forEach(slot => {
        const startTime = new Date(slot.start);
        const endTime = new Date(slot.end);
        
        const dayIndex = Math.floor((startTime - monday) / (1000 * 60 * 60 * 24));
        if (dayIndex >= 0 && dayIndex < 7) {
            const day = days[dayIndex];
            
            // Convert to hours and snap to 30-minute intervals
            const startHour = startTime.getHours() + startTime.getMinutes() / 60;
            const endHour = endTime.getHours() + endTime.getMinutes() / 60;
            
            const snappedStartHour = snapTo30Minutes(startHour);
            const snappedEndHour = snapTo30Minutes(endHour);
            
            const startPercent = hoursToPercent(snappedStartHour);
            const endPercent = hoursToPercent(snappedEndHour);
            
            addTimeBlock(day, startPercent, endPercent);
        }
    });
}

// Add game
function addGame() {
    const input = document.getElementById('gameInput');
    const game = input.value.trim();
    
    if (game && !currentGames.includes(game)) {
        currentGames.push(game);
        displayGames();
        input.value = '';
    }
}

// Remove game
function removeGame(game) {
    currentGames = currentGames.filter(g => g !== game);
    displayGames();
}

// Display games
function displayGames() {
    const container = document.getElementById('gamesList');
    container.innerHTML = currentGames.map(game => `
        <div class="game-tag">
            ${game}
            <span class="remove" onclick="removeGame('${game}')">×</span>
        </div>
    `).join('');
}

// Save games
async function saveGames() {
    if (!currentUserId) {
        showMessage('Please create a profile first', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/games`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUserId, games: currentGames })
        });
        
        if (response.ok) {
            showMessage('Games saved successfully!', 'success');
        } else {
            const error = await response.json();
            showMessage(error.error || 'Failed to save games', 'error');
        }
    } catch (error) {
        showMessage('Error saving games', 'error');
    }
}

// Load games
async function loadGames() {
    if (!currentUserId) return;
    
    try {
        const response = await fetch(`${API_BASE}/games/${currentUserId}`);
        if (response.ok) {
            const data = await response.json();
            currentGames = data.games || [];
            displayGames();
        }
    } catch (error) {
        console.error('Error loading games:', error);
    }
}

// Search for another user's games
async function searchUserGames() {
    const searchUserId = document.getElementById('searchUserId').value.trim();
    const container = document.getElementById('searchedUserGames');
    
    if (!searchUserId) {
        showMessage('Please enter a user ID', 'error');
        return;
    }
    
    container.innerHTML = '<div class="message info">Loading...</div>';
    
    try {
        // First get user info
        const userResponse = await fetch(`${API_BASE}/users/${searchUserId}`);
        
        // Then get their games
        const gamesResponse = await fetch(`${API_BASE}/games/${searchUserId}`);
        
        if (gamesResponse.ok) {
            const gamesData = await gamesResponse.json();
            const games = gamesData.games || [];
            
            let userInfo = searchUserId;
            if (userResponse.ok) {
                const userData = await userResponse.json();
                userInfo = userData.name || searchUserId;
            }
            
            if (games.length === 0) {
                container.innerHTML = `
                    <div class="message info">
                        <strong>${userInfo}</strong> hasn't added any preferred games yet.
                    </div>
                `;
            } else {
                let html = `
                    <div class="searched-user-info">
                        <h4>🎮 ${userInfo}'s Preferred Games</h4>
                        <div class="searched-games-list">
                `;
                
                games.forEach(game => {
                    html += `
                        <div class="game-tag searched-game">
                            ${game}
                        </div>
                    `;
                });
                
                html += `
                        </div>
                    </div>
                `;
                
                container.innerHTML = html;
            }
        } else {
            const error = await gamesResponse.json();
            container.innerHTML = `
                <div class="message error">
                    ${error.error || 'User not found or has no games set'}
                </div>
            `;
        }
    } catch (error) {
        container.innerHTML = `
            <div class="message error">
                Error searching for user: ${error.message}
            </div>
        `;
    }
}

// Find slots
async function findSlots() {
    const friendId = document.getElementById('friendId').value;
    
    if (!currentUserId || !friendId) {
        showMessage('Please enter both your user ID and friend\'s user ID', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/find-slots`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user1_id: currentUserId, user2_id: friendId })
        });
        
        if (response.ok) {
            const data = await response.json();
            displayResults(data);
        } else {
            const error = await response.json();
            showMessage(error.error || 'Failed to find slots', 'error');
        }
    } catch (error) {
        showMessage('Error finding slots', 'error');
    }
}

// Display results
function displayResults(data) {
    const container = document.getElementById('results');
    
    if (!data.overlaps || data.overlaps.length === 0) {
        container.innerHTML = '<div class="message info">No overlapping time slots found. Try adjusting your availability!</div>';
        return;
    }
    
    let html = '<h3>Available Gaming Times</h3>';
    
    data.overlaps.forEach((slot, index) => {
        const startTime = new Date(slot.start);
        const endTime = new Date(slot.end);
        const isBest = index === 0;
        
        html += `
            <div class="result-card ${isBest ? 'best' : ''}">
                ${isBest ? '<h3>⭐ Best Match</h3>' : ''}
                <div class="time-info">
                    <strong>Time:</strong> ${startTime.toLocaleString()} - ${endTime.toLocaleString()}
                </div>
                <div class="time-info">
                    <strong>Duration:</strong> ${slot.duration.toFixed(1)} hours
                </div>
                ${data.suggested_game ? `<div class="game-info">🎮 Suggested Game: ${data.suggested_game}</div>` : ''}
                ${isBest ? `<button onclick="scheduleSession('${slot.start}', '${slot.end}', '${data.suggested_game || ''}')">Schedule This Time</button>` : ''}
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Schedule session
async function scheduleSession(start, end, game) {
    const friendId = document.getElementById('friendId').value;
    
    if (!currentUserId || !friendId) {
        showMessage('Missing user information', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/schedule-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user1_id: currentUserId,
                user2_id: friendId,
                slot: { start, end },
                game: game || null
            })
        });
        
        if (response.ok) {
            showMessage('Session scheduled! Check Discord for notification.', 'success');
        } else {
            const error = await response.json();
            showMessage(error.error || 'Failed to schedule session', 'error');
        }
    } catch (error) {
        showMessage('Error scheduling session', 'error');
    }
}

// Show message
function showMessage(text, type) {
    const container = document.querySelector('.container');
    const message = document.createElement('div');
    message.className = `message ${type}`;
    message.textContent = text;
    
    container.insertBefore(message, container.firstChild);
    
    setTimeout(() => {
        message.remove();
    }, 5000);
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    initializeTimeMarkers();
    
    // Add Enter key support for user search
    const searchInput = document.getElementById('searchUserId');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchUserGames();
            }
        });
    }
});

