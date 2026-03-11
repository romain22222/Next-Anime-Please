function nextAnime() {
    chrome.bookmarks.getTree((tree) => {
        let lookedNode = null;
        for (const node of tree[0].children[0].children) {
            if (node.title === "animés à voir" && node.children) {
                lookedNode = node;
                break;
            }
        }
        if (!lookedNode) {
            return;
        }
        const firstAnime = lookedNode.children[0];
        const episodeNumber = parseInt(firstAnime.title.split(' ')[1].substring(2)) + 1;
        chrome.bookmarks.update(firstAnime.id, {
            title: firstAnime.title.split(' ')[0] + ' ep' + episodeNumber + ' ' + firstAnime.title.split(' ').slice(2).join(' '),
            url: newUrl(firstAnime, episodeNumber)
        }, () => {
            chrome.bookmarks.move(firstAnime.id, {
                parentId: lookedNode.id,
                index: lookedNode.children.length
            }, () => {
                // Open the new first anime in the current tab
                chrome.tabs.query({active: true, currentWindow: true}, () => {
                    chrome.tabs.create({url: lookedNode.children[1].url});
                });
            });
        });
    });
}

function newUrl(firstAnime, episodeNumber) {
    const animeUrl = firstAnime.url;
    if (animeUrl.includes('voiranime.com')
        || animeUrl.includes('otakufr.co')
        || animeUrl.includes('mavanimes.co')
        || animeUrl.includes('v3.voiranime.ws')
    ) {
        const animeUrlSplitted = animeUrl.split('-');
        return animeUrlSplitted.slice(0, animeUrlSplitted.length - 2).join('-') + '-' + (episodeNumber > 9 ? episodeNumber : '0' + episodeNumber) + '-' + animeUrlSplitted[animeUrlSplitted.length - 1];
    }
    if (animeUrl.includes('french-anime.com') || animeUrl.includes('anime-sama.fr')) {
        return animeUrl;
    }
    if (animeUrl.includes('vostanime.fr')) {
        const animeUrlSplitted = animeUrl.split('-');
        return animeUrlSplitted.slice(0, animeUrlSplitted.length - 3).join('-') + '-' + episodeNumber + '-' + animeUrlSplitted.slice(animeUrlSplitted.length - 2).join('-');
    }
    if (animeUrl.includes('v3.voiranime1.fr')) {
        const animeUrlSplitted = animeUrl.split('-');
        return animeUrlSplitted.slice(0, animeUrlSplitted.length - 1).join('-') + '-' + episodeNumber + '/';
    }
}

function addAnimeToList(title, url) {
    chrome.bookmarks.getTree((tree) => {
        let lookedNode = null;
        for (const node of tree[0].children[0].children) {
            if (node.title === "animés à voir" && node.children) {
                lookedNode = node;
                break;
            }
        }
        if (!lookedNode) {
            return;
        }
        chrome.bookmarks.create({
            parentId: lookedNode.id,
            title: title,
            url: url
        });
        // Move the new bookmark to the start of the list
        chrome.bookmarks.getChildren(lookedNode.id, (children) => {
            const newBookmark = children.find(child => child.title === title && child.url === url);
            if (newBookmark) {
                chrome.bookmarks.move(newBookmark.id, {
                    parentId: lookedNode.id,
                    index: 0
                });
            }
        });
    });
}

function levenshteinDistance(s, s2) {
    const d = [];
    const n = s.length;
    const m = s2.length;

    if (n === 0) return m;
    if (m === 0) return n;

    for (let i = 0; i <= n; i++) {
        d[i] = [i];
    }
    for (let j = 0; j <= m; j++) {
        d[0][j] = j;
    }

    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            const cost = s[i - 1] === s2[j - 1] ? 0 : 1;
            d[i][j] = Math.min(
                d[i - 1][j] + 1,      // deletion
                d[i][j - 1] + 1,      // insertion
                d[i - 1][j - 1] + cost // substitution
            );
        }
    }

    return d[n][m];
}

