// Tự động detect repository
const GITHUB_REPO = window.location.hostname.split('.')[0];
const GITHUB_USERNAME = GITHUB_REPO;
const DATA_FILE_PATH = 'data.txt';

let data = [];
let githubToken = localStorage.getItem('githubToken');

// Load dữ liệu từ file TXT
async function loadData() {
    try {
        const response = await fetch(DATA_FILE_PATH + '?t=' + new Date().getTime());
        const text = await response.text();
        
        data = text.split('\n')
            .filter(line => line.trim() !== '')
            .map(line => {
                const parts = line.split('.');
                if (parts.length >= 3) {
                    return {
                        fullText: line.trim(),
                        ch: parts[0], // CH
                        bs: parts[1].split(',').map(bs => bs.trim()), // BS (có thể nhiều)
                        more: parts.slice(2).join('.') // More
                    };
                }
                return {
                    fullText: line.trim(),
                    ch: '',
                    bs: [],
                    more: line.trim()
                };
            });
        
        console.log('Đã load', data.length, 'dòng dữ liệu');
    } catch (error) {
        console.error('Lỗi khi load dữ liệu:', error);
        showMessage('Lỗi khi tải dữ liệu: ' + error.message, 'error');
    }
}

// Hàm tìm kiếm
function searchData() {
    const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
    const resultsContainer = document.getElementById('results');
    const noResults = document.getElementById('noResults');
    const resultCount = document.getElementById('resultCount');
    
    resultsContainer.innerHTML = '';
    
    if (searchTerm === '') {
        noResults.style.display = 'block';
        resultCount.textContent = '0 kết quả';
        return;
    }
    
    const filteredData = data.filter(item => {
        const searchInFullText = item.fullText.toLowerCase().includes(searchTerm);
        const searchInCH = item.ch.toLowerCase().includes(searchTerm);
        const searchInBS = item.bs.some(bs => bs.toLowerCase().includes(searchTerm));
        const searchInMore = item.more.toLowerCase().includes(searchTerm);
        
        return searchInFullText || searchInCH || searchInBS || searchInMore;
    });
    
    if (filteredData.length > 0) {
        filteredData.forEach(item => {
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';
            
            let highlightedText = highlightText(item.fullText, searchTerm);
            
            resultItem.innerHTML = `
                <div class="result-info">${highlightedText}</div>
                <div style="font-size: 12px; color: #666; margin-top: 5px;">
                    CH: ${item.ch} | BS: ${item.bs.join(', ')} | More: ${item.more}
                </div>
            `;
            
            resultsContainer.appendChild(resultItem);
        });
        
        noResults.style.display = 'none';
        resultCount.textContent = `${filteredData.length} kết quả`;
    } else {
        noResults.style.display = 'block';
        resultCount.textContent = '0 kết quả';
    }
}

