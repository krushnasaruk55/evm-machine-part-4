// Initialize Socket.IO
const socket = io();

// Global state
let candidates = [];
let hasVoted = false;

// Load candidates on page load
document.addEventListener('DOMContentLoaded', () => {
    // Check for admin mode
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('admin') === 'true') {
        showAdminMode();
    } else {
        loadCandidates();
        checkLocalVoteStatus();
    }

    // Socket.IO listeners
    socket.on('candidates-updated', () => {
        loadCandidates();
        if (document.getElementById('admin-interface').classList.contains('active')) {
            loadAdminCandidates();
            loadResults();
        }
    });

    socket.on('vote-submitted', () => {
        loadResults();
        loadDetailedVotes();
        loadCandidates(); // Reload to update vote counts
    });
});

function checkLocalVoteStatus() {
    if (localStorage.getItem('hasVoted') === 'true') {
        hasVoted = true;
    }
}

function showAdminMode() {
    document.getElementById('voter-interface').classList.add('hidden');
    document.getElementById('admin-interface').classList.remove('hidden');
    document.getElementById('admin-interface').classList.add('active');
    loadCandidates();
    loadAdminCandidates();
    loadResults();
    loadDetailedVotes();
}

// Load Candidates
async function loadCandidates() {
    try {
        const response = await fetch('/api/candidates');
        candidates = await response.json();
        renderBallot();
        if (document.getElementById('admin-interface').classList.contains('active')) {
            loadAdminCandidates();
        }
    } catch (error) {
        console.error('Error loading candidates:', error);
    }
}

// Render Ballot
function renderBallot() {
    const tbody = document.getElementById('candidates-list');
    if (!tbody) return;

    if (candidates.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="padding: 40px; text-align: center; color: #6b7280;">
                    <p style="font-size: 1.2rem;">No candidates available yet.</p>
                    <p style="margin-top: 10px;">Please contact the admin to add candidates.</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = candidates.map((candidate, index) => `
        <tr id="candidate-row-${candidate.id}">
            <td>${index + 1}</td>
            <td>
                <div class="candidate-info">
                    <div class="candidate-details">
                        <div class="candidate-name">${escapeHtml(candidate.name)}</div>
                        ${candidate.description ? `<div class="candidate-party">${escapeHtml(candidate.description)}</div>` : ''}
                        <div class="vote-count-display" style="margin-top: 5px; font-weight: bold; color: #1e40af;">
                            Votes: ${candidate.vote_count || 0}
                        </div>
                    </div>
                </div>
            </td>
            <td>
                <div class="symbol-container">
                    ${renderSymbol(candidate.image_url)}
                </div>
            </td>
            <td>
                <button class="vote-btn" onclick="submitVote(${candidate.id})" ${hasVoted ? 'disabled' : ''}>
                    VOTE
                </button>
            </td>
        </tr>
    `).join('');
}

function renderSymbol(imageUrl) {
    if (!imageUrl) {
        return '<span class="symbol-emoji">📋</span>';
    }

    // Check if it's an emoji (single character or unicode)
    if (imageUrl.length <= 4 || /[\u{1F300}-\u{1F9FF}]/u.test(imageUrl)) {
        return `<span class="symbol-emoji">${imageUrl}</span>`;
    }

    // It's an image URL
    return `<img src="${escapeHtml(imageUrl)}" alt="Symbol" class="symbol-image" onerror="this.outerHTML='<span class=\\'symbol-emoji\\'>📋</span>'">`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Submit Vote
async function submitVote(candidateId) {
    if (hasVoted) {
        alert('You have already voted!');
        return;
    }

    if (!confirm('Are you sure you want to vote for this candidate? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch('/api/vote', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                candidateId: candidateId
            })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || 'Failed to submit vote');
            if (data.error && data.error.includes('already voted')) {
                hasVoted = true;
                localStorage.setItem('hasVoted', 'true');
                renderBallot();
            }
            return;
        }

        hasVoted = true;
        localStorage.setItem('hasVoted', 'true');

        // Highlight voted row
        document.getElementById(`candidate-row-${candidateId}`).classList.add('voted');

        // Disable all vote buttons
        document.querySelectorAll('.vote-btn').forEach(btn => {
            btn.disabled = true;
        });

        // Show confirmation
        document.getElementById('vote-confirmation').classList.remove('hidden');

    } catch (error) {
        console.error('Error submitting vote:', error);
        alert('Failed to submit vote. Please try again.');
    }
}

// Admin Functions

// Show Tab
function showTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    if (tabName === 'manage') {
        document.querySelector('.tab-btn:nth-child(1)').classList.add('active');
        document.getElementById('manage-tab').classList.add('active');
    } else if (tabName === 'results') {
        document.querySelector('.tab-btn:nth-child(2)').classList.add('active');
        document.getElementById('results-tab').classList.add('active');
        loadResults();
        loadDetailedVotes();
    }
}