function findClosestFavoriteInEnAttente(romaji, english, callback) {
    chrome.bookmarks.getTree((tree) => {
        let lookedNode = null;
        for (const node of tree[0].children[0].children) {
            if (node.title === "en attente" && node.children) {
                lookedNode = node;
                break;
            }
        }
        if (!lookedNode) {
            callback(null);
            return;
        }
        let closestNode = null;
        let closestDistance = Infinity;
        for (const node of lookedNode.children) {
            const distance = levenshteinDistance(romaji.toLowerCase(), node.title.toLowerCase());
            if (distance < closestDistance) {
                closestDistance = distance;
                closestNode = node;
            }
        }
        for (const node of lookedNode.children) {
            const distance = levenshteinDistance(english.toLowerCase(), node.title.toLowerCase());
            if (distance < closestDistance) {
                closestDistance = distance;
                closestNode = node;
            }
        }
        console.log(closestNode);
        callback(closestNode);
    });
}

function checkTabName(callback) {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        console.log(tabs);
        const tab = tabs[0];
        if (!tab) {
            callback(false);
            return;
        }
        const title = tab.title;
        const match = title.startsWith('Regarder gratuitement ') && title.endsWith(' en HD- Voiranime')
        callback(match);
    });
}

const availableHostParts = [
    "myTV",
    "MOON",
    "VOE",
    "Stape",
    "FHD1"
];

function setAndSaveHostPart(hostPart) {
    // Save host part in chrome storage
    chrome.storage.sync.set({hostPart: hostPart}, () => {
        console.log('Host part saved:', hostPart);
    });
    // Update Animés à voir links to use new host part
    chrome.bookmarks.getTree((tree) => {
        let lookedNode = null;
        for (const node of tree[0].children[0].children) {
            if (node.title === "animés à voir" && node.children) {
                lookedNode = node;
                break;
            }
        }
        if (!lookedNode) {
            return;
        }
        for (const bookmark of lookedNode.children) {
            // Split url at "?host=" and replace the host part after it
            const urlParts = bookmark.url.split('?host=');
            const newUrl = urlParts[0] + "?host=LECTEUR%20" + hostPart;
            chrome.bookmarks.update(bookmark.id, {
                url: newUrl
            });
        }
    });
}

function getHostPart() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['hostPart'], (result) => {
            if (result.hostPart && availableHostParts.includes(result.hostPart)) {
                resolve(result.hostPart);
            } else {
                resolve(availableHostParts[0]);
            }
        });
    });
}

function makeHostPart() {
    return getHostPart().then((hostPart) => {
        return "?host=LECTEUR%20" + hostPart;
    });
}

