document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('search');
    let selectedIndex = -1;
    let allBookmarks = [];
    let allTabs = [];
    let searchResults = []; // 存储当前搜索结果

    function updateSelection() {
        const items = document.querySelectorAll('#results li');
        items.forEach(item => {
            item.classList.remove('selected');
            item.classList.remove('hover');  // 移除所有 hover 效果
        });

        if (selectedIndex >= 0 && items[selectedIndex]) {
            const selectedItem = searchResults[selectedIndex];
            items[selectedIndex].classList.add('selected');
            
            // 如果是已打开的标签页，添加 hover 效果
            if (selectedItem && selectedItem.type === 'tab') {
                items[selectedIndex].classList.add('hover');
            }
            
            items[selectedIndex].scrollIntoView({ block: 'nearest' });
        }
    }

    function openSelectedBookmark(useExistingTab = false) {
        const selected = document.querySelector('#results li.selected');
        if (selected) {
            const resultItem = searchResults[selectedIndex];
            if (useExistingTab) {
                // 左方向键：优先切换到已存在的标签页
                switchToOrOpenTab(resultItem.url, true);
            } else {
                // 回车键：直接新开标签页
                chrome.tabs.create({ url: resultItem.url });
                window.close();
            }
        }
    }

    // 修改切换标签页函数
    function switchToOrOpenTab(url, preferExisting = false) {
        chrome.tabs.query({}, function (tabs) {
            const existingTab = tabs.find(tab => tab.url === url);
            if (existingTab && preferExisting) {
                // 切换到已存在的标签页
                chrome.tabs.update(existingTab.id, { active: true });
                chrome.windows.update(existingTab.windowId, { focused: true });
                window.close();
            } else {
                // 创建新标签页
                chrome.tabs.create({ url: url });
                window.close();
            }
        });
    }

    // 修改显示函数以区分书签和标签页
    function displayResults(results) {
        const resultsList = document.getElementById('results');
        resultsList.innerHTML = '';
        selectedIndex = -1;
        searchResults = results;

        // 创建一个 Set 存储所有打开的标签页 URL，用于快速查找
        const openTabUrls = new Set(allTabs.map(tab => tab.url));

        results.forEach(function (item) {
            const li = document.createElement('li');
            
            // 添加favicon
            const favicon = document.createElement('img');
            favicon.className = 'favicon';
            
            // 如果是标签页或者是已打开的书签，使用插件图标
            if (item.type === 'tab' || openTabUrls.has(item.url)) {
                favicon.src = 'icons/icon16.png';
            } else {
                // 未打开的书签使用网站favicon
                favicon.src = `https://www.google.com/s2/favicons?domain=${new URL(item.url).hostname}`;
            }
            favicon.onerror = () => favicon.src = 'icons/icon16.png';
            li.appendChild(favicon);

            // 标题和URL
            const textSpan = document.createElement('span');
            textSpan.textContent = item.title;
            textSpan.title = item.url;
            li.appendChild(textSpan);

            // 修改右键菜单处理
            if (item.type === 'tab') {
                li.addEventListener('contextmenu', function (e) {
                    e.preventDefault();
                    // 更新选中状态
                    selectedIndex = Array.from(resultsList.children).indexOf(li);
                    updateSelection();
                    // 关闭标签页
                    chrome.tabs.remove(item.id, () => {
                        // 重新加载数据并保持搜索状态
                        const searchQuery = searchInput.value;
                        loadAllItems();
                        if (searchQuery) {
                            searchInput.value = searchQuery;
                            const filteredResults = [...allTabs, ...allBookmarks].filter(item =>
                                item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                item.url.toLowerCase().includes(searchQuery.toLowerCase())
                            );
                            displayResults(filteredResults);
                        }
                    });
                });
            }

            li.addEventListener('click', function () {
                switchToOrOpenTab(item.url, true);
            });
            resultsList.appendChild(li);
        });
    }

    // 加载所有书签和标签页
    function loadAllItems() {
        // 加载书签
        chrome.bookmarks.getTree(function (bookmarkTreeNodes) {
            function traverseBookmarks(nodes) {
                for (const node of nodes) {
                    if (node.children) {
                        traverseBookmarks(node.children);
                    } else if (node.url) {
                        allBookmarks.push({
                            ...node,
                            type: 'bookmark'
                        });
                    }
                }
            }
            traverseBookmarks(bookmarkTreeNodes);
            
            // 获取当前窗口的标签页
            chrome.windows.getCurrent({ populate: true }, function(window) {
                if (window.tabs) {
                    allTabs = window.tabs.map(tab => ({
                        title: tab.title,
                        url: tab.url,
                        type: 'tab',
                        id: tab.id,
                        index: tab.index,  // 添加标签页索引
                        favIconUrl: tab.favIconUrl
                    }));
                    
                    // 显示所有结果
                    displayResults([...allTabs, ...allBookmarks]);
                }
            });
        });
    }

    // 搜索功能
    searchInput.addEventListener('input', function () {
        const query = this.value.toLowerCase();
        if (!query) {
            displayResults([...allTabs, ...allBookmarks]);
        } else {
            const filteredResults = [...allTabs, ...allBookmarks].filter(item =>
                item.title.toLowerCase().includes(query) ||
                item.url.toLowerCase().includes(query)
            );
            displayResults(filteredResults);
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
                openSelectedBookmark(false); // 新开标签页
                break;

            case 'ArrowLeft':
                e.preventDefault();
                openSelectedBookmark(true); // 优先使用已存在的标签页
                break;

            case 'ArrowRight':
                e.preventDefault();
                const selected = searchResults[selectedIndex];
                if (selected && selected.type === 'tab') {
                    chrome.tabs.remove(selected.id, () => {
                        // 重新加载数据并保持搜索状态
                        const searchQuery = searchInput.value;
                        loadAllItems();
                        if (searchQuery) {
                            searchInput.value = searchQuery;
                            const filteredResults = [...allTabs, ...allBookmarks].filter(item =>
                                item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                item.url.toLowerCase().includes(searchQuery.toLowerCase())
                            );
                            displayResults(filteredResults);
                        }
                    });
                }
                break;
        }
    });

    // 初始化
    loadAllItems();
    searchInput.focus();
});