// Load Admin Candidates
function loadAdminCandidates() {
    const container = document.getElementById('admin-candidates-list');
    if (!container) return;

    if (candidates.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 20px;">No candidates added yet.</p>';
        return;
    }

    container.innerHTML = candidates.map(candidate => `
        <div class="candidate-card">
            <div class="candidate-card-info">
                ${candidate.image_url && candidate.image_url.length > 4 && !/[\u{1F300}-\u{1F9FF}]/u.test(candidate.image_url)
            ? `<img src="${escapeHtml(candidate.image_url)}" alt="Symbol" class="candidate-card-symbol" onerror="this.outerHTML='<span class=\\'candidate-card-symbol emoji\\'>📋</span>'">`
            : `<span class="candidate-card-symbol emoji">${candidate.image_url || '📋'}</span>`
        }
                <div class="candidate-card-details">
                    <h4>${escapeHtml(candidate.name)}</h4>
                    ${candidate.description ? `<p>${escapeHtml(candidate.description)}</p>` : ''}
                    <p>Votes: ${candidate.vote_count || 0}</p>
                </div>
            </div>
            <div class="candidate-card-actions">
                <button class="icon-btn btn-primary" onclick="editCandidate(${candidate.id})">Edit</button>
                <button class="icon-btn btn-danger" onclick="deleteCandidate(${candidate.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

// Save Candidate
async function saveCandidate() {
    const id = document.getElementById('edit-candidate-id').value;
    const name = document.getElementById('candidate-name').value.trim();
    const description = document.getElementById('candidate-description').value.trim();
    const imageUrl = document.getElementById('candidate-image').value.trim();

    if (!name) {
        alert('Candidate name is required');
        return;
    }

    const candidateData = {
        name,
        description,
        image_url: imageUrl
    };

    try {
        const url = id ? `/api/candidates/${id}` : '/api/candidates';
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(candidateData)
        });

        if (!response.ok) {
            throw new Error('Failed to save candidate');
        }

        alert(id ? 'Candidate updated successfully!' : 'Candidate added successfully!');
        cancelEdit();
        loadCandidates();

    } catch (error) {
        console.error('Error saving candidate:', error);
        alert('Failed to save candidate. Please try again.');
    }
}

// Edit Candidate
function editCandidate(id) {
    const candidate = candidates.find(c => c.id === id);
    if (!candidate) return;

    document.getElementById('edit-candidate-id').value = candidate.id;
    document.getElementById('candidate-name').value = candidate.name;
    document.getElementById('candidate-description').value = candidate.description || '';
    document.getElementById('candidate-image').value = candidate.image_url || '';
    document.getElementById('save-btn-text').textContent = 'Update Candidate';

    // Scroll to form
    document.querySelector('.add-candidate-form').scrollIntoView({ behavior: 'smooth' });
}

// Cancel Edit
function cancelEdit() {
    document.getElementById('edit-candidate-id').value = '';
    document.getElementById('candidate-name').value = '';
    document.getElementById('candidate-description').value = '';
    document.getElementById('candidate-image').value = '';
    document.getElementById('save-btn-text').textContent = 'Add Candidate';
}

// Delete Candidate
async function deleteCandidate(id) {
    if (!confirm('Are you sure you want to delete this candidate? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch(`/api/candidates/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to delete candidate');
        }

        alert('Candidate deleted successfully!');
        loadCandidates();

    } catch (error) {
        console.error('Error deleting candidate:', error);
        alert('Failed to delete candidate. Please try again.');
    }
}

// Load Results
async function loadResults() {
    try {
        const response = await fetch('/api/results');
        const results = await response.json();

        const container = document.getElementById('results-chart');
        if (!container) return;

        const totalVotes = results.reduce((sum, r) => sum + r.vote_count, 0);

        if (totalVotes === 0) {
            container.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 20px;">No votes have been cast yet.</p>';
            return;
        }

        container.innerHTML = results.map(result => {
            const percentage = totalVotes > 0 ? (result.vote_count / totalVotes * 100).toFixed(1) : 0;
            return `
                <div class="result-bar">
                    <div class="result-header">
                        <span class="result-name">${escapeHtml(result.name)}</span>
                        <span class="result-count">${result.vote_count} votes</span>
                    </div>
                    <div class="result-progress">
                        <div class="result-fill" style="width: ${percentage}%">
                            ${percentage}%
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading results:', error);
    }
}

// Load Detailed Votes
async function loadDetailedVotes() {
    try {
        const response = await fetch('/api/votes/details');
        const votes = await response.json();

        const tbody = document.getElementById('detailed-votes-list');
        if (!tbody) return;

        if (votes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #6b7280; padding: 20px;">No votes recorded yet.</td></tr>';
            return;
        }

        tbody.innerHTML = votes.map(vote => `
            <tr>
                <td>${escapeHtml(vote.ip_address || 'Unknown')}</td>
                <td><strong>${escapeHtml(vote.candidate_name)}</strong></td>
                <td>${new Date(vote.timestamp).toLocaleString()}</td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error loading detailed votes:', error);
    }
}

// Export to Excel
async function exportToExcel() {
    try {
        const response = await fetch('/api/export/excel');

        if (!response.ok) {
            throw new Error('Failed to export data');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `voting_results_${new Date().getTime()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        alert('Excel file downloaded successfully!');

    } catch (error) {
        console.error('Error exporting to Excel:', error);
        alert('Failed to export data. Please try again.');
    }
}

// Share Results
async function shareResults() {
    try {
        const response = await fetch('/api/results');
        const results = await response.json();

        const totalVotes = results.reduce((sum, r) => sum + r.vote_count, 0);

        let message = '📊 *Voting Results*\\n\\n';
        message += `Total Votes: ${totalVotes}\\n\\n`;

        results.forEach((result, index) => {
            const percentage = totalVotes > 0 ? (result.vote_count / totalVotes * 100).toFixed(1) : 0;
            message += `${index + 1}. ${result.name}\\n`;
            message += `   Votes: ${result.vote_count} (${percentage}%)\\n\\n`;
        });

        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');

    } catch (error) {
        console.error('Error sharing results:', error);
        alert('Failed to share results. Please try again.');
    }
}