function addCurrentTabAnimeToList() {
    // First check if page is the base anime page (not episode)
    // To do so, check if the name of the tab is of the form "Regarder gratuitement {anime name} en HD- Voiranime"
    if (!document) {
        return;
    }
    checkTabName((result) => {
        if (!result) {
            alert('Cette page ne semble pas être une page d\'anime valide.');
            return;
        }
        getCurrentTabUrlAndRomajiPlusEnglishNamesInsidePage((url, romajiName, englishName, tabName, firstEpUrl) => {
            const weekDays = ['Dimanche','Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
            findClosestFavoriteInEnAttente(romajiName, englishName, (closestNode) => {
                if (!closestNode) {
                    alert('Aucun anime similaire trouvé dans les favoris "en attente". Ajout annulé.');
                    return;
                }
                const closest = closestNode.title;
                const sheduledDayMonth = closest.split(' ')[0];
                const sheduledDay = parseInt(sheduledDayMonth.split('/')[0]);
                const sheduledMonth = parseInt(sheduledDayMonth.split('/')[1]) - 1;
                const weekDayOfSheduled = new Date(new Date().getFullYear(), sheduledMonth, sheduledDay).getDay();

                const realTitle = `${weekDays[weekDayOfSheduled]} ep1 ${englishName}`;
                makeHostPart().then((hostPart) => {
                    const realUrl = firstEpUrl + hostPart;
                    addAnimeToList(realTitle, realUrl);
                    // open both urls in new tabs
                    chrome.tabs.create({url: closestNode.url});
                    chrome.tabs.create({url: realUrl});
                })
            });
        });
    });
}

function getCurrentTabUrlAndRomajiPlusEnglishNamesInsidePage(callback) {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        const tab = tabs[0];
        if (!tab) {
            return;
        }
        const url = tab.url;
        chrome.scripting.executeScript({
            target: {tabId: tab.id},
            function: () => {
                // Theres a div of class post-content which contains a list of divs. Each of "post-content_item" class divs contains a "summary-heading" class and a "summary-content" class div.
                // You need to find the "summary-heading" div which contains an h5 div with either "Romaji" or "English" text. Then get the text of the corresponding "summary-content" div while removing the spaces around the text.
                const romajiHeading = Array.from(document.getElementsByClassName('summary-heading')).find(el => el.innerText.trim() === 'Romaji');
                const englishHeading = Array.from(document.getElementsByClassName('summary-heading')).find(el => el.innerText.trim() === 'English');
                const romajiName = romajiHeading ? romajiHeading.nextElementSibling.innerText.trim() : '';
                const englishName = englishHeading ? englishHeading.nextElementSibling.innerText.trim() : '';

                // Get the first episode url (which is the last episode of the list) from a ul of class "main version-chap no-volumn", each li having a "a" tag
                const episodeList = document.getElementsByClassName('main version-chap no-volumn');
                let firstEpisodeUrl = '';
                if (episodeList.length > 0) {
                    const firstEpisode = episodeList[0].getElementsByTagName('li');
                    if (firstEpisode.length > 0) {
                        const lastEpisodeLink = firstEpisode[firstEpisode.length - 1].getElementsByTagName('a');
                        if (lastEpisodeLink.length > 0) {
                            firstEpisodeUrl = lastEpisodeLink[0].href;
                        }
                    }
                }

                console.log({romajiName, englishName, tabName: document.title, firstEpisodeUrl});
                return {romajiName, englishName, tabName: document.title, firstEpisodeUrl};
            }
        }, (results) => {
            if (chrome.runtime.lastError || !results || results.length === 0) {
                callback(url, '', '');
                return;
            }
            const {romajiName, englishName, tabName, firstEpisodeUrl} = results[0].result;
            callback(url, romajiName, englishName, tabName, firstEpisodeUrl);
        });
    });
}

const folderName = "animés à voir";

function oopsiePreviousAnime() {
    chrome.bookmarks.getTree((tree) => {
        let lookedNode = null;
        for (const node of tree[0].children[0].children) {
            if (node.title === folderName && node.children) {
                lookedNode = node;
                break;
            }
        }
        if (!lookedNode || lookedNode.children.length < 2) {
            return;
        }
        const lastAnime = lookedNode.children[lookedNode.children.length - 1];
        const episodeNumber = parseInt(lastAnime.title.split(' ')[1].substring(2)) - 1;
        if (episodeNumber < 1) {
            return;
        }
        const nUrl = newUrl(lastAnime, episodeNumber);
        chrome.bookmarks.update(lastAnime.id, {
            title: lastAnime.title.split(' ')[0] + ' ep' + episodeNumber + ' ' + lastAnime.title.split(' ').slice(2).join(' '),
            url: nUrl
        }, () => {
            chrome.bookmarks.move(lastAnime.id, {
                parentId: lookedNode.id,
                index: 0
            }, () => {
                // Open the new first anime in the current tab
                chrome.tabs.query({active: true, currentWindow: true}, () => {
                    chrome.tabs.create({url: nUrl});
                });
            });
        });
    });
}

chrome.commands.onCommand.addListener((command) => {
    if (command === 'next-anime') {
        nextAnime();
    }
});
if (typeof document !== 'undefined') {
    // Populate the lecteurSelect select element with availableHostParts and set the selected option to the saved host part
    document.getElementById("lecteurSelect").innerHTML = availableHostParts.map(part => `<option value="${part}">${part}</option>`).join('');
    getHostPart().then((hostPart) => {
        document.getElementById("lecteurSelect").value = hostPart;
    });
    document.getElementById('nextAnime').addEventListener('click', nextAnime);
    document.getElementById('addAnime').addEventListener('click', addCurrentTabAnimeToList);
    document.getElementById('oopsiePreviousAnime').addEventListener('click', oopsiePreviousAnime);
    document.getElementById("lecteurSelect").addEventListener("change", (event) => {
        setAndSaveHostPart(event.target.value);
    });
}
