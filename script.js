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
                        bs: parts[1].split(' ').map(bs => bs.trim()).filter(bs => bs !== ''), // BS (cách nhau bằng dấu cách)
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
            
            // CHỈ HIỂN THỊ DÒNG DỮ LIỆU, KHÔNG HIỂN THỊ CHI TIẾT
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

// Hàm thêm dữ liệu mới với logic gộp CH và xóa BS trùng
async function addNewData() {
    let ch = document.getElementById('newCode').value.trim().toUpperCase();
    let bsInput = document.getElementById('newSubCode').value.trim().toUpperCase();
    let more = document.getElementById('newName').value.trim();

    if (!ch || !bsInput) {
        showMessage('Vui lòng điền đầy đủ CH và ít nhất một BS', 'error');
        return;
    }

    if (!githubToken) {
        showTokenModal();
        return;
    }

    // Xử lý nhiều BS (tách bằng dấu CÁCH)
    const bsArray = bsInput.split(' ')
        .map(bs => bs.trim())
        .filter(bs => bs !== '');

    if (bsArray.length === 0) {
        showMessage('Vui lòng nhập ít nhất một BS', 'error');
        return;
    }

    try {
        showMessage('Đang xử lý dữ liệu...', 'success');
        
        // Lấy thông tin file hiện tại
        const fileInfo = await getFileInfo();
        let currentContent = fileInfo.content;
        let lines = currentContent.split('\n').filter(line => line.trim() !== '');
        
        // Tìm các dòng cần xử lý
        let existingLineIndex = -1;
        let linesToRemove = [];
        const bsToCheck = bsArray.map(bs => bs.toLowerCase());
        
        // Tìm dòng có CH trùng
        lines.forEach((line, index) => {
            const parts = line.split('.');
            if (parts.length >= 2) {
                const existingCH = parts[0].toLowerCase();
                const existingBS = parts[1].split(' ').map(bs => bs.trim().toLowerCase()).filter(bs => bs !== '');
                
                // Nếu CH trùng
                if (existingCH === ch.toLowerCase()) {
                    existingLineIndex = index;
                }
                
                // Nếu có BS trùng (khác CH)
                const hasMatchingBS = existingBS.some(bs => bsToCheck.includes(bs));
                if (hasMatchingBS && existingCH !== ch.toLowerCase()) {
                    linesToRemove.push(index);
                }
            }
        });
        
        let newEntry = '';
        
        // Xử lý logic gộp dữ liệu
        if (existingLineIndex !== -1) {
            // Có CH trùng - gộp BS và More
            const existingLine = lines[existingLineIndex];
            const parts = existingLine.split('.');
            const existingBS = parts[1].split(' ').map(bs => bs.trim()).filter(bs => bs !== '');
            const existingMore = parts.slice(2).join('.');
            
            // Gộp BS (loại bỏ trùng lặp)
            const mergedBS = [...new Set([...existingBS, ...bsArray])];
            
            // Gộp More (nếu có)
            let mergedMore = existingMore;
            if (more && !existingMore.includes(more)) {
                mergedMore = existingMore ? `${existingMore} ${more}` : more;
            }
            
            newEntry = more ? `${ch}.${mergedBS.join(' ')}.${mergedMore}` : `${ch}.${mergedBS.join(' ')}`;
            lines[existingLineIndex] = newEntry;
            
        } else {
            // Không có CH trùng - tạo dòng mới
            newEntry = more ? `${ch}.${bsArray.join(' ')}.${more}` : `${ch}.${bsArray.join(' ')}`;
            lines.push(newEntry);
        }
        
        // Xóa các dòng có BS trùng (khác CH)
        if (linesToRemove.length > 0) {
            lines = lines.filter((line, index) => !linesToRemove.includes(index));
        }
        
        const newContent = lines.join('\n');
        
        // Cập nhật file
        await updateFile(newContent, fileInfo.sha);
        
        let message = '✅ Đã thêm thông tin thành công!';
        if (existingLineIndex !== -1) {
            message += ' Đã gộp với dữ liệu CH trùng.';
        }
        if (linesToRemove.length > 0) {
            message += ` Đã xóa ${linesToRemove.length} dòng có BS trùng.`;
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

// Auto uppercase cho input
document.getElementById('newCode').addEventListener('input', function(e) {
    this.value = this.value.toUpperCase();
});

document.getElementById('newSubCode').addEventListener('input', function(e) {
    this.value = this.value.toUpperCase();
});

// Load dữ liệu khi trang được tải
window.addEventListener('DOMContentLoaded', loadData);
