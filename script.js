let data = [];

// Load dữ liệu từ file TXT
async function loadData() {
    try {
        const response = await fetch('data.txt');
        const text = await response.text();
        
        // Phân tích dữ liệu từ file TXT
        data = text.split('\n')
            .filter(line => line.trim() !== '')
            .map(line => {
                // Giả sử định dạng: C11708.38A-34868.Nguyễn Quang Thọ
                const parts = line.split('.');
                if (parts.length >= 3) {
                    return {
                        fullText: line.trim(),
                        code: parts[0], // C11708
                        subCode: parts[1], // 38A-34868
                        name: parts.slice(2).join('.') // Nguyễn Quang Thọ...
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
    }
}

// Hàm tìm kiếm
function searchData() {
    const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
    const resultsContainer = document.getElementById('results');
    const noResults = document.getElementById('noResults');
    const resultCount = document.getElementById('resultCount');
    
    // Xóa kết quả cũ
    resultsContainer.innerHTML = '';
    
    if (searchTerm === '') {
        noResults.style.display = 'block';
        resultCount.textContent = '0 kết quả';
        return;
    }
    
    // Tìm kiếm
    const filteredData = data.filter(item => {
        return item.fullText.toLowerCase().includes(searchTerm) ||
               item.code.toLowerCase().includes(searchTerm) ||
               item.subCode.toLowerCase().includes(searchTerm) ||
               item.name.toLowerCase().includes(searchTerm);
    });
    
    // Hiển thị kết quả
    if (filteredData.length > 0) {
        filteredData.forEach(item => {
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';
            
            // Highlight từ khóa tìm kiếm
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

// Hàm highlight từ khóa
function highlightText(text, searchTerm) {
    const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
}

// Escape ký tự đặc biệt trong regex
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Tìm kiếm khi nhấn Enter
document.getElementById('searchInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        searchData();
    }
});

// Tự động tìm kiếm khi gõ (có debounce)
let searchTimeout;
document.getElementById('searchInput').addEventListener('input', function(e) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(searchData, 300);
});

// Load dữ liệu khi trang được tải
window.addEventListener('DOMContentLoaded', loadData);
