document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('search');
    let selectedIndex = -1;
    let allBookmarks = [];
    let allTabs = [];
    let searchResults = [];

    // 添加标签页范围切换处理
    function loadTabs(callback) {
        const tabScope = document.querySelector('input[name="tabScope"]:checked').value;
        
        if (tabScope === 'current') {
            // 只加载当前窗口的标签页
            chrome.windows.getCurrent({ populate: true }, function(window) {
                if (window.tabs) {
                    allTabs = window.tabs.map(tab => ({
                        title: tab.title,
                        url: tab.url,
                        type: 'tab',
                        id: tab.id,
                        index: tab.index,
                        favIconUrl: tab.favIconUrl
                    }));
                    callback && callback();
                }
            });
        } else {
            // 加载所有窗口的标签页
            chrome.tabs.query({}, function(tabs) {
                allTabs = tabs.map(tab => ({
                    title: tab.title,
                    url: tab.url,
                    type: 'tab',
                    id: tab.id,
                    index: tab.index,
                    favIconUrl: tab.favIconUrl
                }));
                callback && callback();
            });
        }
    }

    // 修改加载所有项目的函数
    function loadAllItems() {
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
            
            // 加载标签页
            loadTabs(() => {
                displayResults([...allTabs, ...allBookmarks]);
            });
        });
    }

    // 修改标签页范围切换事件监听
    document.querySelectorAll('input[name="tabScope"]').forEach(radio => {
        radio.addEventListener('change', function() {
            allTabs = []; // 清空现有标签页
            selectedIndex = -1; // 重置选中状态
            loadTabs(() => {
                const query = searchInput.value.toLowerCase();
                if (!query) {
                    displayResults([...allTabs, ...allBookmarks]);
                } else {
                    const filteredResults = [...allTabs, ...allBookmarks].filter(item =>
                        item.title.toLowerCase().includes(query) ||
                        item.url.toLowerCase().includes(query)
                    );
                    displayResults(filteredResults);
                }
                // 重新设置焦点到搜索框
                searchInput.focus();
            });
        });
    });

    function updateSelection() {
        // 选择所有非分组标题的列表项
        const items = document.querySelectorAll('#results li:not(.group-header)');
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
        const tabScope = document.querySelector('input[name="tabScope"]:checked').value;
        
        if (tabScope === 'current') {
            // 只在当前窗口查找标签页
            chrome.windows.getCurrent({ populate: true }, function(window) {
                const existingTab = window.tabs.find(tab => tab.url === url);
                if (existingTab && preferExisting) {
                    // 切换到当前窗口的已存在标签页
                    chrome.tabs.update(existingTab.id, { active: true });
                    window.close();
                } else {
                    // 在当前窗口创建新标签页
                    chrome.tabs.create({ url: url });
                    window.close();
                }
            });
        } else {
            // 在所有窗口中查找标签页
            chrome.tabs.query({}, function (tabs) {
                const existingTab = tabs.find(tab => tab.url === url);
                if (existingTab && preferExisting) {
                    // 切换到任意窗口的已存在标签页
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
    }

    // 修改显示函数以支持分组显示
    function displayResults(results) {
        const resultsList = document.getElementById('results');
        resultsList.innerHTML = '';
        selectedIndex = -1;  // 重置选中状态
        searchResults = [];  // 清空搜索结果

        // 分离标签页和书签
        const tabs = results.filter(item => item.type === 'tab');
        const bookmarks = results.filter(item => item.type === 'bookmark');

        // 创建一个 Set 存储所有打开的标签页 URL
        const openTabUrls = new Set(allTabs.map(tab => tab.url));

        // 添加标签页分组
        if (tabs.length > 0) {
            // 添加分组标题
            const tabsHeader = document.createElement('li');
            tabsHeader.className = 'group-header';
            tabsHeader.textContent = '已打开的标签页';
            resultsList.appendChild(tabsHeader);

            // 添加标签页
            tabs.forEach(item => {
                const li = createListItem(item, openTabUrls);
                resultsList.appendChild(li);
                searchResults.push(item);  // 只添加实际的项目，不添加标题
            });
        }

        // 添加书签分组
        if (bookmarks.length > 0) {
            // 添加分组标题
            const bookmarksHeader = document.createElement('li');
            bookmarksHeader.className = 'group-header';
            bookmarksHeader.textContent = '书签';
            resultsList.appendChild(bookmarksHeader);

            // 添加书签
            bookmarks.forEach(item => {
                const li = createListItem(item, openTabUrls);
                resultsList.appendChild(li);
                searchResults.push(item);  // 只添加实际的项目，不添加标题
            });
        }

        // 如果有结果，选中第一项
        if (searchResults.length > 0) {
            selectedIndex = 0;
            updateSelection();
        }
    }

    // 抽取创建列表项的函数
    function createListItem(item, openTabUrls) {
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

        // 标签页的右键菜单处理
        if (item.type === 'tab') {
            li.addEventListener('contextmenu', function (e) {
                e.preventDefault();
                selectedIndex = searchResults.indexOf(item);
                updateSelection();
                chrome.tabs.remove(item.id, () => {
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

        return li;
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
        // 获取所有非分组标题的列表项
        const items = document.querySelectorAll('#results li:not(.group-header)');
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