// Hàm thêm dữ liệu mới với tính năng ghi đè
async function addNewData() {
    const ch = document.getElementById('newCode').value.trim();
    const bsInput = document.getElementById('newSubCode').value.trim();
    const more = document.getElementById('newName').value.trim();

    if (!ch || !bsInput || !more) {
        showMessage('Vui lòng điền đầy đủ thông tin', 'error');
        return;
    }

    if (!githubToken) {
        showTokenModal();
        return;
    }

    // Xử lý nhiều BS (tách bằng dấu phẩy)
    const bsArray = bsInput.split(',')
        .map(bs => bs.trim())
        .filter(bs => bs !== '');

    if (bsArray.length === 0) {
        showMessage('Vui lòng nhập ít nhất một BS', 'error');
        return;
    }

    const newEntry = `${ch}.${bsArray.join(',')}.${more}`;
    
    try {
        showMessage('Đang xử lý dữ liệu...', 'success');
        
        // Lấy thông tin file hiện tại
        const fileInfo = await getFileInfo();
        let currentContent = fileInfo.content;
        let lines = currentContent.split('\n').filter(line => line.trim() !== '');
        
        // Tìm và xóa các dòng có BS trùng
        const bsToCheck = bsArray.map(bs => bs.toLowerCase());
        lines = lines.filter(line => {
            const parts = line.split('.');
            if (parts.length >= 2) {
                const existingBS = parts[1].split(',').map(bs => bs.trim().toLowerCase());
                // Nếu có bất kỳ BS nào trùng, xóa dòng cũ
                return !existingBS.some(bs => bsToCheck.includes(bs));
            }
            return true;
        });
        
        // Thêm dòng mới
        lines.push(newEntry);
        const newContent = lines.join('\n');
        
        // Cập nhật file
        await updateFile(newContent, fileInfo.sha);
        
        const deletedCount = currentContent.split('\n').length - lines.length;
        let message = '✅ Đã thêm thông tin thành công!';
        if (deletedCount > 0) {
            message += ` Đã xóa ${deletedCount} dòng cũ có BS trùng.`;
        }
        
        showMessage(message, 'success');
        clearForm();
        
        // Load lại dữ liệu sau 3 giây
        setTimeout(() => {
            loadData();
            searchData();
        }, 3000);
        
    } catch (error) {
        console.error('Lỗi khi thêm dữ liệu:', error);
        showMessage('❌ Lỗi: ' + error.message, 'error');
    }
}

// Hàm lấy thông tin file
async function getFileInfo() {
    const response = await fetch(
        `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${DATA_FILE_PATH}`,
        {
            headers: {
                'Authorization': `token ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        }
    );

    if (!response.ok) {
        if (response.status === 404) {
            throw new Error('Không tìm thấy file data.txt trong repository');
        } else if (response.status === 401) {
            throw new Error('Token không hợp lệ hoặc hết hạn');
        } else {
            throw new Error(`Lỗi GitHub API: ${response.status}`);
        }
    }

    const fileData = await response.json();
    return {
        content: decodeBase64(fileData.content),
        sha: fileData.sha
    };
}

// Hàm cập nhật file
async function updateFile(content, sha) {
    const response = await fetch(
        `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${DATA_FILE_PATH}`,
        {
            method: 'PUT',
            headers: {
                'Authorization': `token ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Cập nhật dữ liệu: ${new Date().toLocaleString('vi-VN')}`,
                content: encodeBase64(content),
                sha: sha
            })
        }
    );

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Lỗi khi cập nhật file');
    }

    return true;
}

// Hàm giải mã base64
function decodeBase64(str) {
    try {
        return decodeURIComponent(escape(atob(str)));
    } catch (e) {
        return atob(str);
    }
}

// Hàm mã hóa base64
function encodeBase64(str) {
    try {
        return btoa(unescape(encodeURIComponent(str)));
    } catch (e) {
        return btoa(str);
    }
}

// Hàm highlight text
function highlightText(text, searchTerm) {
    const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Các hàm UI
function showTokenModal() {
    document.getElementById('tokenModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('tokenModal').style.display = 'none';
}

function saveToken() {
    const token = document.getElementById('githubToken').value.trim();
    if (token) {
        githubToken = token;
        localStorage.setItem('githubToken', token);
        closeModal();
        showMessage('✅ Đã lưu token thành công!', 'success');
    }
}

function showMessage(message, type) {
    const messageEl = document.getElementById('addMessage');
    messageEl.textContent = message;
    messageEl.className = `message ${type}`;
    
    setTimeout(() => {
        messageEl.style.display = 'none';
    }, 5000);
}

function clearForm() {
    document.getElementById('newCode').value = '';
    document.getElementById('newSubCode').value = '';
    document.getElementById('newName').value = '';
}

function refreshData() {
    loadData();
    showMessage('Đang làm mới dữ liệu...', 'success');
}

// Event listeners
document.getElementById('searchInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        searchData();
    }
});

let searchTimeout;
document.getElementById('searchInput').addEventListener('input', function(e) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(searchData, 300);
});

// Load dữ liệu khi trang được tải
window.addEventListener('DOMContentLoaded', loadData);
