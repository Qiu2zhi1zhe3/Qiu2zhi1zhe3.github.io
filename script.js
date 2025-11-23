// Thêm các biến toàn cục
const GITHUB_USERNAME = 'qiu2zhi1zhe3'; // Thay bằng username GitHub của bạn
const GITHUB_REPO = 'qiu2zhi1zhe3.github.io'; // Thay bằng tên repository
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
                        code: parts[0],
                        subCode: parts[1],
                        name: parts.slice(2).join('.')
                    };
                }
                return {
                    fullText: line.trim(),
                    code: '',
                    subCode: '',
                    name: line.trim()
                };
            });
        
        console.log('Đã load', data.length, 'dòng dữ liệu');
    } catch (error) {
        console.error('Lỗi khi load dữ liệu:', error);
        showMessage('Lỗi khi tải dữ liệu: ' + error.message, 'error');
    }
}

// Hàm thêm dữ liệu mới
async function addNewData() {
    const code = document.getElementById('newCode').value.trim();
    const subCode = document.getElementById('newSubCode').value.trim();
    const name = document.getElementById('newName').value.trim();

    if (!code || !subCode || !name) {
        showMessage('Vui lòng điền đầy đủ thông tin', 'error');
        return;
    }

    // Kiểm tra token
    if (!githubToken) {
        showTokenModal();
        return;
    }

    const newEntry = `${code}.${subCode}.${name}`;
    
    try {
        // Lấy thông tin file hiện tại
        const fileInfo = await getFileInfo();
        
        // Thêm dòng mới vào nội dung
        const newContent = fileInfo.content + '\n' + newEntry;
        
        // Cập nhật file
        const result = await updateFile(newContent, fileInfo.sha);
        
        if (result) {
            showMessage('Đã thêm thông tin thành công!', 'success');
            clearForm();
            // Load lại dữ liệu sau 2 giây
            setTimeout(loadData, 2000);
        }
    } catch (error) {
        console.error('Lỗi khi thêm dữ liệu:', error);
        showMessage('Lỗi: ' + error.message, 'error');
    }
}

// Lấy thông tin file từ GitHub
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
        throw new Error('Không thể lấy thông tin file');
    }

    const fileData = await response.json();
    return {
        content: atob(fileData.content), // Giải mã base64
        sha: fileData.sha
    };
}

// Cập nhật file trên GitHub
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
                message: `Thêm dữ liệu mới: ${new Date().toLocaleString('vi-VN')}`,
                content: btoa(unescape(encodeURIComponent(content))), // Mã hóa base64
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

// Các hàm hỗ trợ
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
        showMessage('Đã lưu token thành công!', 'success');
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

// Giữ nguyên các hàm tìm kiếm hiện có (searchData, highlightText, etc.)
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
        return item.fullText.toLowerCase().includes(searchTerm) ||
               item.code.toLowerCase().includes(searchTerm) ||
               item.subCode.toLowerCase().includes(searchTerm) ||
               item.name.toLowerCase().includes(searchTerm);
    });
    
    if (filteredData.length > 0) {
        filteredData.forEach(item => {
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';
            
            let highlightedText = highlightText(item.fullText, searchTerm);
            
            resultItem.innerHTML = `
                <div class="result-info">${highlightedText}</div>
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

function highlightText(text, searchTerm) {
    const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Giữ nguyên các event listeners hiện có
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

window.addEventListener('DOMContentLoaded', loadData);
