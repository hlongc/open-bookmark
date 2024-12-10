document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('search');
    let selectedIndex = -1;
    let allBookmarks = [];

    function updateSelection() {
        const items = document.querySelectorAll('#results li');
        items.forEach(item => item.classList.remove('selected'));
        if (selectedIndex >= 0 && items[selectedIndex]) {
            items[selectedIndex].classList.add('selected');
            items[selectedIndex].scrollIntoView({ block: 'nearest' });
        }
    }

    function openSelectedBookmark() {
        const selected = document.querySelector('#results li.selected');
        if (selected) {
            switchToOrOpenTab(selected.title);
        } else {
            const firstResult = document.querySelector('#results li');
            if (firstResult) {
                switchToOrOpenTab(firstResult.title);
            }
        }
    }

    // 新增函数：切换到已存在的标签页或打开新标签页
    function switchToOrOpenTab(url) {
        chrome.tabs.query({}, function (tabs) {
            // 查找是否存在相同 URL 的标签页
            const existingTab = tabs.find(tab => tab.url === url);
            if (existingTab) {
                // 如果存在，切换到该标签页
                chrome.tabs.update(existingTab.id, { active: true });
                chrome.windows.update(existingTab.windowId, { focused: true });
            } else {
                // 如果不存在，创建新标签页
                chrome.tabs.create({ url: url });
            }
            // 关闭扩展弹窗
            window.close();
        });
    }

    // 修改点击事件处理
    function displayBookmarks(bookmarks) {
        const resultsList = document.getElementById('results');
        resultsList.innerHTML = '';
        selectedIndex = -1;

        bookmarks.forEach(function (bookmark) {
            if (bookmark.url) {
                const li = document.createElement('li');
                li.textContent = bookmark.title;
                li.title = bookmark.url;
                li.addEventListener('click', function () {
                    switchToOrOpenTab(bookmark.url);
                });
                resultsList.appendChild(li);
            }
        });
    }

    // 初始加载所有书签
    chrome.bookmarks.getTree(function (bookmarkTreeNodes) {
        function traverseBookmarks(nodes) {
            for (const node of nodes) {
                if (node.children) {
                    traverseBookmarks(node.children);
                } else if (node.url) {
                    allBookmarks.push(node);
                }
            }
        }
        traverseBookmarks(bookmarkTreeNodes);
        displayBookmarks(allBookmarks);
    });

    // 搜索功能
    searchInput.addEventListener('input', function () {
        const query = this.value.toLowerCase();
        if (!query) {
            displayBookmarks(allBookmarks);
        } else {
            const filteredBookmarks = allBookmarks.filter(bookmark =>
                bookmark.title.toLowerCase().includes(query) ||
                bookmark.url.toLowerCase().includes(query)
            );
            displayBookmarks(filteredBookmarks);
        }
    });

    // 处理键盘事件
    searchInput.addEventListener('keydown', function (e) {
        const items = document.querySelectorAll('#results li');
        const itemCount = items.length;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                selectedIndex = (selectedIndex + 1) % itemCount;
                updateSelection();
                break;

            case 'ArrowUp':
                e.preventDefault();
                selectedIndex = selectedIndex <= 0 ? itemCount - 1 : selectedIndex - 1;
                updateSelection();
                break;

            case 'Enter':
                e.preventDefault();
                openSelectedBookmark();
                break;
        }
    });

    // 设置焦点
    searchInput.focus();
});